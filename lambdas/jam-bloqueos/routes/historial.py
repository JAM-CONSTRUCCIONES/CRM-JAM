import json
import boto3
import os
from boto3.dynamodb.conditions import Attr, Key
from utils.response import ok, bad_request

historial = boto3.resource('dynamodb').Table(os.environ['HISTORIAL_TABLE'])

PAGE_SIZE = 50


def listar(event):
    """GET /admin/bloqueos/historial?proyecto_id=xxx&unidad_id=xxx&limit=50&next_token=xxx"""
    qs = event.get('queryStringParameters') or {}
    unidad_id = qs.get('unidad_id')
    proyecto_id = qs.get('proyecto_id')
    limit = min(int(qs.get('limit', PAGE_SIZE)), 200)
    next_token = qs.get('next_token')

    exclusive_start_key = None
    if next_token:
        try:
            exclusive_start_key = json.loads(next_token)
        except (ValueError, TypeError):
            return bad_request('next_token invalido')

    if unidad_id:
        kwargs = {'Limit': limit, 'ScanIndexForward': False}
        if exclusive_start_key:
            kwargs['ExclusiveStartKey'] = exclusive_start_key
        result = historial.query(
            KeyConditionExpression=Key('pk').eq(f'UNIDAD#{unidad_id}'),
            **kwargs,
        )
        if proyecto_id:
            result['Items'] = [
                item for item in result.get('Items', [])
                if item.get('proyecto_id') == proyecto_id
            ]
    elif proyecto_id:
        result = _scan_por_proyecto(proyecto_id, limit, exclusive_start_key)
    else:
        scan_kwargs = {'Limit': limit}
        if exclusive_start_key:
            scan_kwargs['ExclusiveStartKey'] = exclusive_start_key
        result = historial.scan(**scan_kwargs)

    items = result.get('Items', [])

    for item in items:
        if not item.get('unidad_id') and item.get('pk', '').startswith('UNIDAD#'):
            item['unidad_id'] = item['pk'].replace('UNIDAD#', '')

    response = {'items': items}
    if result.get('LastEvaluatedKey'):
        response['next_token'] = json.dumps(result['LastEvaluatedKey'])

    return ok(response)


def _scan_por_proyecto(proyecto_id, limit, exclusive_start_key=None):
    items = []
    last_key = exclusive_start_key

    while len(items) < limit:
        scan_kwargs = {
            'Limit': limit,
            'FilterExpression': Attr('proyecto_id').eq(proyecto_id),
        }
        if last_key:
            scan_kwargs['ExclusiveStartKey'] = last_key

        page = historial.scan(**scan_kwargs)
        items.extend(page.get('Items', []))
        last_key = page.get('LastEvaluatedKey')
        if not last_key:
            break

    return {
        'Items': items[:limit],
        'LastEvaluatedKey': last_key,
    }
