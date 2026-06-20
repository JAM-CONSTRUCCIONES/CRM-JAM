"""Lambda consumidora de SQS — envía notificaciones por email vía AWS SES."""
import json
import boto3
import os
import logging
import re
from html import escape
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
ses = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

USUARIOS_TABLE = os.environ['USUARIOS_TABLE']
CLIENTES_TABLE = os.environ['CLIENTES_TABLE']
INVENTARIO_TABLE = os.environ.get('INVENTARIO_TABLE', '')
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
FROM_EMAIL = os.environ['FROM_EMAIL']

usuarios = dynamodb.Table(USUARIOS_TABLE)
clientes_table = dynamodb.Table(CLIENTES_TABLE)
inventario_table = dynamodb.Table(INVENTARIO_TABLE) if INVENTARIO_TABLE else None

def _get_template(tipo):
    """Returns (titulo, mensaje) from DynamoDB, falling back to defaults.

    The templates are editable from Configuracion, so this must always read the
    current value. Warm Lambda containers can keep old in-memory values alive.
    """
    try:
        item = usuarios.get_item(
            Key={'pk': 'CONFIG#EMAIL_TEMPLATES', 'sk': tipo}
        ).get('Item', {})
        if item.get('titulo') and item.get('mensaje'):
            return item['titulo'], item['mensaje']
    except Exception as e:
        logger.warning(f'No se pudo leer template {tipo}: {e}')
    return None, None  # caller uses hardcoded default


def handler(event, context):
    for record in event.get('Records', []):
        try:
            body = json.loads(record['body'])
            _procesar(body)
        except Exception as e:
            logger.error(f'Error procesando mensaje: {e}', exc_info=True)
            raise


def _procesar(msg):
    tipo = msg.get('tipo') or msg.get('evento')
    if not tipo:
        logger.warning(f'Mensaje sin tipo/evento: {msg}')
        return

    logger.info(f'Procesando evento: {tipo}')

    handlers = {
        'bloqueo_registrado':        _bloqueo_registrado,
        'alerta_vencimiento':        _alerta_vencimiento,
        'liberacion_automatica':     _liberacion_automatica,
        'liberacion_manual':         _liberacion_manual,
        'cambio_estatus':            _cambio_estatus,
        'alerta_separacion_vencida': _alerta_separacion_vencida,
        'cliente_captado':           _cliente_captado,
        'exclusividad_vencida':      _exclusividad_vencida,
        'intento_duplicado':         _intento_duplicado,
    }

    fn = handlers.get(tipo)
    if fn:
        fn(msg)
    else:
        logger.warning(f'Tipo de evento no manejado: {tipo}')


# ─── Resolvers ───────────────────────────────────────────────────────────────

def _correos_inmobiliaria(inmobiliaria_id):
    if not inmobiliaria_id:
        return []
    inmo_id = inmobiliaria_id.replace('INMOBILIARIA#', '')
    item = usuarios.get_item(
        Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}
    ).get('Item', {})
    return item.get('correos', [])


def _nombre_inmobiliaria(inmobiliaria_id):
    if not inmobiliaria_id:
        return inmobiliaria_id or ''
    inmo_id = inmobiliaria_id.replace('INMOBILIARIA#', '')
    item = usuarios.get_item(
        Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}
    ).get('Item', {})
    return item.get('nombre', inmo_id)


def _nombre_proyecto(proyecto_id):
    if not proyecto_id or not inventario_table:
        return proyecto_id or ''
    pid = proyecto_id.replace('PROYECTO#', '')
    item = inventario_table.get_item(
        Key={'pk': f'PROYECTO#{pid}', 'sk': 'METADATA'}
    ).get('Item', {})
    return item.get('nombre', pid)


def _correo_cliente(cedula, inmobiliaria_id, proyecto_id):
    inmo_id = (inmobiliaria_id or '').replace('INMOBILIARIA#', '')
    pk = f'CLIENTE#{cedula}#{inmo_id}'
    sk = f'PROYECTO#{proyecto_id}'
    item = clientes_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item', {})
    return item.get('correo', '')


