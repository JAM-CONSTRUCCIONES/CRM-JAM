import json
import os
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, _build
from utils.helpers import now

cognito = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

USER_POOL_ID = os.environ['USER_POOL_ID']
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']


def listar(inmo_id):
    table = dynamodb.Table(USUARIOS_TABLE)
    result = table.query(
        IndexName='gsi-por-inmobiliaria',
        KeyConditionExpression=Key('inmobiliaria_id').eq(f'INMOBILIARIA#{inmo_id}')
    )
    return ok(result.get('Items', []))


def crear(inmo_id, event):
    body = json.loads(event.get('body') or '{}')
    username = body.get('username')
    password = body.get('password')
    nombre = body.get('nombre', username)
    correo = body.get('correo', '')

    if not username or not password:
        return bad_request('username y password requeridos')

    try:
        user_attrs = []
        if correo:
            user_attrs.append({'Name': 'email', 'Value': correo})
            user_attrs.append({'Name': 'email_verified', 'Value': 'true'})

        cog_result = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=username,
            TemporaryPassword=password,
            MessageAction='SUPPRESS',
            UserAttributes=user_attrs,
        )
        attrs = cog_result['User']['Attributes']
        sub = next((a['Value'] for a in attrs if a['Name'] == 'sub'), None)

        cognito.admin_set_user_password(
            UserPoolId=USER_POOL_ID, Username=username, Password=password, Permanent=True
        )
        cognito.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID, Username=username, GroupName='inmobiliaria'
        )

        table = dynamodb.Table(USUARIOS_TABLE)
        item = {
            'pk': f'USUARIO#{sub}',
            'sk': 'METADATA',
            'tipo': 'USUARIO',
            'inmobiliaria_id': f'INMOBILIARIA#{inmo_id}',
            'cognito_username': username,
            'nombre': nombre,
            'correo': correo,
            'rol': 'inmobiliaria',
            'activo': True,
            'creado_en': now(),
        }
        table.put_item(Item=item)
        return created({'message': 'Usuario creado', 'sub': sub, 'username': username})

    except ClientError as e:
        code = e.response['Error']['Code']
        if code == 'UsernameExistsException':
            return _build(409, {'message': f'El nombre de usuario "{username}" ya está en uso, elige otro'})
        if code == 'InvalidPasswordException':
            return _build(400, {'message': 'La contraseña no cumple los requisitos: mínimo 8 caracteres, una mayúscula y un número'})
        if code == 'InvalidParameterException':
            return _build(400, {'message': f'Parámetro inválido: {e.response["Error"]["Message"]}'})
        return _build(500, {'message': f'Error al crear usuario en Cognito: {code}'})


def deshabilitar(usuario_id):
    return _set_activo(usuario_id, False)


def habilitar(usuario_id):
    return _set_activo(usuario_id, True)


def eliminar(usuario_id):
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'}).get('Item')
    if not item:
        return not_found('Usuario no encontrado')
    username = item.get('cognito_username')
    try:
        if username:
            cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=username)
        table.delete_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'})
        return ok({'message': 'Usuario eliminado'})
    except ClientError as e:
        code = e.response['Error']['Code']
        if code == 'UserNotFoundException':
            table.delete_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'})
            return ok({'message': 'Usuario eliminado'})
        return _build(500, {'message': f'No se pudo eliminar el usuario: {code}'})


def _set_activo(usuario_id, activo):
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'}).get('Item')
    if not item:
        return not_found('Usuario no encontrado')

    errors = []
    username = item.get('cognito_username')
    if username:
        try:
            if activo:
                cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=username)
            else:
                cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=username)
        except ClientError as e:
            errors.append(f'Cognito: {e.response["Error"]["Code"]}')

    try:
        table.update_item(
            Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'},
            UpdateExpression='SET activo = :activo',
            ExpressionAttributeValues={':activo': activo}
        )
    except ClientError as e:
        errors.append(f'DynamoDB: {e.response["Error"]["Code"]}')

    if errors:
        return _build(500, {'message': f'No se pudo {"habilitar" if activo else "deshabilitar"} el usuario correctamente: {", ".join(errors)}'})
    return ok({'message': 'OK', 'activo': activo})
