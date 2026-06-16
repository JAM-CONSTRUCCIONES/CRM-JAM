import json
import uuid
import boto3
import os
import base64
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found, conflict
from utils.helpers import now

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])
_procesos_table_name = os.environ.get('PROCESOS_TABLE', '')


def _case_variants(value):
    text = str(value or '').strip()
    if not text:
        return []
    return list(dict.fromkeys([text, text.lower(), text.upper(), text.title(), text.capitalize()]))


def _contains_case_insensitive(attr_name, value):
    expr = None
    for variant in _case_variants(value):
        current = Attr(attr_name).contains(variant)
        expr = expr | current if expr else current
    return expr


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
    
    # Paginación
    limit = min(int(qs.get('limit', 1000)), 1000)
    
    # Siempre usar query normal por proyecto (más confiable)
    query_kwargs = {
        'Limit': limit,
        'KeyConditionExpression': Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
    }
    
    filter_expr = None
    
    # Agregar filtros adicionales
    if qs.get('estado'):
        new_filter = Attr('estado').eq(qs['estado'])
        filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    if qs.get('etapa_id'):
        new_filter = Attr('etapa_id').eq(qs['etapa_id'])
        filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    if qs.get('id_unidad'):
        # Búsqueda parcial case-insensitive para id_unidad
        new_filter = _contains_case_insensitive('id_unidad', qs['id_unidad'])
        if new_filter:
            filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    if qs.get('tipo'):
        # Búsqueda parcial case-insensitive para tipo
        new_filter = _contains_case_insensitive('tipo', qs['tipo'])
        if new_filter:
            filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    if qs.get('manzana'):
        # Búsqueda parcial case-insensitive para manzana/bloque
        new_filter = _contains_case_insensitive('manzana', qs['manzana'])
        if new_filter:
            filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    if qs.get('piso'):
        # Piso puede estar almacenado como número o string según la fuente (Excel vs UI)
        try:
            piso_int = int(qs['piso'])
            new_filter = Attr('piso').eq(piso_int) | Attr('piso').eq(qs['piso'])
        except (ValueError, TypeError):
            new_filter = Attr('piso').eq(qs['piso'])
        filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    if qs.get('torre_id'):
        new_filter = Attr('torre_id').eq(qs['torre_id'])
        filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    # Filtro por rol: inmobiliarias solo ven disponible y bloqueada
    if rol == 'inmobiliaria':
        new_filter = Attr('estado').is_in(['disponible', 'bloqueada'])
        filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    # Aplicar FilterExpression si existe
    if filter_expr:
        query_kwargs['FilterExpression'] = filter_expr
    
    # Soporte para paginación con next_token
    next_token = qs.get('next_token')
    if next_token:
        try:
            query_kwargs['ExclusiveStartKey'] = json.loads(base64.b64decode(next_token).decode())
        except Exception:
            pass  # Token inválido, ignorar
    
    # Ejecutar query
    result = inventario.query(**query_kwargs)
    items = [i for i in result.get('Items', []) if i.get('id_unidad')]
    
    # Ocultar campos internos para inmobiliarias (por seguridad adicional)
    if rol == 'inmobiliaria':
        for item in items:
            item.pop('bloqueado_por', None)
            item.pop('cliente_id', None)
            item.pop('cliente_cedula', None)
            item.pop('comentario', None)
    
    # Enriquecer con tiempo restante de bloqueo
    items = [_enrich_bloqueo(i) for i in items]

    # Ordenar alfabéticamente por id_unidad (ej: A-101, A-102, B-01...)
    items.sort(key=lambda x: (x.get('id_unidad') or '').upper())

    # Preparar respuesta con paginación
    response_data = {'items': items, 'count': len(items)}
    
    # Agregar next_token si hay más resultados
    if result.get('LastEvaluatedKey'):
        response_data['next_token'] = base64.b64encode(
            json.dumps(result['LastEvaluatedKey']).encode()
        ).decode()
    
    return ok(response_data)


