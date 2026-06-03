import json
import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, _build
from utils.helpers import now

cognito = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

USER_POOL_ID = os.environ['USER_POOL_ID']
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']

ROLES_VALIDOS = ('admin', 'coordinador', 'supervisor')


def listar():
    table = dynamodb.Table(USUARIOS_TABLE)
    # Traer todos los usuarios internos JAM (no inmobiliaria)
    result = table.query(
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('USUARIO'),
        FilterExpression=Attr('rol').is_in(list(ROLES_VALIDOS))
    )
    return ok(result.get('Items', []))


def crear(event):
    body = json.loads(event.get('body') or '{}')
    username = body.get('username')
    password = body.get('password')
    nombre = body.get('nombre', username)
    rol = body.get('rol')
    correo = body.get('correo', '')

    if not username or not password:
        return bad_request('username y password requeridos')
    if rol not in ROLES_VALIDOS:
        return bad_request(f'rol debe ser uno de: {", ".join(ROLES_VALIDOS)}')

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
            UserPoolId=USER_POOL_ID, Username=username, GroupName=rol
        )

        # Iniciar sesión interna para obtener la sesión del challenge MFA_SETUP
        # y generar el secret TOTP que el usuario deberá escanear
        USER_POOL_CLIENT_ID = os.environ['USER_POOL_CLIENT_ID']
        auth_result = cognito.initiate_auth(
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={'USERNAME': username, 'PASSWORD': password},
            ClientId=USER_POOL_CLIENT_ID,
        )

        mfa_secret = None
        if auth_result.get('ChallengeName') == 'MFA_SETUP':
            totp_result = cognito.associate_software_token(
                Session=auth_result['Session']
            )
            mfa_secret = totp_result['SecretCode']

        table = dynamodb.Table(USUARIOS_TABLE)
        item = {
            'pk': f'USUARIO#{sub}',
            'sk': 'METADATA',
            'tipo': 'USUARIO',
            'cognito_username': username,
            'nombre': nombre,
            'rol': rol,
            'correo': correo,
            'activo': True,
            'creado_en': now(),
        }
        table.put_item(Item=item)

        response = {'message': 'Usuario creado', 'sub': sub, 'username': username, 'rol': rol}
        if mfa_secret:
            response['mfa_secret'] = mfa_secret

        return created(response)

    except ClientError as e:
        code = e.response['Error']['Code']
        if code == 'UsernameExistsException':
            return _build(409, {'message': f'El nombre de usuario "{username}" ya está en uso, elige otro'})
        if code == 'InvalidPasswordException':
            return _build(400, {'message': 'La contraseña no cumple los requisitos: mínimo 8 caracteres, una mayúscula y un número'})
        if code == 'InvalidParameterException':
            return _build(400, {'message': f'Parámetro inválido: {e.response["Error"]["Message"]}'})
        return _build(500, {'message': f'Error al crear usuario en Cognito: {code}'})


def actualizar(usuario_id, event):
    body = json.loads(event.get('body') or '{}')
    table = dynamodb.Table(USUARIOS_TABLE)
    updates, values, names = [], {}, {}

    if 'nombre' in body:
        updates.append('#nombre = :nombre')
        values[':nombre'] = body['nombre']
        names['#nombre'] = 'nombre'
    if 'rol' in body:
        if body['rol'] not in ROLES_VALIDOS:
            return bad_request(f'rol debe ser uno de: {", ".join(ROLES_VALIDOS)}')
        updates.append('#rol = :rol')
        values[':rol'] = body['rol']
        names['#rol'] = 'rol'

    if not updates:
        return bad_request('Nada que actualizar')

    values[':ts'] = now()
    updates.append('actualizado_en = :ts')

    try:
        item = table.get_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'}).get('Item')
        if not item:
            return not_found('Usuario no encontrado')

        # Si cambia el rol, actualizar grupo en Cognito
        if 'rol' in body and body['rol'] != item.get('rol'):
            username = item.get('cognito_username')
            if username:
                cognito.admin_remove_user_from_group(
                    UserPoolId=USER_POOL_ID, Username=username, GroupName=item['rol']
                )
                cognito.admin_add_user_to_group(
                    UserPoolId=USER_POOL_ID, Username=username, GroupName=body['rol']
                )

        table.update_item(
            Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'},
            UpdateExpression='SET ' + ', '.join(updates),
            ExpressionAttributeValues=values,
            ExpressionAttributeNames=names,
        )
        return ok({'message': 'Usuario actualizado'})
    except ClientError as e:
        return _build(500, {'message': f'Error: {e.response["Error"]["Code"]}'})


def deshabilitar(usuario_id):
    return _set_activo(usuario_id, False)


def habilitar(usuario_id):
    return _set_activo(usuario_id, True)


def eliminar(usuario_id):
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'}).get('Item')
    if not item:
        return not_found('Usuario no encontrado')
    if item.get('rol') not in ROLES_VALIDOS:
        return bad_request('Este endpoint es solo para usuarios del sistema')
    username = item.get('cognito_username')
    try:
        if username:
            cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=username)
        table.delete_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'})
        return ok({'message': 'Usuario eliminado'})
    except ClientError as e:
        return _build(500, {'message': f'Error: {e.response["Error"]["Code"]}'})


def _set_activo(usuario_id, activo):
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'}).get('Item')
    if not item:
        return not_found('Usuario no encontrado')
    if item.get('rol') not in ROLES_VALIDOS:
        return bad_request('Este endpoint es solo para usuarios del sistema')

    username = item.get('cognito_username')
    try:
        if username:
            if activo:
                cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=username)
            else:
                cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=username)
        table.update_item(
            Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'},
            UpdateExpression='SET activo = :activo',
            ExpressionAttributeValues={':activo': activo}
        )
        return ok({'message': 'OK', 'activo': activo})
    except ClientError as e:
        return _build(500, {'message': f'Error: {e.response["Error"]["Code"]}'})