def _nombre_cliente(cedula, inmobiliaria_id, proyecto_id=''):
    """Retorna 'Nombres Apellidos (cédula)' o solo la cédula si no se encuentra."""
    if not cedula:
        return ''
    inmo_id = (inmobiliaria_id or '').replace('INMOBILIARIA#', '')
    pk = f'CLIENTE#{cedula}#{inmo_id}'
    # Intentar con proyecto específico primero, luego sin sk
    item = {}
    if proyecto_id:
        sk = f'PROYECTO#{proyecto_id}'
        item = clientes_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item', {})
    if not item:
        # Buscar cualquier registro del cliente en esa inmobiliaria
        resp = clientes_table.query(
            KeyConditionExpression=Key('pk').eq(pk),
            Limit=1
        )
        items = resp.get('Items', [])
        item = items[0] if items else {}
    nombres = item.get('nombres', '')
    apellidos = item.get('apellidos', '')
    nombre_completo = f'{nombres} {apellidos}'.strip()
    return f'{nombre_completo} ({cedula})' if nombre_completo else cedula


def _tabla_datos(filas):
    """Renders the always-visible data table below the message."""
    rows_html = ''.join(
        f'<tr><td style="padding:6px 0;color:#666;width:130px">{label}</td>'
        f'<td style="padding:6px 0;font-weight:500;color:#222">{valor}</td></tr>'
        for label, valor in filas if valor
    )
    return f'<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">{rows_html}</table>'


def _texto_multilinea_html(texto):
    """Escapes configured text and keeps line breaks visible in HTML emails."""
    return '<br>'.join(escape(str(texto or '')).splitlines())


def _formatear_fecha_correo(fecha):
    """Formats email dates as DD/MM/YYYY without time or timezone."""
    if not fecha:
        return ''
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(str(fecha).replace('Z', '+00:00'))
        return dt.strftime('%d/%m/%Y')
    except Exception:
        texto = str(fecha)
        if len(texto) >= 10:
            partes = texto[:10].split('-')
            if len(partes) == 3:
                return f'{partes[2]}/{partes[1]}/{partes[0]}'
        return texto


def _sustituir_variables(texto, vars_dict):
    """Replace known placeholders in editable email templates."""
    resultado = str(texto or '')
    for key, value in (vars_dict or {}).items():
        pattern = re.compile(r'\{' + re.escape(str(key)) + r'\}?(?![A-Za-z0-9_])', re.IGNORECASE)
        resultado = pattern.sub(str(value or ''), resultado)
    resultado = re.sub(r'\{fecha\}?(?![A-Za-z0-9_])', '', resultado, flags=re.IGNORECASE)
    return resultado


def _render_template(tipo, vars_dict, filas_datos, default_titulo, default_mensaje):
    """
    Reads template from DynamoDB (or uses defaults), substitutes variables,
    and appends the fixed data table.
    """
    titulo_tpl, mensaje_tpl = _get_template(tipo)
    titulo = titulo_tpl or default_titulo
    mensaje = mensaje_tpl or default_mensaje

    # Safe variable substitution — ignore unknown keys
    titulo = _sustituir_variables(titulo, vars_dict)
    mensaje = _sustituir_variables(mensaje, vars_dict)

    titulo_html = escape(str(titulo or ''))
    mensaje_html = _texto_multilinea_html(mensaje)
    pie = '<br><p style="color:#aaa;font-size:12px;margin:0">(Mensaje automático)</p>'
    cuerpo = f'''
        <h3 style="color:#1a3c5e;margin-top:0;font-size:16px">{titulo_html}</h3>
        <div style="margin:0 0 10px;line-height:1.5">{mensaje_html}</div>
        {_tabla_datos(filas_datos)}
        {pie}
    '''
    return titulo, cuerpo


def _nombre_unidad(unidad_id_o_nombre, proyecto_id=''):
    """
    Returns the human-readable unit name.
    If the value looks like an internal UUID (8 chars alphanumeric), look up id_unidad from inventory.
    """
    if not unidad_id_o_nombre:
        return ''
    # If it looks like a UUID (8 uppercase alphanumeric chars), resolve it
    import re
    if re.match(r'^[A-Z0-9]{8}$', str(unidad_id_o_nombre)) and inventario_table and proyecto_id:
        try:
            item = inventario_table.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id_o_nombre}'}
            ).get('Item', {})
            return item.get('id_unidad') or unidad_id_o_nombre
        except Exception:
            pass
    return unidad_id_o_nombre


def _firma():
    return '''
    <br>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0">
    <table style="width:100%">
      <tr>
        <td style="vertical-align:middle">
          <p style="margin:0;font-weight:600;color:#1a1a1a">JAM Construcciones</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666">Sistema de Gestión Inmobiliaria</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999">Este es un mensaje automático, no responder a este correo.</p>
        </td>
        <td style="text-align:right;vertical-align:middle;width:80px">
          <img src="https://d12nm0khvt8zd9.cloudfront.net/Jam-Construcciones.png"
               alt="JAM Construcciones" style="height:56px;width:auto;object-fit:contain" />
        </td>
      </tr>
    </table>
    '''


