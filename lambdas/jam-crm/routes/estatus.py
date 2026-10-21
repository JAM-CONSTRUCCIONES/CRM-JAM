import json
import boto3
import os
import time
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, created, bad_request, not_found, conflict
from utils.auth import get_sub, get_nombre

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')
scheduler_client = boto3.client('scheduler')

clientes_table = dynamodb.Table(os.environ['CLIENTES_TABLE'])
procesos_table = dynamodb.Table(os.environ['PROCESOS_TABLE'])
inventario_table = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
HISTORIAL_TABLE = os.environ.get('HISTORIAL_TABLE', '')
historial_table = dynamodb.Table(HISTORIAL_TABLE) if HISTORIAL_TABLE else None
SQS_URL = os.environ['SQS_URL']
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')
CRM_LAMBDA_ARN = os.environ.get('CRM_LAMBDA_ARN', '')
BLOQUEOS_LAMBDA_ARN = os.environ.get('BLOQUEOS_LAMBDA_ARN', '')

DIAS_RESERVA = 30
HORAS_BLOQUEO = 48
HORAS_ALERTA_BLOQUEO = 43

TRANSICIONES = {
    'captacion':       ['reserva'],
    'reserva':         ['separacion', 'pagos_atrasados', 'desvinculado', 'captacion'],
    'pagos_atrasados': ['separacion', 'desvinculado', 'reserva'],
    'separacion':      ['inicial', 'desvinculado', 'pagos_atrasados'],
    'inicial':         ['contra_entrega', 'desvinculado', 'separacion'],
    'contra_entrega':  ['vendida', 'desvinculado', 'inicial'],
    'vendida':         ['contra_entrega'],
}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _schedule_name_bloqueo(unidad_id, suffix):
    safe = unidad_id.replace('/', '-').replace('#', '-')
    return f"bloqueo-{safe}-{suffix}"


def _cancelar_schedules_bloqueo(unidad_id):
    for suffix in ('alerta', 'liberacion'):
        try:
            scheduler_client.delete_schedule(Name=_schedule_name_bloqueo(unidad_id, suffix))
        except Exception:
            pass


def _crear_schedules_bloqueo(unidad_id, proyecto_id, ts_liberacion_iso, ts_alerta_iso):
    if not SCHEDULER_ROLE_ARN or not BLOQUEOS_LAMBDA_ARN:
        return
    payload_base = {'unidad_id': unidad_id, 'proyecto_id': proyecto_id}
    for suffix, at_time, accion in (
        ('alerta', ts_alerta_iso, 'alerta_vencimiento'),
        ('liberacion', ts_liberacion_iso, 'liberar_automatico'),
    ):
        try:
            scheduler_client.create_schedule(
                Name=_schedule_name_bloqueo(unidad_id, suffix),
                ScheduleExpression=f"at({at_time})",
                ScheduleExpressionTimezone='UTC',
                FlexibleTimeWindow={'Mode': 'OFF'},
                Target={
                    'Arn': BLOQUEOS_LAMBDA_ARN,
                    'RoleArn': SCHEDULER_ROLE_ARN,
                    'Input': json.dumps({**payload_base, 'accion': accion}),
                },
                ActionAfterCompletion='DELETE',
            )
        except Exception as e:
            print(f'_crear_schedules_bloqueo error {suffix}: {type(e).__name__}: {e}')


def _schedule_name_separacion(cedula, unidad_id):
    safe_cedula = cedula.replace('/', '-').replace('#', '-').replace(' ', '-')
    safe_unidad = unidad_id.replace('/', '-').replace('#', '-')
    return f"sep-{safe_cedula}-{safe_unidad}"[:64]


def _schedule_name_reserva(cedula, unidad_id):
    safe_cedula = cedula.replace('/', '-').replace('#', '-').replace(' ', '-')
    safe_unidad = unidad_id.replace('/', '-').replace('#', '-')
    return f"res-{safe_cedula}-{safe_unidad}"[:64]


