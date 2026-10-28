import json
import uuid
import time
import boto3
import os
import logging
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, conflict
from utils.helpers import now
from utils.auditoria import registrar_auditoria

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])
s3_client = boto3.client('s3')
scheduler_client = boto3.client('scheduler')
sfn_client = boto3.client('stepfunctions')
ASSETS_BUCKET = os.environ.get('ASSETS_BUCKET', '')
CLOUDFRONT_URL = os.environ.get('CLOUDFRONT_URL', '')
SF_ELIMINAR_ARN = os.environ.get('ELIMINAR_PROYECTO_SF_ARN', '')
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def listar(event):
    result = inventario.query(
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('PROYECTO'),
        FilterExpression=Attr('activo').eq(True)
    )
    return ok(result.get('Items', []))


def detalle(proyecto_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    )
    item = result.get('Item')
    if not item:
        return not_found('Proyecto no encontrado')
    return ok(item)


def crear(event):
    body = json.loads(event.get('body') or '{}')
    nombre = body.get('nombre')
    if not nombre:
        return bad_request('nombre requerido')

    proyecto_id = str(uuid.uuid4())[:8].upper()
    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': 'METADATA',
        'tipo': 'PROYECTO',
        'proyecto_id': proyecto_id,
        'nombre': nombre,
        'descripcion': body.get('descripcion', ''),
        'activo': True,
        'creado_en': now(),
    }
    if 'config_precios' in body:
        item['config_precios'] = body['config_precios']
    inventario.put_item(Item=item)
    registrar_auditoria(event, 'proyecto_creado', 'inventario', 'proyecto', proyecto_id, detalles={'nombre': nombre})
    return created(item)


