"""
GET  /admin/config/email-templates        — list all templates
GET  /admin/config/email-templates/{tipo} — get one template
PUT  /admin/config/email-templates/{tipo} — save one template
"""
import os
import json
import re
import boto3
from utils.response import ok, bad_request, not_found

dynamodb = boto3.resource('dynamodb')
_table = None

def _get_table():
    global _table
    if _table is None:
        _table = dynamodb.Table(os.environ['USUARIOS_TABLE'])
    return _table

# ── Default templates ─────────────────────────────────────────────────────────
# Each template has: titulo, mensaje
# Variables available: {cliente}, {unidad}, {proyecto}, {inmobiliaria}, {fecha}
# The data table (client, unit, project, etc.) is always appended automatically.

DEFAULTS = {
    'bloqueo_registrado': {
        'titulo': 'Nuevo bloqueo registrado',
        'mensaje': 'Le informamos que se ha registrado un nuevo bloqueo en el sistema.',
    },
    'alerta_vencimiento': {
        'titulo': '⚠️ Bloqueo próximo a vencer',
        'mensaje': 'El siguiente bloqueo está próximo a vencer. Si necesita más tiempo, comuníquese con el administrador del sistema.',
    },
    'liberacion_automatica': {
        'titulo': 'Bloqueo liberado por vencimiento',
        'mensaje': 'El tiempo de bloqueo expiró y la unidad quedó disponible automáticamente.',
    },
    'liberacion_manual': {
        'titulo': 'Bloqueo liberado manualmente',
        'mensaje': 'El bloqueo de la unidad ha sido liberado manualmente por un administrador.',
    },
    'cambio_estatus_disponible': {
        'titulo': 'Unidad disponible',
        'mensaje': 'Le informamos que la unidad ha quedado disponible nuevamente por no haberse completado el proceso de reserva dentro del tiempo establecido.',
    },
    'cambio_estatus_bloqueada': {
        'titulo': 'Unidad bloqueada',
        'mensaje': 'Le informamos que la unidad ha sido bloqueada y cuenta con un plazo de 48 horas para completar el proceso de reserva. En caso de no recibirse el pago dentro de este período, la unidad quedará disponible nuevamente de forma automática.',
    },
    'cambio_estatus_reserva': {
        'titulo': 'Unidad reservada',
        'mensaje': 'Le informamos que hemos recibido el pago correspondiente a la reserva de la unidad {unidad}, a nombre del cliente {cliente}. Una vez contabilidad aplique el pago, estaremos remitiendo el recibo correspondiente.',
    },
    'cambio_estatus_separacion': {
        'titulo': 'Separación registrada',
        'mensaje': 'Le informamos que hemos recibido el pago correspondiente a la separación de la unidad {unidad}, a nombre del cliente {cliente}. Una vez contabilidad aplique el pago, estaremos remitiendo el recibo correspondiente.',
    },
    'cambio_estatus_inicial': {
        'titulo': 'Contrato de promesa de venta firmado',
        'mensaje': 'Le informamos que el contrato de promesa de venta correspondiente a la unidad {unidad}, a nombre del cliente {cliente} e inmobiliaria {inmobiliaria}, ha sido firmado exitosamente.',
    },
    'cambio_estatus_pagos_atrasados': {
        'titulo': 'Cliente con pagos atrasados',
        'mensaje': 'Le informamos que el cliente {cliente}, correspondiente a la unidad {unidad}, presenta pagos pendientes según el plan establecido. Agradecemos gestionar este caso a la mayor brevedad.',
    },
    'cambio_estatus_contra_entrega': {
        'titulo': 'Contra entrega',
        'mensaje': 'Le informamos que hemos recibido el pago correspondiente a la contra entrega de la unidad {unidad}, a nombre del cliente {cliente}. Una vez contabilidad aplique el pago, estaremos remitiendo el recibo correspondiente.',
    },
    'cambio_estatus_vendida': {
        'titulo': 'Gracias por su compra',
        'mensaje': 'Le informamos que la unidad {unidad}, correspondiente al cliente {cliente}, ha sido entregada satisfactoriamente. Agradecemos la confianza depositada en nosotros.',
    },
    'cambio_estatus_desvinculado': {
        'titulo': 'Cliente desvinculado',
        'mensaje': 'Le informamos que el cliente {cliente}, correspondiente a la unidad {unidad}, ha sido desvinculado del proceso de compra. La unidad queda disponible conforme a las condiciones del proyecto.',
    },
    'alerta_separacion_vencida': {
        'titulo': '⚠️ Separación vencida sin pago',
        'mensaje': 'Han transcurrido 30 días desde la separación sin registrar pago.',
    },
    'cliente_captado': {
        'titulo': 'Nuevo cliente captado',
        'mensaje': 'Se ha registrado un nuevo cliente en el sistema.',
    },
    'exclusividad_vencida': {
        'titulo': 'Exclusividad de cliente vencida',
        'mensaje': 'El período de exclusividad de 3 meses ha expirado. La unidad quedó disponible para otras inmobiliarias.',
    },
    'intento_duplicado': {
        'titulo': '⚠️ Intento de captación duplicada bloqueado',
        'mensaje': 'Una inmobiliaria intentó captar un cliente que ya tiene exclusividad activa con otra inmobiliaria.',
    },
}

