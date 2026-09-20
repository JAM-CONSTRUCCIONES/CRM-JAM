import argparse
import json
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).astimezone(timezone.utc)
    except ValueError:
        return None


def now_utc():
    return datetime.now(timezone.utc)


def table_name(base, stage):
    return f'{base}-prod' if stage == 'prod' else base


def schedule_name(prefix, cedula, unidad_id):
    safe_cedula = str(cedula).replace('/', '-').replace('#', '-').replace(' ', '-')
    safe_unidad = str(unidad_id).replace('/', '-').replace('#', '-')
    return f'{prefix}-{safe_cedula}-{safe_unidad}'[:64]


def scan_by_estado(table, estado):
    items = []
    kwargs = {'FilterExpression': Attr('estado').eq(estado)}
    while True:
        res = table.scan(**kwargs)
        items.extend(res.get('Items', []))
        last_key = res.get('LastEvaluatedKey')
        if not last_key:
            return items
        kwargs['ExclusiveStartKey'] = last_key


def get_crm_env(stage):
    lambda_client = boto3.client('lambda')
    fn = table_name('jam-crm', stage)
    cfg = lambda_client.get_function_configuration(FunctionName=fn)
    env = cfg.get('Environment', {}).get('Variables', {})
    return {
        'crm_lambda_arn': cfg['FunctionArn'],
        'scheduler_role_arn': env.get('SCHEDULER_ROLE_ARN', ''),
    }


def fecha_reserva(proceso):
    historial = proceso.get('historial') or []
    for entry in reversed(historial):
        if entry.get('estatus_nuevo') == 'reserva':
            ts = parse_dt(entry.get('timestamp'))
            if ts:
                return ts, 'historial'

    for field in ('fecha_reserva', 'actualizado_en', 'fecha_inicio'):
        ts = parse_dt(proceso.get(field))
        if ts:
            return ts, field

    return None, 'sin_fecha'


def crear_schedule_reserva(scheduler, proceso, fecha_alerta, crm_lambda_arn, scheduler_role_arn, apply):
    cedula = proceso.get('cedula')
    unidad_id = proceso.get('unidad_id')
    nombre = schedule_name('res', cedula, unidad_id)
    input_payload = {
        'source': 'scheduler',
        'tipo': 'alerta_reserva_vencida',
        'cedula': cedula,
        'inmobiliaria_id': proceso.get('inmobiliaria_id'),
        'proyecto_id': proceso.get('proyecto_id'),
        'unidad_id': unidad_id,
        'unidad_nombre': proceso.get('unidad_nombre') or unidad_id,
    }
    if apply:
        try:
            scheduler.delete_schedule(Name=nombre)
        except Exception:
            pass
        scheduler.create_schedule(
            Name=nombre,
            ScheduleExpression=f"at({fecha_alerta.strftime('%Y-%m-%dT%H:%M:%S')})",
            ScheduleExpressionTimezone='UTC',
            FlexibleTimeWindow={'Mode': 'OFF'},
            Target={
                'Arn': crm_lambda_arn,
                'RoleArn': scheduler_role_arn,
                'Input': json.dumps(input_payload, ensure_ascii=False),
            },
            ActionAfterCompletion='DELETE',
        )
    return nombre


def backfill_reservas(args):
    dynamodb = boto3.resource('dynamodb')
    scheduler = boto3.client('scheduler')
    procesos = dynamodb.Table(table_name('jam-procesos', args.stage))
    env = get_crm_env(args.stage)
    crm_lambda_arn = args.crm_lambda_arn or env['crm_lambda_arn']
    scheduler_role_arn = args.scheduler_role_arn or env['scheduler_role_arn']
    if args.apply and (not crm_lambda_arn or not scheduler_role_arn):
        raise RuntimeError('Falta crm_lambda_arn o scheduler_role_arn')

    items = scan_by_estado(procesos, 'reserva')
    reporte = {'total_reserva': len(items), 'futuros': 0, 'vencidos_10_min': 0, 'sin_fecha': 0, 'errores': 0}
    ejemplos = []
    base_now = now_utc()
    for p in items:
        fecha, fuente = fecha_reserva(p)
        if not fecha:
            reporte['sin_fecha'] += 1
            ejemplos.append({'cedula': p.get('cedula'), 'unidad_id': p.get('unidad_id'), 'motivo': fuente})
            continue
        vencimiento = fecha + timedelta(days=30)
        fecha_schedule = vencimiento if vencimiento > base_now else base_now + timedelta(minutes=10)
        if vencimiento > base_now:
            reporte['futuros'] += 1
        else:
            reporte['vencidos_10_min'] += 1
        try:
            nombre = crear_schedule_reserva(
                scheduler, p, fecha_schedule, crm_lambda_arn, scheduler_role_arn, args.apply
            )
            if len(ejemplos) < 20:
                ejemplos.append({
                    'schedule': nombre,
                    'cedula': p.get('cedula'),
                    'unidad_id': p.get('unidad_id'),
                    'fecha_reserva': fecha.isoformat(),
                    'fuente': fuente,
                    'fecha_schedule': fecha_schedule.isoformat(),
                })
        except Exception as exc:
            reporte['errores'] += 1
            ejemplos.append({'cedula': p.get('cedula'), 'unidad_id': p.get('unidad_id'), 'error': str(exc)})

    print(json.dumps({'apply': args.apply, 'reporte': reporte, 'ejemplos': ejemplos}, indent=2, ensure_ascii=False))