def actualizar(proyecto_id, event):
    body = json.loads(event.get('body') or '{}')
    print(f"[actualizar] proyecto_id={proyecto_id} body_keys={list(body.keys())} imagen_url={body.get('imagen_url','NO')}")
    updates, values, names = [], {}, {}

    if 'nombre' in body:
        values[':nombre'] = body['nombre']
        updates.append('#nombre = :nombre')
        names['#nombre'] = 'nombre'
    if 'descripcion' in body:
        values[':desc'] = body['descripcion']
        updates.append('descripcion = :desc')
    if 'imagen_url' in body:
        values[':img'] = body['imagen_url']
        updates.append('imagen_url = :img')
    if 'config_precios' in body:
        values[':cfg'] = body['config_precios']
        updates.append('config_precios = :cfg')

    if not updates:
        return bad_request('No hay campos para actualizar')

    values[':ts'] = now()
    updates.append('actualizado_en = :ts')

    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {})
        )
        registrar_auditoria(event, 'proyecto_actualizado', 'inventario', 'proyecto', proyecto_id, detalles={'cambios': body})
        return ok({'message': 'Proyecto actualizado'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Proyecto no encontrado')
        raise


def _eliminar_legacy_disponibles(proyecto_id):
    """
    Elimina (desactiva) un proyecto.
    Permite eliminar si tiene unidades, pero solo si están en estado 'disponible'.
    Bloquea si hay unidades bloqueadas o en procesos activos.
    """
    
    # 1. Verificar si hay unidades en el proyecto
    unidades_result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
    )
    unidades = unidades_result.get('Items', [])
    
    if unidades:
        # 2. Verificar que todas las unidades estén disponibles
        unidades_no_disponibles = [
            u for u in unidades 
            if u.get('estado') != 'disponible'
        ]
        
        if unidades_no_disponibles:
            # Contar por estado para dar un mensaje más informativo
            estados = {}
            for u in unidades_no_disponibles:
                estado = u.get('estado', 'desconocido')
                estados[estado] = estados.get(estado, 0) + 1
            
            estados_str = ', '.join([f'{count} {estado}' for estado, count in estados.items()])
            return conflict(
                f'No se puede eliminar el proyecto porque tiene {len(unidades_no_disponibles)} unidad(es) '
                f'no disponible(s): {estados_str}. Solo se pueden eliminar proyectos con unidades en estado "disponible".'
            )
        
        # 3. Verificar que no haya procesos activos en ninguna unidad
        procesos_table_name = os.environ.get('PROCESOS_TABLE', '')
        if procesos_table_name:
            try:
                procesos_table = boto3.resource('dynamodb').Table(procesos_table_name)
                
                procesos_activos = _query_procesos_por_estados(
                    procesos_table,
                    proyecto_id,
                    ('captacion', 'reserva', 'pagos_atrasados', 'separacion', 'inicial', 'contra_entrega'),
                )
                
                if procesos_activos:
                    # Contar por estado
                    estados_procesos = {}
                    for p in procesos_activos:
                        estado = p.get('estado', 'desconocido')
                        estados_procesos[estado] = estados_procesos.get(estado, 0) + 1
                    
                    estados_str = ', '.join([f'{count} en {estado}' for estado, count in estados_procesos.items()])
                    return conflict(
                        f'No se puede eliminar el proyecto porque tiene {len(procesos_activos)} proceso(s) '
                        f'de venta activo(s): {estados_str}. Finaliza o cancela estos procesos primero.'
                    )
            except Exception as e:
                import logging
                logging.getLogger().warning(f'Error al verificar procesos activos: {e}')
                # Si no podemos verificar procesos, bloqueamos la eliminación por seguridad
                return conflict(
                    'No se puede verificar si hay procesos activos. Por seguridad, no se puede eliminar el proyecto.'
                )
        
        # 4. Si llegamos aquí, todas las unidades están disponibles y no hay procesos activos
        # Eliminar físicamente todas las unidades
        print(f'[ELIMINAR PROYECTO] Eliminando {len(unidades)} unidades disponibles del proyecto {proyecto_id}')
        
        with inventario.meta.client.batch_write_item as batch:
            for unidad in unidades:
                try:
                    inventario.delete_item(
                        Key={
                            'pk': unidad['pk'],
                            'sk': unidad['sk']
                        }
                    )
                except Exception as e:
                    import logging
                    logging.getLogger().warning(
                        f'Error eliminando unidad {unidad.get("unidad_id")}: {e}'
                    )

    # 5. Desactivar el proyecto (soft delete)
    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'},
            UpdateExpression='SET activo = :false',
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues={':false': False}
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Proyecto no encontrado')
        raise

    # 6. Desvincular el proyecto de todas las inmobiliarias que lo tengan asignado
    try:
        usuarios_table_name = os.environ.get('USUARIOS_TABLE')
        if usuarios_table_name:
            usuarios_table = boto3.resource('dynamodb').Table(usuarios_table_name)
            inmos = usuarios_table.query(
                IndexName='gsi-tipo',
                KeyConditionExpression=Key('tipo').eq('INMOBILIARIA'),
            )
            for inmo in inmos.get('Items', []):
                proyectos_asignados = inmo.get('proyectos', [])
                if proyecto_id in proyectos_asignados:
                    nuevos = [p for p in proyectos_asignados if p != proyecto_id]
                    usuarios_table.update_item(
                        Key={'pk': inmo['pk'], 'sk': 'METADATA'},
                        UpdateExpression='SET proyectos = :p',
                        ExpressionAttributeValues={':p': nuevos},
                    )
    except Exception as e:
        import logging
        logging.getLogger().warning(f'Error desvinculando proyecto de inmobiliarias: {e}')

    mensaje = f'Proyecto desactivado y desvinculado de inmobiliarias'
    if unidades:
        mensaje += f' ({len(unidades)} unidades eliminadas)'
    
    return ok({'message': mensaje})




def presigned_imagen(proyecto_id, event=None):
    """Genera una presigned URL para subir imagen de portada del proyecto a S3."""
    if not ASSETS_BUCKET:
        return bad_request('ASSETS_BUCKET no configurado')

    body = json.loads((event or {}).get('body') or '{}')
    content_type = body.get('content_type', 'image/jpeg')
    print(f"[presigned_imagen] proyecto_id={proyecto_id} content_type={content_type}")

    ext_map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    }
    ext = ext_map.get(content_type, 'jpg')
    
    # Usar timestamp en el nombre del archivo para evitar caché de CloudFront
    import time
    timestamp = int(time.time())
    key = f'assets/proyectos/{proyecto_id}/portada-{timestamp}.{ext}'

    # BORRAR todas las imágenes anteriores del proyecto
    # Listar y borrar todos los archivos que empiecen con "portada"
    try:
        response = s3_client.list_objects_v2(
            Bucket=ASSETS_BUCKET,
            Prefix=f'assets/proyectos/{proyecto_id}/portada'
        )
        if 'Contents' in response:
            for obj in response['Contents']:
                old_key = obj['Key']
                s3_client.delete_object(Bucket=ASSETS_BUCKET, Key=old_key)
                print(f"[presigned_imagen] ✓ Borrada imagen anterior: {old_key}")
    except Exception as e:
        print(f"[presigned_imagen] ⚠ Error borrando imágenes anteriores: {e}")

    presigned = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': ASSETS_BUCKET,
            'Key': key,
            'ContentType': content_type,
            'CacheControl': 'public, max-age=31536000, immutable',  # Caché agresivo porque el nombre cambia
        },
        ExpiresIn=300,
    )

    # URL pública sin query string (el timestamp está en el nombre del archivo)
    public_url = f'{CLOUDFRONT_URL}/{key}'
    registrar_auditoria(
        event or {}, 'imagen_proyecto_upload_url_generada', 'inventario', 'proyecto', proyecto_id,
        detalles={'proyecto_id': proyecto_id, 'key': key, 'content_type': content_type, 'entidad_nombre': proyecto_id},
    )
    print(f"[presigned_imagen] public_url={public_url}")

    return ok({
        'upload_url': presigned,
        'public_url': public_url,
        'key': key,
    })


