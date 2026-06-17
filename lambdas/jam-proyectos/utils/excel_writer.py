"""Escribe el inventario migrado en DynamoDB. Unidades directo al proyecto, sin torres."""
import uuid
import boto3
import os
import json
import logging
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key
from utils.helpers import now

dynamodb     = boto3.resource('dynamodb')
inventario_t = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
usuarios_t   = dynamodb.Table(os.environ['USUARIOS_TABLE'])
clientes_t   = dynamodb.Table(os.environ['CLIENTES_TABLE'])
procesos_t   = dynamodb.Table(os.environ['PROCESOS_TABLE'])
historial_t  = dynamodb.Table(os.environ['HISTORIAL_TABLE'])
logger       = logging.getLogger()
EMAIL_RE = re.compile(r'^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$')


def _clean_spaces(value):
    return ' '.join(str(value or '').strip().split())


def _normalizar_nombre(value):
    nombre = _clean_spaces(value)
    if not nombre:
        return ''
    if not all(ch.isalpha() or ch.isspace() for ch in nombre):
        raise ValueError('Nombres y apellidos solo deben contener letras y espacios')
    return nombre.upper()


def _normalizar_cedula(value):
    cedula = _clean_spaces(value)
    if not cedula:
        return ''
    if not cedula.isdigit():
        raise ValueError('La cedula solo debe contener numeros')
    return cedula


def _normalizar_correo(value):
    correo = _clean_spaces(value).lower()
    if not correo:
        return ''
    if not EMAIL_RE.match(correo):
        raise ValueError('El correo debe tener un formato valido y dominio con punto')
    return correo


def _normalizar_telefono(value):
    raw = _clean_spaces(value)
    if not raw:
        return ''
    if not raw.isdigit():
        raise ValueError('El telefono solo debe contener numeros')
    return raw


def _normalizar_texto_catalogo(value):
    return _clean_spaces(value)


def _parse_dt(value):
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = _clean_spaces(value)
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _parse_fecha_iso(value):
    dt = _parse_dt(value)
    return dt.isoformat() if dt else ''


def _calcular_edad(fecha_nacimiento):
    dt = _parse_dt(fecha_nacimiento)
    if not dt:
        return None
    hoy = datetime.now(timezone.utc).date()
    nacimiento = dt.date()
    return hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day))


def _add_months(dt, months):
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    days = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(dt.day, days[month - 1])
    return dt.replace(year=year, month=month, day=day)

# Cliente para schedules y SQS
scheduler = boto3.client('scheduler')
sqs = boto3.client('sqs')

# Variables de entorno
LAMBDA_ARN = os.environ.get('BLOQUEOS_LAMBDA_ARN', '')
CAPTACION_LAMBDA_ARN = os.environ.get('CAPTACION_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')
SQS_URL = os.environ.get('SQS_URL', '')

# Duración de bloqueo en migración (48 horas)
HORAS_BLOQUEO_MIGRACION = 48
HORAS_ALERTA_MIGRACION = 43  # alerta 5 horas antes del vencimiento
MESES_EXCLUSIVIDAD = 3


def escribir_migracion(proyecto_id, filas):
    """
    Escribe unidades, inmobiliarias, clientes, procesos e historial.
    SIN torres — unidades van directo al proyecto.
    SIN schedules de EventBridge — datos históricos.
    """
    # Diagnóstico de variables de entorno
    print(f'=== INICIO MIGRACIÓN ===')
    print(f'Proyecto: {proyecto_id}')
    print(f'Total filas: {len(filas)}')
    print(f'LAMBDA_ARN: {LAMBDA_ARN}')
    print(f'SCHEDULER_ROLE_ARN: {SCHEDULER_ROLE_ARN}')
    print(f'SQS_URL: {SQS_URL}')

    duplicadas = _buscar_unidades_duplicadas(proyecto_id, filas)
    if duplicadas:
        raise ValueError(
            'No se puede confirmar la migracion. Estas unidades ya existen o estan duplicadas: ' +
            ', '.join(duplicadas[:10])
        )

    inmos_cache  = {}  # nombre_excel → inmobiliaria_id
    etapas_cache = {}  # nombre_etapa → etapa_id
    ahora        = now()

    # ── Pre-crear etapas únicas ───────────────────────────────────────────
    nombres_etapa = list({
        f['etapa_nombre'].strip()
        for f in filas
        if f.get('etapa_nombre') and f['etapa_nombre'].strip()
    })
    for nombre_etapa in nombres_etapa:
        etapa_id = _resolver_etapa(proyecto_id, nombre_etapa, etapas_cache, ahora)
        print(f'Etapa resuelta: {nombre_etapa} → {etapa_id}')

    # Asignar etapa_id a cada fila
    for fila in filas:
        nombre_etapa = (fila.get('etapa_nombre') or '').strip()
        if nombre_etapa and nombre_etapa in etapas_cache:
            fila['etapa_id'] = etapas_cache[nombre_etapa]

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
            print(f'Procesando bloqueo para unidad {id_unidad} (fila {fila_num})')
            _escribir_historial(proyecto_id, fila, inmo_id, cedula, ahora)
            _crear_schedules_bloqueo(fila, proyecto_id)
            _enviar_notificacion_bloqueo(fila, proyecto_id, inmo_id, cedula, id_unidad)

        stats['unidades_cargadas'] += 1

    print(f'=== FIN MIGRACIÓN ===')
    print(f'Unidades cargadas: {stats["unidades_cargadas"]}')
    print(f'Clientes creados: {stats["clientes_creados"]}')
    
    return stats


