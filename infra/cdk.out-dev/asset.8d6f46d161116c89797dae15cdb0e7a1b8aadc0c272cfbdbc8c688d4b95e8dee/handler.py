from utils.auth import require_admin, get_rol
from utils.response import forbidden, not_found, bad_request
from routes import estatus as estatus_routes
from routes import analytics as analytics_routes


def handler(event, context):
    # Invocación desde EventBridge Scheduler (alerta separación vencida)
    if event.get('source') == 'scheduler' and event.get('tipo') == 'alerta_separacion_vencida':
        estatus_routes.manejar_alerta_separacion(event)
        return {'statusCode': 200}

    method = event.get('httpMethod')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    cedula = path_params.get('cedula')
    proyecto_id = path_params.get('proyecto_id')
    unidad_id = path_params.get('unidad_id')

    rol = get_rol(event)
    es_admin = require_admin(event)

    # GET /admin/analytics — accesible para internos e inmobiliaria (solo sus proyectos)
    if method == 'GET' and path.endswith('/analytics'):
        return analytics_routes.get_analytics(event)

    # GET /admin/procesos — accesible para internos; inmobiliaria solo ve sus propios procesos
    if method == 'GET' and path == '/admin/procesos':
        if not es_admin and get_rol(event) != 'inmobiliaria':
            return forbidden()
        return estatus_routes.listar_todos_procesos(event)

    # El resto de endpoints solo para admin/coordinador/supervisor
    if not es_admin:
        return forbidden()

    # GET /admin/clientes/{cedula}/procesos
    if method == 'GET' and cedula and path.endswith('/procesos'):
        return estatus_routes.listar_procesos(event, cedula)

    # POST /admin/clientes/{cedula}/procesos — DESHABILITADO
    # La asignación de unidades se hace exclusivamente desde el flujo de bloqueos
    # if method == 'POST' and cedula and path.endswith('/procesos'):
    #     return estatus_routes.crear_proceso_admin(event, cedula)

    if not cedula or not proyecto_id or not unidad_id:
        return bad_request('cedula, proyecto_id y unidad_id son requeridos')

    # PUT /admin/clientes/{cedula}/proyecto/{proyecto_id}/unidad/{unidad_id}/estatus
    if method == 'PUT' and path.endswith('/estatus'):
        return estatus_routes.cambiar_estatus(event, cedula, proyecto_id, unidad_id)

    # GET /admin/clientes/{cedula}/proyecto/{proyecto_id}/unidad/{unidad_id}/historial
    if method == 'GET' and path.endswith('/historial'):
        return estatus_routes.ver_historial(event, cedula, proyecto_id, unidad_id)

    return not_found()
