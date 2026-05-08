import json
import boto3
import os
from datetime import datetime, timezone, date
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, conflict, not_found
from utils.auth import get_sub, get_rol
from utils import scheduler as sched

dynamodb = boto3.resource('dynamodb')
clientes = dynamodb.Table(os.environ['CLIENTES_TABLE'])
usuarios = dynamodb.Table(os.environ['USUARIOS_TABLE'])
procesos = dynamodb.Table(os.environ['PROCESOS_TABLE'])
MESES_EXCLUSIVIDAD = 3


def _now():
    return datetime.now(timezone.utc).isoformat()


def _get_inmobiliaria_id(sub: str) -> str:
    """Resuelve el inmobiliaria_id real desde el sub del usuario."""
    item = usuarios.get_item(
        Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}
    ).get('Item', {})
    return item.get('inmobiliaria_id', f'USUARIO#{sub}')


def _add_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    max_day = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
               31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return dt.replace(year=year, month=month, day=min(dt.day, max_day))


def _calcular_edad(fecha_nacimiento: str):
    try:
        nacimiento = date.fromisoformat(fecha_nacimiento)
        hoy = date.today()
        return hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day))
    except (ValueError, TypeError):
        return None


def registrar(event):
    body = json.loads(event.get('body') or '{}')
    cedula = body.get('cedula', '').strip()
    proyecto_id = body.get('proyecto_id', '').strip()
    nombres = body.get('nombres', '').strip()
    apellidos = body.get('apellidos', '').strip()

    if not all([cedula, proyecto_id, nombres, apellidos]):
        return bad_request('cedula, proyecto_id, nombres y apellidos son requeridos')

    sub = get_sub(event)
    inmobiliaria_id = _get_inmobiliaria_id(sub)

    pk = f'CLIENTE#{cedula}#{inmobiliaria_id}'
    sk = f'PROYECTO#{proyecto_id}'

    # Verificar si esta inmobiliaria ya tiene este cliente en este proyecto
    existing = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item')

    if existing:
        if existing.get('exclusividad_activa'):
            # Actualizar datos, mantener exclusividad
            return _actualizar_datos(pk, sk, body, existing)
        else:
            # Re-captar: nueva exclusividad
            return _recaptar(pk, sk, body, existing, cedula, inmobiliaria_id, proyecto_id)

    # Verificar exclusividad activa de OTRA inmobiliaria
    resultado = clientes.query(
        IndexName='gsi-cedula-proyecto',
        KeyConditionExpression=Key('cedula').eq(cedula) & Key('sk').eq(sk),
        FilterExpression=Attr('exclusividad_activa').eq(True),
    )
    for item in resultado.get('Items', []):
        if item.get('inmobiliaria_id') != inmobiliaria_id:
            return conflict(
                'Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto. '
                'Contacta a JAM Construcciones.'
            )

    # Registrar nuevo cliente
    return _crear(pk, sk, body, cedula, inmobiliaria_id, proyecto_id)


def _resolver_unidad(body, proyecto_id):
    """Resuelve unidad_id y unidad_nombre (torre + id_unidad) desde el body o inventario."""
    unidad_id = body.get('unidad_id')
    unidad_nombre = body.get('unidad_nombre')
    if unidad_id and not unidad_nombre:
        try:
            inv = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
            item = inv.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
            ).get('Item', {})
            id_unidad = item.get('id_unidad') or unidad_id
            torre_id = item.get('torre_id')
            torre_nombre = None
            if torre_id:
                torre = inv.get_item(
                    Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'}
                ).get('Item', {})
                torre_nombre = torre.get('nombre')
            unidad_nombre = f"{torre_nombre} · {id_unidad}" if torre_nombre else id_unidad
        except Exception:
            unidad_nombre = unidad_id
    return unidad_id, unidad_nombre


def _crear(pk, sk, body, cedula, inmobiliaria_id, proyecto_id):
    ahora = datetime.now(timezone.utc)
    fecha_captacion = ahora.isoformat()
    fecha_vencimiento = _add_months(ahora, MESES_EXCLUSIVIDAD).isoformat()
    ts_venc_eb = fecha_vencimiento[:19]

    edad = _calcular_edad(body.get('fecha_nacimiento'))
    unidad_id, unidad_nombre = _resolver_unidad(body, proyecto_id)

    item = {
        'pk': pk,
        'sk': sk,
        'cedula': cedula,
        'inmobiliaria_id': inmobiliaria_id,
        'proyecto_id': proyecto_id,
        'nombres': body.get('nombres', '').strip(),
        'apellidos': body.get('apellidos', '').strip(),
        'correo': body.get('correo', ''),
        'telefono': body.get('telefono', ''),
        'estado_civil': body.get('estado_civil', ''),
        'nacionalidad': body.get('nacionalidad', ''),
        'pais_residencia': body.get('pais_residencia', ''),
        'fecha_nacimiento': body.get('fecha_nacimiento', ''),
        'edad': edad,
        'exclusividad_activa': True,
        'fecha_captacion': fecha_captacion,
        'fecha_vencimiento': fecha_vencimiento,
    }
    clientes.put_item(Item=item)

    # Crear proceso de venta si viene con unidad
    if unidad_id:
        procesos.put_item(Item={
            'pk': f'PROCESO#{cedula}#{inmobiliaria_id}',
            'sk': f'UNIDAD#{unidad_id}',
            'cedula': cedula,
            'inmobiliaria_id': inmobiliaria_id,
            'proyecto_id': proyecto_id,
            'unidad_id': unidad_id,
            'unidad_nombre': unidad_nombre or unidad_id,
            'estado': 'captacion',
            'historial': [],
            'fecha_inicio': fecha_captacion,
            'actualizado_en': fecha_captacion,
        })

    sched.crear_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id, ts_venc_eb)
    return created(item)