# ─── Helpers internos ────────────────────────────────────────────────────────

def _normalizar_id_unidad(id_unidad):
    return (id_unidad or '').strip().upper()


def _buscar_unidades_duplicadas(proyecto_id, filas):
    duplicadas = []
    vistas = set()
    existentes = _obtener_ids_unidades_existentes(proyecto_id)

    for fila in filas:
        id_unidad = (fila.get('id_unidad') or '').strip()
        id_normalizado = _normalizar_id_unidad(id_unidad)
        if not id_normalizado:
            continue

        if id_normalizado in vistas:
            duplicadas.append(f'{id_unidad} duplicada en el Excel')
            continue
        vistas.add(id_normalizado)

        if id_normalizado in existentes:
            duplicadas.append(f'{id_unidad} ya existe en el proyecto')

    return duplicadas


def _obtener_ids_unidades_existentes(proyecto_id):
    ids = set()
    last_key = None

    while True:
        kwargs = {
            'ProjectionExpression': 'id_unidad',
            'KeyConditionExpression': Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
        }
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key

        result = inventario_t.query(**kwargs)
        for item in result.get('Items', []):
            id_unidad = _normalizar_id_unidad(item.get('id_unidad'))
            if id_unidad:
                ids.add(id_unidad)

        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            return ids


def _resolver_etapa(proyecto_id, nombre_etapa, cache, ahora):
    """Busca etapa existente por nombre o la crea. Retorna etapa_id."""
    if nombre_etapa in cache:
        return cache[nombre_etapa]

    # Buscar etapas existentes del proyecto
    result = inventario_t.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('pk').eq(f'PROYECTO#{proyecto_id}') &
                               boto3.dynamodb.conditions.Key('sk').begins_with('ETAPA#')
    )
    for item in result.get('Items', []):
        if item.get('nombre', '').strip().lower() == nombre_etapa.strip().lower():
            etapa_id = item['etapa_id']
            cache[nombre_etapa] = etapa_id
            return etapa_id

    # No existe — crear nueva
    etapa_id = str(uuid.uuid4())[:8].upper()
    inventario_t.put_item(Item={
        'pk':        f'PROYECTO#{proyecto_id}',
        'sk':        f'ETAPA#{etapa_id}',
        'etapa_id':  etapa_id,
        'nombre':    nombre_etapa,
        'activo':    True,
        'creado_en': ahora,
        'origen':    'migracion',
    })
    cache[nombre_etapa] = etapa_id
    return etapa_id


