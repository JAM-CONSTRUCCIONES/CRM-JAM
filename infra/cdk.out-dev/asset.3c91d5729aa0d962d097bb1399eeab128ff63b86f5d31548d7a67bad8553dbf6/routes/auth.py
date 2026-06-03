import os
import json
import boto3
from botocore.exceptions import ClientError
from utils.response import ok, bad_request, forbidden, not_found, _build

cognito = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

USER_POOL_CLIENT_ID = os.environ['USER_POOL_CLIENT_ID']
USER_POOL_ID = os.environ['USER_POOL_ID']
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']


def login(event):
    try:
        body = json.loads(event.get('body') or '{}')
        username = body.get('username')
        password = body.get('password')
        if not username or not password:
            return bad_request('username y password requeridos')

        result = cognito.initiate_auth(
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={'USERNAME': username, 'PASSWORD': password},
            ClientId=USER_POOL_CLIENT_ID,
        )

        # Challenge MFA — admin con TOTP configurado
        if result.get('ChallengeName') == 'SOFTWARE_TOKEN_MFA':
            return ok({
                'challenge': 'SOFTWARE_TOKEN_MFA',
                'session': result['Session'],
            })

        # Challenge primer login admin — MFA no configurado aún
        if result.get('ChallengeName') == 'MFA_SETUP':
            return ok({
                'challenge': 'MFA_SETUP',
                'session': result['Session'],
            })

        tokens = result['AuthenticationResult']
        return ok({
            'access_token': tokens['AccessToken'],
            'id_token': tokens['IdToken'],
            'refresh_token': tokens['RefreshToken'],
            'expires_in': tokens['ExpiresIn'],
        })
    except ClientError as e:
        code = e.response['Error']['Code']
        if code in ('NotAuthorizedException', 'UserNotFoundException'):
            return _build(401, {'message': 'Usuario o contraseña incorrectos'})
        if code == 'UserNotConfirmedException':
            return _build(401, {'message': 'El usuario no ha sido confirmado'})
        if code == 'PasswordResetRequiredException':
            return _build(401, {'message': 'Se requiere restablecer la contraseña antes de iniciar sesión'})
        if code == 'TooManyRequestsException':
            return _build(429, {'message': 'Demasiados intentos fallidos, espera unos minutos e intenta de nuevo'})
        return _build(500, {'message': 'Error interno de autenticación'})


def confirm_mfa(event):
    """Responde al challenge SOFTWARE_TOKEN_MFA con el código TOTP."""
    try:
        body = json.loads(event.get('body') or '{}')
        session = body.get('session')
        code = body.get('code')
        username = body.get('username')
        if not all([session, code, username]):
            return bad_request('session, username y code requeridos')

        result = cognito.respond_to_auth_challenge(
            ClientId=USER_POOL_CLIENT_ID,
            ChallengeName='SOFTWARE_TOKEN_MFA',
            Session=session,
            ChallengeResponses={
                'USERNAME': username,
                'SOFTWARE_TOKEN_MFA_CODE': code,
            },
        )
        tokens = result['AuthenticationResult']
        return ok({
            'access_token': tokens['AccessToken'],
            'id_token': tokens['IdToken'],
            'refresh_token': tokens['RefreshToken'],
            'expires_in': tokens['ExpiresIn'],
        })
    except ClientError as e:
        code = e.response['Error']['Code']
        msg = e.response['Error'].get('Message', '')
        if code == 'CodeMismatchException':
            return _build(401, {'message': 'Código incorrecto'})
        if code == 'ExpiredCodeException':
            return _build(401, {'message': 'Código expirado. Vuelve a iniciar sesión.'})
        if code == 'NotAuthorizedException':
            if 'session' in msg.lower() or 'expired' in msg.lower():
                return _build(401, {'message': 'La sesión expiró. Vuelve a iniciar sesión.'})
            return _build(401, {'message': 'No autorizado'})
        if code == 'TooManyRequestsException':
            return _build(429, {'message': 'Demasiados intentos. Espera unos minutos.'})
        return _build(500, {'message': f'Error MFA: {code}'})


