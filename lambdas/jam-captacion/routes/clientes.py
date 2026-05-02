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

sqs_client = boto3.client('sqs')
SQS_URL = os.environ.get('SQS_URL')


def _publicar_evento(tipo, proyecto_id, inmobiliaria_id, metadata=None):
    if not SQS_URL:
        return
    try:
        sqs_client.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'tipo': tipo,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmobiliaria_id,
                'metadata': metadata or {},
            }),
        )
    except Exception as e:
        import logging
        logging.getLogger().warning(f'Error publicando evento {tipo}: {e}')


def _now():
    return datetime.now(timezone.utc).isoformat()


def _get_inmobiliaria_id(sub: str) -> str:
    """Resuelve el inmobiliaria_id real desde el sub del usuario (sin prefijo INMOBILIARIA#)."""
    item = usuarios.get_item(
        Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}
    ).get('Item', {})
    raw = item.get('inmobiliaria_id', f'USUARIO#{sub}')
    return raw.replace('INMOBILIARIA#', '')


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
        # Normalizar ambos lados para comparar sin prefijo INMOBILIARIA#
        item_inmo = item.get('inmobiliaria_id', '').replace('INMOBILIARIA#', '')
        if item_inmo != inmobiliaria_id:
            _publicar_evento('intento_duplicado', proyecto_id, inmobiliaria_id, {
                'cedula': cedula,
                'nombres': item.get('nombres', ''),
                'apellidos': item.get('apellidos', ''),
                'inmobiliaria_con_exclusividad': item_inmo,
                'inmobiliaria_solicitante': inmobiliaria_id,
            })
            return conflict(
                'Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto. '
                'Contacta a JAM Construcciones.'
            )

    # Verificar si ya existe con prefijo (registrado antes de normalización)
    pk_legacy = f'CLIENTE#{cedula}#INMOBILIARIA#{inmobiliaria_id}'
    existing_legacy = clientes.get_item(Key={'pk': pk_legacy, 'sk': sk}).get('Item')
    if existing_legacy:
        if existing_legacy.get('exclusividad_activa'):
            return _actualizar_datos(pk_legacy, sk, body, existing_legacy)
        else:
            return _recaptar(pk_legacy, sk, body, existing_legacy, cedula, inmobiliaria_id, proyecto_id)

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

    _publicar_evento('cliente_captado', proyecto_id, inmobiliaria_id, {
        'cedula': cedula,
        'nombres': item['nombres'],
        'apellidos': item['apellidos'],
    })

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
    limit = int(qs.get('limit', 50))

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
        # Normalizar: quitar prefijo si viene con él
        inmo_id_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')
        kwargs['IndexName'] = 'gsi-inmobiliaria-clientes'
        kwargs['KeyConditionExpression'] = Key('inmobiliaria_id').eq(inmo_id_clean)
        result = clientes.query(**kwargs)
        # Si no hay resultados, intentar con prefijo (registros legacy)
        if not result.get('Items'):
            kwargs['KeyConditionExpression'] = Key('inmobiliaria_id').eq(f'INMOBILIARIA#{inmo_id_clean}')
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


def registrar_publico(event):
    """POST /publico/clientes — registro externo sin auth, inmobiliaria_id viene en el body."""
    body = json.loads(event.get('body') or '{}')
    cedula = body.get('cedula', '').strip()
    proyecto_id = body.get('proyecto_id', '').strip()
    nombres = body.get('nombres', '').strip()
    apellidos = body.get('apellidos', '').strip()
    # Normalizar: quitar prefijo si viene con él
    inmobiliaria_id = body.get('inmobiliaria_id', '').strip().replace('INMOBILIARIA#', '')

    if not all([cedula, proyecto_id, nombres, apellidos, inmobiliaria_id]):
        return bad_request('cedula, proyecto_id, nombres, apellidos e inmobiliaria_id son requeridos')

    # Verificar que la inmobiliaria existe y está activa
    try:
        inmo_table = dynamodb.Table(os.environ['USUARIOS_TABLE'])
        inmo = inmo_table.get_item(
            Key={'pk': f'INMOBILIARIA#{inmobiliaria_id}', 'sk': 'METADATA'}
        ).get('Item')
        if not inmo or not inmo.get('activo', True):
            return bad_request('Inmobiliaria no válida')
    except Exception:
        return bad_request('Inmobiliaria no válida')

    pk = f'CLIENTE#{cedula}#{inmobiliaria_id}'
    sk = f'PROYECTO#{proyecto_id}'

    existing = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item')

    # También buscar con prefijo por si fue registrado internamente
    if not existing:
        existing = clientes.get_item(
            Key={'pk': f'CLIENTE#{cedula}#INMOBILIARIA#{inmobiliaria_id}', 'sk': sk}
        ).get('Item')
        if existing:
            pk = f'CLIENTE#{cedula}#INMOBILIARIA#{inmobiliaria_id}'

    if existing:
        if existing.get('exclusividad_activa'):
            return _actualizar_datos(pk, sk, body, existing)
        else:
            return _recaptar(pk, sk, body, existing, cedula, inmobiliaria_id, proyecto_id)

    # Verificar exclusividad activa de OTRA inmobiliaria
    # Normalizar para comparar sin prefijo
    resultado = clientes.query(
        IndexName='gsi-cedula-proyecto',
        KeyConditionExpression=Key('cedula').eq(cedula) & Key('sk').eq(sk),
        FilterExpression=Attr('exclusividad_activa').eq(True),
    )
    for item in resultado.get('Items', []):
        item_inmo = item.get('inmobiliaria_id', '').replace('INMOBILIARIA#', '')
        if item_inmo != inmobiliaria_id:
            _publicar_evento('intento_duplicado', proyecto_id, inmobiliaria_id, {
                'cedula': cedula,
                'nombres': body.get('nombres', ''),
                'apellidos': body.get('apellidos', ''),
                'inmobiliaria_con_exclusividad': item_inmo,
                'inmobiliaria_solicitante': inmobiliaria_id,
            })
            return conflict(
                'Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto. '
                'Contacta a JAM Construcciones.'
            )

    return _crear(pk, sk, body, cedula, inmobiliaria_id, proyecto_id)


def listar_proyectos_publico(event):
    """GET /publico/proyectos?inmobiliaria_id=xxx — proyectos asignados a la inmobiliaria (sin auth)."""
    qs = event.get('queryStringParameters') or {}
    inmobiliaria_id = qs.get('inmobiliaria_id', '').strip()
    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id es requerido')

    try:
        inmo_table = dynamodb.Table(os.environ['USUARIOS_TABLE'])
        inmo = inmo_table.get_item(
            Key={'pk': f'INMOBILIARIA#{inmobiliaria_id}', 'sk': 'METADATA'}
        ).get('Item')
        if not inmo or not inmo.get('activo', True):
            return bad_request('Inmobiliaria no válida')

        proyectos_ids = inmo.get('proyectos', [])
        print(f'DEBUG inmo pk=INMOBILIARIA#{inmobiliaria_id} proyectos={proyectos_ids}')
        proy_table = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
        result = []
        for pid in proyectos_ids:
            item = proy_table.get_item(
                Key={'pk': f'PROYECTO#{pid}', 'sk': 'METADATA'}
            ).get('Item')
            if item and item.get('activo', True):
                result.append({'proyecto_id': pid, 'nombre': item.get('nombre', pid)})
        return ok(result)
    except Exception as e:
        print(f'ERROR listar_proyectos_publico: {type(e).__name__}: {e}')
        return bad_request('Error al obtener proyectos')
