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
    # Verificar si el proyecto tiene unidades antes de desactivar
    resultado = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
        Limit=1,
        ProjectionExpression='pk',
    )
    if resultado.get('Items'):
        return conflict('No se puede eliminar el proyecto porque tiene unidades registradas. Elimina primero todas las unidades.')

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

    # Desvincular el proyecto de todas las inmobiliarias que lo tengan asignado
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

    return ok({'message': 'Proyecto desactivado y desvinculado de inmobiliarias'})




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