def _crear_alerta_reserva_en(
    cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre, fecha_alerta
):
    """Crea un EventBridge Scheduler que dispara a los 30 dias si no se avanzo a separacion."""
    if not SCHEDULER_ROLE_ARN or not CRM_LAMBDA_ARN:
        return
    schedule_expr = f"at({fecha_alerta.strftime('%Y-%m-%dT%H:%M:%S')})"
    nombre = _schedule_name_reserva(cedula, unidad_id)
    try:
        try:
            scheduler_client.delete_schedule(Name=nombre)
        except Exception:
            pass
        scheduler_client.create_schedule(
            Name=nombre,
            ScheduleExpression=schedule_expr,
            ScheduleExpressionTimezone='UTC',
            FlexibleTimeWindow={'Mode': 'OFF'},
            Target={
                'Arn': CRM_LAMBDA_ARN,
                'RoleArn': SCHEDULER_ROLE_ARN,
                'Input': json.dumps({
                    'source': 'scheduler',
                    'tipo': 'alerta_reserva_vencida',
                    'cedula': cedula,
                    'inmobiliaria_id': inmobiliaria_id,
                    'proyecto_id': proyecto_id,
                    'unidad_id': unidad_id,
                    'unidad_nombre': unidad_nombre,
                }),
            },
            ActionAfterCompletion='DELETE',
        )
    except Exception:
        pass  # No crítico si falla la creación del schedule


def _crear_alerta_reserva(cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre):
    _crear_alerta_reserva_en(
        cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre,
        datetime.now(timezone.utc) + timedelta(days=DIAS_RESERVA),
    )


def _cancelar_alerta_reserva(cedula, unidad_id):
    """Cancela el scheduler de alerta de reserva si existe."""
    nombre = _schedule_name_reserva(cedula, unidad_id)
    try:
        scheduler_client.delete_schedule(Name=nombre)
    except Exception:
        pass  # Ya expiró o no existe


# ─── Procesos ────────────────────────────────────────────────────────────────

def _cancelar_alerta_separacion_legacy(cedula, unidad_id):
    nombre = _schedule_name_separacion(cedula, unidad_id)
    try:
        scheduler_client.delete_schedule(Name=nombre)
    except Exception:
        pass


def crear_proceso(cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre=''):
    """Crea un proceso de venta para cliente + unidad. Llamado desde jam-captacion."""
    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'

    existing = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if existing and existing.get('estado') not in ('desvinculado',):
        return  # Ya existe un proceso activo para esta unidad

    ahora = _now()
    procesos_table.put_item(Item={
        'pk': pk,
        'sk': sk,
        'cedula': cedula,
        'inmobiliaria_id': inmobiliaria_id,
        'proyecto_id': proyecto_id,
        'unidad_id': unidad_id,
        'unidad_nombre': unidad_nombre,
        'estado': 'captacion',
        'historial': [],
        'fecha_inicio': ahora,
        'actualizado_en': ahora,
    })


def crear_proceso_admin(event, cedula):
    """POST /admin/clientes/{cedula}/procesos — admin crea proceso asignando unidad."""
    body = json.loads(event.get('body') or '{}')
    inmobiliaria_id = body.get('inmobiliaria_id')
    proyecto_id = body.get('proyecto_id')
    unidad_id = body.get('unidad_id')

    if not all([inmobiliaria_id, proyecto_id, unidad_id]):
        return bad_request('inmobiliaria_id, proyecto_id y unidad_id son requeridos')

    cliente = clientes_table.get_item(
        Key={'pk': f'CLIENTE#{cedula}#{inmobiliaria_id}', 'sk': f'PROYECTO#{proyecto_id}'}
    ).get('Item')
    if not cliente:
        return not_found('Cliente no encontrado')

    # Verificar que no existe ya un proceso activo para esta unidad (de cualquier cliente)
    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'
    existing = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if existing and existing.get('estado') not in ('desvinculado',):
        return conflict('Ya existe un proceso activo para este cliente y unidad')

    # Verificar que la unidad no esté en proceso activo de otro cliente
    otros = _procesos_proyecto_por_estados(
        proyecto_id,
        ('captacion', 'reserva', 'pagos_atrasados', 'separacion', 'inicial', 'contra_entrega'),
    )
    for proc in otros:
        if proc.get('unidad_id') != unidad_id:
            continue
        if proc.get('estado') not in ('desvinculado',) and proc.get('cedula') != cedula:
            return conflict('Esta unidad ya tiene un proceso de venta activo con otro cliente')

    unidad_nombre = _resolver_nombre_unidad(proyecto_id, unidad_id)
    ahora = _now()
    procesos_table.put_item(Item={
        'pk': pk, 'sk': sk,
        'cedula': cedula,
        'inmobiliaria_id': inmobiliaria_id,
        'proyecto_id': proyecto_id,
        'unidad_id': unidad_id,
        'unidad_nombre': unidad_nombre,
        'estado': 'captacion',
        'historial': [],
        'fecha_inicio': ahora,
        'actualizado_en': ahora,
    })
    return created({'message': 'Proceso creado', 'unidad_id': unidad_id, 'estado': 'captacion'})


