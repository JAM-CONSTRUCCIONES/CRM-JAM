import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, bad_request, conflict, too_many, not_found
from utils.auth import get_claims, get_inmobiliaria_id, get_rol, require_admin
from utils import scheduler as sched
from utils.clientes import registrar_cliente_y_proceso, _normalizar_datos_cliente

dynamodb = boto3.resource('dynamodb')
inventario = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
historial_table = dynamodb.Table(os.environ['HISTORIAL_TABLE'])
usuarios = dynamodb.Table(os.environ['USUARIOS_TABLE'])
sqs = boto3.client('sqs')
SQS_URL = os.environ.get('SQS_URL', '')

HORAS_BLOQUEO = 48
HORAS_ALERTA = 43  # alerta 5 horas antes del vencimiento
HORAS_REBLOQUEO = 24


def _log_creation_audit(event, accion, estado, cedula, proyecto_id, inmobiliaria_id, **details):
    """Registra bloqueos y asignaciones con identidad y contexto de la petición."""
    claims = get_claims(event)
    request_context = event.get('requestContext') or {}
    print(json.dumps({
        'audit': 'bloqueos_action',
        'accion': accion,
        'estado': estado,
        'actor': {
            'sub': claims.get('sub'),
            'username': claims.get('cognito:username') or claims.get('username'),
            'email': claims.get('email'),
            'nombre': claims.get('name') or claims.get('custom:nombre'),
            'rol': get_rol(event),
        },
        'request_id': request_context.get('requestId') or request_context.get('extendedRequestId'),
        'metodo': event.get('httpMethod'),
        'ruta': event.get('path'),
        'cedula': cedula,
        'proyecto_id': proyecto_id,
        'inmobiliaria_id': inmobiliaria_id,
        **details,
    }, ensure_ascii=False, default=str))


def _normalizar_inmo_id(value: str | None) -> str:
    return (value or '').replace('INMOBILIARIA#', '')


def _get_inmobiliaria_info(sub: str):
    try:
        item = usuarios.get_item(Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}).get('Item', {})
        inmo_id = item.get('inmobiliaria_id', sub)
        inmo = usuarios.get_item(Key={'pk': inmo_id, 'sk': 'METADATA'}).get('Item', {})
        # Normalizar: siempre devolver sin prefijo para consistencia con jam-captacion
        inmo_id_clean = inmo_id.replace('INMOBILIARIA#', '')
        return inmo_id_clean, inmo.get('nombre', inmo_id_clean)
    except Exception:
        return sub, sub


def _tiene_liberacion_reciente(unidad_id: str, proyecto_id: str, inmobiliaria_id: str, ts_limite: str, ts_ahora: str) -> bool:
    inmo_clean = _normalizar_inmo_id(inmobiliaria_id)
    proyecto_clean = (proyecto_id or '').replace('PROYECTO#', '')
    last_key = None

    while True:
        kwargs = {
            'KeyConditionExpression': Key('pk').eq(f'UNIDAD#{unidad_id}'),
            'ScanIndexForward': False,
        }
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key

        result = historial_table.query(**kwargs)
        for item in result.get('Items', []):
            fecha_liberacion = item.get('fecha_liberacion')
            if not fecha_liberacion or not item.get('motivo_liberacion'):
                continue
            if (item.get('proyecto_id') or '').replace('PROYECTO#', '') != proyecto_clean:
                continue
            if _normalizar_inmo_id(item.get('inmobiliaria_id')) != inmo_clean:
                continue
            if ts_limite <= fecha_liberacion <= ts_ahora:
                return True

        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            return False


def _revertir_bloqueo_nuevo(unidad_id: str, proyecto_id: str, inmobiliaria_id: str, ts_bloqueo: str):
    """Evita dejar inventario/historial bloqueados si falla el registro asociado."""
    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            UpdateExpression='SET estado = :disponible REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion, cliente_cedula',
            ConditionExpression=(
                'estado = :bloqueada AND bloqueado_por = :inmo AND fecha_bloqueo = :ts'
            ),
            ExpressionAttributeValues={
                ':disponible': 'disponible',
                ':bloqueada': 'bloqueada',
                ':inmo': inmobiliaria_id,
                ':ts': ts_bloqueo,
            },
        )
    except Exception as e:
        print(f'Error revirtiendo unidad {unidad_id}: {type(e).__name__}: {e}')

    try:
        historial_table.delete_item(
            Key={'pk': f'UNIDAD#{unidad_id}', 'sk': f'BLOQUEO#{ts_bloqueo}'},
        )
    except Exception as e:
        print(f'Error revirtiendo historial de {unidad_id}: {type(e).__name__}: {e}')

    sched.eliminar_schedules(unidad_id)


