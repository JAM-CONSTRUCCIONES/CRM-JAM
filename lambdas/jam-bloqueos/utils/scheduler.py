import boto3
import json
import os

scheduler = boto3.client('scheduler')

LAMBDA_ARN = os.environ.get('BLOQUEOS_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')


def _schedule_name(unidad_id, suffix):
    # EventBridge Scheduler no permite '/' ni '#' en nombres
    safe = unidad_id.replace('/', '-').replace('#', '-')
    return f"bloqueo-{safe}-{suffix}"


def crear_schedules(unidad_id, proyecto_id, ts_liberacion_iso, ts_alerta_iso):
    """
    Crea dos schedules one-time:
      - liberacion: a las 48h → dispara acción 'liberar_automatico'
      - alerta:     a las 43h → dispara acción 'alerta_vencimiento'
    """
    if not LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        print(f'⚠ crear_schedules: LAMBDA_ARN o SCHEDULER_ROLE_ARN no configurados, omitiendo schedules para {unidad_id}')
        print(f'  LAMBDA_ARN: {LAMBDA_ARN}')
        print(f'  SCHEDULER_ROLE_ARN: {SCHEDULER_ROLE_ARN}')
        return

    payload_base = {'unidad_id': unidad_id, 'proyecto_id': proyecto_id}

    schedules_creados = 0
    for suffix, at_time, accion in [
        ('alerta', ts_alerta_iso, 'alerta_vencimiento'),
        ('liberacion', ts_liberacion_iso, 'liberar_automatico'),
    ]:
        try:
            schedule_name = _schedule_name(unidad_id, suffix)
            scheduler.create_schedule(
                Name=schedule_name,
                ScheduleExpression=f"at({at_time})",
                ScheduleExpressionTimezone='UTC',
                FlexibleTimeWindow={'Mode': 'OFF'},
                Target={
                    'Arn': LAMBDA_ARN,
                    'RoleArn': SCHEDULER_ROLE_ARN,
                    'Input': json.dumps({**payload_base, 'accion': accion}),
                },
                ActionAfterCompletion='DELETE',
            )
            schedules_creados += 1
            print(f'✓ Schedule creado: {schedule_name} at {at_time} (accion: {accion})')
        except Exception as e:
            print(f'✗ crear_schedules error ({suffix}): {type(e).__name__}: {e}')
            print(f'  unidad_id: {unidad_id}')
            print(f'  schedule_name: {_schedule_name(unidad_id, suffix)}')
            print(f'  at_time: {at_time}')
    
    if schedules_creados == 2:
        print(f'✓ Ambos schedules creados exitosamente para unidad {unidad_id}')
    elif schedules_creados == 1:
        print(f'⚠ Solo 1 de 2 schedules creado para unidad {unidad_id}')
    else:
        print(f'✗ No se crearon schedules para unidad {unidad_id}')


def eliminar_schedules(unidad_id):
    """Elimina los schedules pendientes al liberar manualmente."""
    schedules_eliminados = 0
    for suffix in ('alerta', 'liberacion'):
        try:
            schedule_name = _schedule_name(unidad_id, suffix)
            scheduler.delete_schedule(Name=schedule_name)
            schedules_eliminados += 1
            print(f'✓ Schedule eliminado manualmente: {schedule_name}')
        except scheduler.exceptions.ResourceNotFoundException:
            print(f'⚠ Schedule no encontrado (ya eliminado): {_schedule_name(unidad_id, suffix)}')
        except Exception as e:
            print(f'✗ Error eliminando schedule {suffix}: {type(e).__name__}: {e}')
    
    if schedules_eliminados > 0:
        print(f'✓ {schedules_eliminados} schedule(s) eliminado(s) para unidad {unidad_id}')
