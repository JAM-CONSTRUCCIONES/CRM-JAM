import json
import boto3
import os
import re
import unicodedata
from io import BytesIO
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
CLIENTE_DUPLICADO_MSG = 'Ya existe un cliente registrado con esta cedula en este proyecto para esta inmobiliaria'
EMAIL_RE = re.compile(r'^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$')
DOCUMENTO_RE = re.compile(r'^[A-Z0-9]+$')
CATALOGO_TEXTO_RE = re.compile(r'^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .-]+$')
ARCHIVOS_BUCKET = os.environ.get('ARCHIVOS_BUCKET', '')
PAISES_VALIDOS = {
    'Alemania', 'Argentina', 'Australia', 'Belgica', 'Bolivia', 'Brasil', 'Canada',
    'Chile', 'China', 'Colombia', 'Corea del Sur', 'Costa Rica', 'Cuba', 'Ecuador',
    'El Salvador', 'Espana', 'Estados Unidos', 'Francia', 'Guatemala', 'Haiti',
    'Honduras', 'India', 'Italia', 'Japon', 'Marruecos', 'Mexico', 'Nicaragua',
    'Nigeria', 'Paises Bajos', 'Panama', 'Paraguay', 'Peru', 'Portugal',
    'Puerto Rico', 'Reino Unido', 'Republica Dominicana', 'Rusia', 'Sudafrica',
    'Suiza', 'Uruguay', 'Venezuela',
}
NACIONALIDADES_VALIDAS = {
    'Alemana', 'Argentina', 'Australiana', 'Belga', 'Boliviana', 'Brasilena',
    'Britanica', 'Canadiense', 'Chilena', 'China', 'Colombiana', 'Costarricense',
    'Cubana', 'Dominicana', 'Ecuatoriana', 'Espanola', 'Estadounidense',
    'Francesa', 'Guatemalteca', 'Haitiana', 'Hondurena', 'India', 'Italiana',
    'Japonesa', 'Marroqui', 'Mexicana', 'Neerlandesa', 'Nicaraguense',
    'Nigeriana', 'Panamena', 'Paraguaya', 'Peruana', 'Portuguesa',
    'Puertorriquena', 'Rusa', 'Salvadorena', 'Sudafricana', 'Surcoreana',
    'Suiza', 'Uruguaya', 'Venezolana',
}

sqs_client = boto3.client('sqs')
s3_client = boto3.client('s3')
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


def _query_all(table, **kwargs):
    items = []
    while True:
        result = table.query(**kwargs)
        items.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    return items


def _scan_all(table, **kwargs):
    items = []
    while True:
        result = table.scan(**kwargs)
        items.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    return items


def _normalizar_inmo_id(value):
    return str(value or '').replace('INMOBILIARIA#', '').strip()


def _get_proyecto(proyecto_id):
    inv = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
    return inv.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')


def _get_inmobiliarias_map():
    result = {}
    try:
        items = _query_all(
            usuarios,
            IndexName='gsi-tipo',
            KeyConditionExpression=Key('tipo').eq('INMOBILIARIA'),
        )
        for item in items:
            inmo_id = _normalizar_inmo_id(item.get('pk'))
            result[inmo_id] = item.get('nombre', inmo_id)
    except Exception as e:
        print(f'Error cargando inmobiliarias: {e}')
    return result


def _listar_clientes_base(proyecto_id, inmobiliaria_id=None):
    items = _query_all(
        clientes,
        IndexName='gsi-proyecto-clientes',
        KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
        ScanIndexForward=False,
    )
    if inmobiliaria_id:
        inmo_norm = _normalizar_inmo_id(inmobiliaria_id)
        items = [
            item for item in items
            if _normalizar_inmo_id(item.get('inmobiliaria_id')) == inmo_norm
        ]
    return items


def _listar_procesos_proyecto(proyecto_id, inmobiliaria_id=None):
    try:
        items = _query_all(
            procesos,
            IndexName='gsi-proyecto-procesos',
            KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
        )
    except Exception as e:
        print(f'Error cargando procesos por proyecto: {e}')
        items = _scan_all(procesos, FilterExpression=Attr('proyecto_id').eq(proyecto_id))

    if inmobiliaria_id:
        inmo_norm = _normalizar_inmo_id(inmobiliaria_id)
        items = [
            item for item in items
            if _normalizar_inmo_id(item.get('inmobiliaria_id')) == inmo_norm
        ]
    return items