# Conserva clientes y limpia las entidades operativas del proyecto.
def eliminar(proyecto_id):
    """Elimina el proyecto y sus dependencias; conserva clientes desvinculados."""
    ts = now()

    proyecto = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not proyecto:
        return not_found('Proyecto no encontrado')

    inventario_items = _query_all(
        inventario,
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}'),
    )
    unidades = [i for i in inventario_items if i.get('sk', '').startswith('UNIDAD#')]
    hijos_inventario = [i for i in inventario_items if i.get('sk') != 'METADATA']
    procesos = _obtener_procesos_proyecto(proyecto_id)
    clientes = _obtener_clientes_proyecto(proyecto_id)
    clientes_keys = {(c.get('pk'), c.get('sk')) for c in clientes}

    logger.info(
        '[eliminar_proyecto] inicio proyecto_id=%s unidades=%s inventario_hijos=%s procesos=%s clientes=%s',
        proyecto_id, len(unidades), len(hijos_inventario), len(procesos), len(clientes),
    )

    for unidad in unidades:
        unidad_id = unidad.get('unidad_id') or unidad.get('sk', '').replace('UNIDAD#', '')
        if unidad_id:
            _cancelar_schedules_bloqueo(unidad_id)

    for proceso in procesos:
        cedula = proceso.get('cedula')
        inmo_id = proceso.get('inmobiliaria_id')
        unidad_id = proceso.get('unidad_id')
        if cedula and unidad_id:
            _cancelar_schedule_separacion(cedula, unidad_id)
        if cedula and inmo_id:
            _cancelar_schedule_exclusividad(cedula, inmo_id, proyecto_id)

    for cliente in clientes:
        cedula = cliente.get('cedula')
        inmo_id = cliente.get('inmobiliaria_id')
        if cedula and inmo_id:
            _cancelar_schedule_exclusividad(cedula, inmo_id, proyecto_id)

    clientes_table = _tabla_env('CLIENTES_TABLE')
    clientes_desvinculados = 0
    if clientes_table:
        for cliente in clientes:
            _desvincular_cliente(clientes_table, cliente, ts)
            clientes_desvinculados += 1

        for proceso in procesos:
            cedula = proceso.get('cedula')
            inmo_id = proceso.get('inmobiliaria_id')
            if not cedula or not inmo_id:
                continue
            pk = f'CLIENTE#{cedula}#{inmo_id}'
            sk = f'PROYECTO#{proyecto_id}'
            if (pk, sk) in clientes_keys:
                continue
            item = clientes_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
            if item:
                _desvincular_cliente(clientes_table, item, ts)
                clientes_desvinculados += 1
                clientes_keys.add((pk, sk))

    procesos_table = _tabla_env('PROCESOS_TABLE')
    procesos_desvinculados = 0
    if procesos_table and procesos:
        for proceso in procesos:
            if _desvincular_proceso(procesos_table, proceso, ts):
                procesos_desvinculados += 1

    historial_eliminado = 0
    historial_table = _tabla_env('HISTORIAL_TABLE')
    if historial_table:
        for unidad in unidades:
            unidad_id = unidad.get('unidad_id') or unidad.get('sk', '').replace('UNIDAD#', '')
            if unidad_id:
                historial_eliminado += _eliminar_historial_unidad(historial_table, unidad_id)

    inventario_eliminado = 0
    if hijos_inventario:
        with inventario.batch_writer() as batch:
            for item in hijos_inventario:
                batch.delete_item(Key={'pk': item['pk'], 'sk': item['sk']})
                inventario_eliminado += 1

    resumen = {
        'unidades_eliminadas': len(unidades),
        'inventario_eliminado': inventario_eliminado,
        'procesos_desvinculados': procesos_desvinculados,
        'clientes_desvinculados': clientes_desvinculados,
        'historial_eliminado': historial_eliminado,
    }

    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'},
        UpdateExpression=(
            'SET activo = :false, eliminado_en = :ts, actualizado_en = :ts, '
            'eliminacion_resumen = :resumen'
        ),
        ExpressionAttributeValues={
            ':false': False,
            ':ts': ts,
            ':resumen': resumen,
        },
    )

    resumen['inmobiliarias_actualizadas'] = _desvincular_proyecto_de_inmobiliarias(proyecto_id)

    logger.info('[eliminar_proyecto] fin proyecto_id=%s resumen=%s', proyecto_id, resumen)
    return ok({
        'message': 'Proyecto eliminado. Clientes conservados como desvinculados.',
        'proyecto_id': proyecto_id,
        'resumen': resumen,
    })