def _resolver_nombre_unidad(proyecto_id, unidad_id):
    try:
        item = inventario_table.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
        ).get('Item', {})
        id_unidad = item.get('id_unidad') or unidad_id
        torre_id = item.get('torre_id')
        if torre_id:
            torre = inventario_table.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'}
            ).get('Item', {})
            torre_nombre = torre.get('nombre')
            if torre_nombre:
                return f"{torre_nombre} · {id_unidad}"
        return id_unidad
    except Exception:
        return unidad_id


def _procesos_proyecto_por_estados(proyecto_id, estados):
    items = []
    for estado in estados:
        kwargs = {
            'IndexName': 'gsi-proyecto-procesos',
            'KeyConditionExpression': Key('proyecto_id').eq(proyecto_id) & Key('estado').eq(estado),
        }
        while True:
            result = procesos_table.query(**kwargs)
            items.extend(result.get('Items', []))
            last_key = result.get('LastEvaluatedKey')
            if not last_key:
                break
            kwargs['ExclusiveStartKey'] = last_key
    return items


def listar_procesos(event, cedula):
    """GET /admin/clientes/{cedula}/procesos — todos los procesos de un cliente."""
    qs = event.get('queryStringParameters') or {}
    inmobiliaria_id = qs.get('inmobiliaria_id')

    if inmobiliaria_id:
        pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
        result = procesos_table.query(
            KeyConditionExpression=Key('pk').eq(pk),
            ScanIndexForward=False  # Más recientes primero
        )
    else:
        result = procesos_table.query(
            IndexName='gsi-cedula-procesos',
            KeyConditionExpression=Key('cedula').eq(cedula),
            ScanIndexForward=False  # Más recientes primero
        )
    return ok(result.get('Items', []))