def _filas_clientes_proyecto(proyecto_id, inmobiliaria_id=None):
    clientes_items = _listar_clientes_base(proyecto_id, inmobiliaria_id)
    procesos_items = _listar_procesos_proyecto(proyecto_id, inmobiliaria_id)

    procesos_por_cliente = {}
    for proceso in procesos_items:
        key = f"{proceso.get('cedula', '')}#{_normalizar_inmo_id(proceso.get('inmobiliaria_id'))}"
        procesos_por_cliente.setdefault(key, []).append(proceso)

    filas = []
    for cliente in clientes_items:
        inmo_id = _normalizar_inmo_id(cliente.get('inmobiliaria_id'))
        key = f"{cliente.get('cedula', '')}#{inmo_id}"
        relacionados = procesos_por_cliente.get(key, [])

        if not relacionados:
            fila = dict(cliente)
            fila['inmobiliaria_id'] = inmo_id
            fila['estatus'] = 'sin_unidad'
            fila['estatus_label'] = 'Sin unidad'
            fila['unidad_id'] = ''
            fila['unidad_nombre'] = ''
            fila['proceso_pk'] = ''
            fila['proceso_sk'] = ''
            filas.append(fila)
            continue

        for proceso in relacionados:
            fila = dict(cliente)
            fila['inmobiliaria_id'] = inmo_id
            fila['estatus'] = proceso.get('estado', '')
            fila['estatus_label'] = proceso.get('estado', '')
            fila['unidad_id'] = proceso.get('unidad_id', '')
            fila['unidad_nombre'] = proceso.get('unidad_nombre') or proceso.get('unidad_id', '')
            fila['proceso_pk'] = proceso.get('pk', '')
            fila['proceso_sk'] = proceso.get('sk', '')
            filas.append(fila)

    filas.sort(key=lambda x: (str(x.get('nombres', '')).upper(), str(x.get('apellidos', '')).upper(), str(x.get('unidad_nombre', ''))))
    return filas


def _nombre_archivo_seguro(value):
    limpio = re.sub(r'[^A-Za-z0-9_-]+', '_', str(value or '').strip())
    return limpio.strip('_') or 'proyecto'


def _clean_spaces(value):
    return ' '.join(str(value or '').strip().split())


def _normalizar_texto_busqueda(value):
    return (
        unicodedata.normalize('NFD', str(value or ''))
        .encode('ascii', 'ignore')
        .decode('ascii')
        .lower()
    )


def _normalizar_nombre(value):
    return _clean_spaces(value).upper()


def _normalizar_cedula(value):
    cedula = _clean_spaces(value).upper()
    if not cedula:
        return ''
    if not DOCUMENTO_RE.match(cedula):
        raise ValueError('La cedula/pasaporte solo debe contener letras y numeros, sin guiones ni simbolos')
    return cedula


def _normalizar_correo(value):
    correo = _clean_spaces(value).lower()
    if not correo:
        return ''
    if not EMAIL_RE.match(correo):
        raise ValueError('El correo debe tener un formato valido y dominio con punto')
    return correo


def _normalizar_telefono(value):
    raw = _clean_spaces(value)
    if not raw:
        return ''
    if not raw.isdigit():
        raise ValueError('El telefono solo debe contener numeros')
    return raw


def _validar_catalogos_cliente(data):
    nacionalidad = _clean_spaces(data.get('nacionalidad'))
    pais_residencia = _clean_spaces(data.get('pais_residencia'))
    if nacionalidad and not CATALOGO_TEXTO_RE.match(nacionalidad):
        raise ValueError('Selecciona una nacionalidad valida')
    if pais_residencia and not CATALOGO_TEXTO_RE.match(pais_residencia):
        raise ValueError('Selecciona un pais de residencia valido')
    if 'nacionalidad' in data:
        data['nacionalidad'] = nacionalidad
    if 'pais_residencia' in data:
        data['pais_residencia'] = pais_residencia


def _normalizar_datos_cliente(body):
    data = dict(body or {})
    try:
        if 'nombres' in data:
            data['nombres'] = _normalizar_nombre(data.get('nombres'))
        if 'apellidos' in data:
            data['apellidos'] = _normalizar_nombre(data.get('apellidos'))
        if 'cedula' in data:
            data['cedula'] = _normalizar_cedula(data.get('cedula'))
        if 'correo' in data:
            data['correo'] = _normalizar_correo(data.get('correo'))
        if 'telefono' in data:
            data['telefono'] = _normalizar_telefono(data.get('telefono'))
        _validar_catalogos_cliente(data)
    except ValueError as exc:
        return None, str(exc)
    return data, None


def registrar(event):
    body = json.loads(event.get('body') or '{}')
    body, error = _normalizar_datos_cliente(body)
    if error:
        return bad_request(error)
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
        return conflict(CLIENTE_DUPLICADO_MSG)

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
        return conflict(CLIENTE_DUPLICADO_MSG)

    # Registrar nuevo cliente
    return _crear(pk, sk, body, cedula, inmobiliaria_id, proyecto_id)


