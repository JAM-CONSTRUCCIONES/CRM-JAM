import os
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

from utils.response import ok, bad_request


dynamodb = boto3.resource('dynamodb')
AUDIT_TABLE = os.environ.get('AUDIT_TABLE', '')


def listar(event):
    if not AUDIT_TABLE:
        return bad_request('AUDIT_TABLE no configurada')

    params = event.get('queryStringParameters') or {}
    fecha = str(params.get('fecha') or datetime.now(timezone.utc).date().isoformat())
    try:
        limit = max(1, min(int(params.get('limit') or 100), 200))
    except (TypeError, ValueError):
        limit = 100

    table = dynamodb.Table(AUDIT_TABLE)
    result = table.query(
        KeyConditionExpression=Key('pk').eq(f'AUDITORIA#{fecha}'),
        ScanIndexForward=False,
        Limit=limit,
    )
    items = result.get('Items', [])
    filtros = {
        'usuario_sub': params.get('usuario_sub'),
        'accion': params.get('accion'),
        'modulo': params.get('modulo'),
        'entidad_tipo': params.get('entidad_tipo'),
        'resultado': params.get('resultado'),
    }
    items = [
        item for item in items
        if all(not value or str(item.get(key, '')) == str(value) for key, value in filtros.items())
    ]
    return ok({
        'items': items,
        'fecha': fecha,
        'count': len(items),
        'last_key': result.get('LastEvaluatedKey'),
    })