def listar_todos_procesos(event):
    """GET /admin/procesos — lista procesos activos o todos según filtros."""
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')
    inmobiliaria_id = qs.get('inmobiliaria_id')
    estado = qs.get('estado')
    incluir_cerrados = qs.get('incluir_cerrados', 'false').lower() == 'true'

    # Si el caller es inmobiliaria, forzar filtro por su propio id
    from utils.auth import get_rol, get_claims
    if get_rol(event) == 'inmobiliaria':
        claims = get_claims(event)
        sub = claims.get('sub', '')
        # Obtener inmobiliaria_id del usuario
        try:
            usuarios_table = dynamodb.Table(os.environ['USUARIOS_TABLE'])
            u = usuarios_table.get_item(Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}).get('Item', {})
            inmo_id_raw = u.get('inmobiliaria_id', sub)
            inmobiliaria_id = inmo_id_raw.replace('INMOBILIARIA#', '')
        except Exception:
            inmobiliaria_id = sub

    if proyecto_id:
        # gsi-proyecto-procesos: PK=proyecto_id, SK=estado
        # Cuando hay proyecto, cargar TODOS los procesos (sin paginación)
        if estado:
            key_cond = Key('proyecto_id').eq(proyecto_id) & Key('estado').eq(estado)
        else:
            key_cond = Key('proyecto_id').eq(proyecto_id)

        kwargs = {
            'IndexName': 'gsi-proyecto-procesos',
            'KeyConditionExpression': key_cond,
            'ScanIndexForward': False,  # Más recientes primero
        }
        query_fn = procesos_table.query
        usar_gsi_proyecto = True
        usar_gsi_inmo = False
        
        # Cargar TODOS los resultados (loop de paginación)
        items = []
        while True:
            result = query_fn(**kwargs)
            items.extend(result.get('Items', []))
            last_key = result.get('LastEvaluatedKey')
            if not last_key:
                break
            kwargs['ExclusiveStartKey'] = last_key
            
    elif inmobiliaria_id:
        # Usar GSI de inmobiliaria para evitar scan — normalizar sin prefijo
        inmo_id_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')
        kwargs = {
            'IndexName': 'gsi-inmobiliaria-procesos',
            'KeyConditionExpression': Key('inmobiliaria_id').eq(inmo_id_clean),
            'ScanIndexForward': False,  # Más recientes primero
        }
        query_fn = procesos_table.query
        usar_gsi_proyecto = False
        usar_gsi_inmo = True
        inmobiliaria_id = inmo_id_clean  # normalizado para filtros posteriores
        
        # Cargar TODOS los resultados
        items = []
        while True:
            result = query_fn(**kwargs)
            items.extend(result.get('Items', []))
            last_key = result.get('LastEvaluatedKey')
            if not last_key:
                break
            kwargs['ExclusiveStartKey'] = last_key
    else:
        # Sin proyecto ni inmobiliaria: scan limitado (fallback)
        usar_gsi_proyecto = False
        usar_gsi_inmo = False
        kwargs = {'Limit': 200}
        query_fn = procesos_table.scan
        result = query_fn(**kwargs)
        items = result.get('Items', [])

    # Ordenar por fecha de actualización descendente cuando se usa scan (sin GSI)
    if not usar_gsi_proyecto and not usar_gsi_inmo:
        items.sort(key=lambda x: x.get('actualizado_en', ''), reverse=True)

    # Filtrar inmobiliaria en Python cuando usamos gsi-proyecto-procesos
    if usar_gsi_proyecto and inmobiliaria_id:
        inmo_id_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')
        items = [i for i in items if i.get('inmobiliaria_id') == inmo_id_clean]

    # Filtrar estado en Python cuando usamos gsi-proyecto-procesos sin estado exacto
    if usar_gsi_proyecto and not estado:
        estados_activos = {'captacion', 'reserva', 'separacion', 'pagos_atrasados', 'inicial', 'contra_entrega'}
        if not incluir_cerrados:
            items = [i for i in items if i.get('estado') in estados_activos]

    # Filtrar estado en Python cuando usamos gsi-inmobiliaria-procesos
    if usar_gsi_inmo:
        if estado:
            # Estado específico tiene prioridad
            items = [i for i in items if i.get('estado') == estado]
        elif not incluir_cerrados:
            estados_activos = {'captacion', 'reserva', 'separacion', 'pagos_atrasados', 'inicial', 'contra_entrega'}
            items = [i for i in items if i.get('estado') in estados_activos]

    # Enriquecer con datos del cliente usando BatchGetItem para evitar una consulta por proceso.
    cliente_keys = {}
    for item in items:
        cedula = item.get('cedula', '')
        inmo_id = item.get('inmobiliaria_id', '')
        proy_id = item.get('proyecto_id', '')
        if cedula and inmo_id and proy_id:
            key = f'{cedula}#{inmo_id}#{proy_id}'
            cliente_keys[key] = {
                'pk': f'CLIENTE#{cedula}#{inmo_id}',
                'sk': f'PROYECTO#{proy_id}',
            }

    clientes_por_clave = {}
    keys = list(cliente_keys.values())
    try:
        for inicio in range(0, len(keys), 100):
            pendientes = {clientes_table.name: {'Keys': keys[inicio:inicio + 100]}}
            intentos = 0
            while pendientes and intentos < 4:
                respuesta = dynamodb.meta.client.batch_get_item(RequestItems=pendientes)
                for cliente in respuesta.get('Responses', {}).get(clientes_table.name, []):
                    clave = f"{cliente.get('pk', '')}#{cliente.get('sk', '').replace('PROYECTO#', '')}"
                    clientes_por_clave[clave] = {
                        'nombres': cliente.get('nombres', ''),
                        'apellidos': cliente.get('apellidos', ''),
                        'correo': cliente.get('correo', ''),
                        'telefono': cliente.get('telefono', ''),
                    }
                pendientes = respuesta.get('UnprocessedKeys', {})
                if pendientes:
                    intentos += 1
                    time.sleep(0.05 * (2 ** intentos))
                else:
                    break
    except Exception as e:
        print(f'[clientes] batch_get_item error: {e}')

    for item in items:
        key = f"CLIENTE#{item.get('cedula', '')}#{item.get('inmobiliaria_id', '')}#{item.get('proyecto_id', '')}"
        item['cliente'] = clientes_por_clave.get(key, {})

    # Enriquecer con estado actual de la unidad en inventario (batch get)
    unidad_keys = [
        {'pk': f'PROYECTO#{item["proyecto_id"]}', 'sk': f'UNIDAD#{item["unidad_id"]}'}
        for item in items
        if item.get('proyecto_id') and item.get('unidad_id')
    ]
    estado_unidad_map = {}
    try:
        for i in range(0, len(unidad_keys), 100):
            batch = inventario_table.meta.client.batch_get_item(
                RequestItems={
                    inventario_table.name: {
                        'Keys': unidad_keys[i:i+100],
                        'ProjectionExpression': 'pk, sk, estado, #fl',
                        'ExpressionAttributeNames': {'#fl': 'fecha_liberacion'},
                    }
                }
            )
            for u in batch.get('Responses', {}).get(inventario_table.name, []):
                uid = u['sk'].replace('UNIDAD#', '')
                estado_unidad_map[uid] = {
                    'estado_unidad': u.get('estado', ''),
                    'fecha_liberacion_unidad': u.get('fecha_liberacion'),
                }
    except Exception as e:
        print(f'[estado_unidad] batch_get_item error: {e}')
    for item in items:
        uid = item.get('unidad_id', '')
        info = estado_unidad_map.get(uid, {})
        item['estado_unidad'] = info.get('estado_unidad', '')
        item['fecha_liberacion_unidad'] = info.get('fecha_liberacion_unidad')

    # Cuando hay proyecto o inmobiliaria, devolver todos sin paginación
    resp = {'items': items}
    # No incluir next_token cuando se carga todo
    return ok(resp)