def _resolver_unidad(body, proyecto_id):
    """Resuelve unidad_id, unidad_nombre y fecha_liberacion desde el body o inventario."""
    unidad_id = body.get('unidad_id')
    unidad_nombre = body.get('unidad_nombre')
    fecha_liberacion = None
    if unidad_id:
        try:
            inv = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
            item = inv.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
            ).get('Item', {})
            id_unidad = item.get('id_unidad') or unidad_id
            fecha_liberacion = item.get('fecha_liberacion')
            if not unidad_nombre:
                torre_id = item.get('torre_id')
                torre_nombre = None
                if torre_id:
                    torre = inv.get_item(
                        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'}
                    ).get('Item', {})
                    torre_nombre = torre.get('nombre')
                unidad_nombre = f"{torre_nombre} · {id_unidad}" if torre_nombre else id_unidad
        except Exception:
            unidad_nombre = unidad_nombre or unidad_id
    return unidad_id, unidad_nombre, fecha_liberacion


def _crear(pk, sk, body, cedula, inmobiliaria_id, proyecto_id):
    ahora = datetime.now(timezone.utc)
    fecha_captacion = ahora.isoformat()
    fecha_vencimiento = _add_months(ahora, MESES_EXCLUSIVIDAD).isoformat()
    ts_venc_eb = fecha_vencimiento[:19]

    edad = _calcular_edad(body.get('fecha_nacimiento'))
    unidad_id, unidad_nombre, fecha_liberacion_unidad = _resolver_unidad(body, proyecto_id)

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
        proceso_item = {
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
        }
        if fecha_liberacion_unidad:
            proceso_item['fecha_liberacion_unidad'] = fecha_liberacion_unidad
        procesos.put_item(Item=proceso_item)

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

    if qs.get('accion') == 'exportar':
        return exportar_clientes(event)

    if proyecto_id and qs.get('vista') == 'proyecto':
        return ok(_filas_clientes_proyecto(proyecto_id, inmobiliaria_id))

    kwargs = {
        'IndexName': 'gsi-inmobiliaria-clientes',
        'KeyConditionExpression': Key('inmobiliaria_id').eq(inmobiliaria_id),
        'ScanIndexForward': False,  # Más recientes primero
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

    if qs.get('accion') == 'exportar':
        return exportar_clientes(event)

    if proyecto_id and qs.get('vista') == 'proyecto':
        return ok({
            'items': _filas_clientes_proyecto(proyecto_id, inmobiliaria_id),
            'next_token': None,
        })

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
        kwargs['ScanIndexForward'] = False  # Más recientes primero
        if inmobiliaria_id:
            kwargs['FilterExpression'] = Attr('inmobiliaria_id').eq(inmobiliaria_id)
        result = clientes.query(**kwargs)
    elif inmobiliaria_id:
        # Normalizar: quitar prefijo si viene con él
        inmo_id_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')
        kwargs['IndexName'] = 'gsi-inmobiliaria-clientes'
        kwargs['KeyConditionExpression'] = Key('inmobiliaria_id').eq(inmo_id_clean)
        kwargs['ScanIndexForward'] = False  # Más recientes primero
        result = clientes.query(**kwargs)
        # Si no hay resultados, intentar con prefijo (registros legacy)
        if not result.get('Items'):
            kwargs['KeyConditionExpression'] = Key('inmobiliaria_id').eq(f'INMOBILIARIA#{inmo_id_clean}')
            kwargs['ScanIndexForward'] = False  # Más recientes primero
            result = clientes.query(**kwargs)
    else:
        result = clientes.scan(**kwargs)
        # Ordenar por fecha de captación descendente cuando se usa scan
        items = result.get('Items', [])
        items.sort(key=lambda x: x.get('fecha_captacion', ''), reverse=True)
        result['Items'] = items

    resp = {'items': result.get('Items', [])}
    if result.get('LastEvaluatedKey'):
        import base64, json as _json
        resp['next_token'] = base64.b64encode(
            _json.dumps(result['LastEvaluatedKey']).encode()
        ).decode()
    return ok(resp)


def exportar_clientes(event):
    """Exporta clientes de un proyecto a Excel, incluyendo estatus Sin unidad."""
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id', '').strip()
    inmobiliaria_id = qs.get('inmobiliaria_id')

    if not proyecto_id:
        return bad_request('proyecto_id requerido')
    if not ARCHIVOS_BUCKET:
        return bad_request('Bucket de archivos no configurado')

    try:
        if get_rol(event) == 'inmobiliaria':
            inmobiliaria_id = _get_inmobiliaria_id(get_sub(event))
        elif inmobiliaria_id:
            inmobiliaria_id = _normalizar_inmo_id(inmobiliaria_id)

        proyecto = _get_proyecto(proyecto_id)
        if not proyecto:
            return not_found('Proyecto no encontrado')

        proyecto_nombre = proyecto.get('nombre', proyecto_id)
        filas = _filas_clientes_proyecto(proyecto_id, inmobiliaria_id)
        inmobiliarias_map = _get_inmobiliarias_map()

        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        wb = Workbook()
        ws = wb.active
        ws.title = 'Clientes'

        headers = [
            'Cedula',
            'Nombre',
            'Apellido',
            'Correo',
            'Telefono',
            'Nacionalidad',
            'Pais de residencia',
            'Proyecto',
            'Inmobiliaria',
            'Estatus',
            'Unidad',
        ]

        header_fill = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid')
        header_font = Font(color='FFFFFF', bold=True, size=11)
        border = Border(
            left=Side(style='thin', color='D0D0D0'),
            right=Side(style='thin', color='D0D0D0'),
            top=Side(style='thin', color='D0D0D0'),
            bottom=Side(style='thin', color='D0D0D0'),
        )

        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = border

        widths = [16, 22, 22, 28, 18, 18, 22, 24, 24, 18, 20]
        for idx, width in enumerate(widths, 1):
            ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = width

        def estatus_label(fila):
            if fila.get('estatus') == 'sin_unidad':
                return 'Sin unidad'
            return fila.get('estatus_label') or fila.get('estatus') or ''

        for row_num, fila in enumerate(filas, 2):
            inmo_id = _normalizar_inmo_id(fila.get('inmobiliaria_id'))
            row_data = [
                fila.get('cedula', ''),
                fila.get('nombres', ''),
                fila.get('apellidos', ''),
                fila.get('correo', ''),
                fila.get('telefono', ''),
                fila.get('nacionalidad', ''),
                fila.get('pais_residencia', ''),
                proyecto_nombre,
                inmobiliarias_map.get(inmo_id, inmo_id),
                estatus_label(fila),
                fila.get('unidad_nombre') or fila.get('unidad_id') or '',
            ]
            for col_num, value in enumerate(row_data, 1):
                cell = ws.cell(row=row_num, column=col_num, value=value)
                cell.border = border
                cell.alignment = Alignment(vertical='center')

        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)

        timestamp = _now().replace(':', '-').replace('.', '-')
        filename = f"clientes_{_nombre_archivo_seguro(proyecto_nombre)}_{timestamp}.xlsx"
        s3_key = f'clientes/exportaciones/{filename}'

        s3_client.put_object(
            Bucket=ARCHIVOS_BUCKET,
            Key=s3_key,
            Body=excel_buffer.getvalue(),
            ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ContentDisposition=f'attachment; filename="{filename}"',
        )

        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': ARCHIVOS_BUCKET, 'Key': s3_key},
            ExpiresIn=300,
        )

        return ok({
            'download_url': download_url,
            'filename': filename,
            'total_clientes': len(filas),
            'proyecto_nombre': proyecto_nombre,
        })
    except Exception as e:
        print(f'ERROR exportar_clientes: {type(e).__name__}: {e}')
        import traceback
        traceback.print_exc()
        return bad_request(f'Error al generar exportacion: {str(e)}')


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
    inmobiliaria_id = _normalizar_inmo_id(qs.get('inmobiliaria_id'))
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
    body, error = _normalizar_datos_cliente(body)
    if error:
        return bad_request(error)
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
    actualizado = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item') or {}
    print('DEBUG actualizar_admin cliente actualizado:', json.dumps({
        'cedula': cedula,
        'proyecto_id': proyecto_id,
        'inmobiliaria_id': inmobiliaria_id,
        'estado_civil': actualizado.get('estado_civil', ''),
        'nacionalidad': actualizado.get('nacionalidad', ''),
        'pais_residencia': actualizado.get('pais_residencia', ''),
    }, ensure_ascii=False))
    return ok({'message': 'Cliente actualizado', 'cliente': actualizado})


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
    items = result.get('Items', [])

    # Enriquecer con nombre del cliente desde la tabla de clientes
    inmo_id_clean = inmobiliaria_id.replace('INMOBILIARIA#', '')
    for p in items:
        cedula = p.get('cedula', '')
        pid = (proyecto_id or p.get('proyecto_id', '')).replace('PROYECTO#', '')
        if not cedula or not pid:
            continue
        try:
            cliente = clientes.get_item(
                Key={'pk': f'CLIENTE#{cedula}#{inmo_id_clean}', 'sk': f'PROYECTO#{pid}'}
            ).get('Item') or {}
            if cliente.get('nombres'):
                p['nombres'] = cliente['nombres']
                p['apellidos'] = cliente.get('apellidos', '')
        except Exception:
            pass

    return ok(items)


