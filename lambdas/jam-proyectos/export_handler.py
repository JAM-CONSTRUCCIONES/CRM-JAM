import json

from utils.auth import get_rol, require_admin
from utils.response import forbidden, not_found
from routes import excel


def handler(event, context):
    """API de exportaciones pesadas de inventario/proyectos."""
    try:
        if event.get('action') == 'generar_exportacion_inventario':
            return excel.procesar_exportacion_inventario(event, get_rol(event))

        method = event.get('httpMethod')
        path = event.get('path', '')
        if not require_admin(event):
            return forbidden()

        if method == 'POST' and path.endswith('/inventario/exportar'):
            body = json.loads(event.get('body') or '{}')
            if body.get('action') == 'status':
                job_id = body.get('job_id')
                if not job_id:
                    return excel.bad_request('job_id requerido')
                return excel.estado_exportacion_inventario(job_id)
            return excel.iniciar_exportacion_inventario(event, get_rol(event))

        return not_found('Ruta de exportación no encontrada')
    except Exception as exc:
        print(f'ERROR export_handler: {type(exc).__name__}: {exc}')
        return excel.bad_request(f'Error en exportación: {exc}')
