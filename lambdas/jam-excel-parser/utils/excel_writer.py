"""Escribe el inventario migrado en DynamoDB."""
import uuid
import boto3
import os
from decimal import Decimal, InvalidOperation
from utils.helpers import now
from utils.excel_helpers import extraer_torre

dynamodb    = boto3.resource('dynamodb')
inventario_t = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
usuarios_t   = dynamodb.Table(os.environ['USUARIOS_TABLE'])
clientes_t   = dynamodb.Table(os.environ['CLIENTES_TABLE'])
procesos_t   = dynamodb.Table(os.environ['PROCESOS_TABLE'])
historial_t  = dynamodb.Table(os.environ['HISTORIAL_TABLE'])


def escribir_migracion(proyecto_id, filas):
    """
    Escribe torres, unidades, inmobiliarias, clientes, procesos e historial.
    Retorna dict de stats.
    SIN schedules de EventBridge — datos históricos.
    """
    torres_cache = {}   # nombre_torre → torre_id
    inmos_cache  = {}   # nombre_excel → inmobiliaria_id
    ahora        = now()

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

        torre_id = _resolver_torre(proyecto_id, id_unidad, fila, torres_cache, ahora)
        torre_nombre = extraer_torre(id_unidad)

        inmo_id = _resolver_inmobiliaria(proyecto_id, fila, inmos_cache, stats, ahora, fila_num, id_unidad)

        _escribir_unidad(proyecto_id, id_unidad, fila, torre_id, inmo_id, ahora)

        cedula    = (fila.get('cedula') or '').strip()
        nombres   = (fila.get('nombres_sugerido')   or '').strip()
        apellidos = (fila.get('apellidos_sugerido') or '').strip()

        if cedula and nombres and inmo_id:
            _escribir_cliente_proceso(
                proyecto_id, id_unidad, fila, cedula, nombres, apellidos,
                inmo_id, torre_nombre, ahora,
            )
            stats['clientes_creados'] += 1
        elif fila.get('cliente_nombre_excel'):
            stats['advertencias'] += 1
            stats['detalle'].append({
                'fila': fila_num, 'id_unidad': id_unidad, 'tipo': 'advertencia',
                'motivo': 'Cédula no ingresada, unidad cargada sin cliente',
            })

        if fila.get('estado') == 'bloqueada' and inmo_id:
            _escribir_historial(proyecto_id, fila, torre_id, torre_nombre, inmo_id, cedula, ahora)

        stats['unidades_cargadas'] += 1

    return stats


# ─── Helpers internos ────────────────────────────────────────────────────────

def _resolver_torre(proyecto_id, id_unidad, fila, cache, ahora):
    nombre = extraer_torre(id_unidad)
    if nombre not in cache:
        torre_id = str(uuid.uuid4())[:8].upper()
        inventario_t.put_item(Item={
            'pk':        f'PROYECTO#{proyecto_id}',
            'sk':        f'TORRE#{torre_id}',
            'torre_id':  torre_id,
            'nombre':    nombre,
            'etapa_id':  fila.get('etapa_id') or '',
            'orden':     len(cache) + 1,
            'activo':    True,
            'creado_en': ahora,
        })
        cache[nombre] = torre_id
    return cache[nombre]


def _resolver_inmobiliaria(proyecto_id, fila, cache, stats, ahora, fila_num, id_unidad):
    inmo_excel = fila.get('inmobiliaria_excel') or ''
    if not inmo_excel:
        return None

    if inmo_excel in cache:
        return cache[inmo_excel]

    if fila.get('inmobiliaria_id_sugerido'):
        inmo_id = fila['inmobiliaria_id_sugerido']
        _agregar_proyecto_a_inmo(inmo_id, proyecto_id)
        cache[inmo_excel] = inmo_id
        return inmo_id

    # Crear nueva — patrón igual que inmobiliarias.py
    inmo_id = str(uuid.uuid4())[:8].upper()
    usuarios_t.put_item(Item={
        'pk':        f'INMOBILIARIA#{inmo_id}',
        'sk':        'METADATA',
        'tipo':      'INMOBILIARIA',
        'nombre':    fila.get('inmobiliaria_nombre_sugerido') or inmo_excel,
        'activo':    True,
        'proyectos': [proyecto_id],
        'correos':   [],
        'origen':    'migracion',
        'creado_en': ahora,
    })
    cache[inmo_excel] = inmo_id
    stats['inmobiliarias_creadas'] += 1
    stats['detalle'].append({
        'fila': fila_num, 'id_unidad': id_unidad, 'tipo': 'info',
        'motivo': f"Inmobiliaria '{inmo_excel}' creada (origen: migracion)",
    })
    return inmo_id


def _escribir_unidad(proyecto_id, id_unidad, fila, torre_id, inmo_id, ahora):
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
        'torre_id':       torre_id,
        'etapa_id':       fila.get('etapa_id') or '',
        'metraje':        metraje_dec,
        'precio':         precio_dec,
        'estado':         fila.get('estado', 'disponible'),
        'creado_en':      ahora,
        'actualizado_en': ahora,
    }

    for campo in ('tipo', 'piso', 'comentario', 'fecha_bloqueo',
                  'fecha_liberacion', 'cliente_nombre_excel'):
        if fila.get(campo) is not None:
            item[campo] = fila[campo]

    for campo_num in ('num_cuartos', 'num_banos', 'parqueos'):
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
    # Devolver unidad_id para usarlo en proceso e historial
    fila['_unidad_id'] = unidad_id


def _escribir_cliente_proceso(proyecto_id, id_unidad, fila, cedula, nombres, apellidos,
                               inmo_id, torre_nombre, ahora):
    # Cliente — pk sin prefijo INMOBILIARIA# igual que jam-captacion
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
        unidad_id    = fila.get('_unidad_id', '')
        unidad_nombre = f'{torre_nombre} · {id_unidad}'  # igual que jam-bloqueos
        procesos_t.put_item(Item={
            'pk':             f'PROCESO#{cedula}#{inmo_id}',
            'sk':             f'UNIDAD#{unidad_id}',
            'cedula':         cedula,
            'inmobiliaria_id': inmo_id,
            'proyecto_id':    proyecto_id,
            'unidad_id':      unidad_id,
            'unidad_nombre':  unidad_nombre,
            'estado':         estado_proceso,
            'historial':      [],
            'fecha_inicio':   fila.get('fecha_bloqueo') or ahora,
            'actualizado_en': ahora,
            'origen':         'migracion',
        })


def _escribir_historial(proyecto_id, fila, torre_id, torre_nombre, inmo_id, cedula, ahora):
    unidad_id  = fila.get('_unidad_id', '')
    id_unidad  = fila['id_unidad']
    historial_t.put_item(Item={
        'pk':                f'UNIDAD#{unidad_id}',
        'sk':                f'BLOQUEO#{fila.get("fecha_bloqueo") or ahora}',
        'proyecto_id':       proyecto_id,
        'unidad_id':         unidad_id,
        'unidad_nombre':     f'{torre_nombre} · {id_unidad}',
        'torre_id':          torre_id,
        'torre_nombre':      torre_nombre,
        'inmobiliaria_id':   inmo_id,
        'inmobiliaria_nombre': fila.get('inmobiliaria_nombre_sugerido') or '',
        'fecha_bloqueo':     fila.get('fecha_bloqueo') or ahora,
        'fecha_liberacion':  fila.get('fecha_liberacion') or '',
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
