import os
import uuid
from datetime import datetime, timezone

import boto3


_dynamodb = boto3.resource('dynamodb')


def registrar_auditoria(event, accion, modulo, entidad_tipo=None, entidad_id=None,
                        resultado='completado', detalles=None, datos_anteriores=None,
                        datos_nuevos=None):
    """Escribe un movimiento persistente sin interrumpir la operación principal."""
    tabla_nombre = os.environ.get('AUDIT_TABLE', '')
    if not tabla_nombre:
        return False

    ahora = datetime.now(timezone.utc)
    timestamp = ahora.isoformat()
    claims = (event or {}).get('requestContext', {}).get('authorizer', {}).get('claims', {})
    sub = claims.get('sub') or ''
    username = claims.get('cognito:username') or claims.get('username') or ''
    rol = claims.get('cognito:groups') or 'sistema'
    if isinstance(rol, list):
        rol = ','.join(rol)

    nombre = claims.get('name') or username or 'Sistema'
    usuarios_nombre = os.environ.get('USUARIOS_TABLE', '')
    if sub and usuarios_nombre:
        try:
            usuario = _dynamodb.Table(usuarios_nombre).get_item(
                Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}
            ).get('Item') or {}
            nombre = usuario.get('nombre') or nombre
            rol = usuario.get('rol') or rol
        except Exception:
            pass

    request_context = (event or {}).get('requestContext') or {}
    request_id = request_context.get('requestId') or request_context.get('extendedRequestId') or ''
    actor_tipo = 'usuario' if sub else 'sistema'
    event_id = str(uuid.uuid4())
    detalles = detalles or {}
    entidad_nombre = detalles.get('entidad_nombre') or detalles.get('nombre_manual') or detalles.get('nombre') or detalles.get('titulo') or detalles.get('nombre_creado') or detalles.get('unidad_nombre') or ''
    item = {
        'pk': f'AUDITORIA#{ahora.date().isoformat()}',
        'sk': f'{timestamp}#{event_id}',
        'tipo': 'AUDITORIA',
        'evento_id': event_id,
        'fecha': timestamp,
        'accion': accion,
        'modulo': modulo,
        'resultado': resultado,
        'actor_tipo': actor_tipo,
        'usuario_sub': sub,
        'usuario_nombre': nombre,
        'usuario_username': username,
        'rol': rol,
        'request_id': request_id,
        'metodo': (event or {}).get('httpMethod') or '',
        'ruta': (event or {}).get('path') or '',
        'entidad_tipo': entidad_tipo or '',
        'entidad_id': entidad_id or '', 'entidad_nombre': entidad_nombre,
        'GSI1PK': f'USUARIO#{sub or "SISTEMA"}',
        'GSI1SK': f'{timestamp}#{event_id}',
        'GSI2PK': f'ENTIDAD#{entidad_tipo or "general"}#{entidad_id or "general"}',
        'GSI2SK': f'{timestamp}#{event_id}',
        'GSI3PK': f'ACCION#{accion}',
        'GSI3SK': f'{timestamp}#{event_id}',
    }
    for key, value in detalles.items():
        if value is not None:
            item[key] = value
    if datos_anteriores is not None:
        item['datos_anteriores'] = datos_anteriores
    if datos_nuevos is not None:
        item['datos_nuevos'] = datos_nuevos

    try:
        _dynamodb.Table(tabla_nombre).put_item(Item=item)
        return True
    except Exception as exc:
        print(f'[AUDITORIA] No se pudo guardar {accion}: {type(exc).__name__}: {exc}')
        return False