def registrar_publico(event):
    """POST /publico/clientes — registro externo sin auth, inmobiliaria_id viene en el body."""
    body = json.loads(event.get('body') or '{}')
    body, error = _normalizar_datos_cliente(body)
    if error:
        return bad_request(error)
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
        return conflict(CLIENTE_DUPLICADO_MSG)

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


def listar_inmobiliarias_publico(event):
    """GET /publico/inmobiliarias — lista todas las inmobiliarias activas (sin auth)."""
    try:
        from boto3.dynamodb.conditions import Key
        inmo_table = dynamodb.Table(os.environ['USUARIOS_TABLE'])
        response = inmo_table.query(
            IndexName='gsi-tipo',
            KeyConditionExpression=Key('tipo').eq('INMOBILIARIA')
        )
        
        result = []
        for item in response.get('Items', []):
            # Solo incluir inmobiliarias activas
            if not item.get('activo', True):
                continue
                
            inmo_id = item['pk'].replace('INMOBILIARIA#', '')
            result.append({
                'id': inmo_id,
                'nombre': item.get('nombre', inmo_id),
                'imagen_url': item.get('imagen_url')
            })
        
        # Ordenar por nombre
        result.sort(key=lambda x: x['nombre'].lower())
        return ok(result)
    except Exception as e:
        print(f'ERROR listar_inmobiliarias_publico: {type(e).__name__}: {e}')
        import traceback
        traceback.print_exc()
        return bad_request('Error al obtener inmobiliarias')


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


