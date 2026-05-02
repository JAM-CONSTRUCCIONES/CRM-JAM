"""Escribe el inventario migrado en DynamoDB. Unidades directo al proyecto, sin torres."""
import uuid
import boto3
import os
import json
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone, timedelta
from utils.helpers import now

dynamodb     = boto3.resource('dynamodb')
inventario_t = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
usuarios_t   = dynamodb.Table(os.environ['USUARIOS_TABLE'])
clientes_t   = dynamodb.Table(os.environ['CLIENTES_TABLE'])
procesos_t   = dynamodb.Table(os.environ['PROCESOS_TABLE'])
historial_t  = dynamodb.Table(os.environ['HISTORIAL_TABLE'])

# Cliente para schedules y SQS
scheduler = boto3.client('scheduler')
sqs = boto3.client('sqs')

# Variables de entorno
LAMBDA_ARN = os.environ.get('BLOQUEOS_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')
SQS_URL = os.environ.get('SQS_URL', '')

# Duración de bloqueo en migración (24 horas)
HORAS_BLOQUEO_MIGRACION = 24
HORAS_ALERTA_MIGRACION = 19  # alerta 5 horas antes del vencimiento


def escribir_migracion(proyecto_id, filas):
    """
    Escribe unidades, inmobiliarias, clientes, procesos e historial.
    SIN torres — unidades van directo al proyecto.
    SIN schedules de EventBridge — datos históricos.
    """
    inmos_cache = {}  # nombre_excel → inmobiliaria_id
    ahora       = now()

    stats = {
        'unidades_cargadas':     0,
        'clientes_creados':      0,
        'inmobiliarias_creadas': 0,
        'advertencias':          0,
        'detalle':               [],
    }

    for fila in filas:
        id_unidad = fila['id_unidad']
        fila_num  = fila.get('fila_excel', '?')

        inmo_id = _resolver_inmobiliaria(proyecto_id, fila, inmos_cache, stats, ahora, fila_num, id_unidad)

        _escribir_unidad(proyecto_id, id_unidad, fila, inmo_id, ahora)

        cedula    = (fila.get('cedula') or '').strip()
        nombres   = (fila.get('nombres_sugerido')   or '').strip()
        apellidos = (fila.get('apellidos_sugerido') or '').strip()

        if cedula and nombres and inmo_id:
            _escribir_cliente_proceso(proyecto_id, id_unidad, fila, cedula, nombres, apellidos, inmo_id, ahora)
            stats['clientes_creados'] += 1
        elif fila.get('cliente_nombre_excel'):
            stats['advertencias'] += 1
            stats['detalle'].append({
                'fila': fila_num, 'id_unidad': id_unidad, 'tipo': 'advertencia',
                'motivo': 'Cédula no ingresada, unidad cargada sin cliente',
            })

        if fila.get('estado') == 'bloqueada' and inmo_id:
            _escribir_historial(proyecto_id, fila, inmo_id, cedula, ahora)
            _crear_schedules_bloqueo(fila, proyecto_id)
            _enviar_notificacion_bloqueo(fila, proyecto_id, inmo_id, cedula, id_unidad)

        stats['unidades_cargadas'] += 1

    return stats


# ─── Helpers internos ────────────────────────────────────────────────────────

