"""Maneja eventos de EventBridge Scheduler para vencimiento de exclusividad."""
import boto3
import os
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
clientes = dynamodb.Table(os.environ['CLIENTES_TABLE'])


def handle(event):
    accion = event.get('accion')
    if accion == 'vencer_exclusividad':
        return _vencer(
            event.get('cedula'),
            event.get('inmobiliaria_id'),
            event.get('proyecto_id'),
        )


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
