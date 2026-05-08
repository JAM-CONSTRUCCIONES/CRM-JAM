from utils.auth import require_admin
from utils.response import forbidden, not_found
from routes import clientes, scheduler_handler


def handler(event, context):
    # Eventos de EventBridge Scheduler
    if 'accion' in event:
        return scheduler_handler.handle(event)

    method = event.get('httpMethod')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    cedula = path_params.get('cedula')
    proyecto_id = path_params.get('proyecto_id')
    is_admin = '/admin/' in path or path.startswith('/admin/')

    # ===== PÚBLICO (sin auth) =====

    if method == 'POST' and path == '/publico/clientes':
        return clientes.registrar_publico(event)

    if method == 'GET' and path == '/publico/proyectos':
        return clientes.listar_proyectos_publico(event)

    # ===== INMOBILIARIA =====

    if method == 'POST' and path == '/clientes':
        return clientes.registrar(event)

    if method == 'GET' and path == '/clientes':
        return clientes.listar(event)

    if method == 'GET' and cedula and path == f'/clientes/{cedula}':
        return clientes.buscar_por_cedula(event, cedula)

    if method == 'GET' and path == '/mis-procesos':
        return clientes.listar_mis_procesos(event)

    # ===== ADMIN: guard =====
    if is_admin and not require_admin(event):
        return forbidden()

    if method == 'GET' and path == '/admin/clientes/buscar':
        # Nuevo endpoint de búsqueda general
        return clientes.buscar_clientes_admin(event)

    if method == 'GET' and path == '/admin/clientes':
        return clientes.listar_admin(event)

    if method == 'GET' and path == '/admin/clientes/buscar-cedula':
        # Endpoint legacy para búsqueda por cédula específica
        qs_params = event.get('queryStringParameters') or {}
        cedula_buscar = qs_params.get('cedula', '').strip()
        if not cedula_buscar:
            from utils.response import bad_request as br
            return br('cedula es requerido')
        return clientes.buscar_por_cedula_admin(event, cedula_buscar)

    # /admin/clientes/{cedula}/proyecto/{proyecto_id}
    if method == 'GET' and cedula and proyecto_id and is_admin:
        return clientes.detalle_admin(event, cedula, proyecto_id)

    if method == 'PUT' and cedula and proyecto_id and is_admin:
        return clientes.actualizar_admin(event, cedula, proyecto_id)

    import json as _json
    print('UNMATCHED EVENT:', _json.dumps({
        'method': method, 'path': path, 'is_admin': is_admin,
        'cedula': cedula, 'proyecto_id': proyecto_id,
        'pathParameters': path_params,
    }))
    return not_found()
