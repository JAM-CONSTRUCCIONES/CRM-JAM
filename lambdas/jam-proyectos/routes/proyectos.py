import json
import uuid
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, conflict
from utils.helpers import now

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])
s3_client = boto3.client('s3')
ASSETS_BUCKET = os.environ.get('ASSETS_BUCKET', '')
CLOUDFRONT_URL = os.environ.get('CLOUDFRONT_URL', '')


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
        return ok({'message': 'Proyecto actualizado'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Proyecto no encontrado')
        raise


def eliminar(proyecto_id):
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
                
                # Buscar procesos activos para este proyecto
                procesos_result = procesos_table.query(
                    IndexName='gsi-proyecto-procesos',
                    KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
                    FilterExpression=Attr('estado').is_in(['captacion', 'reserva', 'separacion', 'inicial'])
                )
                
                procesos_activos = procesos_result.get('Items', [])
                
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
    print(f"[presigned_imagen] public_url={public_url}")

    return ok({
        'upload_url': presigned,
        'public_url': public_url,
        'key': key,
    })
