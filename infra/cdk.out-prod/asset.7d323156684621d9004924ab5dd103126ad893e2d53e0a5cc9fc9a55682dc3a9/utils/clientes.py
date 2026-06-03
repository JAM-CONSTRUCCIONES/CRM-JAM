"""Helpers para crear/actualizar clientes y procesos desde jam-bloqueos."""
import boto3
import json
import os
from datetime import datetime, timezone, date
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')
scheduler_client = boto3.client('scheduler')

MESES_EXCLUSIVIDAD = 3


def _now():
    return datetime.now(timezone.utc).isoformat()


def _calcular_edad(fecha_nacimiento: str):
    try:
        nacimiento = date.fromisoformat(fecha_nacimiento)
        hoy = date.today()
        return hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day))
    except (ValueError, TypeError):
        return None


def _add_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    max_day = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
               31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return dt.replace(year=year, month=month, day=min(dt.day, max_day))


def _crear_schedule_exclusividad(cedula, inmobiliaria_id, proyecto_id, ts_vencimiento_iso):
    """Programa el vencimiento de exclusividad en EventBridge."""
    captacion_arn = os.environ.get('CAPTACION_LAMBDA_ARN', '')
    scheduler_role = os.environ.get('SCHEDULER_ROLE_ARN', '')
    if not captacion_arn or not scheduler_role:
        return

    safe_cedula = cedula.replace('/', '-').replace('#', '-')
    safe_inmo = inmobiliaria_id.replace('/', '-').replace('#', '-').replace('INMOBILIARIA', 'I')
    safe_proy = proyecto_id.replace('/', '-').replace('#', '-').replace('PROYECTO', 'P')
    name = f"exclusividad-{safe_cedula}-{safe_inmo}-{safe_proy}"

    try:
        scheduler_client.create_schedule(
            Name=name,
            ScheduleExpression=f"at({ts_vencimiento_iso[:19]})",
            ScheduleExpressionTimezone='UTC',
            FlexibleTimeWindow={'Mode': 'OFF'},
            Target={
                'Arn': captacion_arn,
                'RoleArn': scheduler_role,
                'Input': json.dumps({
                    'accion': 'vencer_exclusividad',
                    'cedula': cedula,
                    'inmobiliaria_id': inmobiliaria_id,
                    'proyecto_id': proyecto_id,
                }),
            },
            ActionAfterCompletion='DELETE',
        )
    except Exception as e:
        print(f'_crear_schedule_exclusividad error: {e}')