def _wrap(contenido):
    return f'''
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;color:#333">
      <div style="background:#1a3c5e;padding:16px 24px;border-radius:8px 8px 0 0">
        <div style="color:#fff;font-size:17px;font-weight:700;line-height:1.2">JAM Construcciones</div>
        <div style="color:#aed6f1;font-size:12px;margin-top:4px">Sistema de Gestión Inmobiliaria</div>
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        {contenido}
        {_firma()}
      </div>
    </div>
    '''


def _enviar(destinatarios, asunto, cuerpo_html):
    seen = set()
    dedup = []
    for d in destinatarios:
        if d and d.lower() not in seen:
            seen.add(d.lower())
            dedup.append(d)
    destinatarios = dedup
    if not destinatarios:
        logger.warning('Sin destinatarios, email no enviado')
        return

    ses.send_email(
        Source=FROM_EMAIL,
        Destination={'ToAddresses': destinatarios},
        Message={
            'Subject': {'Data': f'[JAM] {asunto}', 'Charset': 'UTF-8'},
            'Body': {'Html': {'Data': _wrap(cuerpo_html), 'Charset': 'UTF-8'}},
        },
    )
    logger.info(f'Email enviado a {destinatarios}: {asunto}')


# ─── Handlers por evento ─────────────────────────────────────────────────────