def listar_publico(proyecto_id, event):
    if not proyecto_id:
        return bad_request('proyecto_id requerido')

    proyecto = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not proyecto or not proyecto.get('activo', True):
        return not_found('Proyecto no encontrado')

    qs = event.get('queryStringParameters') or {}
    limit = min(int(qs.get('limit', 1000)), 1000)

    query_kwargs = {
        'Limit': limit,
        'KeyConditionExpression': Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
    }

    filter_expr = Attr('estado').eq('disponible')

    if qs.get('etapa_id'):
        filter_expr = filter_expr & Attr('etapa_id').eq(qs['etapa_id'])

    if qs.get('id_unidad'):
        new_filter = _contains_case_insensitive('id_unidad', qs['id_unidad'])
        if new_filter:
            filter_expr = filter_expr & new_filter

    if qs.get('tipo'):
        new_filter = _contains_case_insensitive('tipo', qs['tipo'])
        if new_filter:
            filter_expr = filter_expr & new_filter

    if qs.get('manzana'):
        new_filter = _contains_case_insensitive('manzana', qs['manzana'])
        if new_filter:
            filter_expr = filter_expr & new_filter

    if qs.get('piso'):
        try:
            piso_int = int(qs['piso'])
            filter_expr = filter_expr & (Attr('piso').eq(piso_int) | Attr('piso').eq(qs['piso']))
        except (ValueError, TypeError):
            filter_expr = filter_expr & Attr('piso').eq(qs['piso'])

    query_kwargs['FilterExpression'] = filter_expr

    next_token = qs.get('next_token')
    if next_token:
        try:
            query_kwargs['ExclusiveStartKey'] = json.loads(base64.b64decode(next_token).decode())
        except Exception:
            pass

    result = inventario.query(**query_kwargs)
    campos_publicos = {
        'pk', 'sk', 'unidad_id', 'id_unidad', 'etapa_id', 'metraje',
        'metraje_terraza', 'metraje_patio', 'precio', 'precio_reserva',
        'precio_separacion', 'precio_inicial', 'cuota_monto', 'cuota_meses',
        'contra_entrega', 'tipo', 'manzana', 'piso', 'parqueos',
        'num_cuartos', 'num_banos', 'estado', 'creado_en', 'actualizado_en',
    }
    items = [
        {k: v for k, v in item.items() if k in campos_publicos}
        for item in result.get('Items', [])
        if item.get('id_unidad')
    ]
    items.sort(key=lambda x: (x.get('id_unidad') or '').upper())

    response_data = {'items': items, 'count': len(items)}
    if result.get('LastEvaluatedKey'):
        response_data['next_token'] = base64.b64encode(
            json.dumps(result['LastEvaluatedKey']).encode()
        ).decode()

    return ok(response_data)


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

    # ✅ Validar duplicados usando GSI (más eficiente)
    proyecto_id_unidad = f"{proyecto_id}#{id_unidad.upper()}"
    existing = inventario.query(
        IndexName='gsi-proyecto-id-unidad',
        KeyConditionExpression=Key('proyecto_id_unidad').eq(proyecto_id_unidad),
        Limit=1
    )
    if existing.get('Items'):
        return bad_request(f'Ya existe una unidad con el nombre "{id_unidad}" en este proyecto')

    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'UNIDAD#{unidad_id}',
        'unidad_id': unidad_id,
        'id_unidad': id_unidad,
        'proyecto_id_unidad': proyecto_id_unidad,  # ✅ Campo para GSI
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
            # ✅ Validar duplicados usando GSI (más eficiente)
            proyecto_id_unidad = f"{proyecto_id}#{nuevo_id.upper()}"
            existing = inventario.query(
                IndexName='gsi-proyecto-id-unidad',
                KeyConditionExpression=Key('proyecto_id_unidad').eq(proyecto_id_unidad),
                Limit=1
            )
            # Verificar que no sea la misma unidad que estamos actualizando
            if existing.get('Items'):
                existing_unidad = existing['Items'][0]
                if existing_unidad.get('unidad_id') != unidad_id:
                    return bad_request(f'Ya existe una unidad con el nombre "{nuevo_id}" en este proyecto')
            
            # Actualizar ambos campos
            values[':id_unidad'] = nuevo_id
            values[':proyecto_id_unidad'] = proyecto_id_unidad
            updates.append('id_unidad = :id_unidad')
            updates.append('proyecto_id_unidad = :proyecto_id_unidad')
        else:
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
        try:
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
        except ClientError as e:
            # Si falla la consulta de procesos, registrar el error pero continuar con la eliminación
            print(f'Error al verificar procesos activos: {e}')
            # No bloqueamos la eliminación si la tabla de procesos tiene problemas
        except Exception as e:
            # Capturar cualquier otro error (tabla no existe, permisos, etc.)
            print(f'Error inesperado al verificar procesos: {e}')
            # No bloqueamos la eliminación

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
        # Capturar cualquier otro error de DynamoDB y devolver respuesta apropiada
        print(f'Error al eliminar unidad: {e}')
        return bad_request(f'Error al eliminar unidad: {str(e)}')
    except Exception as e:
        # Capturar errores inesperados para evitar 502
        print(f'Error inesperado al eliminar unidad: {e}')
        return bad_request(f'Error inesperado: {str(e)}')