def bloquear(event):
    body = json.loads(event.get('body') or '{}')
    proyecto_id = body.get('proyecto_id')
    unidad_id = body.get('unidad_id')
    solicita_forzar_admin = bool(body.get('forzar_admin', False))
    notificar = body.get('notificar', 'todos')
    if notificar not in (False, 'admin', 'todos'):
        notificar = False

    # Datos del cliente (opcionales — puede bloquearse sin cliente)
    cedula = (body.get('cedula') or '').strip()
    nombres = (body.get('nombres') or '').strip()
    apellidos = (body.get('apellidos') or '').strip()
    tiene_cliente = bool(cedula and nombres and apellidos)
    datos_cliente_normalizados = None

    if tiene_cliente:
        datos_cliente_normalizados, error_cliente = _normalizar_datos_cliente({
            'cedula': cedula,
            'nombres': nombres,
            'apellidos': apellidos,
            'correo': body.get('correo', ''),
            'telefono': body.get('telefono', ''),
            'estado_civil': body.get('estado_civil', ''),
            'nacionalidad': body.get('nacionalidad', ''),
            'pais_residencia': body.get('pais_residencia', ''),
            'fecha_nacimiento': body.get('fecha_nacimiento', ''),
        })
        if error_cliente:
            return bad_request(error_cliente)
        cedula = datos_cliente_normalizados.get('cedula', '')
        nombres = datos_cliente_normalizados.get('nombres', '')
        apellidos = datos_cliente_normalizados.get('apellidos', '')

    if not all([proyecto_id, unidad_id]):
        return bad_request('proyecto_id y unidad_id son requeridos')

    es_admin = require_admin(event)
    forzar_admin = es_admin and solicita_forzar_admin
    # Los usuarios internos pueden gestionar una unidad inmediatamente después
    # de una liberación. La confirmación explícita (`forzar_admin`) se conserva
    # únicamente para saltar la exclusividad del cliente.
    puede_omitir_rebloqueo = es_admin

    # Las inmobiliarias deben crear los bloqueos con un cliente asignado.
    # Los usuarios internos mantienen la posibilidad de crear bloqueos
    # temporales sin cliente para gestionarlos posteriormente.
    if not es_admin and not tiene_cliente:
        return bad_request('Las inmobiliarias deben crear el bloqueo con un cliente')

    # Si es admin y especifica inmobiliaria_id, usar esa; sino, usar la del usuario
    if es_admin and body.get('inmobiliaria_id'):
        inmo_id = body.get('inmobiliaria_id').replace('INMOBILIARIA#', '')
        # Obtener nombre de la inmobiliaria
        inmo_info = usuarios.get_item(Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}).get('Item', {})
        inmo_nombre = inmo_info.get('nombre', inmo_id)
    else:
        inmobiliaria_id = get_inmobiliaria_id(event)
        inmo_id, inmo_nombre = _get_inmobiliaria_info(inmobiliaria_id)

    # Normalizar proyecto_id (sin prefijo para claves, con prefijo para inventario)
    proyecto_id_clean = proyecto_id.replace('PROYECTO#', '') if proyecto_id else proyecto_id

    # Resolver nombre de la unidad
    unidad_item = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    ).get('Item', {})
    id_unidad = unidad_item.get('id_unidad') or unidad_id
    torre_id = unidad_item.get('torre_id')
    torre_nombre = None
    if torre_id:
        torre_item = inventario.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'}
        ).get('Item', {})
        torre_nombre = torre_item.get('nombre')
    unidad_nombre = f"{torre_nombre} · {id_unidad}" if torre_nombre else id_unidad

    # Si es admin asignando cliente a un bloqueo existente, usar la inmobiliaria del bloqueo
    if require_admin(event) and unidad_item.get('bloqueado_por'):
        inmo_id_real = unidad_item['bloqueado_por']
        inmo_info = usuarios.get_item(Key={'pk': inmo_id_real, 'sk': 'METADATA'}).get('Item', {})
        inmo_id = inmo_id_real
        inmo_nombre = inmo_info.get('nombre', inmo_id_real)

    # Validar exclusividad del cliente ANTES de bloquear (solo si NO es forzar_admin)
    if tiene_cliente and not forzar_admin:
        clientes_table_name = os.environ.get('CLIENTES_TABLE')
        if clientes_table_name:
            clientes_t = dynamodb.Table(clientes_table_name)
            pk_cliente = f'CLIENTE#{cedula}#{inmo_id}'
            sk_proy = f'PROYECTO#{proyecto_id_clean}'
            existing_cliente = clientes_t.get_item(Key={'pk': pk_cliente, 'sk': sk_proy}).get('Item')
            if not existing_cliente:
                resultado = clientes_t.query(
                    IndexName='gsi-cedula-proyecto',
                    KeyConditionExpression=Key('cedula').eq(cedula) & Key('sk').eq(sk_proy),
                    FilterExpression=Attr('exclusividad_activa').eq(True),
                )
                for item in resultado.get('Items', []):
                    if item.get('inmobiliaria_id') != inmo_id:
                        return conflict(
                            'Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto'
                        )

    # Validar restricción de re-bloqueo (< 24h) — solo si la unidad NO está ya bloqueada por esta inmo
    unidad_actual = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    ).get('Item', {})
    ya_bloqueada_propia = (
        unidad_actual.get('estado') == 'bloqueada' and
        unidad_actual.get('bloqueado_por') == inmo_id
    )

    now = datetime.now(timezone.utc)
    if not ya_bloqueada_propia and not puede_omitir_rebloqueo:
        ts_limite = (now - timedelta(hours=HORAS_REBLOQUEO)).isoformat()
        if _tiene_liberacion_reciente(unidad_id, proyecto_id, inmo_id, ts_limite, now.isoformat()):
            return too_many(f'No puedes re-bloquear la unidad "{unidad_nombre}" antes de 24 horas desde la última liberación')

    ts_asignacion = now.isoformat()
    ts_bloqueo = unidad_actual.get('fecha_bloqueo') if ya_bloqueada_propia else ts_asignacion
    ts_liberacion = unidad_actual.get('fecha_liberacion') if ya_bloqueada_propia else (now + timedelta(hours=HORAS_BLOQUEO)).isoformat()
    ts_alerta = (now + timedelta(hours=HORAS_ALERTA)).isoformat()

    # Escritura condicional — solo si estado == disponible o ya es bloqueo propio
    if ya_bloqueada_propia:
        # Solo actualizar cliente_cedula
        if cedula:
            inventario.update_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
                UpdateExpression='SET cliente_cedula = :cedula',
                ExpressionAttributeValues={':cedula': cedula},
            )
    else:
        try:
            inventario.update_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
                UpdateExpression='SET estado = :bloqueada, bloqueado_por = :inmo, fecha_bloqueo = :ts, fecha_liberacion = :lib, cliente_cedula = :cedula',
                ConditionExpression='estado = :disponible AND attribute_exists(pk)',
                ExpressionAttributeValues={
                    ':bloqueada': 'bloqueada',
                    ':disponible': 'disponible',
                    ':inmo': inmo_id,
                    ':ts': ts_bloqueo,
                    ':lib': ts_liberacion,
                    ':cedula': cedula,
                },
            )
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                return conflict('La unidad ya fue bloqueada por otra inmobiliaria o no está disponible para bloquear')
            else:
                raise

    # Programar schedules en EventBridge (solo si es un bloqueo nuevo)
    if not ya_bloqueada_propia:
        sched.crear_schedules(unidad_id, proyecto_id, ts_liberacion[:19], ts_alerta[:19])

    # Registrar en historial (solo si es un bloqueo nuevo)
    if not ya_bloqueada_propia:
        historial_table.put_item(Item={
            'pk': f'UNIDAD#{unidad_id}',
            'sk': f'BLOQUEO#{ts_bloqueo}',
            'proyecto_id': proyecto_id,
            'unidad_id': unidad_id,
            'unidad_nombre': unidad_nombre,
            'torre_id': torre_id,
            'torre_nombre': torre_nombre,
            'inmobiliaria_id': inmo_id,
            'inmobiliaria_nombre': inmo_nombre,
            'fecha_bloqueo': ts_bloqueo,
            'fecha_liberacion': ts_liberacion,
            'motivo_liberacion': None,
            'cliente_cedula': cedula,
        })

    # Crear cliente y proceso si vienen datos del cliente
    cliente_advertencia = None
    if tiene_cliente:
        ok_cliente, msg_cliente = registrar_cliente_y_proceso(
            cedula,
            inmo_id,
            proyecto_id_clean,
            unidad_id,
            unidad_nombre,
            datos_cliente_normalizados,
            omitir_exclusividad=forzar_admin,
        )
        if not ok_cliente:
            if not ya_bloqueada_propia:
                _revertir_bloqueo_nuevo(unidad_id, proyecto_id, inmo_id, ts_bloqueo)
            return conflict(msg_cliente)

    # Notificar vía SQS
    if SQS_URL and (not ya_bloqueada_propia or tiene_cliente):
        evento_notificacion = 'cliente_asignado_bloqueo' if ya_bloqueada_propia and tiene_cliente else 'bloqueo_registrado'
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': evento_notificacion,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmo_id,
                'metadata': {
                    'unidad_id': unidad_id,
                    'unidad_nombre': unidad_nombre,
                    'fecha_bloqueo': ts_bloqueo,
                    'fecha_liberacion': ts_liberacion,
                    'fecha_asignacion': ts_asignacion,
                    'cliente_cedula': cedula,
                    'horas': HORAS_BLOQUEO,
                },
                'notificar': notificar,
            }),
        )

    _log_creation_audit(
        event,
        'bloqueo_creado' if not ya_bloqueada_propia else 'cliente_asignado_bloqueo',
        'completada',
        cedula,
        proyecto_id_clean,
        inmo_id,
        unidad_id=unidad_id,
        unidad_nombre=unidad_nombre,
        cliente_registrado=tiene_cliente and not cliente_advertencia,
        bloqueo_nuevo=not ya_bloqueada_propia,
        fecha_bloqueo=ts_bloqueo,
    )

    resp = {
        'unidad_id': unidad_id,
        'proyecto_id': proyecto_id,
        'inmobiliaria_id': inmo_id,
        'fecha_bloqueo': ts_bloqueo,
        'fecha_liberacion': ts_liberacion,
        'cliente_registrado': tiene_cliente and not cliente_advertencia,
    }
    if cliente_advertencia:
        resp['advertencia_cliente'] = cliente_advertencia

    return ok(resp)


