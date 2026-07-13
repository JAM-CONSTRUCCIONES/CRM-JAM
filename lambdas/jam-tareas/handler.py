import json
import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

from utils.auth import es_admin, get_usuario, puede_asignar, puede_ver
from utils.response import bad_request, created, forbidden, not_found, ok


dynamodb = boto3.resource('dynamodb')
TAREAS_TABLE = os.environ['TAREAS_TABLE']
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']
tareas_t = dynamodb.Table(TAREAS_TABLE)
usuarios_t = dynamodb.Table(USUARIOS_TABLE)

ESTADOS_TAREA = ('pendiente', 'en_progreso', 'completada', 'cancelada')
PRIORIDADES = ('baja', 'media', 'alta')
ROLES_JAM = ('admin', 'coordinador', 'supervisor')
HORA_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')


def handler(event, context):
    if not puede_ver(event):
        return forbidden()

    method = event.get('httpMethod', '')
    qs = _qs(event)
    body = _body(event)
    tipo = (qs.get('tipo') or body.get('tipo') or '').strip().lower()

    if tipo in ('trabajador', 'trabajadores'):
        if method == 'GET':
            return listar_trabajadores(event)
        if method == 'POST':
            return crear_trabajador(event)
        if method == 'PUT':
            return actualizar_trabajador(event)
        return not_found('Ruta de trabajadores no encontrada')

    if method == 'GET':
        tarea_id = qs.get('tarea_id')
        return obtener_tarea(tarea_id) if tarea_id else listar_tareas(event)
    if method == 'POST':
        return crear_tarea(event)
    if method == 'PUT':
        return actualizar_tarea(event)
    if method == 'DELETE':
        return cancelar_tarea(event)

    return not_found('Ruta no encontrada')


def _body(event):
    raw = event.get('body') or '{}'
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _qs(event):
    return event.get('queryStringParameters') or {}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _clean_text(value):
    return ' '.join(str(value or '').strip().split())


def _scan_all(**kwargs):
    items = []
    last_key = None
    while True:
        req = dict(kwargs)
        if last_key:
            req['ExclusiveStartKey'] = last_key
        res = tareas_t.scan(**req)
        items.extend(res.get('Items', []))
        last_key = res.get('LastEvaluatedKey')
        if not last_key:
            return items


def _query_all(**kwargs):
    items = []
    last_key = None
    while True:
        req = dict(kwargs)
        if last_key:
            req['ExclusiveStartKey'] = last_key
        res = tareas_t.query(**req)
        items.extend(res.get('Items', []))
        last_key = res.get('LastEvaluatedKey')
        if not last_key:
            return items


def _int_or_none(value):
    if value in (None, ''):
        return None
    try:
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _to_decimal(value):
    return Decimal(str(value)) if value is not None else None


