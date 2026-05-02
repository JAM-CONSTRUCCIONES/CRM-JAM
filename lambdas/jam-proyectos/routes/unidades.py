import json
import uuid
import boto3
import os
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, conflict
from utils.helpers import now

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])
_procesos_table_name = os.environ.get('PROCESOS_TABLE', '')


def _enrich_bloqueo(item):
    if item.get('estado') == 'bloqueada' and item.get('fecha_liberacion'):
        try:
            dt_lib = datetime.fromisoformat(item['fecha_liberacion'].replace('Z', '+00:00'))
            restante = int((dt_lib - datetime.now(timezone.utc)).total_seconds())
            item['tiempo_restante'] = max(restante, 0)
        except (ValueError, TypeError):
            item['tiempo_restante'] = 0
    return item


def listar(proyecto_id, event, rol):
    if not proyecto_id:
        return bad_request('proyecto_id requerido')

    qs = event.get('queryStringParameters') or {}

    result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
    )
    items = [i for i in result.get('Items', []) if i.get('id_unidad')]

    # Filtros opcionales
    if qs.get('etapa_id'):
        items = [i for i in items if i.get('etapa_id') == qs['etapa_id']]
    if qs.get('estado'):
        items = [i for i in items if i.get('estado') == qs['estado']]
    if qs.get('tipo'):
        items = [i for i in items if i.get('tipo') == qs['tipo']]
    if qs.get('manzana'):
        items = [i for i in items if i.get('manzana') == qs['manzana']]
    if qs.get('piso'):
        items = [i for i in items if str(i.get('piso', '')) == qs['piso']]

    # Filtrar y ocultar campos internos (solo JAM) para inmobiliaria
    if rol == 'inmobiliaria':
        items = [i for i in items if i.get('estado') in ('disponible', 'bloqueada')]
        for item in items:
            item.pop('bloqueado_por', None)
            item.pop('cliente_id', None)
            item.pop('cliente_cedula', None)
            item.pop('comentario', None)       # CELDA INTERNA

    items = [_enrich_bloqueo(i) for i in items]
    return ok(items)


def detalle(proyecto_id, unidad_id, rol):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item:
        return not_found('Unidad no encontrada')

    if rol == 'inmobiliaria':
        item.pop('bloqueado_por', None)
        item.pop('cliente_id', None)
        item.pop('cliente_cedula', None)
        item.pop('comentario', None)       # CELDA INTERNA

    return ok(_enrich_bloqueo(item))


def crear(proyecto_id, event):
    body = json.loads(event.get('body') or '{}')

    id_unidad = (body.get('id_unidad') or '').strip()
    etapa_id = body.get('etapa_id')
    metraje = body.get('metraje')
    precio = body.get('precio')

    if not all([id_unidad, etapa_id, metraje, precio]):
        return bad_request('Campos requeridos: id_unidad, etapa_id, metraje, precio')

    # Validar que el proyecto existe y está activo (#6)
    proyecto = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not proyecto:
        return not_found('Proyecto no encontrado')
    if not proyecto.get('activo', True):
        return bad_request('No se pueden agregar unidades a un proyecto desactivado')

    try:
        metraje = Decimal(str(metraje))
        precio = Decimal(str(precio))
    except (ValueError, TypeError):
        return bad_request('metraje y precio deben ser numéricos')

    unidad_id = str(uuid.uuid4())[:8].upper()
    ts = now()

    # Validar que no exista otra unidad con el mismo id_unidad en este proyecto
    existing = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
    )
    for u in existing.get('Items', []):
        if u.get('id_unidad', '').strip().upper() == id_unidad.upper():
            return bad_request(f'Ya existe una unidad con el nombre "{id_unidad}" en este proyecto')

    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'UNIDAD#{unidad_id}',
        'unidad_id': unidad_id,
        'id_unidad': id_unidad,
        'etapa_id': etapa_id,
        'metraje': metraje,
        'precio': precio,
        'estado': 'disponible',
        'creado_en': ts,
        'actualizado_en': ts,
    }

    for campo in ('tipo', 'manzana', 'piso', 'parqueos', 'num_cuartos', 'num_banos',
                  'metraje_terraza', 'metraje_patio', 'comentario',
                  'precio_reserva', 'precio_separacion', 'precio_inicial', 'cuota_monto', 'cuota_meses', 'contra_entrega'):
        if body.get(campo) is not None:
            item[campo] = body[campo] if campo in ('comentario', 'tipo', 'manzana', 'piso') else (
                Decimal(str(body[campo])) if campo in ('parqueos', 'num_cuartos', 'num_banos',
                    'metraje_terraza', 'metraje_patio',
                    'precio_reserva', 'precio_separacion', 'precio_inicial', 'cuota_monto', 'cuota_meses', 'contra_entrega')
                    and body[campo] != '' else body[campo]
            )

    inventario.put_item(Item=item)
    return created(item)