def sched_eliminar_bloqueo(unidad_id):
    """Cancela los schedules de EventBridge del bloqueo al confirmar reserva."""
    safe = unidad_id.replace('/', '-').replace('#', '-')
    for suffix in ('alerta', 'liberacion'):
        try:
            scheduler_client.delete_schedule(Name=f"bloqueo-{safe}-{suffix}")
        except Exception:
            pass  # Ya expiró o no existe — no es crítico


def _registrar_historial_bloqueo(proyecto_id, unidad_id, unidad_nombre, inmobiliaria_id, cedula, fecha_bloqueo, fecha_liberacion):
    if not historial_table:
        return
    try:
        historial_table.put_item(Item={
            'pk': f'UNIDAD#{unidad_id}',
            'sk': f'BLOQUEO#{fecha_bloqueo}',
            'proyecto_id': proyecto_id,
            'unidad_id': unidad_id,
            'unidad_nombre': unidad_nombre,
            'inmobiliaria_id': inmobiliaria_id,
            'fecha_bloqueo': fecha_bloqueo,
            'fecha_liberacion': fecha_liberacion,
            'motivo_liberacion': None,
            'cliente_cedula': cedula,
            'origen': 'reversa_estatus',
        })
    except Exception as e:
        print(f'_registrar_historial_bloqueo error: {type(e).__name__}: {e}')


def _cerrar_historial_bloqueo(unidad_id, fecha_bloqueo, motivo, liberado_por, fecha_liberacion=None):
    if not historial_table:
        return
    try:
        sk_objetivo = f'BLOQUEO#{fecha_bloqueo}' if fecha_bloqueo else ''
        result = historial_table.query(
            KeyConditionExpression=Key('pk').eq(f'UNIDAD#{unidad_id}'),
            ScanIndexForward=False,
            Limit=20,
        )
        items = result.get('Items', [])
        item_objetivo = next((i for i in items if sk_objetivo and i.get('sk') == sk_objetivo), None)
        if not item_objetivo:
            item_objetivo = next((i for i in items if not i.get('motivo_liberacion')), None)
        if not item_objetivo:
            print(f'_cerrar_historial_bloqueo sin historial abierto para unidad {unidad_id}')
            return

        historial_table.update_item(
            Key={'pk': item_objetivo['pk'], 'sk': item_objetivo['sk']},
            UpdateExpression='SET motivo_liberacion = :m, liberado_por = :lp, fecha_liberacion = :fl',
            ExpressionAttributeValues={
                ':m': motivo,
                ':lp': liberado_por,
                ':fl': fecha_liberacion or datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception as e:
        print(f'_cerrar_historial_bloqueo error: {type(e).__name__}: {e}')


def _activar_bloqueo_desde_proceso(cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre):
    ahora_dt = datetime.now(timezone.utc)
    fecha_bloqueo = ahora_dt.isoformat()
    fecha_liberacion = (ahora_dt + timedelta(hours=HORAS_BLOQUEO)).isoformat()
    fecha_alerta = (ahora_dt + timedelta(hours=HORAS_ALERTA_BLOQUEO)).isoformat()
    inmo_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')

    _cancelar_schedules_bloqueo(unidad_id)
    inventario_table.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression=(
            'SET estado = :estado, bloqueado_por = :inmo, cliente_cedula = :cedula, '
            'fecha_bloqueo = :fb, fecha_liberacion = :fl, actualizado_en = :ts'
        ),
        ExpressionAttributeValues={
            ':estado': 'bloqueada',
            ':inmo': inmo_clean,
            ':cedula': cedula,
            ':fb': fecha_bloqueo,
            ':fl': fecha_liberacion,
            ':ts': fecha_bloqueo,
        },
    )
    _crear_schedules_bloqueo(unidad_id, proyecto_id, fecha_liberacion[:19], fecha_alerta[:19])
    _registrar_historial_bloqueo(proyecto_id, unidad_id, unidad_nombre, inmo_clean, cedula, fecha_bloqueo, fecha_liberacion)


def _marcar_unidad_no_disponible(proyecto_id, unidad_id):
    _cancelar_schedules_bloqueo(unidad_id)
    inventario_table.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression=(
            'SET estado = :estado, actualizado_en = :ts '
            'REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion'
        ),
        ExpressionAttributeValues={
            ':estado': 'no_disponible',
            ':ts': datetime.now(timezone.utc).isoformat(),
        },
    )