def _bloqueo_registrado(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    correos = _correos_inmobiliaria(inmo_id) + [ADMIN_EMAIL]
    unidad = _nombre_unidad(meta.get('unidad_nombre') or meta.get('unidad_id', ''), msg.get('proyecto_id', ''))
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    fecha_bloqueo = meta.get('fecha_bloqueo', '')
    fecha_liberacion = meta.get('fecha_liberacion', '')
    cliente_cedula = meta.get('cliente_cedula', '')
    horas = meta.get('horas', 48)
    cliente = _nombre_cliente(cliente_cedula, inmo_id, msg.get('proyecto_id', '')) if cliente_cedula else ''

    fecha_bloqueo_fmt = _formatear_fecha_correo(fecha_bloqueo)
    fecha_liberacion_fmt = _formatear_fecha_correo(fecha_liberacion)

    filas = [
        ('Unidad', unidad), ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre),
        ('Cliente', cliente), ('Duración', f'{horas} horas'),
        ('Fecha de bloqueo', fecha_bloqueo_fmt), ('Vence el', fecha_liberacion_fmt),
    ]
    vars_dict = {'cliente': cliente, 'unidad': unidad, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('bloqueo_registrado', vars_dict, filas,
        'Nuevo bloqueo registrado',
        'Le informamos que se ha registrado un nuevo bloqueo en el sistema.')
    _enviar(correos, f'{titulo} — {unidad}', cuerpo)


def _alerta_vencimiento(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    correos = _correos_inmobiliaria(inmo_id) + [ADMIN_EMAIL]
    proyecto_id = msg.get('proyecto_id', '')
    unidad = _nombre_unidad(meta.get('unidad_nombre') or meta.get('unidad_id') or msg.get('unidad_id', ''), proyecto_id)
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    fecha_liberacion = meta.get('fecha_liberacion') or msg.get('fecha_liberacion', '')
    fecha_fmt = _formatear_fecha_correo(fecha_liberacion)

    filas = [('Unidad', unidad), ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre), ('Vence el', fecha_fmt)]
    vars_dict = {'unidad': unidad, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('alerta_vencimiento', vars_dict, filas,
        '⚠️ Bloqueo próximo a vencer',
        'El siguiente bloqueo está próximo a vencer. Si necesita más tiempo, comuníquese con el administrador.')
    _enviar(correos, f'{titulo} — {unidad}', cuerpo)


def _liberacion_automatica(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    correos = _correos_inmobiliaria(inmo_id)
    proyecto_id = msg.get('proyecto_id', '')
    unidad = _nombre_unidad(meta.get('unidad_nombre') or meta.get('unidad_id') or msg.get('unidad_id', ''), proyecto_id)
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    fecha = meta.get('fecha_liberacion') or msg.get('fecha_liberacion', '')
    fecha_fmt = _formatear_fecha_correo(fecha)

    filas = [('Unidad', unidad), ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre), ('Liberada el', fecha_fmt)]
    vars_dict = {'unidad': unidad, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('liberacion_automatica', vars_dict, filas,
        'Bloqueo liberado por vencimiento',
        'El tiempo de bloqueo expiró y la unidad quedó disponible automáticamente.')
    _enviar(correos, f'{titulo} — {unidad}', cuerpo)


def _liberacion_manual(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    proyecto_id = msg.get('proyecto_id', '')
    unidad = _nombre_unidad(meta.get('unidad_nombre') or meta.get('unidad_id') or msg.get('unidad_id', ''), proyecto_id)
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    liberado_por = meta.get('liberado_por') or msg.get('liberado_por', 'Administrador')
    justificacion = meta.get('justificacion') or msg.get('justificacion', '')
    cedula = meta.get('cedula') or msg.get('cedula', '')
    cliente = _nombre_cliente(cedula, inmo_id, msg.get('proyecto_id', '')) if cedula else ''
    notificar = msg.get('notificar')
    if notificar in (False, 'false', None):
        logger.info('liberacion_manual sin notificar, omitiendo email')
        return

    correos_inmo = _correos_inmobiliaria(inmo_id)
    correo_cliente = _correo_cliente(cedula, inmo_id, proyecto_id) if cedula else ''
    if notificar == 'todos':
        correos = [correo_cliente] + correos_inmo + [ADMIN_EMAIL]
    elif notificar == 'admin':
        correos = [ADMIN_EMAIL]
    else:
        correos = correos_inmo

    filas = [
        ('Unidad', unidad), ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre),
        ('Cliente', cliente), ('Liberado por', liberado_por), ('Justificación', justificacion),
    ]
    vars_dict = {'cliente': cliente, 'unidad': unidad, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('liberacion_manual', vars_dict, filas,
        'Bloqueo liberado manualmente',
        'El bloqueo de la unidad ha sido liberado manualmente por un administrador.')
    _enviar(correos, f'{titulo} — {unidad}', cuerpo)


def _cambio_estatus(msg):
    meta = msg.get('metadata', {})
    notificar = msg.get('notificar')
    if not notificar:
        logger.info('cambio_estatus sin notificar, omitiendo email')
        return

    inmo_id = msg.get('inmobiliaria_id', '')
    cedula = msg.get('cedula', '') or meta.get('cedula', '')
    proyecto_id = msg.get('proyecto_id', '')
    nuevo_estatus = msg.get('estatus_nuevo', '') or meta.get('nuevo_estatus', '')
    unidad = _nombre_unidad(msg.get('unidad_nombre', '') or meta.get('unidad_nombre') or meta.get('unidad_id', ''), proyecto_id)
    proyecto = _nombre_proyecto(proyecto_id)
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    cliente_nombre = f"{msg.get('nombres', '')} {msg.get('apellidos', '')}".strip()
    if not cliente_nombre:
        cliente_nombre = _nombre_cliente(cedula, inmo_id, proyecto_id)

    correos_inmo = _correos_inmobiliaria(inmo_id)
    correo_cliente = _correo_cliente(cedula, inmo_id, proyecto_id)

    if notificar == 'todos':
        destinatarios = [correo_cliente] + correos_inmo + [ADMIN_EMAIL]
    else:
        destinatarios = [ADMIN_EMAIL]

    tipo = f'cambio_estatus_{nuevo_estatus}'
    filas = [
        ('Cliente', cliente_nombre), ('Unidad', unidad),
        ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre),
    ]
    vars_dict = {'cliente': cliente_nombre, 'unidad': unidad, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}

    # Default titles/messages per status
    defaults = {
        'disponible':       ('Unidad disponible', 'La unidad ha quedado disponible nuevamente.'),
        'bloqueada':        ('Unidad bloqueada', 'La unidad ha sido bloqueada con un plazo de 48 horas para completar la reserva.'),
        'reserva':          ('Unidad reservada', 'Hemos recibido el pago de reserva de la unidad {unidad} a nombre de {cliente}.'),
        'separacion':       ('Separación registrada', 'Hemos recibido el pago de separación de la unidad {unidad} a nombre de {cliente}.'),
        'inicial':          ('Contrato de promesa de venta firmado', 'El contrato de promesa de venta de la unidad {unidad} a nombre de {cliente} ha sido firmado exitosamente.'),
        'pagos_atrasados':  ('Cliente con pagos atrasados', 'El cliente {cliente} presenta pagos pendientes en la unidad {unidad}.'),
        'contra_entrega':   ('Contra entrega', 'Hemos recibido el pago de contra entrega de la unidad {unidad} a nombre de {cliente}.'),
        'vendida':          ('Gracias por su compra', 'La unidad {unidad} correspondiente al cliente {cliente} ha sido entregada satisfactoriamente.'),
        'desvinculado':     ('Cliente desvinculado', 'El cliente {cliente} ha sido desvinculado del proceso de compra de la unidad {unidad}.'),
    }
    default_titulo, default_mensaje = defaults.get(nuevo_estatus, (f'Actualización — {nuevo_estatus}', ''))
    titulo, cuerpo = _render_template(tipo, vars_dict, filas, default_titulo, default_mensaje)
    _enviar(destinatarios, f'{titulo} — {proyecto}', cuerpo)


def _alerta_separacion_vencida(msg):
    meta = msg.get('metadata', {})
    cedula = meta.get('cedula') or msg.get('cedula', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    unidad = _nombre_unidad(meta.get('unidad_nombre') or meta.get('unidad_id') or msg.get('unidad_nombre') or msg.get('unidad_id', ''), msg.get('proyecto_id', ''))
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    dias = meta.get('dias_sin_pago') or msg.get('dias_sin_pago', 30)
    cliente = _nombre_cliente(cedula, inmo_id, msg.get('proyecto_id', '')) if cedula else cedula

    filas = [('Cliente', cliente), ('Unidad', unidad), ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre)]
    vars_dict = {'cliente': cliente, 'unidad': unidad, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('alerta_separacion_vencida', vars_dict, filas,
        '⚠️ Separación vencida sin pago',
        f'Han transcurrido {dias} días desde la separación sin registrar pago.')
    _enviar([ADMIN_EMAIL], f'{titulo} — {cedula}', cuerpo)


def _cliente_captado(msg):
    meta = msg.get('metadata', {})
    nombres = meta.get('nombres', '')
    apellidos = meta.get('apellidos', '')
    cedula = meta.get('cedula', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    cliente = f'{nombres} {apellidos} ({cedula})'.strip()
    fecha = msg.get('timestamp', '')
    fecha_fmt = _formatear_fecha_correo(fecha)

    filas = [
        ('Nombre', f'{nombres} {apellidos}'), ('Cédula', cedula),
        ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre), ('Fecha', fecha_fmt),
    ]
    vars_dict = {'cliente': cliente, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('cliente_captado', vars_dict, filas,
        'Nuevo cliente captado',
        'Se ha registrado un nuevo cliente en el sistema.')
    _enviar([ADMIN_EMAIL], f'{titulo} — {nombres} {apellidos}', cuerpo)


def _exclusividad_vencida(msg):
    meta = msg.get('metadata', {})
    cedula = meta.get('cedula', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    correos_inmo = _correos_inmobiliaria(inmo_id)
    cliente = _nombre_cliente(cedula, inmo_id, msg.get('proyecto_id', '')) if cedula else cedula

    filas = [('Cliente', cliente), ('Proyecto', proyecto), ('Inmobiliaria', inmo_nombre)]
    vars_dict = {'cliente': cliente, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('exclusividad_vencida', vars_dict, filas,
        'Exclusividad de cliente vencida',
        'El período de exclusividad de 3 meses ha expirado. La unidad quedó disponible para otras inmobiliarias.')
    _enviar([ADMIN_EMAIL] + correos_inmo, f'{titulo} — {cedula}', cuerpo)


def _intento_duplicado(msg):
    meta = msg.get('metadata', {})
    cedula = meta.get('cedula', '')
    nombres = meta.get('nombres', '')
    apellidos = meta.get('apellidos', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    cliente = f'{nombres} {apellidos} ({cedula})'.strip(' ()')
    inmo_con_excl_id = meta.get('inmobiliaria_con_exclusividad', '')
    inmo_con_excl = _nombre_inmobiliaria(inmo_con_excl_id) if inmo_con_excl_id else 'Otra inmobiliaria'

    filas = [
        ('Cliente', cliente), ('Proyecto', proyecto),
        ('Inmobiliaria solicitante', inmo_nombre),
        ('Inmobiliaria con exclusividad', inmo_con_excl),
    ]
    vars_dict = {'cliente': cliente, 'proyecto': proyecto, 'inmobiliaria': inmo_nombre}
    titulo, cuerpo = _render_template('intento_duplicado', vars_dict, filas,
        '⚠️ Intento de captación duplicada bloqueado',
        'Una inmobiliaria intentó captar un cliente que ya tiene exclusividad activa con otra inmobiliaria.')
    _enviar([ADMIN_EMAIL], f'{titulo} — {cedula}', cuerpo)
