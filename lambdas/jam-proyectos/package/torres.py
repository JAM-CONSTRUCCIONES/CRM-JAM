import json
import uuid
import boto3
import os
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found
from utils.helpers import now

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])


def listar(proyecto_id):
    result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('TORRE#')
    )
    items = sorted(result.get('Items', []), key=lambda x: x.get('orden', 0))
    return ok(items)


def crear(proyecto_id, event):
    body = json.loads(event.get('body') or '{}')
    nombre = body.get('nombre')
    etapa_id = body.get('etapa_id')
    if not nombre or not etapa_id:
        return bad_request('nombre y etapa_id requeridos')

    torre_id = str(uuid.uuid4())[:8].upper()
    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'TORRE#{torre_id}',
        'torre_id': torre_id,
        'nombre': nombre,
        'etapa_id': etapa_id,
        'orden': body.get('orden', 1),
        'activo': True,
        'creado_en': now(),
    }
    inventario.put_item(Item=item)
    return created(item)


def actualizar(proyecto_id, torre_id, event):
    body = json.loads(event.get('body') or '{}')
    updates, values, names = [], {}, {}

    if 'nombre' in body:
        values[':nombre'] = body['nombre']
        updates.append('#nombre = :nombre')
        names['#nombre'] = 'nombre'
    if 'orden' in body:
        values[':orden'] = int(body['orden'])
        updates.append('#orden = :orden')
        names['#orden'] = 'orden'

    if not updates:
        return bad_request('No hay campos para actualizar')

    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            ExpressionAttributeNames=names
        )
        return ok({'message': 'Torre actualizada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Torre no encontrada')
        raise


def eliminar(proyecto_id, torre_id):
    result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
        FilterExpression='torre_id = :tid',
        ExpressionAttributeValues={':tid': torre_id}
    )
    if result.get('Items'):
        return bad_request('No se puede eliminar: la torre tiene unidades asociadas')

    try:
        inventario.delete_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'},
            ConditionExpression='attribute_exists(pk)'
        )
        return ok({'message': 'Torre eliminada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Torre no encontrada')
        raise