def _marcar_unidad_vendida(proyecto_id, unidad_id):
    _cancelar_schedules_bloqueo(unidad_id)
    inventario_table.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression=(
            'SET estado = :estado, actualizado_en = :ts '
            'REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion'
        ),
        ExpressionAttributeValues={
            ':estado': 'vendida',
            ':ts': datetime.now(timezone.utc).isoformat(),
        },
    )


def _liberar_unidad_por_desvinculacion(proyecto_id, unidad_id):
    _cancelar_schedules_bloqueo(unidad_id)
    inventario_table.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression=(
            'SET estado = :estado, actualizado_en = :ts '
            'REMOVE bloqueado_por, cliente_cedula, fecha_bloqueo, fecha_liberacion'
        ),
        ExpressionAttributeValues={
            ':estado': 'disponible',
            ':ts': datetime.now(timezone.utc).isoformat(),
        },
    )


def _limpiar_campos_separacion(pk, sk):
    try:
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='REMOVE fecha_separacion, alerta_separacion_vencida',
        )
    except Exception:
        pass


def _limpiar_alerta_reserva(pk, sk):
    try:
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='REMOVE alerta_reserva_vencida, alerta_separacion_vencida',
        )
    except Exception:
        pass


def _limpiar_campos_reserva(pk, sk):
    try:
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='REMOVE fecha_reserva, alerta_reserva_vencida, alerta_separacion_vencida',
        )
    except Exception:
        pass


def _limpiar_pago_confirmado(pk, sk):
    try:
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='REMOVE pago_confirmado',
        )
    except Exception:
        pass


