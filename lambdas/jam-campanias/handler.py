import json
import os
import re
import uuid
from datetime import datetime, timezone
from html import escape

import boto3
from boto3.dynamodb.conditions import Key, Attr

from utils.auth import get_usuario, puede_enviar, puede_ver
from utils.response import ok, created, bad_request, forbidden, not_found


dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

CLIENTES_TABLE = os.environ['CLIENTES_TABLE']
PROCESOS_TABLE = os.environ['PROCESOS_TABLE']
PROYECTOS_TABLE = os.environ['INVENTARIO_TABLE']
CAMPANIAS_TABLE = os.environ['CAMPANIAS_TABLE']
FROM_EMAIL = os.environ['FROM_EMAIL']

clientes_t = dynamodb.Table(CLIENTES_TABLE)
procesos_t = dynamodb.Table(PROCESOS_TABLE)
proyectos_t = dynamodb.Table(PROYECTOS_TABLE)
campanias_t = dynamodb.Table(CAMPANIAS_TABLE)

EMAIL_RE = re.compile(r'^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$')


def handler(event, context):
    if not puede_ver(event):
        return forbidden()

    method = event.get('httpMethod', '')
    path = event.get('path', '')

    if method == 'GET' and path.endswith('/admin/campanias/historial'):
        return listar_historial(event)
    if method == 'GET' and path.endswith('/admin/campanias/templates'):
        return listar_templates(event)
    if method == 'PUT' and '/admin/campanias/templates/' in path:
        template_id = path.rstrip('/').split('/')[-1]
        return guardar_template(event, template_id)
    if method == 'POST' and path.endswith('/admin/campanias/preview'):
        return preview_destinatarios(event)
    if method == 'POST' and path.endswith('/admin/campanias/enviar'):
        return enviar_campania(event)

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


def _query_all(table, **kwargs):
    items = []
    last_key = None
    while True:
        req = dict(kwargs)
        if last_key:
            req['ExclusiveStartKey'] = last_key
        res = table.query(**req)
        items.extend(res.get('Items', []))
        last_key = res.get('LastEvaluatedKey')
        if not last_key:
            return items


def _scan_all(table, **kwargs):
    items = []
    last_key = None
    while True:
        req = dict(kwargs)
        if last_key:
            req['ExclusiveStartKey'] = last_key
        res = table.scan(**req)
        items.extend(res.get('Items', []))
        last_key = res.get('LastEvaluatedKey')
        if not last_key:
            return items


def _normalizar_inmo_id(value):
    return str(value or '').replace('INMOBILIARIA#', '')


def _get_proyecto(proyecto_id):
    return proyectos_t.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    ).get('Item', {})


def _listar_clientes_base(proyecto_id):
    return _query_all(
        clientes_t,
        IndexName='gsi-proyecto-clientes',
        KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
        ScanIndexForward=False,
    )


def _listar_procesos_proyecto(proyecto_id):
    try:
        return _query_all(
            procesos_t,
            IndexName='gsi-proyecto-procesos',
            KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
        )
    except Exception:
        return _scan_all(procesos_t, FilterExpression=Attr('proyecto_id').eq(proyecto_id))


def _filas_clientes_proyecto(proyecto_id):
    clientes_items = _listar_clientes_base(proyecto_id)
    procesos_items = _listar_procesos_proyecto(proyecto_id)

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
            fila['grupo'] = 'sin_unidad'
            fila['estatus'] = 'sin_unidad'
            fila['estatus_label'] = 'Sin unidad'
            fila['unidad_id'] = ''
            fila['unidad_nombre'] = ''
            filas.append(fila)
            continue

        for proceso in relacionados:
            fila = dict(cliente)
            fila['inmobiliaria_id'] = inmo_id
            fila['grupo'] = 'con_unidad'
            fila['estatus'] = proceso.get('estado', '')
            fila['estatus_label'] = proceso.get('estado', '')
            fila['unidad_id'] = proceso.get('unidad_id', '')
            fila['unidad_nombre'] = proceso.get('unidad_nombre') or proceso.get('unidad_id', '')
            filas.append(fila)

    return filas


