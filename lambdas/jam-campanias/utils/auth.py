ROLES_INTERNOS = ('admin', 'coordinador', 'supervisor')
ROLES_ENVIO = ('admin', 'coordinador')


def get_claims(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})


def get_rol(event):
    groups = get_claims(event).get('cognito:groups', '')
    for rol in ROLES_INTERNOS:
        if rol in groups:
            return rol
    return 'inmobiliaria'


def get_usuario(event):
    claims = get_claims(event)
    return {
        'sub': claims.get('sub', ''),
        'email': claims.get('email', ''),
        'nombre': claims.get('name') or claims.get('cognito:username') or claims.get('email') or '',
        'rol': get_rol(event),
    }


def puede_ver(event):
    return get_rol(event) in ROLES_INTERNOS


def puede_enviar(event):
    return get_rol(event) in ROLES_ENVIO