def cambiar_estatus(event, cedula, proyecto_id, unidad_id):
    """PUT /admin/clientes/{cedula}/proyecto/{id}/unidad/{uid}/estatus"""
    body = json.loads(event.get('body') or '{}')
    nuevo_estatus = body.get('estatus')
    notificar = body.get('notificar', False)
    inmobiliaria_id = body.get('inmobiliaria_id')

    if not nuevo_estatus:
        return bad_request('estatus es requerido')
    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id es requerido')

    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    
    # Intentar primero con formato corto: UNIDAD#{unidad_id}
    sk = f'UNIDAD#{unidad_id}'
    proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    
    # Si no se encuentra, intentar con formato largo: PROYECTO#{proyecto_id}#UNIDAD#{unidad_id}
    if not proceso:
        sk = f'PROYECTO#{proyecto_id}#UNIDAD#{unidad_id}'
        proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    
    if not proceso:
        return not_found('Proceso no encontrado para este cliente y unidad')

    estatus_actual = proceso.get('estado')
    permitidos = TRANSICIONES.get(estatus_actual, [])
    if nuevo_estatus not in permitidos:
        return conflict(
            f"Transición no permitida: {estatus_actual} → {nuevo_estatus}. "
            f"Permitidas: {', '.join(permitidos) or 'ninguna'}"
        )

    # Fix #5: validar que la unidad sigue disponible/bloqueada antes de reservar
    # y que si está bloqueada, es por la misma inmobiliaria
    if nuevo_estatus == 'reserva' and estatus_actual == 'captacion':
        unidad = inventario_table.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
        ).get('Item', {})
        estado_unidad = unidad.get('estado')
        if estado_unidad not in ('disponible', 'bloqueada', 'no_disponible'):
            return conflict(
                f"La unidad no está disponible para reservar (estado actual: {estado_unidad})"
            )
        # Si está bloqueada, verificar que sea por la misma inmobiliaria
        if estado_unidad == 'bloqueada':
            bloqueado_por = unidad.get('bloqueado_por', '')
            inmo_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')
            bloqueado_clean = bloqueado_por.replace('INMOBILIARIA#', '')
            if bloqueado_clean and bloqueado_clean != inmo_clean:
                return conflict(
                    'La unidad está bloqueada por otra inmobiliaria y no puede ser reservada'
                )

    sub = get_sub(event)
    nombre_admin = get_nombre(event)
    ahora = _now()

    # Agregar entrada al historial embebido en el proceso
    entrada_historial = {
        'estatus_anterior': estatus_actual,
        'estatus_nuevo': nuevo_estatus,
        'ejecutado_por': sub,
        'ejecutado_por_nombre': nombre_admin,
        'notificacion_enviada': notificar,
        'timestamp': ahora,
    }

    procesos_table.update_item(
        Key={'pk': pk, 'sk': sk},
        UpdateExpression=(
            'SET estado = :e, actualizado_en = :ts, '
            'historial = list_append(if_not_exists(historial, :empty), :entrada)'
        ),
        ExpressionAttributeValues={
            ':e': nuevo_estatus,
            ':ts': ahora,
            ':empty': [],
            ':entrada': [entrada_historial],
        },
    )

    # Actualizar unidad en inventario y manejar schedules según estado destino
    if nuevo_estatus == 'reserva':
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        _limpiar_alerta_reserva(pk, sk)
        _limpiar_pago_confirmado(pk, sk)
        if estatus_actual == 'captacion':
            unidad_actual = inventario_table.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
            ).get('Item', {})
            _cerrar_historial_bloqueo(
                unidad_id,
                unidad_actual.get('fecha_bloqueo', ''),
                'reserva',
                nombre_admin,
                ahora,
            )
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET fecha_reserva = :fr REMOVE alerta_reserva_vencida, alerta_separacion_vencida',
            ExpressionAttributeValues={':fr': ahora},
        )
        _crear_alerta_reserva(
            cedula, inmobiliaria_id, proyecto_id, unidad_id,
            proceso.get('unidad_nombre', unidad_id)
        )
        _marcar_unidad_no_disponible(proyecto_id, unidad_id)
    elif nuevo_estatus == 'captacion':
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        _limpiar_campos_reserva(pk, sk)
        _limpiar_campos_separacion(pk, sk)
        _limpiar_pago_confirmado(pk, sk)
        _activar_bloqueo_desde_proceso(
            cedula, inmobiliaria_id, proyecto_id, unidad_id,
            proceso.get('unidad_nombre', unidad_id)
        )
    elif nuevo_estatus == 'separacion':
        _limpiar_pago_confirmado(pk, sk)
        _marcar_unidad_no_disponible(proyecto_id, unidad_id)
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        _limpiar_alerta_reserva(pk, sk)
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET fecha_separacion = :fs REMOVE alerta_reserva_vencida, alerta_separacion_vencida',
            ExpressionAttributeValues={':fs': ahora},
        )
    elif nuevo_estatus == 'inicial':
        _marcar_unidad_no_disponible(proyecto_id, unidad_id)
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        _limpiar_alerta_reserva(pk, sk)
    elif nuevo_estatus == 'pagos_atrasados':
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET alerta_reserva_vencida = :v REMOVE alerta_separacion_vencida',
            ExpressionAttributeValues={':v': True},
        )
        _marcar_unidad_no_disponible(proyecto_id, unidad_id)
    elif nuevo_estatus == 'contra_entrega':
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        _limpiar_alerta_reserva(pk, sk)
        _marcar_unidad_no_disponible(proyecto_id, unidad_id)
    elif nuevo_estatus == 'vendida':
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        _limpiar_alerta_reserva(pk, sk)
        _marcar_unidad_vendida(proyecto_id, unidad_id)
    elif nuevo_estatus == 'desvinculado':
        _cancelar_alerta_reserva(cedula, unidad_id)
        _cancelar_alerta_separacion_legacy(cedula, unidad_id)
        _limpiar_campos_reserva(pk, sk)
        _limpiar_campos_separacion(pk, sk)
        _limpiar_pago_confirmado(pk, sk)
        _liberar_unidad_por_desvinculacion(proyecto_id, unidad_id)

    # Publicar a SQS para TK-08
    cliente = clientes_table.get_item(
        Key={'pk': f'CLIENTE#{cedula}#{inmobiliaria_id}', 'sk': f'PROYECTO#{proyecto_id}'}
    ).get('Item', {})
    sqs.send_message(
        QueueUrl=SQS_URL,
        MessageBody=json.dumps({
            'tipo': 'cambio_estatus',
            'cedula': cedula,
            'proyecto_id': proyecto_id,
            'inmobiliaria_id': inmobiliaria_id,
            'unidad_id': unidad_id,
            'estatus_anterior': estatus_actual,
            'estatus_nuevo': nuevo_estatus,
            'notificar': notificar,
            'correo': cliente.get('correo'),
            'telefono': cliente.get('telefono'),
            'nombres': cliente.get('nombres'),
            'apellidos': cliente.get('apellidos'),
            'unidad_nombre': proceso.get('unidad_nombre', unidad_id),
            'timestamp': ahora,
        }, ensure_ascii=False),
    )

    return ok({'message': f'Estatus actualizado a {nuevo_estatus}', 'estatus': nuevo_estatus})