def _get_inventario_table():
    return dynamodb.Table(os.environ['INVENTARIO_TABLE'])


def _get_proyecto_publico(proyecto_id):
    item = _get_inventario_table().get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not item or not item.get('activo', True):
        return None
    return item


def _detalle_inventario_publico(proyecto_id):
    item = _get_proyecto_publico(proyecto_id)
    if not item:
        return not_found('Proyecto no encontrado')
    return ok({
        'pk': item.get('pk'),
        'proyecto_id': item.get('proyecto_id'),
        'nombre': item.get('nombre'),
        'descripcion': item.get('descripcion', ''),
        'imagen_url': item.get('imagen_url'),
        'activo': item.get('activo', True),
        'creado_en': item.get('creado_en'),
    })


def _etapas_inventario_publico(proyecto_id):
    if not _get_proyecto_publico(proyecto_id):
        return not_found('Proyecto no encontrado')
    result = _get_inventario_table().query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('ETAPA#')
    )
    return ok(result.get('Items', []))


def _unidades_inventario_publico(proyecto_id, qs):
    if not _get_proyecto_publico(proyecto_id):
        return not_found('Proyecto no encontrado')

    estado = (qs.get('estado') or '').strip().lower()
    if estado in ('disponible', 'bloqueada'):
        filter_expr = Attr('estado').eq(estado)
    else:
        filter_expr = Attr('estado').is_in(['disponible', 'bloqueada'])

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

    result = _get_inventario_table().query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
        FilterExpression=filter_expr,
    )

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
    return ok({'items': items, 'count': len(items)})


def listar_proyectos_publico(event):
    """GET /publico/proyectos?inmobiliaria_id=xxx — proyectos asignados a la inmobiliaria (sin auth)."""
    qs = event.get('queryStringParameters') or {}
    inventario_publico = qs.get('inventario_publico', '').strip()
    proyecto_publico_id = qs.get('proyecto_id', '').strip()
    if inventario_publico:
        if not proyecto_publico_id:
            return bad_request('proyecto_id es requerido')
        if inventario_publico == 'detalle':
            return _detalle_inventario_publico(proyecto_publico_id)
        if inventario_publico == 'etapas':
            return _etapas_inventario_publico(proyecto_publico_id)
        if inventario_publico == 'unidades':
            return _unidades_inventario_publico(proyecto_publico_id, qs)
        return bad_request('inventario_publico invalido')

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


