def get_claims(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})


def get_sub(event):
    return get_claims(event).get('sub')


def get_nombre(event):
    claims = get_claims(event)
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