def _resolver_inmobiliaria(proyecto_id, fila, cache, stats, ahora, fila_num, id_unidad):
    # Usar el nombre que el admin confirmó/editó, con fallback al nombre del Excel
    nombre_final = (fila.get('inmobiliaria_nombre_sugerido') or fila.get('inmobiliaria_excel') or '').strip()
    inmo_excel   = (fila.get('inmobiliaria_excel') or nombre_final).strip()

    if not nombre_final:
        return None

    # Cache por nombre final (lo que el admin ve y edita)
    if nombre_final in cache:
        return cache[nombre_final]

    # Si Bedrock ya resolvió el ID, usarlo directamente
    if fila.get('inmobiliaria_id_sugerido'):
        inmo_id = fila['inmobiliaria_id_sugerido']
        _agregar_proyecto_a_inmo(inmo_id, proyecto_id)
        cache[nombre_final] = inmo_id
        return inmo_id

    # Buscar por nombre en jam-usuarios (case-insensitive)
    inmo_id = _buscar_inmo_por_nombre(nombre_final)
    if inmo_id:
        _agregar_proyecto_a_inmo(inmo_id, proyecto_id)
        cache[nombre_final] = inmo_id
        return inmo_id

    # No existe — crear nueva
    inmo_id = str(uuid.uuid4())[:8].upper()
    usuarios_t.put_item(Item={
        'pk':        f'INMOBILIARIA#{inmo_id}',
        'sk':        'METADATA',
        'tipo':      'INMOBILIARIA',
        'nombre':    nombre_final,
        'activo':    True,
        'proyectos': [proyecto_id],
        'correos':   [],
        'origen':    'migracion',
        'creado_en': ahora,
    })
    cache[nombre_final] = inmo_id
    stats['inmobiliarias_creadas'] += 1
    stats['detalle'].append({
        'fila': fila_num, 'id_unidad': id_unidad, 'tipo': 'info',
        'motivo': f"Inmobiliaria '{nombre_final}' creada (origen: migracion)",
    })
    return inmo_id


def _buscar_inmo_por_nombre(nombre):
    """Busca inmobiliaria existente por nombre (case-insensitive). Retorna inmo_id o None."""
    try:
        from boto3.dynamodb.conditions import Key as DKey
        result = usuarios_t.query(
            IndexName='gsi-tipo',
            KeyConditionExpression=DKey('tipo').eq('INMOBILIARIA'),
        )
        nombre_norm = nombre.strip().lower()
        for item in result.get('Items', []):
            if item.get('nombre', '').strip().lower() == nombre_norm:
                return item['pk'].replace('INMOBILIARIA#', '')
    except Exception:
        pass
    return None


def _escribir_unidad(proyecto_id, id_unidad, fila, inmo_id, ahora):
    unidad_id = str(uuid.uuid4())[:8].upper()

    try:
        metraje_dec = Decimal(str(fila.get('metraje') or 0))
        precio_dec  = Decimal(str(fila.get('precio')  or 0))
    except InvalidOperation:
        metraje_dec = Decimal('0')
        precio_dec  = Decimal('0')

    item = {
        'pk':             f'PROYECTO#{proyecto_id}',
        'sk':             f'UNIDAD#{unidad_id}',
        'unidad_id':      unidad_id,
        'id_unidad':      id_unidad,
        'proyecto_id':    proyecto_id,
        'etapa_id':       fila.get('etapa_id') or '',
        'metraje':        metraje_dec,
        'precio':         precio_dec,
        'estado':         fila.get('estado', 'disponible'),
        'creado_en':      ahora,
        'actualizado_en': ahora,
    }

    # Para campos opcionales que no requieren cálculo especial
    for campo in ('tipo', 'piso', 'comentario', 'cliente_nombre_excel', 'manzana'):
        if fila.get(campo) is not None:
            item[campo] = fila[campo]

    # Manejar fecha_bloqueo y fecha_liberacion con reglas de 24 horas
    # SIEMPRE usar fecha actual para bloqueos (ignorar fechas del Excel)
    if fila.get('estado') == 'bloqueada':
        dt_bloqueo = datetime.fromisoformat(ahora.replace('Z', '+00:00'))
        item['fecha_bloqueo'] = ahora
        
        # Calcular fecha_liberacion: +24 horas desde ahora
        dt_liberacion = dt_bloqueo + timedelta(hours=HORAS_BLOQUEO_MIGRACION)
        item['fecha_liberacion'] = dt_liberacion.isoformat()
        
        # Guardar las fechas calculadas en la fila para usar en historial y schedules
        fila['_fecha_bloqueo_calculada'] = ahora
        fila['_fecha_liberacion_calculada'] = dt_liberacion.isoformat()
    else:
        # Para estados no bloqueados, mantener las fechas del Excel si existen
        if fila.get('fecha_bloqueo') is not None:
            item['fecha_bloqueo'] = fila['fecha_bloqueo']
        if fila.get('fecha_liberacion') is not None:
            item['fecha_liberacion'] = fila['fecha_liberacion']

    for campo_num in ('num_cuartos', 'num_banos', 'parqueos', 'metraje_terraza',
                      'metraje_patio', 'precio_reserva', 'precio_separacion',
                      'precio_inicial', 'cuota_monto', 'contra_entrega'):
        if fila.get(campo_num) is not None:
            try:
                item[campo_num] = Decimal(str(fila[campo_num]))
            except InvalidOperation:
                pass

    if inmo_id:
        item['bloqueado_por'] = inmo_id
    if fila.get('cedula'):
        item['cliente_cedula'] = fila['cedula'].strip()

    inventario_t.put_item(Item=item)
    fila['_unidad_id'] = unidad_id  # para proceso e historial