def _tabla_env(nombre_env):
    table_name = os.environ.get(nombre_env, '')
    return boto3.resource('dynamodb').Table(table_name) if table_name else None


def _query_all(table, **kwargs):
    items = []
    while True:
        result = table.query(**kwargs)
        items.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            return items
        kwargs['ExclusiveStartKey'] = last_key


def _query_procesos_por_estados(table, proyecto_id, estados):
    items = []
    for estado in estados:
        items.extend(_query_all(
            table,
            IndexName='gsi-proyecto-procesos',
            KeyConditionExpression=Key('proyecto_id').eq(proyecto_id) & Key('estado').eq(estado),
        ))
    return items


def _obtener_procesos_proyecto(proyecto_id):
    table = _tabla_env('PROCESOS_TABLE')
    if not table:
        return []
    return _query_all(
        table,
        IndexName='gsi-proyecto-procesos',
        KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
    )


def _obtener_clientes_proyecto(proyecto_id):
    table = _tabla_env('CLIENTES_TABLE')
    if not table:
        return []
    return _query_all(
        table,
        IndexName='gsi-proyecto-clientes',
        KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
    )


def _desvincular_cliente(table, cliente, ts):
    table.update_item(
        Key={'pk': cliente['pk'], 'sk': cliente['sk']},
        UpdateExpression=(
            'SET exclusividad_activa = :false, #estado = :estado, '
            'desvinculado_en = :ts, motivo_desvinculacion = :motivo, '
            'proyecto_eliminado = :true, actualizado_en = :ts '
            'REMOVE fecha_vencimiento'
        ),
        ExpressionAttributeNames={'#estado': 'estado'},
        ExpressionAttributeValues={
            ':false': False,
            ':true': True,
            ':estado': 'desvinculado',
            ':ts': ts,
            ':motivo': 'proyecto_eliminado',
        },
    )