def _get_usuario_jam(usuario_id):
    if not usuario_id:
        return None
    usuario_id = str(usuario_id).replace('USUARIO#', '')
    item = usuarios_t.get_item(
        Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not item:
        return None
    if item.get('rol') not in ROLES_JAM:
        return None
    return item


def _validar_fecha_hora(fecha, hora):
    if not fecha:
        return 'fecha es requerida'
    if not hora:
        return 'hora es requerida'
    try:
        datetime.strptime(fecha, '%Y-%m-%d')
    except ValueError:
        return 'fecha debe tener formato YYYY-MM-DD'
    if not HORA_RE.match(hora):
        return 'hora debe tener formato HH:mm'
    return ''


def listar_tareas(event):
    qs = _qs(event)
    fecha = (qs.get('fecha') or '').strip()
    trabajador_id = (qs.get('trabajador_id') or '').strip()
    estado = (qs.get('estado') or '').strip()
    prioridad = (qs.get('prioridad') or '').strip()

    if fecha:
        items = _query_all(
            IndexName='gsi-fecha',
            KeyConditionExpression=Key('fecha').eq(fecha),
        )
    elif trabajador_id:
        items = _query_all(
            IndexName='gsi-trabajador',
            KeyConditionExpression=Key('trabajador_id').eq(trabajador_id),
        )
    elif estado:
        items = _query_all(
            IndexName='gsi-estado',
            KeyConditionExpression=Key('estado').eq(estado),
        )
    else:
        items = _scan_all(FilterExpression=Attr('tipo').eq('tarea'))

    if trabajador_id:
        items = [item for item in items if item.get('trabajador_id') == trabajador_id]
    if estado:
        items = [item for item in items if item.get('estado') == estado]
    if prioridad:
        items = [item for item in items if item.get('prioridad') == prioridad]

    items.sort(key=lambda item: item.get('fecha_hora_inicio', ''))
    return ok(items[:300])


def obtener_tarea(tarea_id):
    if not tarea_id:
        return bad_request('tarea_id requerido')
    item = tareas_t.get_item(Key={'pk': f'TAREA#{tarea_id}', 'sk': 'METADATA'}).get('Item')
    if not item:
        return not_found('Tarea no encontrada')
    return ok(item)


def crear_tarea(event):
    if not puede_asignar(event):
        return forbidden('Solo administrador o coordinador pueden asignar tareas')

    body = _body(event)
    titulo = _clean_text(body.get('titulo'))
    trabajador_id = _clean_text(body.get('trabajador_id'))
    fecha = _clean_text(body.get('fecha'))
    hora = _clean_text(body.get('hora'))
    estado = _clean_text(body.get('estado') or 'pendiente')
    prioridad = _clean_text(body.get('prioridad') or 'media')
    duracion = _int_or_none(body.get('duracion_minutos'))

    if not titulo:
        return bad_request('titulo es requerido')
    error_fecha = _validar_fecha_hora(fecha, hora)
    if error_fecha:
        return bad_request(error_fecha)
    if estado not in ESTADOS_TAREA:
        return bad_request('estado invalido')
    if prioridad not in PRIORIDADES:
        return bad_request('prioridad invalida')
    if body.get('duracion_minutos') not in (None, '') and not duracion:
        return bad_request('duracion_minutos debe ser mayor a 0')

    trabajador = _get_usuario_jam(trabajador_id)
    if not trabajador or not trabajador.get('activo', True):
        return bad_request('usuario JAM activo requerido')

    usuario = get_usuario(event)
    now = _now()
    tarea_id = str(uuid.uuid4())
    item = {
        'pk': f'TAREA#{tarea_id}',
        'sk': 'METADATA',
        'tipo': 'tarea',
        'tarea_id': tarea_id,
        'titulo': titulo,
        'descripcion': str(body.get('descripcion') or '').strip(),
        'trabajador_id': trabajador.get('pk', '').replace('USUARIO#', ''),
        'trabajador_nombre': trabajador.get('nombre') or trabajador.get('cognito_username', ''),
        'fecha': fecha,
        'hora': hora,
        'fecha_hora_inicio': f'{fecha}T{hora}:00',
        'duracion_minutos': _to_decimal(duracion),
        'estado': estado,
        'prioridad': prioridad,
        'proyecto_id': _clean_text(body.get('proyecto_id')),
        'proyecto_nombre': _clean_text(body.get('proyecto_nombre')),
        'unidad_id': _clean_text(body.get('unidad_id')),
        'creado_por': usuario.get('sub', ''),
        'creado_por_nombre': usuario.get('nombre', ''),
        'creado_en': now,
        'actualizado_en': now,
    }
    item = {k: v for k, v in item.items() if v not in (None, '')}
    tareas_t.put_item(Item=item)
    return created(item)


def actualizar_tarea(event):
    if not puede_asignar(event):
        return forbidden('Solo administrador o coordinador pueden editar tareas')

    body = _body(event)
    tarea_id = _clean_text(body.get('tarea_id') or _qs(event).get('tarea_id'))
    if not tarea_id:
        return bad_request('tarea_id requerido')

    current = tareas_t.get_item(Key={'pk': f'TAREA#{tarea_id}', 'sk': 'METADATA'}).get('Item')
    if not current:
        return not_found('Tarea no encontrada')

    next_item = dict(current)
    for field in ('titulo', 'descripcion', 'proyecto_id', 'proyecto_nombre', 'unidad_id'):
        if field in body:
            next_item[field] = _clean_text(body.get(field)) if field != 'descripcion' else str(body.get(field) or '').strip()

    if 'trabajador_id' in body and body.get('trabajador_id') != current.get('trabajador_id'):
        trabajador = _get_usuario_jam(_clean_text(body.get('trabajador_id')))
        if not trabajador or not trabajador.get('activo', True):
            return bad_request('usuario JAM activo requerido')
        next_item['trabajador_id'] = trabajador.get('pk', '').replace('USUARIO#', '')
        next_item['trabajador_nombre'] = trabajador.get('nombre') or trabajador.get('cognito_username', '')

    fecha = _clean_text(body.get('fecha') or next_item.get('fecha'))
    hora = _clean_text(body.get('hora') or next_item.get('hora'))
    if 'fecha' in body or 'hora' in body:
        error_fecha = _validar_fecha_hora(fecha, hora)
        if error_fecha:
            return bad_request(error_fecha)
        next_item['fecha'] = fecha
        next_item['hora'] = hora
        next_item['fecha_hora_inicio'] = f'{fecha}T{hora}:00'

    if 'estado' in body:
        estado = _clean_text(body.get('estado'))
        if estado not in ESTADOS_TAREA:
            return bad_request('estado invalido')
        next_item['estado'] = estado
    if 'prioridad' in body:
        prioridad = _clean_text(body.get('prioridad'))
        if prioridad not in PRIORIDADES:
            return bad_request('prioridad invalida')
        next_item['prioridad'] = prioridad
    if 'duracion_minutos' in body:
        duracion = _int_or_none(body.get('duracion_minutos'))
        if body.get('duracion_minutos') not in (None, '') and not duracion:
            return bad_request('duracion_minutos debe ser mayor a 0')
        next_item['duracion_minutos'] = _to_decimal(duracion)

    if not next_item.get('titulo'):
        return bad_request('titulo es requerido')

    next_item['actualizado_en'] = _now()
    next_item = {k: v for k, v in next_item.items() if v not in (None, '')}
    tareas_t.put_item(Item=next_item)
    return ok(next_item)


def cancelar_tarea(event):
    if not es_admin(event):
        return forbidden('Solo administrador puede eliminar o cancelar tareas')
    tarea_id = _clean_text(_qs(event).get('tarea_id'))
    if not tarea_id:
        return bad_request('tarea_id requerido')
    current = tareas_t.get_item(Key={'pk': f'TAREA#{tarea_id}', 'sk': 'METADATA'}).get('Item')
    if not current:
        return not_found('Tarea no encontrada')
    current['estado'] = 'cancelada'
    current['actualizado_en'] = _now()
    tareas_t.put_item(Item=current)
    return ok(current)


def listar_trabajadores(event):
    qs = _qs(event)
    incluir_inactivos = str(qs.get('incluir_inactivos') or '').lower() == 'true'
    items = _scan_all(FilterExpression=Attr('tipo').eq('trabajador'))
    if not incluir_inactivos:
        items = [item for item in items if item.get('activo', True)]
    items.sort(key=lambda item: item.get('nombre', '').lower())
    return ok(items)


def crear_trabajador(event):
    if not es_admin(event):
        return forbidden('Solo administrador puede crear trabajadores')
    body = _body(event)
    nombre = _clean_text(body.get('nombre'))
    if not nombre:
        return bad_request('nombre es requerido')
    now = _now()
    trabajador_id = str(uuid.uuid4())
    item = {
        'pk': f'TRABAJADOR#{trabajador_id}',
        'sk': 'METADATA',
        'tipo': 'trabajador',
        'trabajador_id': trabajador_id,
        'nombre': nombre,
        'telefono': _clean_text(body.get('telefono')),
        'correo': _clean_text(body.get('correo')).lower(),
        'cargo': _clean_text(body.get('cargo')),
        'activo': bool(body.get('activo', True)),
        'creado_en': now,
        'actualizado_en': now,
    }
    item = {k: v for k, v in item.items() if v not in (None, '')}
    tareas_t.put_item(Item=item)
    return created(item)


def actualizar_trabajador(event):
    if not es_admin(event):
        return forbidden('Solo administrador puede editar trabajadores')
    body = _body(event)
    trabajador_id = _clean_text(body.get('trabajador_id') or _qs(event).get('trabajador_id'))
    if not trabajador_id:
        return bad_request('trabajador_id requerido')
    current = tareas_t.get_item(
        Key={'pk': f'TRABAJADOR#{trabajador_id}', 'sk': 'METADATA'}
    ).get('Item')
    if not current:
        return not_found('Trabajador no encontrado')
    for field in ('nombre', 'telefono', 'correo', 'cargo'):
        if field in body:
            current[field] = _clean_text(body.get(field))
    if 'activo' in body:
        current['activo'] = bool(body.get('activo'))
    if not current.get('nombre'):
        return bad_request('nombre es requerido')
    current['actualizado_en'] = _now()
    current = {k: v for k, v in current.items() if v not in (None, '')}
    tareas_t.put_item(Item=current)
    return ok(current)
