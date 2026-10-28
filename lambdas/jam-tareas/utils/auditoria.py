import os
import os
import uuid
from datetime import datetime, timezone
import boto3

dynamodb = boto3.resource('dynamodb')

def registrar_auditoria(event, accion, modulo, entidad_tipo=None, entidad_id=None, resultado='completado', detalles=None):
    table_name = os.environ.get('AUDIT_TABLE')
    if not table_name:
        return False
    claims = ((event or {}).get('requestContext') or {}).get('authorizer', {}).get('claims', {})
    sub = claims.get('sub') or claims.get('username') or ''
    username = claims.get('cognito:username') or claims.get('username') or ''
    nombre = claims.get('name') or username or 'Sistema'
    rol = claims.get('custom:rol') or claims.get('cognito:groups') or 'sistema'
    if isinstance(rol, list):
        rol = ','.join(rol)
    usuarios_table_name = os.environ.get('USUARIOS_TABLE', '')
    if sub and usuarios_table_name:
        try:
            usuario = dynamodb.Table(usuarios_table_name).get_item(
                Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}
            ).get('Item') or {}
            nombre = usuario.get('nombre') or nombre
            rol = usuario.get('rol') or rol
            username = usuario.get('cognito_username') or username
        except Exception:
            pass
    ts = datetime.now(timezone.utc).isoformat()
    event_id = str(uuid.uuid4())
    detalles = detalles or {}
    entidad_nombre = detalles.get('entidad_nombre') or detalles.get('nombre_manual') or detalles.get('nombre') or detalles.get('titulo') or detalles.get('nombre_creado') or detalles.get('unidad_nombre') or ''
    item = {
        'pk': f'AUDITORIA#{ts[:10]}', 'sk': f'{ts}#{event_id}', 'tipo': 'AUDITORIA',
        'evento_id': event_id, 'fecha': ts, 'accion': accion, 'modulo': modulo,
        'resultado': resultado,
        'actor_tipo': 'usuario' if sub else 'sistema',
        'usuario_sub': sub,
        'usuario_nombre': nombre,
        'usuario_username': username,
        'rol': rol,
        'usuario_rol': rol,
        'entidad_tipo': entidad_tipo or 'general', 'entidad_id': entidad_id or 'general', 'entidad_nombre': entidad_nombre,
        'GSI1PK': f'USUARIO#{sub}', 'GSI1SK': f'{ts}#{event_id}',
        'GSI2PK': f"ENTIDAD#{entidad_tipo or 'general'}#{entidad_id or 'general'}", 'GSI2SK': f'{ts}#{event_id}',
        'GSI3PK': f'ACCION#{accion}', 'GSI3SK': f'{ts}#{event_id}',
    }
    if detalles: item['detalles'] = detalles
    try:
        dynamodb.Table(table_name).put_item(Item=item)
        return True
    except Exception as exc:
        print(f'[AUDITORIA] no se pudo registrar {accion}: {exc}')
        return False
