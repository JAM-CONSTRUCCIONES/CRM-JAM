import json
import uuid
import os
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, _build
from utils.helpers import now

dynamodb = boto3.resource('dynamodb')
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']
USER_POOL_ID = os.environ['USER_POOL_ID']


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
