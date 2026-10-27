import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, bad_request, not_found, conflict
from utils.auth import get_claims
from utils import scheduler as sched
from utils.clientes import desvincular_unidad
from utils.auditoria import registrar_auditoria

dynamodb = boto3.resource('dynamodb')
inventario = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
historial = dynamodb.Table(os.environ['HISTORIAL_TABLE'])
usuarios = dynamodb.Table(os.environ['USUARIOS_TABLE'])
sqs = boto3.client('sqs')
SQS_URL = os.environ.get('SQS_URL', '')


def _get_nombre_usuario(sub: str) -> str:
    try:
        item = usuarios.get_item(Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}).get('Item', {})
        return item.get('nombre') or item.get('cognito_username') or sub
    except Exception:
        return sub


def _get_unidad_bloqueada(proyecto_id, unidad_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item or item.get('estado') != 'bloqueada':
        return None
    return item


def _registrar_liberacion(unidad_id, proyecto_id, inmobiliaria_id, motivo, liberado_por, fecha_bloqueo):
    ts = datetime.now(timezone.utc).isoformat()
    # Actualizar el registro de historial existente
    try:
        historial.update_item(
            Key={'pk': f'UNIDAD#{unidad_id}', 'sk': f'BLOQUEO#{fecha_bloqueo}'},
            UpdateExpression='SET motivo_liberacion = :m, liberado_por = :lp, fecha_liberacion = :fl',
            ExpressionAttributeValues={
                ':m': motivo,
                ':lp': liberado_por,
                ':fl': ts,
            },
        )
    except ClientError:
        pass  # Si no existe el registro exacto, no es crítico


def liberar(proyecto_id, unidad_id, event):
    if not proyecto_id:
        return bad_request('proyecto_id requerido (query param)')

    unidad = _get_unidad_bloqueada(proyecto_id, unidad_id)
    if not unidad:
        return not_found('Unidad no encontrada o no está bloqueada')

    claims = get_claims(event)
    admin_id = claims.get('sub', 'admin')
    admin_nombre = _get_nombre_usuario(admin_id)
    inmobiliaria_id = unidad.get('bloqueado_por')
    fecha_bloqueo = unidad.get('fecha_bloqueo', '')
    cliente_cedula = unidad.get('cliente_cedula', '')

    # Fix #2: advertir si el proceso ya avanzó más allá de captacion
    # (el admin puede forzar con ?forzar=true)
    qs = event.get('queryStringParameters') or {}
    forzar = qs.get('forzar', 'false').lower() == 'true'
    notificar_raw = str(qs.get('notificar', 'false')).lower()
    notificar = notificar_raw if notificar_raw in ('admin', 'todos') else False

    if cliente_cedula and inmobiliaria_id and not forzar:
        procesos_table_name = os.environ.get('PROCESOS_TABLE', '')
        if procesos_table_name:
            procesos = dynamodb.Table(procesos_table_name)
            proc = procesos.get_item(
                Key={'pk': f'PROCESO#{cliente_cedula}#{inmobiliaria_id}',
                     'sk': f'UNIDAD#{unidad_id}'}
            ).get('Item')
            if proc and proc.get('estado') not in ('captacion', 'desvinculado', None):
                return conflict(
                    f'El proceso de venta está en estado "{proc.get("estado")}". '
                    f'Usa ?forzar=true para liberar de todas formas.'
                )

    # Liberar en inventario
    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression='REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion, cliente_cedula SET estado = :d',
        ExpressionAttributeValues={':d': 'disponible'},
    )

    # Cancelar schedules pendientes
    sched.eliminar_schedules(unidad_id)

    # Historial
    _registrar_liberacion(unidad_id, proyecto_id, inmobiliaria_id, 'manual', admin_nombre, fecha_bloqueo)

    # Desvincular unidad del cliente si había uno asociado
    cliente_cedula = unidad.get('cliente_cedula', '')
    if cliente_cedula and inmobiliaria_id:
        desvincular_unidad(unidad_id, cliente_cedula, inmobiliaria_id, proyecto_id)

    # Notificar
    if SQS_URL:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'liberacion_manual',
                'unidad_id': unidad_id,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmobiliaria_id,
                'liberado_por': admin_nombre,
                'cedula': cliente_cedula,
                'unidad_nombre': unidad.get('id_unidad') or unidad_id,
                'notificar': notificar,
            }, ensure_ascii=False),
        )

    registrar_auditoria(
        event, 'bloqueo_liberado', 'bloqueos', 'unidad', unidad_id,
        detalles={
            'proyecto_id': proyecto_id, 'inmobiliaria_id': inmobiliaria_id,
            'cliente_cedula': cliente_cedula, 'motivo': 'manual',
            'entidad_nombre': unidad.get('id_unidad') or unidad_id,
            'forzar': forzar, 'notificar': notificar,
        },
    )

    return ok({'message': 'Bloqueo liberado', 'unidad_id': unidad_id})


