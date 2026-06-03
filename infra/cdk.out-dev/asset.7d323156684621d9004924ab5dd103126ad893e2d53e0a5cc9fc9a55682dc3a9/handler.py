from utils.auth import require_admin, get_rol, get_claims
from utils.response import forbidden, not_found, bad_request
from routes import bloqueos, admin_bloqueos, scheduler_handler, historial


def handler(event, context):
    # Eventos de EventBridge Scheduler (no tienen httpMethod)
    if 'accion' in event:
        return scheduler_handler.handle(event)

    method = event.get('httpMethod')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    unidad_id = path_params.get('unidad_id')
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')

    is_admin = '/admin/' in path or path.startswith('/admin/')

    # Verificar que hay sesión válida para todas las rutas (excepto scheduler)
    claims = get_claims(event)
    if not claims.get('sub'):
        return forbidden()

    # ===== INMOBILIARIA =====

    if method == 'POST' and path == '/bloqueos':
        return bloqueos.bloquear(event)

    if method == 'GET' and path == '/bloqueos/activos':
        return bloqueos.listar_activos(event)

    # ===== ADMIN: guard =====
    if is_admin and not require_admin(event):
        return forbidden()

    if method == 'GET' and path == '/admin/bloqueos/historial':
        return historial.listar(event)

    if method == 'DELETE' and unidad_id and '/admin/bloqueos/' in path:
        return admin_bloqueos.liberar(proyecto_id, unidad_id, event)

    if method == 'PUT' and unidad_id and path.endswith('/extender'):
        return admin_bloqueos.extender(proyecto_id, unidad_id, event)

    return not_found()