def _email_valido(value):
    correo = str(value or '').strip().lower()
    return correo if EMAIL_RE.match(correo) else ''


def _aplicar_filtros(filas, grupo, pais_residencia='', nacionalidad=''):
    if grupo not in ('sin_unidad', 'con_unidad', 'todos'):
        grupo = 'todos'
    result = []
    for fila in filas:
        if grupo != 'todos' and fila.get('grupo') != grupo:
            continue
        if pais_residencia and str(fila.get('pais_residencia', '')).strip().lower() != pais_residencia.strip().lower():
            continue
        if nacionalidad and str(fila.get('nacionalidad', '')).strip().lower() != nacionalidad.strip().lower():
            continue
        result.append(fila)
    return result


def _resumen_destinatarios(proyecto_id, grupo, filtros=None):
    filtros = filtros or {}
    filas = _aplicar_filtros(
        _filas_clientes_proyecto(proyecto_id),
        grupo,
        filtros.get('pais_residencia', ''),
        filtros.get('nacionalidad', ''),
    )

    validos = []
    sin_correo = []
    invalidos = []
    vistos = set()

    for fila in filas:
        correo_raw = str(fila.get('correo') or '').strip()
        correo = _email_valido(correo_raw)
        cliente = {
            'cedula': fila.get('cedula', ''),
            'nombres': fila.get('nombres', ''),
            'apellidos': fila.get('apellidos', ''),
            'correo': correo_raw,
            'unidad': fila.get('unidad_nombre') or fila.get('unidad_id') or '',
            'estatus': fila.get('estatus_label') or fila.get('estatus') or '',
            'pais_residencia': fila.get('pais_residencia', ''),
            'nacionalidad': fila.get('nacionalidad', ''),
        }
        if not correo_raw:
            sin_correo.append(cliente)
            continue
        if not correo:
            invalidos.append(cliente)
            continue
        if correo in vistos:
            continue
        vistos.add(correo)
        validos.append({**cliente, 'correo': correo})

    return {
        'total_clientes': len(filas),
        'correos_validos': len(validos),
        'sin_correo': len(sin_correo),
        'correos_invalidos': len(invalidos),
        'destinatarios': validos,
        'omitidos_sin_correo': sin_correo,
        'omitidos_invalidos': invalidos,
    }


def _render_html(mensaje, imagen_url=''):
    safe = escape(str(mensaje or '')).replace('\r\n', '\n').replace('\r', '\n').replace('\n', '<br>')
    image_html = ''
    if imagen_url:
        url = escape(str(imagen_url).strip(), quote=True)
        image_html = f'<p><img src="{url}" style="max-width:100%;height:auto;border:0" alt="Imagen de campania"></p>'
    return f"""
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">
      {image_html}
      <div>{safe}</div>
    </div>
    """


def listar_templates(event):
    proyecto_id = _qs(event).get('proyecto_id', 'global').strip() or 'global'
    items = _query_all(
        campanias_t,
        KeyConditionExpression=Key('pk').eq(f'TEMPLATES#{proyecto_id}') & Key('sk').begins_with('TEMPLATE#'),
    )
    if proyecto_id != 'global':
        globales = _query_all(
            campanias_t,
            KeyConditionExpression=Key('pk').eq('TEMPLATES#global') & Key('sk').begins_with('TEMPLATE#'),
        )
        items = globales + items
    items.sort(key=lambda x: x.get('actualizado_en', ''), reverse=True)
    return ok(items)