def _escribir_cliente_proceso(proyecto_id, id_unidad, fila, cedula, nombres, apellidos, inmo_id, ahora):
    clientes_t.put_item(Item={
        'pk':                f'CLIENTE#{cedula}#{inmo_id}',
        'sk':                f'PROYECTO#{proyecto_id}',
        'cedula':            cedula,
        'inmobiliaria_id':   inmo_id,
        'proyecto_id':       proyecto_id,
        'nombres':           nombres,
        'apellidos':         apellidos,
        'correo':            '',
        'telefono':          '',
        'estado_civil':      '',
        'nacionalidad':      '',
        'pais_residencia':   '',
        'fecha_nacimiento':  '',
        'edad':              None,
        'exclusividad_activa': True,
        'fecha_captacion':   ahora,
        'fecha_vencimiento': '',
        'creado_en':         ahora,
        'origen':            'migracion',
    })

    estado_proceso = fila.get('estado_proceso')
    if estado_proceso:
        unidad_id = fila.get('_unidad_id', '')
        procesos_t.put_item(Item={
            'pk':             f'PROCESO#{cedula}#{inmo_id}',
            'sk':             f'UNIDAD#{unidad_id}',
            'cedula':         cedula,
            'inmobiliaria_id': inmo_id,
            'proyecto_id':    proyecto_id,
            'unidad_id':      unidad_id,
            'unidad_nombre':  id_unidad,  # sin torre, solo el id legible
            'estado':         estado_proceso,
            'historial':      [],
            'fecha_inicio':   fila.get('fecha_bloqueo') or ahora,
            'actualizado_en': ahora,
            'origen':         'migracion',
        })


def _escribir_historial(proyecto_id, fila, inmo_id, cedula, ahora):
    """
    Escribe historial de bloqueo aplicando reglas de 24 horas.
    Usa las fechas calculadas en _escribir_unidad para mantener consistencia.
    """
    unidad_id = fila.get('_unidad_id', '')
    id_unidad = fila['id_unidad']
    
    # Usar las fechas calculadas en _escribir_unidad
    ts_bloqueo = fila.get('_fecha_bloqueo_calculada', ahora)
    ts_liberacion = fila.get('_fecha_liberacion_calculada', '')
    
    historial_t.put_item(Item={
        'pk':                f'UNIDAD#{unidad_id}',
        'sk':                f'BLOQUEO#{ts_bloqueo}',
        'proyecto_id':       proyecto_id,
        'unidad_id':         unidad_id,
        'unidad_nombre':     id_unidad,
        'inmobiliaria_id':   inmo_id,
        'inmobiliaria_nombre': fila.get('inmobiliaria_nombre_sugerido') or '',
        'fecha_bloqueo':     ts_bloqueo,
        'fecha_liberacion':  ts_liberacion,
        'motivo_liberacion': None,
        'cliente_cedula':    cedula or '',
        'origen':            'migracion',
    })