def _desvincular_proceso(table, proceso, ts):
    estado_actual = proceso.get('estado', 'captacion')
    if estado_actual == 'desvinculado':
        return False

    entrada_historial = {
        'estatus_anterior': estado_actual,
        'estatus_nuevo': 'desvinculado',
        'ejecutado_por': 'sistema',
        'ejecutado_por_nombre': 'Eliminacion de proyecto',
        'notificacion_enviada': False,
        'timestamp': ts,
    }

    table.update_item(
        Key={'pk': proceso['pk'], 'sk': proceso['sk']},
        UpdateExpression=(
            'SET #estado = :estado, actualizado_en = :ts, '
            'desvinculado_en = :ts, motivo_desvinculacion = :motivo, '
            'proyecto_eliminado = :true, '
            'historial = list_append(if_not_exists(historial, :empty), :entrada) '
            'REMOVE alerta_reserva_vencida, alerta_separacion_vencida'
        ),
        ExpressionAttributeNames={'#estado': 'estado'},
        ExpressionAttributeValues={
            ':estado': 'desvinculado',
            ':ts': ts,
            ':motivo': 'proyecto_eliminado',
            ':true': True,
            ':empty': [],
            ':entrada': [entrada_historial],
        },
    )
    return True


def _eliminar_historial_unidad(table, unidad_id):
    items = _query_all(
        table,
        KeyConditionExpression=Key('pk').eq(f'UNIDAD#{unidad_id}'),
    )
    if not items:
        return 0
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={'pk': item['pk'], 'sk': item['sk']})
    return len(items)


def _desvincular_proyecto_de_inmobiliarias(proyecto_id):
    table = _tabla_env('USUARIOS_TABLE')
    if not table:
        return 0
    actualizadas = 0
    inmos = _query_all(
        table,
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('INMOBILIARIA'),
    )
    for inmo in inmos:
        proyectos_asignados = inmo.get('proyectos', [])
        if proyecto_id not in proyectos_asignados:
            continue
        nuevos = [p for p in proyectos_asignados if p != proyecto_id]
        table.update_item(
            Key={'pk': inmo['pk'], 'sk': 'METADATA'},
            UpdateExpression='SET proyectos = :p',
            ExpressionAttributeValues={':p': nuevos},
        )
        actualizadas += 1
    return actualizadas


def _cancelar_schedules_bloqueo(unidad_id):
    safe = unidad_id.replace('/', '-').replace('#', '-')
    for suffix in ('alerta', 'liberacion'):
        _delete_schedule(f'bloqueo-{safe}-{suffix}')


def _cancelar_schedule_separacion(cedula, unidad_id):
    safe_cedula = cedula.replace('/', '-').replace('#', '-').replace(' ', '-')
    safe_unidad = unidad_id.replace('/', '-').replace('#', '-')
    _delete_schedule(f'sep-{safe_cedula}-{safe_unidad}'[:64])
    _delete_schedule(f'res-{safe_cedula}-{safe_unidad}'[:64])


def _cancelar_schedule_exclusividad(cedula, inmobiliaria_id, proyecto_id):
    inmo_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')
    for inmo_id in (inmo_clean, f'INMOBILIARIA#{inmo_clean}'):
        safe_cedula = cedula.replace('/', '-').replace('#', '-')
        safe_inmo = inmo_id.replace('/', '-').replace('#', '-').replace('INMOBILIARIA', 'I')
        safe_proy = proyecto_id.replace('/', '-').replace('#', '-').replace('PROYECTO', 'P')
        _delete_schedule(f'exclusividad-{safe_cedula}-{safe_inmo}-{safe_proy}')


