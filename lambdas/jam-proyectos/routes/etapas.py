import json
import uuid
import boto3
import os
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found
from utils.helpers import now, decimal_to_number
from utils.auditoria import registrar_auditoria

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])


def listar(proyecto_id):
    result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('ETAPA#')
    )
    items = result.get('Items', [])
    # Convertir Decimals a tipos serializables
    items = decimal_to_number(items)
    return ok(items)


def crear(proyecto_id, event):
    body = json.loads(event.get('body') or '{}')
    nombre = body.get('nombre')
    if not nombre:
        return bad_request('nombre requerido')

    # Validar que el proyecto existe y está activo (#6)
    proyecto = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not proyecto:
        return not_found('Proyecto no encontrado')
    if not proyecto.get('activo', True):
        return bad_request('No se pueden agregar etapas a un proyecto desactivado')

    etapa_id = str(uuid.uuid4())[:8].upper()
    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'ETAPA#{etapa_id}',
        'etapa_id': etapa_id,
        'nombre': nombre,
        'activo': True,
        'creado_en': now(),
    }
    inventario.put_item(Item=item)
    registrar_auditoria(event, 'etapa_creada', 'inventario', 'etapa', etapa_id, detalles={'proyecto_id': proyecto_id, 'nombre': nombre})
    # Convertir Decimals a tipos serializables
    item = decimal_to_number(item)
    return created(item)


def actualizar(proyecto_id, etapa_id, event):
    body = json.loads(event.get('body') or '{}')
    updates, values, names = [], {}, {}

    if 'nombre' in body:
        values[':nombre'] = body['nombre']
        updates.append('#nombre = :nombre')
        names['#nombre'] = 'nombre'

    if not updates:
        return bad_request('No hay campos para actualizar')

    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'ETAPA#{etapa_id}'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            ExpressionAttributeNames=names
        )
        registrar_auditoria(event, 'etapa_actualizada', 'inventario', 'etapa', etapa_id, detalles={'proyecto_id': proyecto_id, 'cambios': body})
        return ok({'message': 'Etapa actualizada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Etapa no encontrada')
        raise


def eliminar(proyecto_id, etapa_id, event=None):
    # Validar que no tenga torres asociadas
    torres = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('TORRE#'),
        FilterExpression='etapa_id = :eid',
        ExpressionAttributeValues={':eid': etapa_id}
    )
    if torres.get('Items'):
        return bad_request('No se puede eliminar: la etapa tiene torres asociadas')

    result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
        FilterExpression='etapa_id = :eid',
        ExpressionAttributeValues={':eid': etapa_id}
    )
    if result.get('Items'):
        return bad_request('No se puede eliminar: la etapa tiene unidades asociadas')

    try:
        inventario.delete_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'ETAPA#{etapa_id}'},
            ConditionExpression='attribute_exists(pk)'
        )
        registrar_auditoria(event or {}, 'etapa_eliminada', 'inventario', 'etapa', etapa_id, detalles={'proyecto_id': proyecto_id})
        return ok({'message': 'Etapa eliminada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Etapa no encontrada')
        raise
