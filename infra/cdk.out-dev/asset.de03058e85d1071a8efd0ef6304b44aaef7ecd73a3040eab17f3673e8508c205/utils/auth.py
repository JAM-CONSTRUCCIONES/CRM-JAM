def get_claims(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})


ROLES_INTERNOS = ('admin', 'coordinador', 'supervisor')

def get_rol(event):
    groups = get_claims(event).get('cognito:groups', '')
    for rol in ROLES_INTERNOS:
        if rol in groups:
            return rol
    return 'inmobiliaria'


def get_sub(event):
    return get_claims(event).get('sub')


def require_admin(event):
    return get_rol(event) in ROLES_INTERNOS
