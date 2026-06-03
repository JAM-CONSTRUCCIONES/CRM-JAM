def get_claims(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})


ROLES_INTERNOS = ('admin', 'coordinador', 'supervisor')
def get_rol(event):
    claims = get_claims(event)
    groups = claims.get('cognito:groups', '')
    for rol in ROLES_INTERNOS:
        if rol in groups:
            return rol
    return 'inmobiliaria'


def get_inmobiliaria_id(event):
    """Retorna el inmobiliaria_id del token (sub del usuario)."""
    claims = get_claims(event)
    return claims.get('custom:inmobiliaria_id') or claims.get('sub')


def require_admin(event):
    return get_rol(event) in ROLES_INTERNOS
