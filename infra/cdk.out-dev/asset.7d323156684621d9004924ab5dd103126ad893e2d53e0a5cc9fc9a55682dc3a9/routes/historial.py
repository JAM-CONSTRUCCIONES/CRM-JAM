import json
import boto3
import os
from boto3.dynamodb.conditions import Key
from utils.response import ok, bad_request

historial = boto3.resource('dynamodb').Table(os.environ['HISTORIAL_TABLE'])

PAGE_SIZE = 50


def listar(event):
    """GET /admin/bloqueos/historial?unidad_id=xxx&limit=50&next_token=xxx"""
    qs = event.get('queryStringParameters') or {}
    unidad_id = qs.get('unidad_id')
    limit = min(int(qs.get('limit', PAGE_SIZE)), 200)
    next_token = qs.get('next_token')

    kwargs = {'Limit': limit, 'ScanIndexForward': False}
    if next_token:
        try:
            kwargs['ExclusiveStartKey'] = json.loads(next_token)
        except (ValueError, TypeError):
            return bad_request('next_token inválido')

    if unidad_id:
        result = historial.query(
            KeyConditionExpression=Key('pk').eq(f'UNIDAD#{unidad_id}'),
            **kwargs,
        )
    else:
        # Sin unidad_id: requiere proyecto_id o pagina los más recientes
        proyecto_id = qs.get('proyecto_id')
        if proyecto_id:
            result = historial.query(
                KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}'),
                **kwargs,
            )
        else:
            # Scan paginado — aceptable para admin con tablas pequeñas,
            # pero acotado por Limit para no leer toda la tabla de golpe
            scan_kwargs = {'Limit': limit}
            if next_token:
                try:
                    scan_kwargs['ExclusiveStartKey'] = json.loads(next_token)
                except (ValueError, TypeError):
                    return bad_request('next_token inválido')
            result = historial.scan(**scan_kwargs)

    items = result.get('Items', [])

    # Extraer unidad_id del pk para facilitar el front
    for item in items:
        if not item.get('unidad_id') and item.get('pk', '').startswith('UNIDAD#'):
            item['unidad_id'] = item['pk'].replace('UNIDAD#', '')

    response = {'items': items}
    if result.get('LastEvaluatedKey'):
        response['next_token'] = json.dumps(result['LastEvaluatedKey'])

    return ok(response)
