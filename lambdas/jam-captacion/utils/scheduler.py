import boto3
import json
import os

scheduler = boto3.client('scheduler')

CAPTACION_LAMBDA_ARN = os.environ.get('CAPTACION_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')
EXCLUSIVIDAD_ACTIVA = False


def _schedule_name(cedula, inmobiliaria_id, proyecto_id):
    safe_cedula = cedula.replace('/', '-').replace('#', '-')
    safe_inmo = inmobiliaria_id.replace('/', '-').replace('#', '-').replace('INMOBILIARIA', 'I')
    safe_proy = proyecto_id.replace('/', '-').replace('#', '-').replace('PROYECTO', 'P')
    return f"exclusividad-{safe_cedula}-{safe_inmo}-{safe_proy}"


def crear_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id, ts_vencimiento_iso):
    """Crea un schedule one-time para vencer la exclusividad a los 3 meses."""
    if not EXCLUSIVIDAD_ACTIVA:
        return
    if not CAPTACION_LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        print(f'⚠ crear_schedule_vencimiento: ARNs no configurados, omitiendo schedule para {cedula}')
        print(f'  CAPTACION_LAMBDA_ARN: {CAPTACION_LAMBDA_ARN}')
        print(f'  SCHEDULER_ROLE_ARN: {SCHEDULER_ROLE_ARN}')
        return
    try:
        schedule_name = _schedule_name(cedula, inmobiliaria_id, proyecto_id)
        scheduler.create_schedule(
            Name=schedule_name,
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
        print(f'✓ Schedule de exclusividad creado: {schedule_name} at {ts_vencimiento_iso}')
    except Exception as e:
        print(f'✗ crear_schedule_vencimiento error: {type(e).__name__}: {e}')
        print(f'  cedula: {cedula}')
        print(f'  schedule_name: {_schedule_name(cedula, inmobiliaria_id, proyecto_id)}')
        print(f'  ts_vencimiento_iso: {ts_vencimiento_iso}')


def eliminar_schedule_vencimiento(cedula, inmobiliaria_id, proyecto_id):
    """Elimina el schedule de vencimiento (al re-captar un cliente vencido)."""
    try:
        schedule_name = _schedule_name(cedula, inmobiliaria_id, proyecto_id)
        scheduler.delete_schedule(Name=schedule_name)
        print(f'✓ Schedule de exclusividad eliminado: {schedule_name}')
    except scheduler.exceptions.ResourceNotFoundException:
        print(f'⚠ Schedule de exclusividad no encontrado (ya eliminado): {_schedule_name(cedula, inmobiliaria_id, proyecto_id)}')
    except Exception as e:
        print(f'✗ Error eliminando schedule de exclusividad: {type(e).__name__}: {e}')