def buscar_clientes_admin(event):
    """GET /admin/clientes/buscar?q=texto&tipo=nombre|cedula&proyecto_id=xxx&inmobiliaria_id=xxx — búsqueda en todos los clientes."""
    qs = event.get('queryStringParameters') or {}
    query = qs.get('q', '').strip()
    tipo = qs.get('tipo', 'nombre').lower()  # 'nombre' o 'cedula'
    proyecto_id = qs.get('proyecto_id')
    inmobiliaria_id = qs.get('inmobiliaria_id')
    
    print(f'DEBUG buscar_clientes_admin: query={query}, tipo={tipo}, proyecto_id={proyecto_id}, inmobiliaria_id={inmobiliaria_id}')
    
    if not query or len(query) < 2:
        return bad_request('Query debe tener al menos 2 caracteres')
    
    query_lower = query.lower()
    items = []
    
    if tipo == 'cedula':
        # Búsqueda por cédula - usar GSI para búsqueda exacta o scan para búsqueda parcial
        cedula_busqueda = query.strip()
        
        print(f'DEBUG búsqueda por cédula: query={cedula_busqueda}')
        
        try:
            # Intentar primero con GSI (búsqueda exacta - más rápido)
            if proyecto_id:
                # Si hay proyecto, usar GSI con cédula + proyecto
                print(f'DEBUG usando GSI con proyecto: cedula={cedula_busqueda}, proyecto={proyecto_id}')
                query_kwargs = {
                    'IndexName': 'gsi-cedula-proyecto',
                    'KeyConditionExpression': Key('cedula').eq(cedula_busqueda) & Key('sk').eq(f'PROYECTO#{proyecto_id}')
                }
                
                while True:
                    result = clientes.query(**query_kwargs)
                    items.extend(result.get('Items', []))
                    
                    if 'LastEvaluatedKey' not in result:
                        break
                    query_kwargs['ExclusiveStartKey'] = result['LastEvaluatedKey']
                
                print(f'DEBUG GSI con proyecto encontró: {len(items)} items')
                
                # Si no encuentra nada con búsqueda exacta, intentar búsqueda parcial con scan
                if not items:
                    print(f'DEBUG GSI no encontró nada, intentando scan parcial')
                    filter_expr = Attr('cedula').contains(cedula_busqueda) & Attr('proyecto_id').eq(proyecto_id)
                    scan_kwargs = {'FilterExpression': filter_expr}
                    
                    while True:
                        result = clientes.scan(**scan_kwargs)
                        items.extend(result.get('Items', []))
                        
                        if 'LastEvaluatedKey' not in result:
                            break
                        scan_kwargs['ExclusiveStartKey'] = result['LastEvaluatedKey']
                    
                    print(f'DEBUG scan parcial encontró: {len(items)} items')
            else:
                # Sin proyecto, usar GSI solo con cédula
                print(f'DEBUG usando GSI sin proyecto: cedula={cedula_busqueda}')
                query_kwargs = {
                    'IndexName': 'gsi-cedula-proyecto',
                    'KeyConditionExpression': Key('cedula').eq(cedula_busqueda)
                }
                
                while True:
                    result = clientes.query(**query_kwargs)
                    items.extend(result.get('Items', []))
                    
                    if 'LastEvaluatedKey' not in result:
                        break
                    query_kwargs['ExclusiveStartKey'] = result['LastEvaluatedKey']
                
                print(f'DEBUG GSI sin proyecto encontró: {len(items)} items')
                
                # Si no encuentra nada con búsqueda exacta, intentar búsqueda parcial con scan
                if not items:
                    print(f'DEBUG GSI no encontró nada, intentando scan parcial')
                    filter_expr = Attr('cedula').contains(cedula_busqueda)
                    scan_kwargs = {'FilterExpression': filter_expr}
                    
                    while True:
                        result = clientes.scan(**scan_kwargs)
                        items.extend(result.get('Items', []))
                        
                        if 'LastEvaluatedKey' not in result:
                            break
                        scan_kwargs['ExclusiveStartKey'] = result['LastEvaluatedKey']
                    
                    print(f'DEBUG scan parcial encontró: {len(items)} items')
        except Exception as e:
            print(f'ERROR en búsqueda por cédula: {e}')
            import traceback
            print(f'TRACEBACK: {traceback.format_exc()}')
            items = []
        
        print(f'DEBUG total items cédula: {len(items)}')
    else:
        # Búsqueda por nombre - usar scan completo con paginación automática (SIN LÍMITES)
        # DynamoDB contains es case-sensitive, así que buscamos en múltiples variaciones
        
        # Buscar en minúsculas, Title Case y MAYÚSCULAS
        query_tokens = [
            token for token in _normalizar_texto_busqueda(query).split()
            if len(token) >= 2
        ]
        
        filter_expr = None
        
        if proyecto_id:
            filter_expr = Attr('proyecto_id').eq(proyecto_id)
        
        try:
            # Scan completo con paginación automática - SIN LÍMITE
            scan_kwargs = {}
            if filter_expr is not None:
                scan_kwargs['FilterExpression'] = filter_expr
            
            # Paginar hasta obtener TODOS los resultados
            while True:
                result = clientes.scan(**scan_kwargs)
                items.extend(result.get('Items', []))
                
                print(f'DEBUG scan página: {len(result.get("Items", []))} items, total acumulado: {len(items)}')
                
                # Si no hay más páginas, salir
                if 'LastEvaluatedKey' not in result:
                    print(f'DEBUG scan completado, no hay más páginas')
                    break
                    
                # Continuar con la siguiente página
                scan_kwargs['ExclusiveStartKey'] = result['LastEvaluatedKey']
            
            print(f'DEBUG scan total encontró: {len(items)} items')
            if query_tokens:
                items_antes = len(items)
                items = [
                    item for item in items
                    if all(
                        token in _normalizar_texto_busqueda(
                            f"{item.get('nombres', '')} {item.get('apellidos', '')} {item.get('cedula', '')}"
                        )
                        for token in query_tokens
                    )
                ]
                print(f'DEBUG filtro nombre combinado: {items_antes} -> {len(items)} items')
        except Exception as e:
            print(f'ERROR en scan: {e}')
            import traceback
            print(f'TRACEBACK: {traceback.format_exc()}')
            items = []
    
    # Filtrar por inmobiliaria si se especificó
    if inmobiliaria_id:
        inmo_norm = inmobiliaria_id.replace('INMOBILIARIA#', '')
        items_antes = len(items)
        items = [
            i for i in items 
            if i.get('inmobiliaria_id') == inmo_norm or 
               i.get('inmobiliaria_id') == f'INMOBILIARIA#{inmo_norm}' or
               i.get('inmobiliaria_id') == inmobiliaria_id
        ]
        print(f'DEBUG filtro inmobiliaria: {items_antes} -> {len(items)} items')
    
    # Devolver TODOS los resultados encontrados (sin límite)
    print(f'DEBUG buscar_clientes_admin: devolviendo {len(items)} items')
    
    return ok(items)


