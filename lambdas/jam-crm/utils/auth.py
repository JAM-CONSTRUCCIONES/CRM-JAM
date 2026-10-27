import os

import boto3


_dynamodb = boto3.resource('dynamodb')


def get_claims(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})


def get_sub(event):
    return get_claims(event).get('sub')


def get_nombre(event):
    claims = get_claims(event)
    sub = claims.get('sub')
    table_name = os.environ.get('USUARIOS_TABLE', '')
    if sub and table_name:
        try:
            usuario = _dynamodb.Table(table_name).get_item(
                Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}
            ).get('Item') or {}
            nombre = str(usuario.get('nombre') or '').strip()
            if nombre:
                return nombre
        except Exception:
            pass
    return claims.get('name') or claims.get('cognito:username', 'admin')


def require_admin(event):
    groups = get_claims(event).get('cognito:groups', '')
    return any(g in groups for g in ('admin', 'coordinador', 'supervisor'))


def get_rol(event):
    groups = get_claims(event).get('cognito:groups', '')
    for rol in ('admin', 'coordinador', 'supervisor'):
        if rol in groups:
            return rol
    return 'inmobiliaria'