def extender(proyecto_id, unidad_id, event):
    if not proyecto_id:
        return bad_request('proyecto_id requerido (query param)')

    body = json.loads(event.get('body') or '{}')
    # Acepta tanto horas_restantes (tiempo total desde ahora) como horas_extra (tiempo adicional)
    horas_restantes = body.get('horas_restantes')
    horas_extra = body.get('horas_extra')
    justificacion = body.get('justificacion', '')

    if horas_restantes is None and horas_extra is None:
        return bad_request('horas_restantes o horas_extra es requerido')

    if not justificacion:
        return bad_request('justificacion es requerida')

    unidad = _get_unidad_bloqueada(proyecto_id, unidad_id)
    if not unidad:
        return not_found('Unidad no encontrada o no está bloqueada')

    claims = get_claims(event)
    admin_id = claims.get('sub', 'admin')
    admin_nombre = _get_nombre_usuario(admin_id)

    fecha_bloqueo = unidad.get('fecha_bloqueo', '')
    ahora = datetime.now(timezone.utc)

    if horas_restantes is not None:
        # Tiempo total restante desde ahora
        horas = float(horas_restantes)
        if horas < 0.02:
            return bad_request('El tiempo restante debe ser al menos 1 minuto (0.02 horas)')
        nueva_dt_lib = ahora + timedelta(hours=horas)
    else:
        # Tiempo adicional sobre la fecha actual de liberación
        horas = float(horas_extra)
        if horas <= 0:
            return bad_request('horas_extra debe ser mayor a 0')
        fecha_lib_actual = unidad.get('fecha_liberacion', ahora.isoformat())
        try:
            dt_lib_actual = datetime.fromisoformat(fecha_lib_actual.replace('Z', '+00:00'))
            if dt_lib_actual.tzinfo is None:
                dt_lib_actual = dt_lib_actual.replace(tzinfo=timezone.utc)
        except Exception:
            dt_lib_actual = ahora
        nueva_dt_lib = dt_lib_actual + timedelta(hours=horas)
        # Calcular horas_restantes para el historial
        horas_restantes = (nueva_dt_lib - ahora).total_seconds() / 3600

    nueva_lib = nueva_dt_lib.isoformat()

    # Alerta 5 horas antes; si queda menos de 5h, alerta en 1 minuto
    tiempo_restante_h = (nueva_dt_lib - ahora).total_seconds() / 3600
    if tiempo_restante_h <= 5:
        nueva_alerta_dt = ahora + timedelta(minutes=1)
    else:
        nueva_alerta_dt = nueva_dt_lib - timedelta(hours=5)
    nueva_alerta = nueva_alerta_dt.isoformat()

    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression='SET fecha_liberacion = :lib',
        ExpressionAttributeValues={':lib': nueva_lib},
    )

    # Reemplazar ambos schedules (alerta + liberacion)
    sched.eliminar_schedules(unidad_id)
    sched.crear_schedules(unidad_id, proyecto_id, nueva_lib[:19], nueva_alerta[:19])

    # Registrar modificación en historial
    extension = {
        'horas_restantes': round(horas_restantes, 2),
        'justificacion': justificacion,
        'modificado_por': admin_nombre,
        'timestamp': ahora.isoformat(),
        'nueva_fecha_liberacion': nueva_lib,
    }
    try:
        historial.update_item(
            Key={'pk': f'UNIDAD#{unidad_id}', 'sk': f'BLOQUEO#{fecha_bloqueo}'},
            UpdateExpression='SET extensiones = list_append(if_not_exists(extensiones, :empty), :ext)',
            ExpressionAttributeValues={':ext': [extension], ':empty': []},
        )
    except Exception:
        pass

    registrar_auditoria(
        event, 'bloqueo_extendido', 'bloqueos', 'unidad', unidad_id,
        detalles={
            'proyecto_id': proyecto_id, 'horas_restantes': round(horas_restantes, 2),
            'entidad_nombre': unidad.get('id_unidad') or unidad_id,
            'justificacion': justificacion, 'nueva_fecha_liberacion': nueva_lib,
        },
    )

    return ok({
        'message': 'Tiempo de bloqueo actualizado',
        'unidad_id': unidad_id,
        'nueva_fecha_liberacion': nueva_lib,
        'modificado_por': admin_id,
        'justificacion': justificacion,
        'horas_restantes': round(horas_restantes, 2),
    })