def eliminar_admin(event, cedula, proyecto_id):
    """DELETE /admin/clientes/{cedula}/proyecto/{id} — admin elimina TODOS los registros del cliente en TODAS las inmobiliarias."""
    
    print(f'[ELIMINAR] Iniciando eliminación COMPLETA de cliente: cedula={cedula}, proyecto={proyecto_id}')
    
    items_eliminados = []
    
    # 1. Buscar TODOS los registros del cliente en este proyecto (todas las inmobiliarias)
    try:
        resultado = clientes.query(
            IndexName='gsi-cedula-proyecto',
            KeyConditionExpression=Key('cedula').eq(cedula) & Key('sk').eq(f'PROYECTO#{proyecto_id}')
        )
        registros = resultado.get('Items', [])
        print(f'[ELIMINAR] Registros encontrados: {len(registros)}')
        
        if not registros:
            print(f'[ELIMINAR] Cliente no encontrado')
            return not_found('Cliente no encontrado')
        
        # 2. Para cada registro (cada inmobiliaria)
        for registro in registros:
            inmobiliaria_id = registro.get('inmobiliaria_id', '').replace('INMOBILIARIA#', '')
            print(f'[ELIMINAR] Procesando registro en inmobiliaria: {inmobiliaria_id}')
            
            # 2.1. Buscar y eliminar todos los procesos del cliente en esta inmobiliaria
            pk_proceso = f'PROCESO#{cedula}#{inmobiliaria_id}'
            print(f'[ELIMINAR] Buscando procesos: pk={pk_proceso}')
            
            try:
                procesos_result = procesos.query(
                    KeyConditionExpression=Key('pk').eq(pk_proceso)
                )
                procesos_items = procesos_result.get('Items', [])
                print(f'[ELIMINAR] Procesos encontrados en {inmobiliaria_id}: {len(procesos_items)}')
                
                # 2.2. Para cada proceso, desvincular unidad y liberar bloqueos si existen
                inventario = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
                scheduler_client = boto3.client('scheduler')
                
                for proceso in procesos_items:
                    print(f'[ELIMINAR] ===== Procesando proceso =====')
                    print(f'[ELIMINAR] Proceso completo: {proceso}')
                    
                    unidad_id = proceso.get('unidad_id')
                    proceso_pk = proceso.get('pk')
                    proceso_sk = proceso.get('sk')
                    
                    print(f'[ELIMINAR] unidad_id extraido: {unidad_id}')
                    print(f'[ELIMINAR] proceso pk: {proceso_pk}, sk: {proceso_sk}')
                    
                    if unidad_id:
                        print(f'[ELIMINAR] Verificando unidad: {unidad_id}')
                        
                        # Obtener la unidad
                        unidad_pk = f'PROYECTO#{proyecto_id}'
                        unidad_sk = f'UNIDAD#{unidad_id}'
                        
                        print(f'[ELIMINAR] Buscando unidad con pk={unidad_pk}, sk={unidad_sk}')
                        
                        try:
                            get_result = inventario.get_item(Key={'pk': unidad_pk, 'sk': unidad_sk})
                            print(f'[ELIMINAR] Resultado get_item: {get_result}')
                            
                            unidad = get_result.get('Item')
                            if unidad:
                                cliente_cedula = unidad.get('cliente_cedula', '')
                                estado_actual = unidad.get('estado', '')
                                bloqueado_por = unidad.get('bloqueado_por', '')
                                
                                print(f'[ELIMINAR] Unidad encontrada - estado: {estado_actual}, cliente_cedula: {cliente_cedula}, bloqueado_por: {bloqueado_por}')
                                
                                # Desvincular si está vinculada a este cliente
                                if cliente_cedula == cedula:
                                    print(f'[ELIMINAR] OK Unidad vinculada a este cliente, procediendo a desvincular')
                                    
                                    # Si está bloqueada, eliminar schedules
                                    if estado_actual == 'bloqueada':
                                        print(f'[ELIMINAR] Unidad esta bloqueada, eliminando schedules...')
                                        for suffix in ('alerta', 'liberacion'):
                                            try:
                                                safe_unidad = unidad_id.replace('/', '-').replace('#', '-')
                                                schedule_name = f"bloqueo-{safe_unidad}-{suffix}"
                                                scheduler_client.delete_schedule(Name=schedule_name)
                                                print(f'[ELIMINAR] OK Schedule eliminado: {schedule_name}')
                                            except scheduler_client.exceptions.ResourceNotFoundException:
                                                print(f'[ELIMINAR] Schedule no encontrado (ya eliminado): bloqueo-{safe_unidad}-{suffix}')
                                            except Exception as e:
                                                print(f'[ELIMINAR] ERROR eliminando schedule {suffix}: {e}')
                                    else:
                                        print(f'[ELIMINAR] Unidad NO esta bloqueada (estado: {estado_actual}), no hay schedules que eliminar')
                                    
                                    # Desvincular unidad (marcar como disponible y remover referencias al cliente)
                                    print(f'[ELIMINAR] Actualizando unidad a estado disponible...')
                                    update_result = inventario.update_item(
                                        Key={'pk': unidad_pk, 'sk': unidad_sk},
                                        UpdateExpression='SET estado = :estado REMOVE bloqueado_por, cliente_cedula, fecha_bloqueo, fecha_liberacion',
                                        ExpressionAttributeValues={':estado': 'disponible'},
                                        ReturnValues='ALL_NEW'
                                    )
                                    print(f'[ELIMINAR] OK Unidad actualizada: {update_result.get("Attributes")}')
                                    items_eliminados.append(f'Unidad desvinculada: {unidad_id} ({inmobiliaria_id})')
                                    print(f'[ELIMINAR] SUCCESS Unidad desvinculada exitosamente: {unidad_id}')
                                else:
                                    print(f'[ELIMINAR] ERROR Unidad {unidad_id} NO esta vinculada a este cliente (cliente_cedula en unidad: "{cliente_cedula}" vs cedula buscada: "{cedula}")')
                            else:
                                print(f'[ELIMINAR] ERROR Unidad {unidad_id} NO encontrada en inventario (Item vacio)')
                        except Exception as e:
                            print(f'[ELIMINAR] EXCEPTION Error procesando unidad {unidad_id}: {e}')
                            import traceback
                            print(f'[ELIMINAR] Traceback: {traceback.format_exc()}')
                    else:
                        print(f'[ELIMINAR] WARNING Proceso sin unidad_id')
                    
                    # Eliminar el proceso
                    print(f'[ELIMINAR] Eliminando proceso de DynamoDB...')
                    try:
                        procesos.delete_item(Key={'pk': proceso_pk, 'sk': proceso_sk})
                        items_eliminados.append(f'Proceso eliminado: {proceso.get("unidad_nombre", proceso_sk)} ({inmobiliaria_id})')
                        print(f'[ELIMINAR] OK Proceso eliminado: pk={proceso_pk}, sk={proceso_sk}')
                    except Exception as e:
                        print(f'[ELIMINAR] ERROR eliminando proceso: {e}')
                        import traceback
                        print(f'[ELIMINAR] Traceback: {traceback.format_exc()}')
                    
                    print(f'[ELIMINAR] ===== Fin proceso =====\n')
            
            except Exception as e:
                print(f'[ELIMINAR] Error eliminando procesos de {inmobiliaria_id}: {e}')
                import traceback
                print(traceback.format_exc())
            
            # 2.3. Eliminar schedule de vencimiento de exclusividad
            try:
                sched.eliminar_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id)
                items_eliminados.append(f'Schedule de exclusividad eliminado ({inmobiliaria_id})')
            except Exception as e:
                print(f'[ELIMINAR] Error eliminando schedule de exclusividad en {inmobiliaria_id}: {e}')
            
            # 2.4. Eliminar el registro del cliente
            try:
                clientes.delete_item(Key={'pk': registro['pk'], 'sk': registro['sk']})
                items_eliminados.append(f'Cliente eliminado de {inmobiliaria_id}')
                print(f'[ELIMINAR] Cliente eliminado: {registro["pk"]}, {registro["sk"]}')
            except Exception as e:
                print(f'[ELIMINAR] Error eliminando cliente de {inmobiliaria_id}: {e}')
        
        print(f'[ELIMINAR] Eliminación completada. Items eliminados: {len(items_eliminados)}')
        
        return ok({
            'message': f'Cliente {cedula} eliminado completamente de {len(registros)} inmobiliaria(s)',
            'items_eliminados': items_eliminados,
            'registros_eliminados': len(registros),
            'cliente': {
                'cedula': cedula,
                'nombres': registros[0].get('nombres'),
                'apellidos': registros[0].get('apellidos'),
                'proyecto_id': proyecto_id,
            }
        })
    
    except Exception as e:
        print(f'[ELIMINAR] Error general: {e}')
        import traceback
        print(traceback.format_exc())
        return bad_request(f'Error eliminando cliente: {str(e)}')