def _delete_schedule(name):
    try:
        scheduler_client.delete_schedule(Name=name)
    except scheduler_client.exceptions.ResourceNotFoundException:
        return
    except Exception as e:
        logger.warning('[eliminar_proyecto] no se pudo eliminar schedule %s: %s', name, e)


# ─────────────────────────────────────────────────────────────────────────────
# ELIMINAR PROYECTO via Step Function
# ─────────────────────────────────────────────────────────────────────────────

def iniciar_eliminacion(proyecto_id, event=None):
    """
    Punto de entrada HTTP para borrar un proyecto.
    Si SF_ELIMINAR_ARN está configurado inicia la Step Function (async).
    Si no, ejecuta la eliminación directa como fallback (solo dev).
    """
    proyecto = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not proyecto:
        return not_found('Proyecto no encontrado')
    if not proyecto.get('activo', True):
        return conflict('El proyecto ya fue eliminado')
    if proyecto.get('eliminando'):
        return conflict('El proyecto ya tiene una eliminación en curso')

    if not SF_ELIMINAR_ARN:
        logger.warning('[iniciar_eliminacion] SF_ELIMINAR_ARN no configurado, ejecutando síncronamente')
        result = eliminar(proyecto_id)
        registrar_auditoria(event or {}, 'proyecto_eliminado', 'inventario', 'proyecto', proyecto_id, detalles={'modo': 'sincrono', 'entidad_nombre': proyecto.get('nombre', proyecto_id)})
        return result

    # Marcar como "en eliminación" para que el frontend pueda hacer polling
    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'},
        UpdateExpression='SET eliminando = :true, actualizado_en = :ts',
        ExpressionAttributeValues={':true': True, ':ts': now()},
    )

    execution_name = f'del-{proyecto_id}-{int(time.time())}'[:80]
    execution = sfn_client.start_execution(
        stateMachineArn=SF_ELIMINAR_ARN,
        name=execution_name,
        input=json.dumps({
            'proyecto_id': proyecto_id,
            '_audit_context': {
                'sub': ((event or {}).get('requestContext') or {}).get('authorizer', {}).get('claims', {}).get('sub', ''),
                'username': ((event or {}).get('requestContext') or {}).get('authorizer', {}).get('claims', {}).get('cognito:username', ''),
                'nombre': ((event or {}).get('requestContext') or {}).get('authorizer', {}).get('claims', {}).get('name', 'Sistema'),
                'rol': ((event or {}).get('requestContext') or {}).get('authorizer', {}).get('claims', {}).get('cognito:groups', 'sistema'),
                'request_id': ((event or {}).get('requestContext') or {}).get('requestId', ''),
                'metodo': (event or {}).get('httpMethod', ''),
                'ruta': (event or {}).get('path', ''),
            },
        }),
    )

    print(f'[iniciar_eliminacion] SF iniciada proyecto_id={proyecto_id} execution={execution_name}')
    registrar_auditoria(
        event or {}, 'proyecto_eliminacion_iniciada', 'inventario', 'proyecto', proyecto_id,
        detalles={'execution_arn': execution['executionArn'], 'modo': 'step_function', 'entidad_nombre': proyecto.get('nombre', proyecto_id)},
    )
    return ok({
        'message': 'Eliminación iniciada',
        'proyecto_id': proyecto_id,
        'execution_arn': execution['executionArn'],
    })


# ── Step 1: Validar y recopilar conteos ──────────────────────────────────────

