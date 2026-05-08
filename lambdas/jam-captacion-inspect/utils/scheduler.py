import boto3
import json
import os

scheduler = boto3.client('scheduler')

CAPTACION_LAMBDA_ARN = os.environ.get('CAPTACION_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')


def _schedule_name(cedula, inmobiliaria_id, proyecto_id):
    safe_cedula = cedula.replace('/', '-').replace('#', '-')
    safe_inmo = inmobiliaria_id.replace('/', '-').replace('#', '-').replace('INMOBILIARIA', 'I')
    safe_proy = proyecto_id.replace('/', '-').replace('#', '-').replace('PROYECTO', 'P')
    return f"exclusividad-{safe_cedula}-{safe_inmo}-{safe_proy}"


def crear_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id, ts_vencimiento_iso):
    """Crea un schedule one-time para vencer la exclusividad a los 3 meses."""
    scheduler.create_schedule(
        Name=_schedule_name(cedula, inmobiliaria_id, proyecto_id),
        ScheduleExpression=f"at({ts_vencimiento_iso})",
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


def eliminar_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id):
    """Elimina el schedule de vencimiento (al re-captar un cliente vencido)."""
    try:
        scheduler.delete_schedule(Name=_schedule_name(cedula, inmobiliaria_id, proyecto_id))
    except Exception:
        pass