def _actualizar_datos(pk, sk, body, existing):
    """Actualiza datos del cliente sin tocar la exclusividad."""
    updates, values, names = [], {}, {}
    campos = ['nombres', 'apellidos', 'correo', 'telefono', 'estado_civil',
              'nacionalidad', 'pais_residencia', 'fecha_nacimiento']
    for campo in campos:
        if campo in body:
            values[f':{campo}'] = body[campo]
            updates.append(f'#{campo} = :{campo}')
            names[f'#{campo}'] = campo

    if 'fecha_nacimiento' in body:
        edad = _calcular_edad(body['fecha_nacimiento'])
        if edad is not None:
            values[':edad'] = edad
            updates.append('edad = :edad')

    if not updates:
        return ok(existing)

    values[':ts'] = _now()
    updates.append('actualizado_en = :ts')

    clientes.update_item(
        Key={'pk': pk, 'sk': sk},
        UpdateExpression='SET ' + ', '.join(updates),
        ExpressionAttributeValues=values,
        ExpressionAttributeNames=names,
    )
    return ok({'message': 'Cliente actualizado'})


def _recaptar(pk, sk, body, existing, cedula, inmobiliaria_id, proyecto_id):
    """Re-capta un cliente con exclusividad vencida para la misma inmobiliaria."""
    ahora = datetime.now(timezone.utc)
    fecha_captacion = ahora.isoformat()
    fecha_vencimiento = _add_months(ahora, MESES_EXCLUSIVIDAD).isoformat()
    ts_venc_eb = fecha_vencimiento[:19]

    edad = _calcular_edad(body.get('fecha_nacimiento') or existing.get('fecha_nacimiento'))

    updates = [
        'exclusividad_activa = :activa',
        'fecha_captacion = :fc',
        'fecha_vencimiento = :fv',
        'edad = :edad',
    ]
    values = {
        ':activa': True,
        ':fc': fecha_captacion,
        ':fv': fecha_vencimiento,
        ':edad': edad,
    }

    campos = ['nombres', 'apellidos', 'correo', 'telefono', 'estado_civil',
              'nacionalidad', 'pais_residencia', 'fecha_nacimiento']
    names = {}
    for campo in campos:
        if campo in body:
            values[f':{campo}'] = body[campo]
            updates.append(f'#{campo} = :{campo}')
            names[f'#{campo}'] = campo

    clientes.update_item(
        Key={'pk': pk, 'sk': sk},
        UpdateExpression='SET ' + ', '.join(updates),
        ExpressionAttributeValues=values,
        **({"ExpressionAttributeNames": names} if names else {}),
    )
    sched.eliminar_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id)
    sched.crear_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id, ts_venc_eb)
    return ok({'message': 'Cliente re-captado con nueva exclusividad'})


def buscar_por_cedula(event, cedula):
    """GET /clientes/{cedula}?proyecto_id=xxx — busca cliente propio por cédula."""
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')
    sub = get_sub(event)
    inmobiliaria_id = _get_inmobiliaria_id(sub)

    pk = f'CLIENTE#{cedula}#{inmobiliaria_id}'

    if proyecto_id:
        item = clientes.get_item(Key={'pk': pk, 'sk': f'PROYECTO#{proyecto_id}'}).get('Item')
        if item:
            return ok(item)
        return not_found('Cliente no encontrado')

    # Sin proyecto_id — devuelve todos los registros de esta cédula para esta inmobiliaria
    result = clientes.query(
        KeyConditionExpression=Key('pk').eq(pk)
    )
    return ok(result.get('Items', []))


def listar(event):
    """GET /clientes — inmobiliaria ve sus propios clientes."""
    sub = get_sub(event)
    inmobiliaria_id = _get_inmobiliaria_id(sub)
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')

    kwargs = {
        'IndexName': 'gsi-inmobiliaria-clientes',
        'KeyConditionExpression': Key('inmobiliaria_id').eq(inmobiliaria_id),
    }
    if proyecto_id:
        kwargs['FilterExpression'] = Attr('proyecto_id').eq(proyecto_id)

    result = clientes.query(**kwargs)
    return ok(result.get('Items', []))


