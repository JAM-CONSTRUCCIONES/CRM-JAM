import json
from utils.auth import get_rol, require_admin
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

    if method == 'GET' and path == '/publico/inmobiliarias':
        return clientes.listar_inmobiliarias_publico(event)

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

    qs = event.get('queryStringParameters') or {}
    es_eliminacion_cliente = (
        (method in ('DELETE', 'POST') and path == '/admin/clientes/eliminar') or
        (method == 'PUT' and qs.get('accion') == 'eliminar') or
        (method == 'DELETE' and cedula and proyecto_id and is_admin) or
        (method == 'POST' and cedula and proyecto_id and path.endswith('/eliminar') and is_admin)
    )
    if es_eliminacion_cliente and get_rol(event) != 'admin':
        return forbidden('Solo administrador puede eliminar')

    if method == 'GET' and path == '/admin/clientes/buscar':
        # Nuevo endpoint de búsqueda general
        return clientes.buscar_clientes_admin(event)

    if method == 'POST' and path == '/admin/clientes/eliminar':
        # Eliminar cliente completamente (todos los registros)
        body = json.loads(event.get('body') or '{}')
        cedula_eliminar = body.get('cedula')
        proyecto_eliminar = body.get('proyecto_id')
        if not cedula_eliminar or not proyecto_eliminar:
            from utils.response import bad_request as br
            return br('cedula y proyecto_id son requeridos')
        return clientes.eliminar_admin(event, cedula_eliminar, proyecto_eliminar)

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
        # Verificar si es una eliminación (workaround para evitar problemas con DELETE)
        qs = event.get('queryStringParameters') or {}
        if qs.get('accion') == 'eliminar':
            return clientes.eliminar_admin(event, cedula, proyecto_id)
        return clientes.actualizar_admin(event, cedula, proyecto_id)

    if method == 'DELETE' and cedula and proyecto_id and is_admin:
        return clientes.eliminar_admin(event, cedula, proyecto_id)

    # POST /admin/clientes/{cedula}/proyecto/{proyecto_id}/eliminar (alternativa a DELETE)
    if method == 'POST' and cedula and proyecto_id and path.endswith('/eliminar') and is_admin:
        return clientes.eliminar_admin(event, cedula, proyecto_id)

    import json as _json
    print('UNMATCHED EVENT:', _json.dumps({
        'method': method, 'path': path, 'is_admin': is_admin,
        'cedula': cedula, 'proyecto_id': proyecto_id,
        'pathParameters': path_params,
    }))
    return not_found()