def _resolver_inmobiliaria(proyecto_id, fila, cache, stats, ahora, fila_num, id_unidad):
    # Usar el nombre que el admin confirmó/editó, con fallback al nombre del Excel
    nombre_final = (fila.get('inmobiliaria_nombre_sugerido') or fila.get('inmobiliaria_excel') or '').strip()
    inmo_excel   = (fila.get('inmobiliaria_excel') or nombre_final).strip()
    logger.info(
        '[excel_writer] resolver inmo proyecto_id=%s fila=%s unidad=%s nombre_final=%r inmo_excel=%r id_sugerido=%r confianza=%s es_nueva=%s',
        proyecto_id, fila_num, id_unidad, nombre_final, inmo_excel,
        fila.get('inmobiliaria_id_sugerido'),
        fila.get('inmobiliaria_confianza'),
        fila.get('inmobiliaria_es_nueva'),
    )

    if not nombre_final:
        logger.info('[excel_writer] sin nombre inmobiliaria fila=%s unidad=%s', fila_num, id_unidad)
        return None

    # Cache por nombre final (lo que el admin ve y edita)
    if nombre_final in cache:
        logger.info('[excel_writer] cache hit nombre_final=%r inmo_id=%s', nombre_final, cache[nombre_final])
        return cache[nombre_final]

    # Si Bedrock ya resolvió el ID, usarlo directamente
    if fila.get('inmobiliaria_id_sugerido'):
        inmo_id = fila['inmobiliaria_id_sugerido']
        logger.info('[excel_writer] usando id_sugerido nombre_final=%r inmo_id=%s', nombre_final, inmo_id)
        _agregar_proyecto_a_inmo(inmo_id, proyecto_id)
        cache[nombre_final] = inmo_id
        return inmo_id

    # Buscar por nombre en jam-usuarios (case-insensitive)
    inmo_id = _buscar_inmo_por_nombre(nombre_final)
    if inmo_id:
        logger.info('[excel_writer] match exacto por nombre nombre_final=%r inmo_id=%s', nombre_final, inmo_id)
        _agregar_proyecto_a_inmo(inmo_id, proyecto_id)
        cache[nombre_final] = inmo_id
        return inmo_id

    # No existe — crear nueva
    inmo_id = str(uuid.uuid4())[:8].upper()
    logger.info('[excel_writer] creando inmobiliaria nueva nombre_final=%r inmo_id=%s', nombre_final, inmo_id)
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
        logger.info(
            '[excel_writer] buscar por nombre nombre=%r nombre_norm=%r candidatos=%s',
            nombre, nombre_norm, len(result.get('Items', [])),
        )
        for item in result.get('Items', []):
            if item.get('nombre', '').strip().lower() == nombre_norm:
                logger.info(
                    '[excel_writer] buscar por nombre match nombre=%r candidato=%r pk=%s',
                    nombre, item.get('nombre', ''), item.get('pk'),
                )
                return item['pk'].replace('INMOBILIARIA#', '')
        logger.info('[excel_writer] buscar por nombre sin match nombre=%r', nombre)
    except Exception as e:
        logger.warning('[excel_writer] buscar por nombre error type=%s message=%s', type(e).__name__, e)
    return None


def _escribir_unidad(proyecto_id, id_unidad, fila, inmo_id, ahora):
    unidad_id = str(uuid.uuid4())[:8].upper()
    proyecto_id_unidad = f"{proyecto_id}#{_normalizar_id_unidad(id_unidad)}"

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
        'proyecto_id_unidad': proyecto_id_unidad,
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

    # Manejar fecha_bloqueo y fecha_liberacion con reglas de 48 horas
    # SIEMPRE usar fecha actual para bloqueos (ignorar fechas del Excel)
    if fila.get('estado') == 'bloqueada':
        dt_bloqueo = datetime.fromisoformat(ahora.replace('Z', '+00:00'))
        item['fecha_bloqueo'] = ahora
        
        # Calcular fecha_liberacion: +48 horas desde ahora
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
                      'precio_inicial', 'cuota_monto', 'cuota_meses', 'contra_entrega'):
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
    cedula = _normalizar_cedula(cedula)
    nombres = _normalizar_nombre(nombres)
    apellidos = _normalizar_nombre(apellidos)
    correo = _normalizar_correo(fila.get('cliente_correo'))
    telefono = _normalizar_telefono(fila.get('cliente_telefono'))
    fecha_nacimiento = _parse_fecha_iso(fila.get('fecha_nacimiento'))
    edad = _calcular_edad(fecha_nacimiento)
    nacionalidad = _normalizar_texto_catalogo(fila.get('nacionalidad'))
    pais_residencia = _normalizar_texto_catalogo(fila.get('pais_residencia'))
    fecha_historica_dt = _parse_dt(fila.get('fecha_bloqueo')) or _parse_dt(ahora) or datetime.now(timezone.utc)
    fecha_captacion = fecha_historica_dt.isoformat()
    fecha_vencimiento_dt = _add_months(fecha_historica_dt, MESES_EXCLUSIVIDAD)
    fecha_vencimiento = fecha_vencimiento_dt.isoformat()
    exclusividad_activa = fecha_vencimiento_dt > datetime.now(timezone.utc)

    item_cliente = {
        'pk':                f'CLIENTE#{cedula}#{inmo_id}',
        'sk':                f'PROYECTO#{proyecto_id}',
        'cedula':            cedula,
        'inmobiliaria_id':   inmo_id,
        'proyecto_id':       proyecto_id,
        'nombres':           nombres,
        'apellidos':         apellidos,
        'correo':            correo,
        'telefono':          telefono,
        'estado_civil':      '',
        'nacionalidad':      nacionalidad,
        'pais_residencia':   pais_residencia,
        'fecha_nacimiento':  fecha_nacimiento,
        'edad':              edad,
        'exclusividad_activa': exclusividad_activa,
        'fecha_captacion':   fecha_captacion,
        'fecha_vencimiento': fecha_vencimiento,
        'creado_en':         ahora,
        'origen':            'migracion',
    }
    if fila.get('fecha_bloqueo'):
        item_cliente['fecha_bloqueo_historica'] = fecha_captacion

    clientes_t.put_item(Item=item_cliente)

    if exclusividad_activa:
        _crear_schedule_exclusividad(cedula, inmo_id, proyecto_id, fecha_vencimiento)

    estado_proceso = fila.get('estado_proceso')
    if estado_proceso:
        unidad_id = fila.get('_unidad_id', '')
        proceso_item = {
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
        }
        if fila.get('fecha_bloqueo'):
            proceso_item['fecha_bloqueo_historica'] = fila.get('fecha_bloqueo')
        procesos_t.put_item(Item=proceso_item)