def registrar_cliente_y_proceso(
    cedula: str,
    inmobiliaria_id: str,
    proyecto_id: str,
    unidad_id: str,
    unidad_nombre: str,
    datos_cliente: dict,
):
    """
    Crea o actualiza el cliente en jam-clientes y crea el proceso en jam-procesos.
    Valida exclusividad antes de escribir.
    Retorna (ok: bool, mensaje: str)
    """
    clientes_table = os.environ.get('CLIENTES_TABLE')
    procesos_table = os.environ.get('PROCESOS_TABLE')
    if not clientes_table or not procesos_table:
        return False, 'CLIENTES_TABLE o PROCESOS_TABLE no configuradas'

    clientes = dynamodb.Table(clientes_table)
    procesos = dynamodb.Table(procesos_table)

    # Normalizar proyecto_id (sin prefijo)
    proyecto_id = proyecto_id.replace('PROYECTO#', '') if proyecto_id else proyecto_id

    ahora_dt = datetime.now(timezone.utc)
    ahora = ahora_dt.isoformat()
    fecha_vencimiento = _add_months(ahora_dt, MESES_EXCLUSIVIDAD).isoformat()

    # Verificar exclusividad de OTRA inmobiliaria — solo si el cliente no existe ya para esta inmo
    pk = f'CLIENTE#{cedula}#{inmobiliaria_id}'
    sk = f'PROYECTO#{proyecto_id}'
    existing = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item')

    if not existing:
        resultado = clientes.query(
            IndexName='gsi-cedula-proyecto',
            KeyConditionExpression=Key('cedula').eq(cedula) & Key('sk').eq(sk),
            FilterExpression=Attr('exclusividad_activa').eq(True),
        )
        for item in resultado.get('Items', []):
            if item.get('inmobiliaria_id') != inmobiliaria_id:
                return False, 'Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto'
    edad = _calcular_edad(datos_cliente.get('fecha_nacimiento'))

    if not existing:
        clientes.put_item(Item={
            'pk': pk, 'sk': sk,
            'cedula': cedula,
            'inmobiliaria_id': inmobiliaria_id,
            'proyecto_id': proyecto_id,
            'nombres': datos_cliente.get('nombres', ''),
            'apellidos': datos_cliente.get('apellidos', ''),
            'correo': datos_cliente.get('correo', ''),
            'telefono': datos_cliente.get('telefono', ''),
            'estado_civil': datos_cliente.get('estado_civil', ''),
            'nacionalidad': datos_cliente.get('nacionalidad', ''),
            'pais_residencia': datos_cliente.get('pais_residencia', ''),
            'fecha_nacimiento': datos_cliente.get('fecha_nacimiento', ''),
            'edad': edad,
            'exclusividad_activa': True,
            'fecha_captacion': ahora,
            'fecha_vencimiento': fecha_vencimiento,
            'creado_en': ahora,
        })
        # Programar vencimiento de exclusividad
        _crear_schedule_exclusividad(cedula, inmobiliaria_id, proyecto_id, fecha_vencimiento)
    else:
        # Actualizar datos si ya existe (con o sin exclusividad)
        updates = ['actualizado_en = :ts']
        values = {':ts': ahora}
        campos = ['nombres', 'apellidos', 'correo', 'telefono',
                  'estado_civil', 'nacionalidad', 'pais_residencia', 'fecha_nacimiento']
        names = {}
        for campo in campos:
            if datos_cliente.get(campo):
                values[f':{campo}'] = datos_cliente[campo]
                updates.append(f'#{campo} = :{campo}')
                names[f'#{campo}'] = campo
        if edad is not None:
            values[':edad'] = edad
            updates.append('edad = :edad')

        clientes.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET ' + ', '.join(updates),
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {}),
        )

    # Crear proceso si no existe uno activo para esta unidad
    proc_pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    proc_sk = f'UNIDAD#{unidad_id}'
    existing_proc = procesos.get_item(Key={'pk': proc_pk, 'sk': proc_sk}).get('Item')

    if not existing_proc or existing_proc.get('estado') == 'desvinculado':
        procesos.put_item(Item={
            'pk': proc_pk, 'sk': proc_sk,
            'cedula': cedula,
            'inmobiliaria_id': inmobiliaria_id,
            'proyecto_id': proyecto_id,
            'unidad_id': unidad_id,
            'unidad_nombre': unidad_nombre,
            'estado': 'captacion',
            'historial': [],
            'fecha_inicio': ahora,
            'actualizado_en': ahora,
        })

    return True, 'ok'


def desvincular_unidad(unidad_id: str, cliente_cedula: str, inmobiliaria_id: str, proyecto_id: str):
    """Marca el proceso como desvinculado cuando se libera el bloqueo sin reserva."""
    if not all([unidad_id, cliente_cedula, inmobiliaria_id, proyecto_id]):
        return

    procesos_table = os.environ.get('PROCESOS_TABLE')
    if not procesos_table:
        return

    procesos = dynamodb.Table(procesos_table)
    pk = f'PROCESO#{cliente_cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'

    try:
        item = procesos.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
        # Fix #3: desvincular en cualquier estado activo, no solo captacion
        if not item or item.get('estado') in ('desvinculado', 'vendida'):
            return  # Ya está cerrado, no tocar

        estado_actual = item.get('estado', 'captacion')
        ts_ahora = datetime.now(timezone.utc).isoformat()
        entrada_historial = {
            'estatus_anterior': estado_actual,
            'estatus_nuevo': 'desvinculado',
            'ejecutado_por': 'sistema',
            'ejecutado_por_nombre': 'Liberación de bloqueo',
            'notificacion_enviada': False,
            'timestamp': ts_ahora,
        }

        historial_actual = item.get('historial', [])
        historial_actual.append(entrada_historial)

        procesos.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression=(
                'SET estado = :d, actualizado_en = :ts, historial = :h'
                ' REMOVE alerta_separacion_vencida'  # Fix #7: limpiar flag de alerta
            ),
            ExpressionAttributeValues={
                ':d': 'desvinculado',
                ':ts': ts_ahora,
                ':h': historial_actual,
            },
        )
    except Exception as e:
        print(f'desvincular_unidad error: {e}')
