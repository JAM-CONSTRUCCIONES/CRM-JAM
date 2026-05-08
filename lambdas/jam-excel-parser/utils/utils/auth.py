ROLES_INTERNOS = ('admin', 'coordinador', 'supervisor')

def get_rol(event):
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    groups = claims.get('cognito:groups', '')
    for rol in ROLES_INTERNOS:
        if rol in groups:
            return rol
    return 'inmobiliaria'


def require_admin(event):
    """Retorna True si es rol interno (admin, coordinador, supervisor)."""
    return get_rol(event) in ROLES_INTERNOS