def _escribir_historial(proyecto_id, fila, inmo_id, cedula, ahora):
    """
    Escribe historial de bloqueo aplicando reglas de 48 horas.
    Usa las fechas calculadas en _escribir_unidad para mantener consistencia.
    """
    unidad_id = fila.get('_unidad_id', '')
    id_unidad = fila['id_unidad']
    
    # Usar las fechas calculadas en _escribir_unidad
    ts_bloqueo = fila.get('_fecha_bloqueo_calculada', ahora)
    ts_liberacion = fila.get('_fecha_liberacion_calculada', '')
    
    historial_item = {
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
    }
    if fila.get('fecha_bloqueo'):
        historial_item['fecha_bloqueo_historica'] = fila.get('fecha_bloqueo')
    historial_t.put_item(Item=historial_item)


def _agregar_proyecto_a_inmo(inmo_id, proyecto_id):
    try:
        item      = usuarios_t.get_item(Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}).get('Item', {})
        proyectos = item.get('proyectos', [])
        logger.info(
            '[excel_writer] agregar proyecto inmo_id=%s proyecto_id=%s existe_item=%s proyectos_actuales=%s',
            inmo_id, proyecto_id, bool(item), proyectos,
        )
        if proyecto_id not in proyectos:
            proyectos.append(proyecto_id)
            usuarios_t.update_item(
                Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'},
                UpdateExpression='SET proyectos = :p',
                ExpressionAttributeValues={':p': proyectos},
            )
            logger.info('[excel_writer] proyecto agregado inmo_id=%s proyecto_id=%s', inmo_id, proyecto_id)
        else:
            logger.info('[excel_writer] proyecto ya asignado inmo_id=%s proyecto_id=%s', inmo_id, proyecto_id)
    except Exception as e:
        logger.warning('[excel_writer] agregar proyecto error inmo_id=%s type=%s message=%s', inmo_id, type(e).__name__, e)


def _schedule_name_exclusividad(cedula, inmobiliaria_id, proyecto_id):
    safe_cedula = cedula.replace('/', '-').replace('#', '-')
    safe_inmo = inmobiliaria_id.replace('/', '-').replace('#', '-').replace('INMOBILIARIA', 'I')
    safe_proy = proyecto_id.replace('/', '-').replace('#', '-').replace('PROYECTO', 'P')
    return f"exclusividad-{safe_cedula}-{safe_inmo}-{safe_proy}"


