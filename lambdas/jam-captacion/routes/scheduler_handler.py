"""Maneja eventos de EventBridge Scheduler para vencimiento de exclusividad."""
import boto3
import json
import os
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
clientes = dynamodb.Table(os.environ['CLIENTES_TABLE'])

sqs_client = boto3.client('sqs')
scheduler = boto3.client('scheduler')
SQS_URL = os.environ.get('SQS_URL')
EXCLUSIVIDAD_ACTIVA = False


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


def handle(event):
    accion = event.get('accion')
    if accion == 'vencer_exclusividad' and not EXCLUSIVIDAD_ACTIVA:
        return
    if accion == 'vencer_exclusividad':
        cedula = event.get('cedula')
        inmobiliaria_id = event.get('inmobiliaria_id')
        proyecto_id = event.get('proyecto_id')
        
        result = _vencer(cedula, inmobiliaria_id, proyecto_id)
        
        # Eliminar schedule después de ejecutar
        _eliminar_schedule_post_ejecucion(cedula, inmobiliaria_id, proyecto_id)
        
        return result


def _vencer(cedula, inmobiliaria_id, proyecto_id):
    if not all([cedula, inmobiliaria_id, proyecto_id]):
        return

    pk = f'CLIENTE#{cedula}#{inmobiliaria_id}'
    sk = f'PROYECTO#{proyecto_id}'

    item = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if not item or not item.get('exclusividad_activa'):
        return  # Ya fue procesado o no existe

    # Solo vencer si sigue en captacion — si ya avanzó a reserva o más, no tocar
    if item.get('estado') == 'captacion':
        clientes.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET exclusividad_activa = :false, estado = :disponible',
            ExpressionAttributeValues={':false': False, ':disponible': 'disponible'},
        )
    else:
        # Avanzó en el proceso — solo marcar exclusividad como vencida
        clientes.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET exclusividad_activa = :false',
            ExpressionAttributeValues={':false': False},
        )

    _publicar_evento('exclusividad_vencida', proyecto_id, inmobiliaria_id, {'cedula': cedula})


def _schedule_name(cedula, inmobiliaria_id, proyecto_id):
    """Genera nombre de schedule consistente con utils/scheduler.py"""
    safe_cedula = cedula.replace('/', '-').replace('#', '-')
    safe_inmo = inmobiliaria_id.replace('/', '-').replace('#', '-').replace('INMOBILIARIA', 'I')
    safe_proy = proyecto_id.replace('/', '-').replace('#', '-').replace('PROYECTO', 'P')
    return f"exclusividad-{safe_cedula}-{safe_inmo}-{safe_proy}"


def _eliminar_schedule_post_ejecucion(cedula, inmobiliaria_id, proyecto_id):
    """Elimina el schedule después de ejecutar el vencimiento."""
    try:
        name = _schedule_name(cedula, inmobiliaria_id, proyecto_id)
        scheduler.delete_schedule(Name=name)
        print(f'✓ Schedule eliminado post-ejecución: {name}')
    except scheduler.exceptions.ResourceNotFoundException:
        print(f'⚠ Schedule ya eliminado: {_schedule_name(cedula, inmobiliaria_id, proyecto_id)}')
    except Exception as e:
        print(f'✗ Error eliminando schedule de exclusividad para {cedula}: {type(e).__name__}: {e}')