def listar_admin(event):
    """GET /admin/clientes — admin ve todos, con paginación."""
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')
    inmobiliaria_id = qs.get('inmobiliaria_id')
    next_token = qs.get('next_token')
    limit = min(int(qs.get('limit', 100)), 200)

    kwargs = {'Limit': limit}
    if next_token:
        import base64, json as _json
        try:
            kwargs['ExclusiveStartKey'] = _json.loads(base64.b64decode(next_token).decode())
        except Exception:
            pass

    if proyecto_id:
        kwargs['IndexName'] = 'gsi-proyecto-clientes'
        kwargs['KeyConditionExpression'] = Key('proyecto_id').eq(proyecto_id)
        if inmobiliaria_id:
            kwargs['FilterExpression'] = Attr('inmobiliaria_id').eq(inmobiliaria_id)
        result = clientes.query(**kwargs)
    elif inmobiliaria_id:
        kwargs['IndexName'] = 'gsi-inmobiliaria-clientes'
        kwargs['KeyConditionExpression'] = Key('inmobiliaria_id').eq(inmobiliaria_id)
        result = clientes.query(**kwargs)
    else:
        result = clientes.scan(**kwargs)

    resp = {'items': result.get('Items', [])}
    if result.get('LastEvaluatedKey'):
        import base64, json as _json
        resp['next_token'] = base64.b64encode(
            _json.dumps(result['LastEvaluatedKey']).encode()
        ).decode()
    return ok(resp)


def buscar_por_cedula_admin(event, cedula):
    """GET /admin/clientes/buscar?cedula=xxx — todos los registros de esa cédula."""
    result = clientes.query(
        IndexName='gsi-cedula-proyecto',
        KeyConditionExpression=Key('cedula').eq(cedula),
    )
    items = result.get('Items', [])

    # Enriquecer con procesos de cada registro
    for item in items:
        inmo_id = item.get('inmobiliaria_id', '')
        pk_proc = f'PROCESO#{cedula}#{inmo_id}'
        try:
            procs = procesos.query(KeyConditionExpression=Key('pk').eq(pk_proc))
            item['procesos'] = procs.get('Items', [])
        except Exception:
            item['procesos'] = []

    return ok(items)


def detalle_admin(event, cedula, proyecto_id):
    """GET /admin/clientes/{cedula}/proyecto/{id} — admin."""
    qs = event.get('queryStringParameters') or {}
    inmobiliaria_id = qs.get('inmobiliaria_id')
    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id requerido como query param')

    pk = f'CLIENTE#{cedula}#{inmobiliaria_id}'
    sk = f'PROYECTO#{proyecto_id}'
    item = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if not item:
        return not_found('Cliente no encontrado')
    return ok(item)


def actualizar_admin(event, cedula, proyecto_id):
    """PUT /admin/clientes/{cedula}/proyecto/{id} — admin puede editar todo."""
    body = json.loads(event.get('body') or '{}')
    qs = event.get('queryStringParameters') or {}
    inmobiliaria_id = qs.get('inmobiliaria_id')
    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id requerido como query param')

    pk = f'CLIENTE#{cedula}#{inmobiliaria_id}'
    sk = f'PROYECTO#{proyecto_id}'

    item = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if not item:
        return not_found('Cliente no encontrado')

    updates, values, names = [], {}, {}
    campos = ['nombres', 'apellidos', 'correo', 'telefono', 'estado_civil',
              'nacionalidad', 'pais_residencia', 'fecha_nacimiento']
    for campo in campos:
        if campo in body:
            values[f':{campo}'] = body[campo]
            updates.append(f'#{campo} = :{campo}')
            names[f'#{campo}'] = campo

    if 'fecha_nacimiento' in body:
        edad = _calcular_edad(body['fecha_nacimiento'])
        if edad is not None:
            values[':edad'] = edad
            updates.append('edad = :edad')

    if not updates:
        return bad_request('Nada que actualizar')

    values[':ts'] = _now()
    updates.append('actualizado_en = :ts')

    clientes.update_item(
        Key={'pk': pk, 'sk': sk},
        UpdateExpression='SET ' + ', '.join(updates),
        ExpressionAttributeValues=values,
        ExpressionAttributeNames=names,
    )
    return ok({'message': 'Cliente actualizado'})


def listar_mis_procesos(event):
    """GET /mis-procesos — inmobiliaria ve los procesos de venta de sus clientes."""
    sub = get_sub(event)
    inmobiliaria_id = _get_inmobiliaria_id(sub)
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')

    kwargs = {
        'IndexName': 'gsi-inmobiliaria-procesos',
        'KeyConditionExpression': Key('inmobiliaria_id').eq(inmobiliaria_id),
    }
    if proyecto_id:
        kwargs['FilterExpression'] = Attr('proyecto_id').eq(proyecto_id)

    result = procesos.query(**kwargs)
    return ok(result.get('Items', []))