def actualizar(proyecto_id, unidad_id, event):
    body = json.loads(event.get('body') or '{}')

    updates, values, names = [], {}, {}

    if 'id_unidad' in body:
        nuevo_id = (body['id_unidad'] or '').strip()
        if nuevo_id:
            existing = inventario.query(
                KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
            )
            for u in existing.get('Items', []):
                if u.get('id_unidad', '').strip().upper() == nuevo_id.upper() and u.get('unidad_id') != unidad_id:
                    return bad_request(f'Ya existe una unidad con el nombre "{nuevo_id}" en este proyecto')
        values[':id_unidad'] = nuevo_id
        updates.append('id_unidad = :id_unidad')

    if 'etapa_id' in body:
        values[':etapa_id'] = body['etapa_id']
        updates.append('etapa_id = :etapa_id')

    if 'metraje' in body:
        try:
            values[':metraje'] = Decimal(str(body['metraje']))
            updates.append('metraje = :metraje')
        except (ValueError, TypeError):
            return bad_request('metraje debe ser numérico')

    if 'precio' in body:
        try:
            values[':precio'] = Decimal(str(body['precio']))
            updates.append('precio = :precio')
        except (ValueError, TypeError):
            return bad_request('precio debe ser numérico')

    for campo in ('tipo', 'manzana', 'piso', 'parqueos', 'num_cuartos', 'num_banos',
                  'metraje_terraza', 'metraje_patio', 'comentario',
                  'precio_reserva', 'precio_separacion', 'precio_inicial', 'cuota_monto', 'cuota_meses', 'contra_entrega'):
        if campo in body:
            if campo in ('parqueos', 'num_cuartos', 'num_banos', 'metraje_terraza', 'metraje_patio',
                         'precio_reserva', 'precio_separacion', 'precio_inicial', 'cuota_monto', 'cuota_meses', 'contra_entrega') \
                    and body[campo] not in (None, ''):
                try:
                    values[f':{campo}'] = Decimal(str(body[campo]))
                except (ValueError, TypeError):
                    return bad_request(f'{campo} debe ser numérico')
            else:
                values[f':{campo}'] = body[campo]
            updates.append(f'#{campo} = :{campo}')
            names[f'#{campo}'] = campo

    if not updates:
        return bad_request('No hay campos para actualizar')

    values[':ts'] = now()
    updates.append('actualizado_en = :ts')

    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {})
        )
        return ok({'message': 'Unidad actualizada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Unidad no encontrada')
        raise


def eliminar(proyecto_id, unidad_id):
    # Fix #1: verificar que no haya procesos de venta activos antes de eliminar
    if _procesos_table_name:
        procesos = boto3.resource('dynamodb').Table(_procesos_table_name)
        activos = procesos.query(
            IndexName='gsi-proyecto-procesos',
            KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
            FilterExpression='unidad_id = :uid AND estado IN (:c, :r, :s, :i)',
            ExpressionAttributeValues={
                ':uid': unidad_id,
                ':c': 'captacion', ':r': 'reserva',
                ':s': 'separacion', ':i': 'inicial',
            },
            Limit=1,
        )
        if activos.get('Items'):
            estado = activos['Items'][0].get('estado', '')
            return conflict(
                f'No se puede eliminar: la unidad tiene un proceso de venta activo en estado "{estado}"'
            )

    try:
        inventario.delete_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            ConditionExpression='attribute_exists(pk) AND estado = :disponible',
            ExpressionAttributeValues={':disponible': 'disponible'}
        )
        return ok({'message': 'Unidad eliminada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            item = inventario.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
            ).get('Item')
            if not item:
                return not_found('Unidad no encontrada')
            return bad_request(f'No se puede eliminar: la unidad está en estado "{item.get("estado")}"')
        raise