def ver_historial(event, cedula, proyecto_id, unidad_id):
    """GET /admin/clientes/{cedula}/proyecto/{id}/unidad/{uid}/historial"""
    qs = event.get('queryStringParameters') or {}
    inmobiliaria_id = qs.get('inmobiliaria_id')
    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id requerido como query param')

    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'
    proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if not proceso:
        return not_found('Proceso no encontrado')

    historial = list(reversed(proceso.get('historial', [])))
    return ok(historial)


def manejar_alerta_reserva(event):
    """Invocado por EventBridge Scheduler cuando vencen los 30 dias de reserva sin separacion."""
    cedula = event.get('cedula')
    inmobiliaria_id = event.get('inmobiliaria_id')
    proyecto_id = event.get('proyecto_id')
    unidad_id = event.get('unidad_id')
    unidad_nombre = event.get('unidad_nombre', unidad_id)
    cliente = clientes_table.get_item(
        Key={'pk': f'CLIENTE#{cedula}#{inmobiliaria_id}', 'sk': f'PROYECTO#{proyecto_id}'}
    ).get('Item', {}) if all([cedula, inmobiliaria_id, proyecto_id]) else {}

    if not all([cedula, inmobiliaria_id, proyecto_id, unidad_id]):
        return

    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'
    proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')

    # Solo mover si sigue en reserva. Si ya avanzo, el schedule no hace nada.
    if not proceso or proceso.get('estado') != 'reserva':
        return

    # Marcar alerta en el proceso
    ahora = _now()
    entrada_historial = {
        'estatus_anterior': 'reserva',
        'estatus_nuevo': 'pagos_atrasados',
        'ejecutado_por': 'sistema',
        'ejecutado_por_nombre': 'Sistema',
        'notificacion_enviada': 'admin',
        'origen': 'vencimiento_reserva_30_dias',
        'timestamp': ahora,
    }

    procesos_table.update_item(
        Key={'pk': pk, 'sk': sk},
        UpdateExpression=(
            'SET #estado = :estado, alerta_reserva_vencida = :v, actualizado_en = :ts, '
            'historial = list_append(if_not_exists(historial, :empty), :entrada)'
            ' REMOVE alerta_separacion_vencida'
        ),
        ExpressionAttributeNames={'#estado': 'estado'},
        ExpressionAttributeValues={
            ':estado': 'pagos_atrasados',
            ':v': True,
            ':ts': ahora,
            ':empty': [],
            ':entrada': [entrada_historial],
        },
    )

    # Enviar notificación al admin por SQS
    sqs.send_message(
        QueueUrl=SQS_URL,
        MessageBody=json.dumps({
            'tipo': 'cambio_estatus',
            'cedula': cedula,
            'proyecto_id': proyecto_id,
            'inmobiliaria_id': inmobiliaria_id,
            'unidad_id': unidad_id,
            'estatus_anterior': 'reserva',
            'estatus_nuevo': 'pagos_atrasados',
            'notificar': 'admin',
            'correo': cliente.get('correo'),
            'telefono': cliente.get('telefono'),
            'nombres': cliente.get('nombres'),
            'apellidos': cliente.get('apellidos'),
            'unidad_nombre': unidad_nombre,
            'timestamp': ahora,
        }, ensure_ascii=False),
    )


def manejar_alerta_separacion(event):
    print(f"alerta_separacion_vencida legacy ignorada: {event}")


def _actualizar_unidad(proyecto_id, unidad_id, nuevo_estado):
    try:
        inventario_table.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            UpdateExpression='SET estado = :e, actualizado_en = :ts',
            ExpressionAttributeValues={
                ':e': nuevo_estado,
                ':ts': datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception:
        pass
