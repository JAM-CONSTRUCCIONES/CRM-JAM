import json
import os
import re
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr, Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from utils.auth import get_nombre, get_sub
from utils.response import bad_request, conflict, not_found, ok
from routes.estatus import _cancelar_alerta_separacion, _crear_alerta_separacion_en


dynamodb = boto3.resource('dynamodb')
ddb = boto3.client('dynamodb')
scheduler = boto3.client('scheduler')
clientes_table = dynamodb.Table(os.environ['CLIENTES_TABLE'])
procesos_table = dynamodb.Table(os.environ['PROCESOS_TABLE'])
inventario_table = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
serializer = TypeSerializer()
CAPTACION_LAMBDA_ARN = os.environ.get('CAPTACION_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')

ESTADOS_PERMITIDOS = {
    'captacion', 'reserva', 'separacion', 'pagos_atrasados',
    'inicial', 'contra_entrega', 'vendida',
}
EMAIL_RE = re.compile(r'^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$')
DOCUMENTO_RE = re.compile(r'^[A-Z0-9]+$')
NOMBRE_RE = re.compile(r'^[^\W\d_]+(?: [^\W\d_]+)*$', re.UNICODE)


def _av(value):
    return serializer.serialize(value)


def _item(value):
    return {key: _av(item_value) for key, item_value in value.items() if item_value is not None}


def _clean(value):
    return ' '.join(str(value or '').strip().split())


def _normalizar_inmobiliaria(value):
    return _clean(value).replace('INMOBILIARIA#', '')


def _calcular_edad(fecha_nacimiento):
    if not fecha_nacimiento:
        return None
    try:
        nacimiento = date.fromisoformat(fecha_nacimiento)
        hoy = date.today()
        return hoy.year - nacimiento.year - (
            (hoy.month, hoy.day) < (nacimiento.month, nacimiento.day)
        )
    except (TypeError, ValueError):
        raise ValueError('La fecha de nacimiento no es valida')


def _sumar_meses(fecha, meses):
    month = fecha.month - 1 + meses
    year = fecha.year + month // 12
    month = month % 12 + 1
    return fecha.replace(year=year, month=month, day=min(fecha.day, monthrange(year, month)[1]))


def _programar_vencimiento_exclusividad(cedula, inmobiliaria_id, proyecto_id, fecha):
    if not CAPTACION_LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        return False
    safe_cedula = cedula.replace('/', '-').replace('#', '-')
    safe_inmo = inmobiliaria_id.replace('/', '-').replace('#', '-').replace('INMOBILIARIA', 'I')
    safe_proyecto = proyecto_id.replace('/', '-').replace('#', '-').replace('PROYECTO', 'P')
    scheduler.create_schedule(
        Name=f'exclusividad-{safe_cedula}-{safe_inmo}-{safe_proyecto}'[:64],
        ScheduleExpression=f"at({fecha.strftime('%Y-%m-%dT%H:%M:%S')})",
        ScheduleExpressionTimezone='UTC',
        FlexibleTimeWindow={'Mode': 'OFF'},
        Target={
            'Arn': CAPTACION_LAMBDA_ARN,
            'RoleArn': SCHEDULER_ROLE_ARN,
            'Input': json.dumps({
                'accion': 'vencer_exclusividad',
                'cedula': cedula,
                'inmobiliaria_id': inmobiliaria_id,
                'proyecto_id': proyecto_id,
            }),
        },
        ActionAfterCompletion='DELETE',
    )
    return True


def _normalizar_cliente(data):
    cliente = dict(data or {})
    cliente['cedula'] = _clean(cliente.get('cedula')).upper()
    cliente['nombres'] = _clean(cliente.get('nombres')).upper()
    cliente['apellidos'] = _clean(cliente.get('apellidos')).upper()
    cliente['correo'] = _clean(cliente.get('correo')).lower()
    cliente['telefono'] = _clean(cliente.get('telefono'))

    if not DOCUMENTO_RE.fullmatch(cliente['cedula']):
        raise ValueError('La cedula/pasaporte solo debe contener letras y numeros')
    if not cliente['nombres'] or not NOMBRE_RE.fullmatch(cliente['nombres']):
        raise ValueError('Los nombres son requeridos y solo deben contener letras y espacios')
    if not cliente['apellidos'] or not NOMBRE_RE.fullmatch(cliente['apellidos']):
        raise ValueError('Los apellidos son requeridos y solo deben contener letras y espacios')
    if cliente['correo'] and not EMAIL_RE.fullmatch(cliente['correo']):
        raise ValueError('El correo no tiene un formato valido')
    if cliente['telefono'] and not cliente['telefono'].isdigit():
        raise ValueError('El telefono solo debe contener numeros')

    cliente['edad'] = _calcular_edad(cliente.get('fecha_nacimiento'))
    return cliente


