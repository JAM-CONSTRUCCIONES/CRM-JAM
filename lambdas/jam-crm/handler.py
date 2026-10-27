from utils.auth import require_admin, get_rol
from utils.response import forbidden, not_found, bad_request
from routes import estatus as estatus_routes
from routes import analytics as analytics_routes
from routes import traspaso_cliente as traspaso_cliente_routes
from routes import meta as meta_routes
from routes import auditoria as auditoria_routes


def handler(event, context):
    if event.get('source') == 'scheduler' and event.get('tipo') == 'alerta_reserva_vencida':
        estatus_routes.manejar_alerta_reserva(event)
        return {'statusCode': 200}

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
        query = event.get('queryStringParameters') or {}
        if query.get('tipo') == 'meta-leads':
            return meta_routes.listar_leads(event)
        if query.get('tipo') == 'meta-formularios':
            return meta_routes.listar_formularios(event)
        if query.get('tipo') == 'meta-conversacion':
            return meta_routes.ver_conversacion(event)
        if query.get('tipo') == 'meta-media-upload':
            return meta_routes.get_media_upload_url(event)
        if query.get('tipo') == 'auditoria':
            if not es_admin:
                return forbidden()
            return auditoria_routes.listar(event)
        if query.get('tipo') == 'meta-facebook-oauth-url':
            return meta_routes.facebook_oauth_url(event)
        return estatus_routes.listar_todos_procesos(event)

    if method == 'PUT' and path == '/admin/procesos':
        if not es_admin:
            return forbidden()
        query = event.get('queryStringParameters') or {}
        if query.get('tipo') == 'meta-lead' and query.get('accion') == 'convertir':
            return meta_routes.convertir_lead(event)
        if query.get('tipo') == 'meta-lead' and query.get('accion') == 'asociar-cliente':
            return meta_routes.asociar_cliente_existente(event)
        if query.get('tipo') == 'meta-contacto-nombre':
            return meta_routes.renombrar_contacto(event)
        if query.get('tipo') == 'meta-lead':
            return meta_routes.gestionar_lead(event)

    if method == 'POST' and path == '/admin/procesos':
        query = event.get('queryStringParameters') or {}
        # Enriquecer un lote de procesos (página visible). Accesible a internos e inmobiliaria.
        if query.get('tipo') == 'enriquecer-procesos':
            if not es_admin and get_rol(event) != 'inmobiliaria':
                return forbidden()
            return estatus_routes.enriquecer_lote(event)
        if not es_admin:
            return forbidden()
        if query.get('tipo') == 'meta-mensaje':
            return meta_routes.enviar_mensaje(event)
        if query.get('tipo') == 'meta-facebook-callback':
            return meta_routes.facebook_oauth_callback(event)

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

    query = event.get('queryStringParameters') or {}

    if method == 'PUT' and query.get('accion') == 'eliminar' and rol != 'admin':
        return forbidden('Solo administrador puede eliminar')

    # Reutiliza el recurso /estatus para no aumentar los recursos de API Gateway.
    if (
        method == 'PUT' and path.endswith('/estatus') and
        query.get('accion') == 'traspasar_cliente'
    ):
        return traspaso_cliente_routes.traspasar_cliente(
            event, cedula, proyecto_id, unidad_id
        )

    # PUT /admin/clientes/{cedula}/proyecto/{proyecto_id}/unidad/{unidad_id}/estatus
    if method == 'PUT' and path.endswith('/estatus'):
        return estatus_routes.cambiar_estatus(event, cedula, proyecto_id, unidad_id)

    # GET /admin/clientes/{cedula}/proyecto/{proyecto_id}/unidad/{unidad_id}/historial
    if method == 'GET' and path.endswith('/historial'):
        return estatus_routes.ver_historial(event, cedula, proyecto_id, unidad_id)

    return not_found()
