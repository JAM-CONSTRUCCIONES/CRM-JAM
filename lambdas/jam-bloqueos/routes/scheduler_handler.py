"""
Maneja los eventos disparados por EventBridge Scheduler:
  - liberar_automatico: libera la unidad a las 48h
  - alerta_vencimiento: notifica 5h antes del vencimiento
"""
import boto3
import json
import os
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from utils.clientes import desvincular_unidad

dynamodb = boto3.resource('dynamodb')
inventario = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
historial = dynamodb.Table(os.environ['HISTORIAL_TABLE'])
sqs = boto3.client('sqs')
scheduler = boto3.client('scheduler')
SQS_URL = os.environ.get('SQS_URL', '')


def handle(event):
    accion = event.get('accion')
    unidad_id = event.get('unidad_id')
    proyecto_id = event.get('proyecto_id')

    if accion == 'liberar_automatico':
        result = _liberar(unidad_id, proyecto_id)
        # Eliminar ambos schedules después de liberar
        _eliminar_schedules_post_ejecucion(unidad_id)
        return result
    elif accion == 'alerta_vencimiento':
        result = _alertar(unidad_id, proyecto_id)
        # Eliminar solo el schedule de alerta (liberación se eliminará cuando se ejecute)
        _eliminar_schedule_especifico(unidad_id, 'alerta')
        return result


def _liberar(unidad_id, proyecto_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item or item.get('estado') != 'bloqueada':
        return  # Ya fue liberada manualmente

    inmobiliaria_id = item.get('bloqueado_por')
    fecha_bloqueo = item.get('fecha_bloqueo', '')
    fecha_liberacion = item.get('fecha_liberacion', '')
    cliente_cedula = item.get('cliente_cedula', '')
    unidad_nombre = item.get('id_unidad', unidad_id)
    ts_ahora = datetime.now(timezone.utc).isoformat()

    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression='REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion, cliente_cedula SET estado = :d',
        ExpressionAttributeValues={':d': 'disponible'},
    )

    # Desvincular unidad del cliente
    if cliente_cedula and inmobiliaria_id:
        desvincular_unidad(unidad_id, cliente_cedula, inmobiliaria_id, proyecto_id)

    # Actualizar historial
    try:
        historial.update_item(
            Key={'pk': f'UNIDAD#{unidad_id}', 'sk': f'BLOQUEO#{fecha_bloqueo}'},
            UpdateExpression='SET motivo_liberacion = :m, fecha_liberacion = :fl',
            ExpressionAttributeValues={':m': 'automatica', ':fl': ts_ahora},
        )
    except Exception as e:
        print(f'Error actualizando historial de liberacion automatica para {unidad_id}: {type(e).__name__}: {e}')

    if SQS_URL:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'liberacion_automatica',
                'unidad_id': unidad_id,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmobiliaria_id,
                'cliente_cedula': cliente_cedula,
                'fecha_liberacion': ts_ahora,
                'metadata': {
                    'unidad_id': unidad_id,
                    'unidad_nombre': unidad_nombre,
                    'cedula': cliente_cedula,
                    'fecha_bloqueo': fecha_bloqueo,
                    'fecha_liberacion_programada': fecha_liberacion,
                    'fecha_liberacion': ts_ahora,
                },
            }),
        )


def _alertar(unidad_id, proyecto_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item or item.get('estado') != 'bloqueada':
        return

    if SQS_URL:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'alerta_vencimiento',
                'unidad_id': unidad_id,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': item.get('bloqueado_por'),
                'fecha_liberacion': item.get('fecha_liberacion'),
            }),
        )


def _schedule_name(unidad_id, suffix):
    """EventBridge Scheduler no permite '/' ni '#' en nombres"""
    safe = unidad_id.replace('/', '-').replace('#', '-')
    return f"bloqueo-{safe}-{suffix}"


def _eliminar_schedules_post_ejecucion(unidad_id):
    """Elimina ambos schedules (alerta y liberación) después de ejecutar la liberación."""
    for suffix in ('alerta', 'liberacion'):
        try:
            name = _schedule_name(unidad_id, suffix)
            scheduler.delete_schedule(Name=name)
            print(f'✓ Schedule eliminado post-ejecución: {name}')
        except scheduler.exceptions.ResourceNotFoundException:
            print(f'⚠ Schedule ya eliminado: {_schedule_name(unidad_id, suffix)}')
        except Exception as e:
            print(f'✗ Error eliminando schedule {suffix} para {unidad_id}: {type(e).__name__}: {e}')


def _eliminar_schedule_especifico(unidad_id, suffix):
    """Elimina un schedule específico después de ejecutarse."""
    try:
        name = _schedule_name(unidad_id, suffix)
        scheduler.delete_schedule(Name=name)
        print(f'✓ Schedule eliminado post-ejecución: {name}')
    except scheduler.exceptions.ResourceNotFoundException:
        print(f'⚠ Schedule ya eliminado: {_schedule_name(unidad_id, suffix)}')
    except Exception as e:
        print(f'✗ Error eliminando schedule {suffix} para {unidad_id}: {type(e).__name__}: {e}')
