import json
import uuid
import os
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, _build
from utils.helpers import now

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']
USER_POOL_ID = os.environ['USER_POOL_ID']
ASSETS_BUCKET = os.environ.get('ASSETS_BUCKET', '')
CLOUDFRONT_URL = os.environ.get('CLOUDFRONT_URL', '')


def listar():
    table = dynamodb.Table(USUARIOS_TABLE)
    result = table.query(
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('INMOBILIARIA')
    )
    return ok(result.get('Items', []))


def crear(event):
    body = json.loads(event.get('body') or '{}')
    nombre = body.get('nombre')
    if not nombre:
        return bad_request('nombre requerido')

    inmo_id = f'INMOBILIARIA#{str(uuid.uuid4())[:8].upper()}'
    table = dynamodb.Table(USUARIOS_TABLE)
    item = {
        'pk': inmo_id,
        'sk': 'METADATA',
        'tipo': 'INMOBILIARIA',
        'nombre': nombre,
        'correos': body.get('correos', []),
        'proyectos': body.get('proyectos', []),
        'activo': True,
        'creado_en': now(),
    }
    table.put_item(Item=item)
    return created(item)


def actualizar(inmo_id, event):
    body = json.loads(event.get('body') or '{}')
    table = dynamodb.Table(USUARIOS_TABLE)
    updates, values, names = [], {}, {}

    if 'nombre' in body:
        updates.append('#nombre = :nombre')
        values[':nombre'] = body['nombre']
        names['#nombre'] = 'nombre'
    if 'correos' in body:
        updates.append('correos = :correos')
        values[':correos'] = body['correos']
    if 'proyectos' in body:
        updates.append('proyectos = :proyectos')
        values[':proyectos'] = body['proyectos']
    if 'imagen_url' in body:
        updates.append('imagen_url = :imagen_url')
        values[':imagen_url'] = body['imagen_url']

    if not updates:
        return bad_request('Nada que actualizar')

    values[':ts'] = now()
    updates.append('actualizado_en = :ts')

    try:
        table.update_item(
            Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {})
        )
        return ok({'message': 'Inmobiliaria actualizada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Inmobiliaria no encontrada')
        raise


def deshabilitar(inmo_id):
    return _set_activo(inmo_id, False)


def habilitar(inmo_id):
    return _set_activo(inmo_id, True)


def eliminar(inmo_id):
    """Elimina la inmobiliaria y todos sus usuarios de Cognito y DynamoDB."""
    table = dynamodb.Table(USUARIOS_TABLE)
    cognito = boto3.client('cognito-idp')

    # Verificar que no tenga proyectos asignados
    inmo = table.get_item(Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}).get('Item')
    if not inmo:
        return not_found('Inmobiliaria no encontrada')

    proyectos_asignados = inmo.get('proyectos', [])
    if proyectos_asignados:
        return _build(409, {'message': f'No se puede eliminar: la inmobiliaria tiene {len(proyectos_asignados)} proyecto(s) asignado(s). Desasígnalos primero.'})

    # Verificar que no tenga clientes registrados
    try:
        inventario_table_name = os.environ.get('INVENTARIO_TABLE')
        clientes_table_name = os.environ.get('CLIENTES_TABLE')
        if clientes_table_name:
            clientes_t = dynamodb.Table(clientes_table_name)
            from boto3.dynamodb.conditions import Key as DKey, Attr
            result = clientes_t.query(
                IndexName='gsi-inmobiliaria-clientes',
                KeyConditionExpression=DKey('inmobiliaria_id').eq(inmo_id),
                Limit=1,
                ProjectionExpression='pk',
            )
            if result.get('Items'):
                return _build(409, {'message': 'No se puede eliminar: la inmobiliaria tiene clientes registrados.'})
    except Exception:
        pass  # Si falla la verificación, continuar con la eliminación

    # Eliminar usuarios asociados
    result = table.query(
        IndexName='gsi-por-inmobiliaria',
        KeyConditionExpression=Key('inmobiliaria_id').eq(f'INMOBILIARIA#{inmo_id}')
    )
    for u in result.get('Items', []):
        username = u.get('cognito_username')
        try:
            if username:
                cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=username)
        except ClientError:
            pass
        table.delete_item(Key={'pk': u['pk'], 'sk': u['sk']})

    # Eliminar inmobiliaria
    try:
        table.delete_item(
            Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'},
            ConditionExpression='attribute_exists(pk)'
        )
        return ok({'message': 'Inmobiliaria eliminada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Inmobiliaria no encontrada')
        raise


def _set_activo(inmo_id, activo):
    table = dynamodb.Table(USUARIOS_TABLE)
    cognito = boto3.client('cognito-idp')
    try:
        table.update_item(
            Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'},
            UpdateExpression='SET activo = :activo',
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues={':activo': activo}
        )
        result = table.query(
            IndexName='gsi-por-inmobiliaria',
            KeyConditionExpression=Key('inmobiliaria_id').eq(f'INMOBILIARIA#{inmo_id}')
        )
        for u in result.get('Items', []):
            username = u.get('cognito_username')
            if username:
                if activo:
                    cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=username)
                else:
                    cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=username)
        return ok({'message': 'OK'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Inmobiliaria no encontrada')
        raise


def presigned_imagen(inmo_id, event=None):
    """Genera una presigned URL para subir imagen de portada de la inmobiliaria a S3."""
    if not ASSETS_BUCKET:
        return bad_request('ASSETS_BUCKET no configurado')

    body = json.loads((event or {}).get('body') or '{}')
    content_type = body.get('content_type', 'image/jpeg')

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
    key = f'assets/inmobiliarias/{inmo_id}/portada-{timestamp}.{ext}'

    # BORRAR todas las imágenes anteriores de la inmobiliaria
    # Listar y borrar todos los archivos que empiecen con "portada"
    try:
        response = s3_client.list_objects_v2(
            Bucket=ASSETS_BUCKET,
            Prefix=f'assets/inmobiliarias/{inmo_id}/portada'
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

    return ok({
        'upload_url': presigned,
        'public_url': public_url,
        'key': key,
    })
