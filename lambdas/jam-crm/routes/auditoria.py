import base64
import base64
import json
import os
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr, Key

from utils.response import ok, bad_request


dynamodb = boto3.resource('dynamodb')
AUDIT_TABLE = os.environ.get('AUDIT_TABLE', '')
USUARIOS_TABLE = os.environ.get('USUARIOS_TABLE', '')


def opciones(event):
    """Devuelve actores para los filtros, conservando usuarios históricos."""
    if not USUARIOS_TABLE:
        return ok({'actores': [{'value': 'usuario', 'label': 'Usuarios'}, {'value': 'sistema', 'label': 'Sistema'}], 'usuarios': []})

    table = dynamodb.Table(USUARIOS_TABLE)
    usuarios = []
    last_key = None
    while True:
        kwargs = {
            'IndexName': 'gsi-tipo',
            'KeyConditionExpression': Key('tipo').eq('USUARIO'),
            'ProjectionExpression': 'pk, #n, cognito_username, rol, activo',
            'ExpressionAttributeNames': {'#n': 'nombre'},
        }
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key
        result = table.query(**kwargs)
        usuarios.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break

    opciones_usuarios = []
    for item in usuarios:
        sub = str(item.get('pk') or '').replace('USUARIO#', '')
        if not sub:
            continue
        nombre = item.get('nombre') or item.get('cognito_username') or sub
        opciones_usuarios.append({
            'value': sub,
            'label': nombre,
            'username': item.get('cognito_username') or '',
            'rol': item.get('rol') or '',
            'activo': item.get('activo', True),
        })

    opciones_usuarios.sort(key=lambda item: str(item['label']).lower())
    return ok({
        'actores': [
            {'value': 'usuario', 'label': 'Usuarios'},
            {'value': 'sistema', 'label': 'Sistema'},
        ],
        'usuarios': opciones_usuarios,
    })


def listar(event):
    if not AUDIT_TABLE:
        return bad_request('AUDIT_TABLE no configurada')

    params = event.get('queryStringParameters') or {}
    fecha = str(params.get('fecha') or datetime.now(timezone.utc).date().isoformat())
    try:
        fecha_dia = datetime.fromisoformat(fecha).date()
    except ValueError:
        return bad_request('fecha invalida; usa YYYY-MM-DD')
    try:
        limit = max(1, min(int(params.get('limit') or 50), 100))
    except (TypeError, ValueError):
        limit = 50

    table = dynamodb.Table(AUDIT_TABLE)
    usuario_sub = str(params.get('usuario_sub') or '').strip()
    usuario_nombre = str(params.get('usuario_nombre') or '').strip()
    actor_tipo = str(params.get('actor_tipo') or '').strip().lower()
    if actor_tipo not in ('usuario', 'sistema'):
        actor_tipo = ''
    filtros = {
        'accion': params.get('accion'),
        'modulo': params.get('modulo'),
        'entidad_tipo': params.get('entidad_tipo'),
        'resultado': params.get('resultado'),
    }
    filter_expression = None
    for key, value in filtros.items():
        if value:
            condicion = Attr(key).eq(str(value))
            filter_expression = condicion if filter_expression is None else filter_expression & condicion
    if actor_tipo == 'usuario':
        condicion = Attr('actor_tipo').eq('usuario') | (
            Attr('actor_tipo').not_exists() & Attr('usuario_sub').exists() & Attr('usuario_sub').ne('')
        )
        filter_expression = condicion if filter_expression is None else filter_expression & condicion
    elif actor_tipo == 'sistema':
        condicion = (
            Attr('actor_tipo').eq('sistema') |
            Attr('actor_tipo').not_exists() & (
                Attr('usuario_sub').not_exists() | Attr('usuario_sub').eq('') | Attr('usuario_sub').eq('sistema')
            )
        )
        filter_expression = condicion if filter_expression is None else filter_expression & condicion
    if usuario_nombre:
        condicion = Attr('usuario_nombre').eq(usuario_nombre)
        filter_expression = condicion if filter_expression is None else filter_expression & condicion

    next_token = params.get('next_token')
    exclusive_start_key = None
    if next_token:
        try:
            padding = '=' * (-len(next_token) % 4)
            exclusive_start_key = json.loads(
                base64.urlsafe_b64decode(f'{next_token}{padding}').decode('utf-8')
            )
        except (ValueError, TypeError, json.JSONDecodeError):
            return bad_request('next_token invalido')

    if usuario_sub:
        inicio = datetime.combine(fecha_dia, datetime.min.time(), tzinfo=timezone.utc).isoformat()
        fin = (datetime.combine(fecha_dia, datetime.min.time(), tzinfo=timezone.utc) + timedelta(days=1)).isoformat()
        key_condition = Key('GSI1PK').eq(f'USUARIO#{usuario_sub}') & Key('GSI1SK').between(inicio, fin)
        index_name = 'gsi-usuario'
    else:
        key_condition = Key('pk').eq(f'AUDITORIA#{fecha}')
        index_name = None

    items = []
    last_key = exclusive_start_key
    while len(items) < limit:
        kwargs = {
            'KeyConditionExpression': key_condition,
            'ScanIndexForward': False,
            'Limit': limit,
        }
        if index_name:
            kwargs['IndexName'] = index_name
        if filter_expression is not None:
            kwargs['FilterExpression'] = filter_expression
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key
        result = table.query(**kwargs)
        items.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break

    encoded_next_token = None
    if last_key:
        encoded_next_token = base64.urlsafe_b64encode(
            json.dumps(last_key, separators=(',', ':')).encode('utf-8')
        ).decode('ascii').rstrip('=')

    return ok({
        'items': items[:limit],
        'fecha': fecha,
        'count': len(items[:limit]),
        'next_token': encoded_next_token,
    })
