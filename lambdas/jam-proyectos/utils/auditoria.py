import os
import uuid
from datetime import datetime, timezone

import boto3


dynamodb = boto3.resource('dynamodb')


def registrar_auditoria(event, accion, modulo, entidad_tipo=None, entidad_id=None,
                        resultado='completado', detalles=None):
    table_name = os.environ.get('AUDIT_TABLE')
    if not table_name:
        return False
    claims = ((event or {}).get('requestContext') or {}).get('authorizer', {}).get('claims', {})
    sub = claims.get('sub') or claims.get('username')
    timestamp = datetime.now(timezone.utc).isoformat()
    event_id = str(uuid.uuid4())
    detalles = detalles or {}
    entidad_nombre = detalles.get('entidad_nombre') or detalles.get('nombre_manual') or detalles.get('nombre') or detalles.get('titulo') or detalles.get('nombre_creado') or detalles.get('unidad_nombre') or ''
    item = {
        'pk': f'AUDITORIA#{timestamp[:10]}', 'sk': f'{timestamp}#{event_id}',
        'tipo': 'AUDITORIA', 'evento_id': event_id, 'fecha': timestamp,
        'accion': accion, 'modulo': modulo, 'resultado': resultado,
        'usuario_sub': sub or 'sistema',
        'usuario_nombre': claims.get('name') or claims.get('cognito:username') or claims.get('email') or 'Sistema',
        'usuario_rol': claims.get('custom:rol') or claims.get('cognito:groups') or '',
        'entidad_tipo': entidad_tipo or 'general', 'entidad_id': entidad_id or 'general', 'entidad_nombre': entidad_nombre,
        'GSI1PK': f"USUARIO#{sub or 'sistema'}", 'GSI1SK': f'{timestamp}#{event_id}',
        'GSI2PK': f"ENTIDAD#{entidad_tipo or 'general'}#{entidad_id or 'general'}", 'GSI2SK': f'{timestamp}#{event_id}',
        'GSI3PK': f'ACCION#{accion}', 'GSI3SK': f'{timestamp}#{event_id}',
    }
    if detalles:
        item['detalles'] = detalles
    try:
        dynamodb.Table(table_name).put_item(Item=item)
        return True
    except Exception as exc:
        print(f'[AUDITORIA] no se pudo registrar {accion}: {exc}')
        return False