def mfa_setup(event):
    """Inicia el setup de TOTP: devuelve secretCode para QR y clave manual."""
    try:
        body = json.loads(event.get('body') or '{}')
        session = body.get('session')

        if session:
            result = cognito.associate_software_token(Session=session)
        else:
            # Preferir access_token del body, luego del header Authorization
            access_token = body.get('access_token') or _get_access_token(event)
            if not access_token:
                return _build(401, {'message': 'No autorizado'})
            result = cognito.associate_software_token(AccessToken=access_token)

        secret = result['SecretCode']
        new_session = result.get('Session')

        return ok({
            'secret_code': secret,
            'session': new_session,
        })
    except ClientError as e:
        return _build(500, {'message': f'Error setup MFA: {e.response["Error"]["Code"]}'})


def mfa_verify(event):
    """Verifica el código TOTP y activa MFA para el usuario."""
    try:
        body = json.loads(event.get('body') or '{}')
        code = body.get('code')
        session = body.get('session')
        if not code:
            return bad_request('code requerido')

        if session:
            result = cognito.verify_software_token(
                Session=session,
                UserCode=code,
                FriendlyDeviceName='Autenticador',
            )
            if result.get('Status') != 'SUCCESS':
                return _build(400, {'message': 'Verificación fallida'})
            return ok({'message': 'MFA configurado. Inicia sesión nuevamente.'})
        else:
            access_token = body.get('access_token') or _get_access_token(event)
            if not access_token:
                return _build(401, {'message': 'No autorizado'})
            result = cognito.verify_software_token(
                AccessToken=access_token,
                UserCode=code,
                FriendlyDeviceName='Autenticador',
            )
            if result.get('Status') != 'SUCCESS':
                return _build(400, {'message': 'Verificación fallida'})
            # Activar MFA usando admin API con username de DynamoDB
            claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
            cognito_sub = claims.get('sub')
            username = None
            if cognito_sub:
                table = dynamodb.Table(USUARIOS_TABLE)
                item = table.get_item(Key={'pk': f'USUARIO#{cognito_sub}', 'sk': 'METADATA'}).get('Item')
                if item:
                    username = item.get('cognito_username')
            if username:
                cognito.admin_set_user_mfa_preference(
                    UserPoolId=USER_POOL_ID,
                    Username=username,
                    SoftwareTokenMfaSettings={'Enabled': True, 'PreferredMfa': True},
                )
            return ok({'message': 'MFA activado correctamente'})
    except ClientError as e:
        code_err = e.response['Error']['Code']
        if code_err == 'EnableSoftwareTokenMFAException':
            return _build(400, {'message': 'Código incorrecto'})
        return _build(500, {'message': f'Error verificación MFA: {code_err}'})


ROLES_INTERNOS = {'admin', 'coordinador', 'supervisor'}

def me(event):
    try:
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        cognito_sub = claims.get('sub')
        if not cognito_sub:
            return _build(401, {'message': 'No autorizado'})

        table = dynamodb.Table(USUARIOS_TABLE)
        item = table.get_item(Key={'pk': f'USUARIO#{cognito_sub}', 'sk': 'METADATA'}).get('Item')
        if not item:
            return not_found('Usuario no encontrado')
        if not item.get('activo', True):
            return forbidden('Usuario deshabilitado')

        perfil = {
            'sub': cognito_sub,
            'nombre': item.get('nombre'),
            'rol': item.get('rol'),
            'inmobiliaria_id': item.get('inmobiliaria_id'),
            'activo': item.get('activo'),
        }

        # Detectar si usuario interno no tiene MFA configurado
        if item.get('rol') in ROLES_INTERNOS:
            username = item.get('cognito_username')
            if username:
                user_data = cognito.admin_get_user(
                    UserPoolId=USER_POOL_ID,
                    Username=username,
                )
                tiene_mfa = 'SOFTWARE_TOKEN_MFA' in user_data.get('UserMFASettingList', [])
                if not tiene_mfa:
                    perfil['mfa_required'] = True

        if item.get('rol') == 'inmobiliaria' and item.get('inmobiliaria_id'):
            inmo = table.get_item(
                Key={'pk': item['inmobiliaria_id'], 'sk': 'METADATA'}
            ).get('Item', {})
            perfil['proyectos'] = inmo.get('proyectos', [])
            perfil['inmobiliaria_nombre'] = inmo.get('nombre')

        return ok(perfil)
    except Exception:
        import traceback
        print(f"ERROR en me(): {traceback.format_exc()}")
        return _build(500, {'message': 'Error interno'})


def _get_access_token(event):
    """Extrae el access token del header Authorization."""
    headers = event.get('headers') or {}
    auth = headers.get('Authorization') or headers.get('authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None