def _crear_schedule_exclusividad(cedula, inmobiliaria_id, proyecto_id, fecha_vencimiento):
    if not CAPTACION_LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        print('WARN _crear_schedule_exclusividad: CAPTACION_LAMBDA_ARN o SCHEDULER_ROLE_ARN no configurados')
        return

    try:
        ts_vencimiento = fecha_vencimiento[:19]
        schedule_name = _schedule_name_exclusividad(cedula, inmobiliaria_id, proyecto_id)
        try:
            scheduler.delete_schedule(Name=schedule_name)
        except Exception:
            pass
        scheduler.create_schedule(
            Name=schedule_name,
            ScheduleExpression=f"at({ts_vencimiento})",
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
        print(f'OK Schedule de exclusividad creado para {cedula} at {ts_vencimiento}')
    except Exception as e:
        print(f'ERROR _crear_schedule_exclusividad: {type(e).__name__}: {e}')


def _schedule_name(unidad_id, suffix):
    """EventBridge Scheduler no permite '/' ni '#' en nombres"""
    safe = unidad_id.replace('/', '-').replace('#', '-')
    return f"bloqueo-{safe}-{suffix}"


def _crear_schedules_bloqueo(fila, proyecto_id):
    """
    Crea schedules de EventBridge para liberación automática y alerta.
    Similar a bloqueos.py pero con duración de 48h.
    """
    if not LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        print(f'⚠ _crear_schedules_bloqueo: LAMBDA_ARN o SCHEDULER_ROLE_ARN no configurados')
        print(f'  LAMBDA_ARN: {LAMBDA_ARN}')
        print(f'  SCHEDULER_ROLE_ARN: {SCHEDULER_ROLE_ARN}')
        return
    
    unidad_id = fila.get('_unidad_id', '')
    if not unidad_id:
        print(f'⚠ _crear_schedules_bloqueo: unidad_id no encontrado en fila')
        return
    
    ts_liberacion = fila.get('_fecha_liberacion_calculada', '')
    ts_bloqueo = fila.get('_fecha_bloqueo_calculada', '')
    
    if not ts_liberacion or not ts_bloqueo:
        print(f'⚠ _crear_schedules_bloqueo: fechas no encontradas para {unidad_id}')
        print(f'  ts_bloqueo: {ts_bloqueo}')
        print(f'  ts_liberacion: {ts_liberacion}')
        return
    
    # Calcular timestamp de alerta (5 horas antes de liberación)
    try:
        dt_bloqueo = datetime.fromisoformat(ts_bloqueo.replace('Z', '+00:00'))
        dt_alerta = dt_bloqueo + timedelta(hours=HORAS_ALERTA_MIGRACION)
        ts_alerta = dt_alerta.isoformat()[:19]  # formato para EventBridge: YYYY-MM-DDTHH:MM:SS
    except Exception as e:
        print(f'✗ _crear_schedules_bloqueo: error calculando alerta para {unidad_id}: {type(e).__name__}: {e}')
        return
    
    ts_liberacion_eb = ts_liberacion[:19]  # formato para EventBridge
    
    payload_base = {'unidad_id': unidad_id, 'proyecto_id': proyecto_id}
    
    schedules_creados = 0
    for suffix, at_time, accion in [
        ('alerta', ts_alerta, 'alerta_vencimiento'),
        ('liberacion', ts_liberacion_eb, 'liberar_automatico'),
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
            print(f'✗ _crear_schedules_bloqueo error ({suffix}): {type(e).__name__}: {e}')
            print(f'  unidad_id: {unidad_id}')
            print(f'  schedule_name: {_schedule_name(unidad_id, suffix)}')
            print(f'  at_time: {at_time}')
    
    if schedules_creados == 2:
        print(f'✓ Ambos schedules creados exitosamente para unidad {unidad_id}')
    elif schedules_creados == 1:
        print(f'⚠ Solo 1 de 2 schedules creado para unidad {unidad_id}')
    else:
        print(f'✗ No se crearon schedules para unidad {unidad_id}')


def _enviar_notificacion_bloqueo(fila, proyecto_id, inmo_id, cedula, id_unidad):
    """
    Envía notificación SQS de bloqueo registrado.
    Similar a bloqueos.py.
    """
    if not SQS_URL:
        print(f'⚠ _enviar_notificacion_bloqueo: SQS_URL no configurado, omitiendo notificación')
        return
    
    unidad_id = fila.get('_unidad_id', '')
    ts_bloqueo = fila.get('_fecha_bloqueo_calculada', '')
    ts_liberacion = fila.get('_fecha_liberacion_calculada', '')
    
    if not unidad_id:
        print(f'⚠ _enviar_notificacion_bloqueo: unidad_id no encontrado')
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
        print(f'✓ Notificación SQS enviada para bloqueo de unidad {id_unidad}')
    except Exception as e:
        print(f'✗ _enviar_notificacion_bloqueo error: {type(e).__name__}: {e}')
        print(f'  unidad_id: {unidad_id}')
        print(f'  SQS_URL: {SQS_URL}')