def sf_eliminar_preparar(event):
    proyecto_id = event['proyecto_id']
    print(f'[sf_preparar] INICIO proyecto_id={proyecto_id}')

    proyecto = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not proyecto:
        raise ValueError(f'Proyecto {proyecto_id} no encontrado')

    items = _query_all(
        inventario,
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}'),
    )
    total_unidades = sum(1 for i in items if i.get('sk', '').startswith('UNIDAD#'))
    total_items = len([i for i in items if i.get('sk') != 'METADATA'])

    procesos = _obtener_procesos_proyecto(proyecto_id)
    clientes = _obtener_clientes_proyecto(proyecto_id)

    print(f'[sf_preparar] unidades={total_unidades} items_inventario={total_items} procesos={len(procesos)} clientes={len(clientes)}')
    return {
        'proyecto_id': proyecto_id,
        'total_unidades': total_unidades,
        'total_procesos': len(procesos),
        'total_clientes': len(clientes),
    }


# ── Step 2: Cancelar schedules de EventBridge ────────────────────────────────

def sf_eliminar_schedules(event):
    proyecto_id = event['proyecto_id']
    print(f'[sf_schedules] INICIO proyecto_id={proyecto_id}')

    items = _query_all(
        inventario,
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}'),
    )
    unidades_ids = [
        i.get('unidad_id') or i['sk'].replace('UNIDAD#', '')
        for i in items
        if i.get('sk', '').startswith('UNIDAD#')
    ]
    procesos = _obtener_procesos_proyecto(proyecto_id)
    clientes = _obtener_clientes_proyecto(proyecto_id)

    cancelados = 0
    for uid in unidades_ids:
        _cancelar_schedules_bloqueo(uid)
        cancelados += 2  # alerta + liberacion

    for p in procesos:
        cedula, inmo_id, uid = p.get('cedula'), p.get('inmobiliaria_id'), p.get('unidad_id')
        if cedula and uid:
            _cancelar_schedule_separacion(cedula, uid)
            cancelados += 1
        if cedula and inmo_id:
            _cancelar_schedule_exclusividad(cedula, inmo_id, proyecto_id)
            cancelados += 2

    for c in clientes:
        cedula, inmo_id = c.get('cedula'), c.get('inmobiliaria_id')
        if cedula and inmo_id:
            _cancelar_schedule_exclusividad(cedula, inmo_id, proyecto_id)
            cancelados += 2

    print(f'[sf_schedules] schedules_cancelados_intentados={cancelados}')
    return {**event, 'schedules_cancelados': cancelados}


# ── Step 3: Desvincular procesos y clientes ───────────────────────────────────

def sf_eliminar_desvincular(event):
    proyecto_id = event['proyecto_id']
    ts = now()
    print(f'[sf_desvincular] INICIO proyecto_id={proyecto_id}')

    procesos = _obtener_procesos_proyecto(proyecto_id)
    clientes = _obtener_clientes_proyecto(proyecto_id)

    clientes_table = _tabla_env('CLIENTES_TABLE')
    clientes_desvinculados = 0
    if clientes_table:
        clientes_keys = set()
        for c in clientes:
            _desvincular_cliente(clientes_table, c, ts)
            clientes_desvinculados += 1
            clientes_keys.add((c['pk'], c['sk']))

        # Clientes que aparecen en procesos pero no en la query de clientes
        for p in procesos:
            cedula, inmo_id = p.get('cedula'), p.get('inmobiliaria_id')
            if not cedula or not inmo_id:
                continue
            pk = f'CLIENTE#{cedula}#{inmo_id}'
            sk = f'PROYECTO#{proyecto_id}'
            if (pk, sk) in clientes_keys:
                continue
            item = clientes_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
            if item:
                _desvincular_cliente(clientes_table, item, ts)
                clientes_desvinculados += 1
                clientes_keys.add((pk, sk))

    procesos_table = _tabla_env('PROCESOS_TABLE')
    procesos_desvinculados = 0
    if procesos_table:
        for p in procesos:
            if _desvincular_proceso(procesos_table, p, ts):
                procesos_desvinculados += 1

    print(f'[sf_desvincular] procesos_desvinculados={procesos_desvinculados} clientes_desvinculados={clientes_desvinculados}')
    return {**event, 'procesos_desvinculados': procesos_desvinculados, 'clientes_desvinculados': clientes_desvinculados}


