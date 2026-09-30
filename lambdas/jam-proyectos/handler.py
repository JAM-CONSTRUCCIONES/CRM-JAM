from utils.auth import get_rol, require_admin
from utils.response import forbidden, not_found
from routes import proyectos, etapas, unidades, excel


# Acciones directas desde Step Function (no tienen httpMethod)
_SF_ACTIONS = {
    'sf_eliminar_preparar':    proyectos.sf_eliminar_preparar,
    'sf_eliminar_schedules':   proyectos.sf_eliminar_schedules,
    'sf_eliminar_desvincular': proyectos.sf_eliminar_desvincular,
    'sf_eliminar_inventario':  proyectos.sf_eliminar_inventario,
    'sf_eliminar_finalizar':   proyectos.sf_eliminar_finalizar,
}


def handler(event, context):
    try:
        # ── Invocación directa desde Step Function ────────────────────────────
        if not event.get('httpMethod') and event.get('action'):
            fn = _SF_ACTIONS.get(event['action'])
            if fn:
                # Lanza excepción en error; SF lo captura como tarea fallida
                return fn(event)
            raise ValueError(f"Acción SF desconocida: {event['action']}")

        # ── Petición HTTP normal ──────────────────────────────────────────────
        method = event.get('httpMethod')
        path = event.get('path', '')
        rol = get_rol(event)
        path_params = event.get('pathParameters') or {}
        proyecto_id = path_params.get('proyecto_id')
        unidad_id = path_params.get('unidad_id')
        etapa_id = path_params.get('etapa_id')
        job_id = path_params.get('job_id')
        is_admin = '/admin/' in path or path.startswith('/admin/')

        # ===== LECTURA =====

        if method == 'GET' and path == '/proyectos':
            return proyectos.listar(event)

        if method == 'GET' and proyecto_id and path.endswith(f'/{proyecto_id}'):
            return proyectos.detalle(proyecto_id)

        if method == 'GET' and path.endswith('/etapas'):
            return etapas.listar(proyecto_id)

        if method == 'GET' and proyecto_id and path.endswith('/unidades'):
            return unidades.listar(proyecto_id, event, rol)

        if method == 'GET' and unidad_id:
            return unidades.detalle(proyecto_id, unidad_id, rol, event)

        if method == 'GET' and path.endswith('/inventario/exportar'):
            return excel.exportar_inventario(event, rol)

        # ===== ADMIN: guard =====
        if is_admin and not require_admin(event):
            return forbidden()

        if method == 'DELETE' and is_admin and rol != 'admin':
            return forbidden('Solo administrador puede eliminar')

        # ===== MIGRACIONES EXCEL =====

        if method == 'GET' and path.endswith('/inventario/upload-url'):
            return excel.get_upload_url(event)

        if method == 'GET' and job_id and '/inventario/preview/' in path:
            return excel.get_preview(job_id)

        if method == 'POST' and job_id and '/inventario/confirmar/' in path:
            return excel.confirmar(job_id, event)

        if method == 'GET' and job_id and '/inventario/reportes/' in path:
            return excel.get_reporte(job_id)

        if method == 'GET' and '/inventario/reportes' in path and not job_id:
            return excel.listar_reportes(event)

        # ===== PROYECTOS =====

        if method == 'POST' and path == '/admin/proyectos':
            return proyectos.crear(event)

        if method == 'PUT' and proyecto_id and path.endswith(f'/{proyecto_id}') and is_admin:
            return proyectos.actualizar(proyecto_id, event)

        if method == 'DELETE' and proyecto_id and path.endswith(f'/{proyecto_id}') and is_admin:
            return proyectos.iniciar_eliminacion(proyecto_id)

        if method == 'POST' and path.endswith('/imagen') and is_admin:
            return proyectos.presigned_imagen(proyecto_id, event)

        # ===== ETAPAS =====

        if method == 'POST' and path.endswith('/etapas') and is_admin:
            return etapas.crear(proyecto_id, event)

        if method == 'PUT' and etapa_id and is_admin:
            return etapas.actualizar(proyecto_id, etapa_id, event)

        if method == 'DELETE' and etapa_id and is_admin:
            return etapas.eliminar(proyecto_id, etapa_id)

        # ===== UNIDADES =====

        if method == 'POST' and path.endswith('/unidades') and is_admin:
            return unidades.crear(proyecto_id, event)

        if method == 'PUT' and unidad_id and is_admin:
            return unidades.actualizar(proyecto_id, unidad_id, event)

        if method == 'DELETE' and unidad_id and is_admin:
            return unidades.eliminar(proyecto_id, unidad_id)

        return not_found()
    
    except Exception as e:
        # Capturar cualquier excepción no manejada para evitar 502
        print(f'Error no manejado en handler: {e}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': '{"message": "Error interno del servidor"}',
        }
