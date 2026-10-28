import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from html import escape
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.conditions import Attr, Key

from utils.auth import es_admin, get_usuario, puede_asignar, puede_ver
from utils.response import bad_request, created, forbidden, not_found, ok
from utils.auditoria import registrar_auditoria


dynamodb = boto3.resource('dynamodb')
scheduler = boto3.client('scheduler')
ses = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
TAREAS_TABLE = os.environ['TAREAS_TABLE']
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')
TAREAS_LAMBDA_ARN = os.environ.get('TAREAS_LAMBDA_ARN', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', '')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
BUSINESS_TZ = os.environ.get('BUSINESS_TZ', 'America/Santo_Domingo')
tareas_t = dynamodb.Table(TAREAS_TABLE)
usuarios_t = dynamodb.Table(USUARIOS_TABLE)

ESTADOS_TAREA = ('pendiente', 'en_progreso', 'completada', 'cancelada')
PRIORIDADES = ('baja', 'media', 'alta')
ROLES_JAM = ('admin', 'coordinador', 'supervisor')
HORA_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def handler(event, context):
    if event.get('source') == 'scheduler' and event.get('tipo') == 'recordatorio_tarea':
        return procesar_recordatorio_tarea(event)

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


def _fechas_en_rango(fecha_desde, fecha_hasta, max_dias=120):
    inicio = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
    fin = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
    dias = (fin - inicio).days + 1
    if dias > max_dias:
        return None
    return [(inicio + timedelta(days=i)).isoformat() for i in range(dias)]


def _listar_tareas_por_estados(estados=ESTADOS_TAREA):
    items = []
    for estado in estados:
        items.extend(_query_all(
            IndexName='gsi-estado',
            KeyConditionExpression=Key('estado').eq(estado),
        ))
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


def _to_int(value):
    if value in (None, ''):
        return None
    try:
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _safe_schedule_part(value):
    return re.sub(r'[^A-Za-z0-9_-]+', '-', str(value or ''))[:48]


def _schedule_name_tarea(tarea_id):
    return f"tarea-rem-{_safe_schedule_part(tarea_id)}"[:64]


def _fecha_hora_tarea(tarea):
    return datetime.strptime(
        f"{tarea.get('fecha')} {tarea.get('hora')}",
        '%Y-%m-%d %H:%M',
    ).replace(tzinfo=ZoneInfo(BUSINESS_TZ))


def _recordatorio_datetime(tarea):
    minutos = _to_int(tarea.get('recordatorio_minutos_antes'))
    if not minutos:
        return None
    return _fecha_hora_tarea(tarea) - timedelta(minutes=minutos)


def _cancelar_schedule_recordatorio(tarea_id):
    if not tarea_id:
        return
    try:
        scheduler.delete_schedule(Name=_schedule_name_tarea(tarea_id))
    except scheduler.exceptions.ResourceNotFoundException:
        return
    except Exception as exc:
        print(f'No se pudo cancelar schedule de tarea {tarea_id}: {type(exc).__name__}: {exc}')


def _crear_schedule_recordatorio(tarea):
    tarea_id = tarea.get('tarea_id')
    recordatorio_en = _recordatorio_datetime(tarea)
    if not tarea_id or not recordatorio_en or not SCHEDULER_ROLE_ARN or not TAREAS_LAMBDA_ARN:
        return None

    if tarea.get('estado') not in ('pendiente', 'en_progreso'):
        _cancelar_schedule_recordatorio(tarea_id)
        return None

    now = datetime.now(ZoneInfo(BUSINESS_TZ))
    if recordatorio_en <= now:
        _cancelar_schedule_recordatorio(tarea_id)
        return None

    schedule_name = _schedule_name_tarea(tarea_id)
    _cancelar_schedule_recordatorio(tarea_id)
    scheduler.create_schedule(
        Name=schedule_name,
        ScheduleExpression=f"at({recordatorio_en.strftime('%Y-%m-%dT%H:%M:%S')})",
        ScheduleExpressionTimezone=BUSINESS_TZ,
        FlexibleTimeWindow={'Mode': 'OFF'},
        Target={
            'Arn': TAREAS_LAMBDA_ARN,
            'RoleArn': SCHEDULER_ROLE_ARN,
            'Input': json.dumps({
                'source': 'scheduler',
                'tipo': 'recordatorio_tarea',
                'tarea_id': tarea_id,
            }),
        },
        ActionAfterCompletion='DELETE',
    )
    return recordatorio_en.isoformat()


def _correo_usuario(usuario):
    for field in ('correo', 'email', 'cognito_username'):
        value = str(usuario.get(field) or '').strip()
        if EMAIL_RE.match(value):
            return value
    return ADMIN_EMAIL


def _enviar_recordatorio_tarea(tarea, usuario):
    destinatario = _correo_usuario(usuario)
    if not destinatario or not FROM_EMAIL:
        raise ValueError('Correo origen o destino no configurado para recordatorio de tarea')

    titulo = tarea.get('titulo') or 'Tarea pendiente'
    responsable = usuario.get('nombre') or usuario.get('cognito_username') or tarea.get('trabajador_nombre') or 'Usuario'
    fecha_hora = f"{tarea.get('fecha', '')} {tarea.get('hora', '')}".strip()
    relacion = tarea.get('relacion_nombre') or tarea.get('proyecto_nombre') or tarea.get('unidad_id') or 'CRM JAM'
    descripcion = tarea.get('descripcion') or ''

    html = f"""
    <h2>Recordatorio de tarea</h2>
    <p>Hola {escape(responsable)}, tienes una tarea pendiente de seguimiento.</p>
    <ul>
      <li><strong>Tarea:</strong> {escape(titulo)}</li>
      <li><strong>Fecha y hora:</strong> {escape(fecha_hora)}</li>
      <li><strong>Prioridad:</strong> {escape(tarea.get('prioridad') or 'media')}</li>
      <li><strong>Relacion:</strong> {escape(relacion)}</li>
    </ul>
    {f"<p><strong>Detalle:</strong> {escape(descripcion)}</p>" if descripcion else ""}
    <p>Revisa la Agenda / Tareas del CRM para darle seguimiento.</p>
    """
    text = (
        f"Recordatorio de tarea\n\n"
        f"Responsable: {responsable}\n"
        f"Tarea: {titulo}\n"
        f"Fecha y hora: {fecha_hora}\n"
        f"Prioridad: {tarea.get('prioridad') or 'media'}\n"
        f"Relacion: {relacion}\n"
        f"Detalle: {descripcion}\n"
    )

    ses.send_email(
        Source=FROM_EMAIL,
        Destination={'ToAddresses': [destinatario]},
        Message={
            'Subject': {'Data': f'Recordatorio CRM: {titulo}', 'Charset': 'UTF-8'},
            'Body': {
                'Text': {'Data': text, 'Charset': 'UTF-8'},
                'Html': {'Data': html, 'Charset': 'UTF-8'},
            },
        },
    )


def procesar_recordatorio_tarea(event):
    tarea_id = _clean_text(event.get('tarea_id'))
    if not tarea_id:
        return {'ok': False, 'message': 'tarea_id requerido'}

    tarea = tareas_t.get_item(Key={'pk': f'TAREA#{tarea_id}', 'sk': 'METADATA'}).get('Item')
    if not tarea:
        return {'ok': False, 'message': 'Tarea no encontrada'}
    if tarea.get('estado') not in ('pendiente', 'en_progreso'):
        return {'ok': True, 'message': 'Tarea no pendiente; recordatorio omitido'}
    if tarea.get('recordatorio_enviado'):
        return {'ok': True, 'message': 'Recordatorio ya enviado'}

    usuario = _get_usuario_jam(tarea.get('trabajador_id')) or {}
    _enviar_recordatorio_tarea(tarea, usuario)

    now = _now()
    tareas_t.update_item(
        Key={'pk': f'TAREA#{tarea_id}', 'sk': 'METADATA'},
        UpdateExpression='SET recordatorio_enviado = :enviado, recordatorio_enviado_en = :now, actualizado_en = :now',
        ExpressionAttributeValues={
            ':enviado': True,
            ':now': now,
        },
    )
    return {'ok': True, 'message': 'Recordatorio enviado'}


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
    fecha_desde = (qs.get('fecha_desde') or '').strip()
    fecha_hasta = (qs.get('fecha_hasta') or '').strip()
    trabajador_id = (qs.get('trabajador_id') or '').strip()
    estado = (qs.get('estado') or '').strip()
    prioridad = (qs.get('prioridad') or '').strip()
    relacion_tipo = (qs.get('relacion_tipo') or '').strip()
    relacion_id = (qs.get('relacion_id') or '').strip()

    if fecha:
        items = _query_all(
            IndexName='gsi-fecha',
            KeyConditionExpression=Key('fecha').eq(fecha),
        )
    elif fecha_desde or fecha_hasta:
        if fecha_desde:
            try:
                datetime.strptime(fecha_desde, '%Y-%m-%d')
            except ValueError:
                return bad_request('fecha_desde debe tener formato YYYY-MM-DD')
        if fecha_hasta:
            try:
                datetime.strptime(fecha_hasta, '%Y-%m-%d')
            except ValueError:
                return bad_request('fecha_hasta debe tener formato YYYY-MM-DD')
        if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
            return bad_request('fecha_desde no puede ser mayor a fecha_hasta')
        desde = fecha_desde or fecha_hasta
        hasta = fecha_hasta or fecha_desde
        fechas = _fechas_en_rango(desde, hasta)
        if fechas is not None:
            items = []
            for dia in fechas:
                items.extend(_query_all(
                    IndexName='gsi-fecha',
                    KeyConditionExpression=Key('fecha').eq(dia),
                ))
        elif estado:
            items = _query_all(
                IndexName='gsi-estado',
                KeyConditionExpression=Key('estado').eq(estado),
            )
        elif trabajador_id:
            items = _query_all(
                IndexName='gsi-trabajador',
                KeyConditionExpression=Key('trabajador_id').eq(trabajador_id),
            )
        else:
            items = _listar_tareas_por_estados()
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
        items = _listar_tareas_por_estados()

    if trabajador_id:
        items = [item for item in items if item.get('trabajador_id') == trabajador_id]
    if estado:
        items = [item for item in items if item.get('estado') == estado]
    if prioridad:
        items = [item for item in items if item.get('prioridad') == prioridad]
    if relacion_tipo:
        items = [item for item in items if item.get('relacion_tipo') == relacion_tipo]
    if relacion_id:
        items = [item for item in items if item.get('relacion_id') == relacion_id]

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
    recordatorio = _int_or_none(body.get('recordatorio_minutos_antes'))

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
        'relacion_tipo': _clean_text(body.get('relacion_tipo')),
        'relacion_id': _clean_text(body.get('relacion_id')),
        'relacion_nombre': _clean_text(body.get('relacion_nombre')),
        'recordatorio_minutos_antes': _to_decimal(recordatorio),
        'recordatorio_enviado': False,
        'creado_por': usuario.get('sub', ''),
        'creado_por_nombre': usuario.get('nombre', ''),
        'creado_en': now,
        'actualizado_en': now,
    }
    recordatorio_en = _crear_schedule_recordatorio(item)
    if recordatorio_en:
        item['recordatorio_en'] = recordatorio_en
        item['recordatorio_schedule_name'] = _schedule_name_tarea(tarea_id)
    item = {k: v for k, v in item.items() if v not in (None, '')}
    tareas_t.put_item(Item=item)
    registrar_auditoria(event, 'tarea_creada', 'tareas', 'tarea', tarea_id, detalles={'titulo': item.get('titulo'), 'estado': item.get('estado')})
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
    for field in (
        'titulo',
        'descripcion',
        'proyecto_id',
        'proyecto_nombre',
        'unidad_id',
        'relacion_tipo',
        'relacion_id',
        'relacion_nombre',
    ):
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
        next_item['recordatorio_enviado'] = False
        next_item.pop('recordatorio_enviado_en', None)

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
    if 'recordatorio_minutos_antes' in body:
        recordatorio = _int_or_none(body.get('recordatorio_minutos_antes'))
        if body.get('recordatorio_minutos_antes') not in (None, '') and not recordatorio:
            return bad_request('recordatorio_minutos_antes debe ser mayor a 0')
        next_item['recordatorio_minutos_antes'] = _to_decimal(recordatorio)
        next_item['recordatorio_enviado'] = False
        next_item.pop('recordatorio_enviado_en', None)

    if not next_item.get('titulo'):
        return bad_request('titulo es requerido')

    next_item['actualizado_en'] = _now()
    if next_item.get('estado') in ('pendiente', 'en_progreso'):
        recordatorio_en = _crear_schedule_recordatorio(next_item)
        if recordatorio_en:
            next_item['recordatorio_en'] = recordatorio_en
            next_item['recordatorio_schedule_name'] = _schedule_name_tarea(tarea_id)
        else:
            next_item.pop('recordatorio_en', None)
            next_item.pop('recordatorio_schedule_name', None)
    else:
        _cancelar_schedule_recordatorio(tarea_id)
        next_item.pop('recordatorio_en', None)
        next_item.pop('recordatorio_schedule_name', None)
    next_item = {k: v for k, v in next_item.items() if v not in (None, '')}
    tareas_t.put_item(Item=next_item)
    registrar_auditoria(event, 'tarea_actualizada', 'tareas', 'tarea', tarea_id, detalles={'cambios': body, 'estado': next_item.get('estado')})
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
    _cancelar_schedule_recordatorio(tarea_id)
    current.pop('recordatorio_en', None)
    current.pop('recordatorio_schedule_name', None)
    tareas_t.put_item(Item=current)
    registrar_auditoria(event, 'tarea_cancelada', 'tareas', 'tarea', tarea_id, detalles={'titulo': current.get('titulo')})
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
    registrar_auditoria(event, 'trabajador_creado', 'tareas', 'trabajador', trabajador_id, detalles={'entidad_nombre': nombre, 'correo': item.get('correo'), 'cargo': item.get('cargo'), 'activo': item.get('activo', True)})
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
    registrar_auditoria(
        event,
        'trabajador_actualizado' if 'activo' not in body else ('trabajador_habilitado' if current.get('activo') else 'trabajador_deshabilitado'),
        'tareas', 'trabajador', trabajador_id,
        detalles={'entidad_nombre': current.get('nombre'), 'cambios': body, 'activo': current.get('activo', True)},
    )
    return ok(current)