def listar_activos(event):
    qs = event.get('queryStringParameters') or {}
    next_token = qs.get('next_token')
    limit = min(int(qs.get('limit', 100)), 200)
    es_inmobiliaria = get_rol(event) == 'inmobiliaria'
    inmo_id_filtro = ''
    if es_inmobiliaria:
        inmo_id_filtro, _ = _get_inmobiliaria_info(get_inmobiliaria_id(event))

    kwargs = {
        'IndexName': 'gsi-estado',
        'KeyConditionExpression': Key('estado').eq('bloqueada'),
        'Limit': limit,
    }
    if next_token:
        import base64, json as _json
        try:
            kwargs['ExclusiveStartKey'] = _json.loads(base64.b64decode(next_token).decode())
        except Exception:
            pass

    result = inventario.query(**kwargs)
    items = result.get('Items', [])
    if es_inmobiliaria:
        items = [
            item for item in items
            if str(item.get('bloqueado_por', '')).replace('INMOBILIARIA#', '') == inmo_id_filtro
        ]

    for item in items:
        if not item.get('proyecto_id') and item.get('pk', '').startswith('PROYECTO#'):
            item['proyecto_id'] = item['pk'].replace('PROYECTO#', '')
        if not item.get('unidad_id') and item.get('sk', '').startswith('UNIDAD#'):
            item['unidad_id'] = item['sk'].replace('UNIDAD#', '')

    # Resolver nombres de torres
    keys_torres_map = {
        f"{item['pk']}#{item['torre_id']}": {'pk': item['pk'], 'sk': f'TORRE#{item["torre_id"]}'}
        for item in items if item.get('torre_id') and item.get('pk')
    }
    keys_torres = list(keys_torres_map.values())
    if keys_torres:
        torre_map = {}
        for i in range(0, len(keys_torres), 100):
            batch = inventario.meta.client.batch_get_item(
                RequestItems={inventario.name: {'Keys': keys_torres[i:i+100]}}
            )
            for t in batch.get('Responses', {}).get(inventario.name, []):
                torre_map[t['sk']] = t.get('nombre')
        for item in items:
            if item.get('torre_id'):
                item['torre_nombre'] = torre_map.get(f'TORRE#{item["torre_id"]}')

    # Resolver nombre del cliente vinculado
    clientes_table_name = os.environ.get('CLIENTES_TABLE')
    if clientes_table_name:
        clientes_t = dynamodb.Table(clientes_table_name)
        for item in items:
            cedula = item.get('cliente_cedula', '')
            inmo_id = item.get('bloqueado_por', '')
            proyecto_id = item.get('proyecto_id') or item.get('pk', '').replace('PROYECTO#', '')
            if cedula and inmo_id and proyecto_id:
                try:
                    cliente = clientes_t.get_item(
                        Key={'pk': f'CLIENTE#{cedula}#{inmo_id}', 'sk': f'PROYECTO#{proyecto_id}'}
                    ).get('Item', {})
                    if cliente:
                        item['cliente_nombre'] = f"{cliente.get('nombres', '')} {cliente.get('apellidos', '')}".strip()
                except Exception:
                    pass

    resp = {'items': items}
    if result.get('LastEvaluatedKey'):
        import base64, json as _json
        resp['next_token'] = base64.b64encode(
            _json.dumps(result['LastEvaluatedKey']).encode()
        ).decode()
    return ok(resp)