def _agregar_proyecto_a_inmo(inmo_id, proyecto_id):
    try:
        item      = usuarios_t.get_item(Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}).get('Item', {})
        proyectos = item.get('proyectos', [])
        if proyecto_id not in proyectos:
            proyectos.append(proyecto_id)
            usuarios_t.update_item(
                Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'},
                UpdateExpression='SET proyectos = :p',
                ExpressionAttributeValues={':p': proyectos},
            )
    except Exception:
        pass


def _schedule_name(unidad_id, suffix):
    """EventBridge Scheduler no permite '/' ni '#' en nombres"""
    safe = unidad_id.replace('/', '-').replace('#', '-')
    return f"bloqueo-{safe}-{suffix}"


def _crear_schedules_bloqueo(fila, proyecto_id):
    """
    Crea schedules de EventBridge para liberación automática y alerta.
    Similar a bloqueos.py pero con duración de 24h.
    """
    if not LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        print(f'_crear_schedules_bloqueo: LAMBDA_ARN o SCHEDULER_ROLE_ARN no configurados, omitiendo schedules')
        return
    
    unidad_id = fila.get('_unidad_id', '')
    if not unidad_id:
        return
    
    ts_liberacion = fila.get('_fecha_liberacion_calculada', '')
    ts_bloqueo = fila.get('_fecha_bloqueo_calculada', '')
    
    if not ts_liberacion or not ts_bloqueo:
        return
    
    # Calcular timestamp de alerta (5 horas antes de liberación)
    try:
        dt_bloqueo = datetime.fromisoformat(ts_bloqueo.replace('Z', '+00:00'))
        dt_alerta = dt_bloqueo + timedelta(hours=HORAS_ALERTA_MIGRACION)
        ts_alerta = dt_alerta.isoformat()[:19]  # formato para EventBridge: YYYY-MM-DDTHH:MM:SS
    except Exception:
        return
    
    ts_liberacion_eb = ts_liberacion[:19]  # formato para EventBridge
    
    payload_base = {'unidad_id': unidad_id, 'proyecto_id': proyecto_id}
    
    for suffix, at_time, accion in [
        ('alerta', ts_alerta, 'alerta_vencimiento'),
        ('liberacion', ts_liberacion_eb, 'liberar_automatico'),
    ]:
        try:
            scheduler.create_schedule(
                Name=_schedule_name(unidad_id, suffix),
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
            print(f'Schedule creado: {_schedule_name(unidad_id, suffix)} at {at_time}')
        except Exception as e:
            print(f'_crear_schedules_bloqueo error ({suffix}): {type(e).__name__}: {e}')


def _enviar_notificacion_bloqueo(fila, proyecto_id, inmo_id, cedula, id_unidad):
    """
    Envía notificación SQS de bloqueo registrado.
    Similar a bloqueos.py.
    """
    if not SQS_URL:
        print(f'_enviar_notificacion_bloqueo: SQS_URL no configurado, omitiendo notificación')
        return
    
    unidad_id = fila.get('_unidad_id', '')
    ts_bloqueo = fila.get('_fecha_bloqueo_calculada', '')
    ts_liberacion = fila.get('_fecha_liberacion_calculada', '')
    
    if not unidad_id:
        return
    
    try:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'bloqueo_registrado',
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmo_id,
                'metadata': {
                    'unidad_id': unidad_id,
                    'unidad_nombre': id_unidad,
                    'fecha_bloqueo': ts_bloqueo,
                    'fecha_liberacion': ts_liberacion,
                    'cliente_cedula': cedula or '',
                    'horas': HORAS_BLOQUEO_MIGRACION,
                    'origen': 'migracion',
                },
            }),
        )
        print(f'Notificación SQS enviada para bloqueo de unidad {id_unidad}')
    except Exception as e:
        print(f'_enviar_notificacion_bloqueo error: {type(e).__name__}: {e}')