def _buscar_proceso(cedula, inmobiliaria_id, proyecto_id, unidad_id):
    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    for sk in (f'UNIDAD#{unidad_id}', f'PROYECTO#{proyecto_id}#UNIDAD#{unidad_id}'):
        proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
        if proceso:
            return proceso
    return None


def _validar_exclusividad(cedula, inmobiliaria_id, proyecto_id):
    resultado = clientes_table.query(
        IndexName='gsi-cedula-proyecto',
        KeyConditionExpression=(
            Key('cedula').eq(cedula) &
            Key('sk').eq(f'PROYECTO#{proyecto_id}')
        ),
        FilterExpression=Attr('exclusividad_activa').eq(True),
    )
    for item_cliente in resultado.get('Items', []):
        if _normalizar_inmobiliaria(item_cliente.get('inmobiliaria_id')) != inmobiliaria_id:
            raise ValueError('Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto')


def traspasar_cliente(event, cedula_actual, proyecto_id, unidad_id):
    body = json.loads(event.get('body') or '{}')
    inmobiliaria_id = _normalizar_inmobiliaria(body.get('inmobiliaria_id'))
    tipo_destino = body.get('tipo_destino')
    justificacion = _clean(body.get('justificacion'))
    cedula_actual = _clean(cedula_actual).upper()
    proyecto_id = _clean(proyecto_id).replace('PROYECTO#', '')

    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id es requerido')
    if tipo_destino not in ('existente', 'nuevo'):
        return bad_request('tipo_destino debe ser existente o nuevo')
    if len(justificacion) < 5:
        return bad_request('La justificacion debe tener al menos 5 caracteres')

    proceso = _buscar_proceso(cedula_actual, inmobiliaria_id, proyecto_id, unidad_id)
    if not proceso:
        return not_found('Proceso no encontrado para el cliente y la unidad indicados')
    if proceso.get('proyecto_id', '').replace('PROYECTO#', '') != proyecto_id:
        return conflict('El proceso no pertenece al proyecto indicado')
    if proceso.get('estado') not in ESTADOS_PERMITIDOS:
        return conflict('El estado actual del proceso no permite traspasar el cliente')

    cliente_origen = clientes_table.get_item(Key={
        'pk': f'CLIENTE#{cedula_actual}#{inmobiliaria_id}',
        'sk': f'PROYECTO#{proyecto_id}',
    }).get('Item', {})

    crear_cliente = tipo_destino == 'nuevo'
    if crear_cliente:
        try:
            cliente_destino = _normalizar_cliente(body.get('cliente'))
        except ValueError as exc:
            return bad_request(str(exc))
        cedula_destino = cliente_destino['cedula']
    else:
        cedula_destino = _clean(body.get('cedula_destino')).upper()
        if not cedula_destino:
            return bad_request('cedula_destino es requerida')
        cliente_destino = clientes_table.get_item(Key={
            'pk': f'CLIENTE#{cedula_destino}#{inmobiliaria_id}',
            'sk': f'PROYECTO#{proyecto_id}',
        }).get('Item')
        if not cliente_destino:
            return not_found('El cliente destino no existe en esta inmobiliaria y proyecto')

    if cedula_destino == cedula_actual:
        return conflict('El cliente destino debe ser diferente del cliente actual')
    if _buscar_proceso(cedula_destino, inmobiliaria_id, proyecto_id, unidad_id):
        return conflict('El cliente destino ya tiene un proceso para esta unidad')

    cliente_destino_existente = clientes_table.get_item(Key={
        'pk': f'CLIENTE#{cedula_destino}#{inmobiliaria_id}',
        'sk': f'PROYECTO#{proyecto_id}',
    }).get('Item')
    if crear_cliente and cliente_destino_existente:
        return conflict('Ya existe un cliente con esa cedula; seleccionelo como cliente existente')

    try:
        _validar_exclusividad(cedula_destino, inmobiliaria_id, proyecto_id)
    except ValueError as exc:
        return conflict(str(exc))

    inventario_key = {'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    unidad = inventario_table.get_item(Key=inventario_key).get('Item')
    if not unidad:
        return not_found('La unidad asociada al proceso no existe')
    cedula_inventario = unidad.get('cliente_cedula')
    if cedula_inventario and cedula_inventario != cedula_actual:
        return conflict('La unidad esta asociada a otro cliente; se requiere revision manual')

    ahora_dt = datetime.now(timezone.utc)
    ahora = ahora_dt.isoformat()
    nombre_origen = _clean(f"{cliente_origen.get('nombres', '')} {cliente_origen.get('apellidos', '')}")
    nombre_destino = _clean(f"{cliente_destino.get('nombres', '')} {cliente_destino.get('apellidos', '')}")
    auditoria = {
        'tipo': 'traspaso_cliente',
        'cedula_anterior': cedula_actual,
        'cliente_anterior_nombre': nombre_origen,
        'cedula_nueva': cedula_destino,
        'cliente_nuevo_nombre': nombre_destino,
        'justificacion': justificacion,
        'estado_proceso': proceso.get('estado'),
        'ejecutado_por': get_sub(event) or 'desconocido',
        'ejecutado_por_nombre': get_nombre(event),
        'notificacion_enviada': False,
        'timestamp': ahora,
    }
    proceso_destino = {
        **proceso,
        'pk': f'PROCESO#{cedula_destino}#{inmobiliaria_id}',
        'cedula': cedula_destino,
        'actualizado_en': ahora,
        'historial': [*(proceso.get('historial') or []), auditoria],
    }

    transaccion = [
        {'Put': {
            'TableName': procesos_table.name,
            'Item': _item(proceso_destino),
            'ConditionExpression': 'attribute_not_exists(pk)',
        }},
        {'Delete': {
            'TableName': procesos_table.name,
            'Key': _item({'pk': proceso['pk'], 'sk': proceso['sk']}),
            'ConditionExpression': 'attribute_exists(pk) AND #estado = :estado AND cedula = :cedula',
            'ExpressionAttributeNames': {'#estado': 'estado'},
            'ExpressionAttributeValues': {
                ':estado': _av(proceso['estado']),
                ':cedula': _av(cedula_actual),
            },
        }},
    ]

    if crear_cliente:
        nuevo_cliente = {
            **cliente_destino,
            'pk': f'CLIENTE#{cedula_destino}#{inmobiliaria_id}',
            'sk': f'PROYECTO#{proyecto_id}',
            'inmobiliaria_id': inmobiliaria_id,
            'proyecto_id': proyecto_id,
            'exclusividad_activa': True,
            'fecha_captacion': ahora,
            'fecha_vencimiento': _sumar_meses(ahora_dt, 3).isoformat(),
            'creado_en': ahora,
        }
        transaccion.append({'Put': {
            'TableName': clientes_table.name,
            'Item': _item(nuevo_cliente),
            'ConditionExpression': 'attribute_not_exists(pk)',
        }})

    if cedula_inventario:
        transaccion.append({'Update': {
            'TableName': inventario_table.name,
            'Key': _item(inventario_key),
            'UpdateExpression': 'SET cliente_cedula = :nueva, actualizado_en = :ts',
            'ConditionExpression': 'cliente_cedula = :anterior',
            'ExpressionAttributeValues': {
                ':nueva': _av(cedula_destino),
                ':anterior': _av(cedula_actual),
                ':ts': _av(ahora),
            },
        }})

    try:
        ddb.transact_write_items(TransactItems=transaccion)
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'TransactionCanceledException':
            return conflict('El proceso cambio o el cliente destino ya tiene esta unidad; recargue e intente nuevamente')
        raise

    advertencias = []
    if crear_cliente:
        try:
            programado = _programar_vencimiento_exclusividad(
                cedula_destino, inmobiliaria_id, proyecto_id,
                _sumar_meses(ahora_dt, 3),
            )
            if not programado:
                advertencias.append('se debe revisar el vencimiento de exclusividad del cliente nuevo')
        except Exception as exc:
            print(f'Error creando vencimiento de exclusividad: {type(exc).__name__}: {exc}')
            advertencias.append('se debe revisar el vencimiento de exclusividad del cliente nuevo')

    if proceso.get('estado') == 'separacion' and proceso.get('fecha_separacion'):
        try:
            fecha_alerta = (
                datetime.fromisoformat(proceso['fecha_separacion'].replace('Z', '+00:00'))
                .astimezone(timezone.utc) + timedelta(days=30)
            )
            _cancelar_alerta_separacion(cedula_actual, unidad_id)
            if fecha_alerta > datetime.now(timezone.utc):
                _crear_alerta_separacion_en(
                    cedula_destino, inmobiliaria_id, proyecto_id, unidad_id,
                    proceso.get('unidad_nombre', unidad_id), fecha_alerta,
                )
        except Exception as exc:
            print(f'Error migrando alerta de separacion: {type(exc).__name__}: {exc}')
            advertencias.append('se debe revisar la alerta de separacion')

    respuesta = {
        'message': 'Cliente traspasado correctamente',
        'cedula_anterior': cedula_actual,
        'cedula_nueva': cedula_destino,
        'proceso': proceso_destino,
    }
    if advertencias:
        respuesta['advertencia'] = (
            'El cliente fue traspasado, pero ' + ' y '.join(advertencias)
        )
    return ok(respuesta)