def cleanup_legacy_schedules(args):
    scheduler = boto3.client('scheduler')
    reporte = {'encontrados': 0, 'eliminados': 0, 'errores': 0}
    ejemplos = []
    token = None
    while True:
        kwargs = {'NamePrefix': 'sep-'}
        if token:
            kwargs['NextToken'] = token
        res = scheduler.list_schedules(**kwargs)
        for item in res.get('Schedules', []):
            name = item.get('Name', '')
            if not name.startswith('sep-'):
                continue
            reporte['encontrados'] += 1
            if len(ejemplos) < 30:
                ejemplos.append(name)
            if args.apply:
                try:
                    scheduler.delete_schedule(Name=name)
                    reporte['eliminados'] += 1
                except Exception:
                    reporte['errores'] += 1
        token = res.get('NextToken')
        if not token:
            break
    print(json.dumps({'apply': args.apply, 'reporte': reporte, 'ejemplos': ejemplos}, indent=2))


def corregir_pagos_atrasados(args):
    dynamodb = boto3.resource('dynamodb')
    procesos = dynamodb.Table(table_name('jam-procesos', args.stage))
    items = scan_by_estado(procesos, 'pagos_atrasados')
    reporte = {'total_pagos_atrasados': len(items), 'desde_separacion': 0, 'desde_inicial': 0, 'desde_reserva': 0, 'desconocidos': 0, 'corregidos': 0}
    ejemplos = []
    ts = now_utc().isoformat()
    for p in items:
        historial = p.get('historial') or []
        anterior = ''
        for entry in reversed(historial):
            if entry.get('estatus_nuevo') == 'pagos_atrasados':
                anterior = entry.get('estatus_anterior') or ''
                break
        if anterior == 'separacion':
            reporte['desde_separacion'] += 1
            if args.apply:
                entrada = {
                    'estatus_anterior': 'pagos_atrasados',
                    'estatus_nuevo': 'separacion',
                    'ejecutado_por': 'cli-dev',
                    'ejecutado_por_nombre': 'Correccion flujo reserva',
                    'notificacion_enviada': False,
                    'origen': 'correccion_migracion_flujo_reserva',
                    'timestamp': ts,
                }
                procesos.update_item(
                    Key={'pk': p['pk'], 'sk': p['sk']},
                    UpdateExpression=(
                        'SET #estado = :estado, actualizado_en = :ts, '
                        'historial = list_append(if_not_exists(historial, :empty), :entrada) '
                        'REMOVE alerta_reserva_vencida, alerta_separacion_vencida, pago_confirmado'
                    ),
                    ExpressionAttributeNames={'#estado': 'estado'},
                    ExpressionAttributeValues={
                        ':estado': 'separacion',
                        ':ts': ts,
                        ':empty': [],
                        ':entrada': [entrada],
                    },
                )
                reporte['corregidos'] += 1
        elif anterior == 'inicial':
            reporte['desde_inicial'] += 1
        elif anterior == 'reserva':
            reporte['desde_reserva'] += 1
        else:
            reporte['desconocidos'] += 1

        if len(ejemplos) < 30:
            ejemplos.append({'cedula': p.get('cedula'), 'unidad_id': p.get('unidad_id'), 'anterior': anterior or 'desconocido'})

    print(json.dumps({'apply': args.apply, 'reporte': reporte, 'ejemplos': ejemplos}, indent=2, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description='Herramientas dev para migrar flujo reserva -> pagos atrasados.')
    parser.add_argument('task', choices=['backfill-reservas', 'cleanup-separacion-schedules', 'corregir-pagos-atrasados'])
    parser.add_argument('--stage', default='dev', choices=['dev', 'prod'])
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--crm-lambda-arn', default='')
    parser.add_argument('--scheduler-role-arn', default='')
    args = parser.parse_args()
    if args.stage != 'dev':
        raise RuntimeError('Este script esta bloqueado para dev por ahora.')
    if args.task == 'backfill-reservas':
        backfill_reservas(args)
    elif args.task == 'cleanup-separacion-schedules':
        cleanup_legacy_schedules(args)
    elif args.task == 'corregir-pagos-atrasados':
        corregir_pagos_atrasados(args)


if __name__ == '__main__':
    main()