# ── Step 4: Borrar historial y unidades del inventario ───────────────────────

def sf_eliminar_inventario(event):
    proyecto_id = event['proyecto_id']
    print(f'[sf_inventario] INICIO proyecto_id={proyecto_id}')

    items = _query_all(
        inventario,
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}'),
    )
    unidades_ids = [
        i.get('unidad_id') or i['sk'].replace('UNIDAD#', '')
        for i in items
        if i.get('sk', '').startswith('UNIDAD#')
    ]
    hijos = [i for i in items if i.get('sk') != 'METADATA']

    historial_eliminado = 0
    historial_table = _tabla_env('HISTORIAL_TABLE')
    if historial_table:
        for uid in unidades_ids:
            historial_eliminado += _eliminar_historial_unidad(historial_table, uid)
        print(f'[sf_inventario] historial_eliminado={historial_eliminado}')

    inventario_eliminado = 0
    if hijos:
        with inventario.batch_writer() as batch:
            for item in hijos:
                batch.delete_item(Key={'pk': item['pk'], 'sk': item['sk']})
                inventario_eliminado += 1
        print(f'[sf_inventario] inventario_eliminado={inventario_eliminado}')

    return {**event, 'inventario_eliminado': inventario_eliminado, 'historial_eliminado': historial_eliminado}


# ── Step 5: Soft-delete del proyecto y desvincular inmobiliarias ─────────────

def sf_eliminar_finalizar(event):
    proyecto_id = event['proyecto_id']
    ts = now()

    resumen = {
        'unidades_eliminadas':     event.get('total_unidades', 0),
        'inventario_eliminado':    event.get('inventario_eliminado', 0),
        'procesos_desvinculados':  event.get('procesos_desvinculados', 0),
        'clientes_desvinculados':  event.get('clientes_desvinculados', 0),
        'historial_eliminado':     event.get('historial_eliminado', 0),
        'schedules_cancelados':    event.get('schedules_cancelados', 0),
    }
    print(f'[sf_finalizar] INICIO proyecto_id={proyecto_id} resumen={resumen}')

    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'},
        UpdateExpression=(
            'SET activo = :false, eliminado_en = :ts, actualizado_en = :ts, '
            'eliminacion_resumen = :resumen '
            'REMOVE eliminando'
        ),
        ExpressionAttributeValues={
            ':false': False,
            ':ts': ts,
            ':resumen': resumen,
        },
    )

    resumen['inmobiliarias_actualizadas'] = _desvincular_proyecto_de_inmobiliarias(proyecto_id)
    registrar_auditoria(
        {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': ((event.get('_audit_context') or {}).get('sub') or ''),
                        'cognito:username': ((event.get('_audit_context') or {}).get('username') or ''),
                        'name': ((event.get('_audit_context') or {}).get('nombre') or 'Sistema'),
                        'cognito:groups': ((event.get('_audit_context') or {}).get('rol') or 'sistema'),
                    }
                },
                'requestId': ((event.get('_audit_context') or {}).get('request_id') or ''),
            },
            'httpMethod': ((event.get('_audit_context') or {}).get('metodo') or ''),
            'path': ((event.get('_audit_context') or {}).get('ruta') or ''),
        },
        'proyecto_eliminado', 'inventario', 'proyecto', proyecto_id,
        detalles={
            'entidad_nombre': proyecto_id,
            'modo': 'step_function',
            'resumen': resumen,
        },
    )
    logger.info('[sf_finalizar] FIN proyecto_id=%s resumen_final=%s', proyecto_id, resumen)

    return {
        'proyecto_id': proyecto_id,
        'message': 'Proyecto eliminado. Clientes conservados como desvinculados.',
        'resumen': resumen,
    }