LABELS = {
    'bloqueo_registrado':           'Bloqueo registrado',
    'alerta_vencimiento':           'Alerta de vencimiento',
    'liberacion_automatica':        'Liberación automática',
    'liberacion_manual':            'Liberación manual',
    'cambio_estatus_disponible':    'Estatus: Disponible',
    'cambio_estatus_bloqueada':     'Estatus: Bloqueada',
    'cambio_estatus_reserva':       'Estatus: Reserva',
    'cambio_estatus_separacion':    'Estatus: Separación',
    'cambio_estatus_inicial':       'Estatus: Inicial / Contrato',
    'cambio_estatus_pagos_atrasados': 'Estatus: Pagos atrasados',
    'cambio_estatus_contra_entrega': 'Estatus: Contra entrega',
    'cambio_estatus_vendida':       'Estatus: Vendida',
    'cambio_estatus_desvinculado':  'Estatus: Desvinculado',
    'alerta_separacion_vencida':    'Alerta separación vencida',
    'cliente_captado':              'Cliente captado',
    'exclusividad_vencida':         'Exclusividad vencida',
    'intento_duplicado':            'Intento de captación duplicada',
}

VARIABLES = ['{cliente}', '{unidad}', '{proyecto}', '{inmobiliaria}', '{fecha}']


def _pk():
    return 'CONFIG#EMAIL_TEMPLATES'


def _validar_variables(*textos):
    permitidas = set(VARIABLES)
    for texto in textos:
        for match in re.finditer(r'\{[^{}\r\n]*\}?', str(texto or '')):
            if match.group(0) not in permitidas:
                return bad_request(
                    'Variable no valida o incompleta. Usa solo: ' + ', '.join(VARIABLES)
                )
    return None


def listar():
    table = _get_table()
    result = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('pk').eq(_pk())
    )
    saved = {item['sk']: item for item in result.get('Items', [])}

    templates = []
    for tipo, default in DEFAULTS.items():
        item = saved.get(tipo, {})
        templates.append({
            'tipo': tipo,
            'label': LABELS.get(tipo, tipo),
            'titulo': item.get('titulo', default['titulo']),
            'mensaje': item.get('mensaje', default['mensaje']),
            'modificado_en': item.get('modificado_en'),
        })
    return ok(templates)


def obtener(tipo):
    if tipo not in DEFAULTS:
        return not_found('Template no encontrado')
    table = _get_table()
    item = table.get_item(Key={'pk': _pk(), 'sk': tipo}).get('Item', {})
    default = DEFAULTS[tipo]
    return ok({
        'tipo': tipo,
        'label': LABELS.get(tipo, tipo),
        'titulo': item.get('titulo', default['titulo']),
        'mensaje': item.get('mensaje', default['mensaje']),
        'variables': VARIABLES,
        'modificado_en': item.get('modificado_en'),
    })


def guardar(tipo, event):
    if tipo not in DEFAULTS:
        return not_found('Template no encontrado')
    body = json.loads(event.get('body') or '{}')
    titulo = body.get('titulo', '').strip()
    mensaje = body.get('mensaje', '').strip()
    if not titulo or not mensaje:
        return bad_request('titulo y mensaje son requeridos')
    error_variables = _validar_variables(titulo, mensaje)
    if error_variables:
        return error_variables

    from datetime import datetime, timezone
    table = _get_table()
    table.put_item(Item={
        'pk': _pk(),
        'sk': tipo,
        'titulo': titulo,
        'mensaje': mensaje,
        'modificado_en': datetime.now(timezone.utc).isoformat(),
    })
    return ok({'message': 'Template guardado', 'tipo': tipo})


def restaurar(tipo):
    """Deletes the saved override, reverting to the default."""
    if tipo not in DEFAULTS:
        return not_found('Template no encontrado')
    table = _get_table()
    table.delete_item(Key={'pk': _pk(), 'sk': tipo})
    return ok({'message': 'Template restaurado al valor por defecto'})