def guardar_template(event, template_id):
    if not puede_enviar(event):
        return forbidden('Solo administrador o coordinador pueden editar plantillas')
    body = _body(event)
    proyecto_id = str(body.get('proyecto_id') or 'global').strip() or 'global'
    nombre = str(body.get('nombre') or '').strip()
    asunto = str(body.get('asunto') or '').strip()
    mensaje = str(body.get('mensaje') or '').strip()
    imagen_url = str(body.get('imagen_url') or '').strip()
    if not nombre or not asunto or not mensaje:
        return bad_request('nombre, asunto y mensaje son requeridos')

    usuario = get_usuario(event)
    now = _now()
    item = {
        'pk': f'TEMPLATES#{proyecto_id}',
        'sk': f'TEMPLATE#{template_id}',
        'template_id': template_id,
        'proyecto_id': proyecto_id,
        'nombre': nombre,
        'asunto': asunto,
        'mensaje': mensaje,
        'imagen_url': imagen_url,
        'actualizado_en': now,
        'actualizado_por': usuario.get('nombre', ''),
    }
    campanias_t.put_item(Item=item)
    return ok(item)


def listar_historial(event):
    proyecto_id = _qs(event).get('proyecto_id', '').strip()
    if not proyecto_id:
        return bad_request('proyecto_id requerido')
    items = _query_all(
        campanias_t,
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('CAMPANIA#'),
        ScanIndexForward=False,
    )
    return ok(items[:100])


def preview_destinatarios(event):
    body = _body(event)
    proyecto_id = str(body.get('proyecto_id') or '').strip()
    grupo = str(body.get('grupo') or 'todos').strip()
    if not proyecto_id:
        return bad_request('proyecto_id requerido')
    resumen = _resumen_destinatarios(proyecto_id, grupo, body.get('filtros') or {})
    return ok(resumen)


def enviar_campania(event):
    if not puede_enviar(event):
        return forbidden('Solo administrador o coordinador pueden enviar campanias')

    body = _body(event)
    proyecto_id = str(body.get('proyecto_id') or '').strip()
    nombre = str(body.get('nombre') or '').strip()
    grupo = str(body.get('grupo') or 'todos').strip()
    asunto = str(body.get('asunto') or '').strip()
    mensaje = str(body.get('mensaje') or '').strip()
    imagen_url = str(body.get('imagen_url') or '').strip()
    filtros = body.get('filtros') or {}

    if not proyecto_id or not nombre or not asunto or not mensaje:
        return bad_request('proyecto_id, nombre, asunto y mensaje son requeridos')

    proyecto = _get_proyecto(proyecto_id)
    proyecto_nombre = proyecto.get('nombre', proyecto_id)
    resumen = _resumen_destinatarios(proyecto_id, grupo, filtros)
    destinatarios = resumen['destinatarios']

    if not destinatarios:
        return bad_request('No hay destinatarios con correo valido')

    html = _render_html(mensaje, imagen_url)
    enviados = 0
    errores_envio = []
    for dest in destinatarios:
        try:
            ses.send_email(
                Source=FROM_EMAIL,
                Destination={'ToAddresses': [dest['correo']]},
                Message={
                    'Subject': {'Data': asunto, 'Charset': 'UTF-8'},
                    'Body': {
                        'Html': {'Data': html, 'Charset': 'UTF-8'},
                        'Text': {'Data': mensaje, 'Charset': 'UTF-8'},
                    },
                },
            )
            enviados += 1
        except Exception as e:
            errores_envio.append({'correo': dest['correo'], 'error': str(e)[:180]})

    usuario = get_usuario(event)
    campania_id = str(uuid.uuid4())[:8].upper()
    now = _now()
    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'CAMPANIA#{now}#{campania_id}',
        'campania_id': campania_id,
        'proyecto_id': proyecto_id,
        'proyecto_nombre': proyecto_nombre,
        'nombre': nombre,
        'grupo': grupo,
        'filtros': filtros,
        'asunto': asunto,
        'mensaje': mensaje,
        'imagen_url': imagen_url,
        'fecha_envio': now,
        'enviado_por': usuario.get('nombre', ''),
        'enviado_por_email': usuario.get('email', ''),
        'cantidad_destinatarios': resumen['total_clientes'],
        'correos_validos': resumen['correos_validos'],
        'correos_enviados': enviados,
        'clientes_sin_correo': resumen['sin_correo'],
        'correos_invalidos': resumen['correos_invalidos'],
        'errores_envio': errores_envio,
    }
    campanias_t.put_item(Item=item)
    return created(item)
