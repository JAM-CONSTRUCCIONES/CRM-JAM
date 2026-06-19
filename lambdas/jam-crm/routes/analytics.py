"""
GET /admin/analytics?proyecto_id=xxx
Agrega métricas de procesos, clientes y unidades para el dashboard.
"""
import os
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, bad_request
from utils.auth import get_claims, get_rol

dynamodb = boto3.resource('dynamodb')
procesos_table = dynamodb.Table(os.environ['PROCESOS_TABLE'])
clientes_table = dynamodb.Table(os.environ['CLIENTES_TABLE'])
inventario_table = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
_usuarios_table_name = os.environ.get('USUARIOS_TABLE', '')

ESTADOS_COMERCIALES = {'reserva', 'separacion', 'inicial', 'pagos_atrasados', 'contra_entrega', 'vendida'}
ESTADOS_VENTA = {'separacion', 'inicial', 'pagos_atrasados', 'contra_entrega', 'vendida'}


def _normalizar_inmo_id(value):
    return str(value or '').replace('INMOBILIARIA#', '').strip()


def _get_inmobiliaria_id_event(event):
    claims = get_claims(event)
    if claims.get('custom:inmobiliaria_id'):
        return _normalizar_inmo_id(claims.get('custom:inmobiliaria_id'))

    sub = claims.get('sub', '')
    if not sub:
        return ''
    try:
        usuarios_table = dynamodb.Table(_usuarios_table_name)
        usuario = usuarios_table.get_item(
            Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}
        ).get('Item', {})
        return _normalizar_inmo_id(usuario.get('inmobiliaria_id') or sub)
    except Exception:
        return _normalizar_inmo_id(sub)


def _filtrar_por_inmobiliaria(items, inmobiliaria_id):
    inmo_id = _normalizar_inmo_id(inmobiliaria_id)
    return [i for i in items if _normalizar_inmo_id(i.get('inmobiliaria_id')) == inmo_id]


def _calcular_unidad_stats_inmobiliaria(unidades, procesos, inmobiliaria_id):
    inmo_id = _normalizar_inmo_id(inmobiliaria_id)
    bloqueadas = set()
    no_disponibles = set()
    desvinculadas = set()

    for unidad in unidades:
        if unidad.get('estado') == 'bloqueada' and _normalizar_inmo_id(unidad.get('bloqueado_por')) == inmo_id:
            uid = unidad.get('unidad_id') or unidad.get('sk', '').replace('UNIDAD#', '')
            if uid:
                bloqueadas.add(uid)

    for proceso in procesos:
        uid = proceso.get('unidad_id')
        if not uid:
            continue
        estado = proceso.get('estado', 'captacion')
        if estado in ESTADOS_COMERCIALES:
            no_disponibles.add(uid)
        elif estado == 'desvinculado':
            desvinculadas.add(uid)

    return {
        'disponible': 0,
        'bloqueada': len(bloqueadas),
        'no_disponible': len(no_disponibles),
        'vendida': 0,
        'desvinculada': len(desvinculadas),
        'total': len(bloqueadas) + len(no_disponibles) + len(desvinculadas),
    }


def _parse_dt(ts: str):
    try:
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _diff_hours(t1, t2):
    if t1 and t2:
        return abs((t2 - t1).total_seconds()) / 3600
    return None


def _calcular_edad(fecha_nacimiento: str):
    try:
        nacimiento = datetime.fromisoformat(fecha_nacimiento[:10]).date()
        hoy = datetime.now(timezone.utc).date()
        return hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day))
    except Exception:
        return None


def get_analytics(event):
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')
    if not proyecto_id:
        return bad_request('proyecto_id es requerido')

    es_inmobiliaria = get_rol(event) == 'inmobiliaria'
    inmobiliaria_id = _get_inmobiliaria_id_event(event) if es_inmobiliaria else ''

    # ── 1. Cargar todos los procesos del proyecto ──────────────────────────
    procesos = _scan_all(
        procesos_table,
        index='gsi-proyecto-procesos',
        key_cond=Key('proyecto_id').eq(proyecto_id),
    )

    # ── 2. Cargar todos los clientes del proyecto ──────────────────────────
    clientes = _scan_all(
        clientes_table,
        index='gsi-proyecto-clientes',
        key_cond=Key('proyecto_id').eq(proyecto_id),
    )

    # ── 3. Cargar todas las unidades del proyecto ──────────────────────────
    unidades = _query_all(
        inventario_table,
        key_cond=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
    )

    if es_inmobiliaria:
        procesos = _filtrar_por_inmobiliaria(procesos, inmobiliaria_id)
        clientes = _filtrar_por_inmobiliaria(clientes, inmobiliaria_id)

    # ── Métricas de unidades ───────────────────────────────────────────────
    unidad_stats = {'disponible': 0, 'bloqueada': 0, 'no_disponible': 0, 'vendida': 0, 'desvinculada': 0, 'total': 0}
    # Índice unidad_id → datos de unidad (para cruzar con procesos)
    unidad_map: dict = {}
    for u in unidades:
        estado = u.get('estado', 'disponible')
        unidad_stats['total'] += 1
        if estado in unidad_stats:
            unidad_stats[estado] += 1
        uid = u.get('unidad_id') or u.get('sk', '').replace('UNIDAD#', '')
        if uid:
            unidad_map[uid] = {
                'piso': str(u.get('piso', '')).strip() if u.get('piso') is not None else '',
                'metraje': u.get('metraje'),
            }

    if es_inmobiliaria:
        unidad_stats = _calcular_unidad_stats_inmobiliaria(unidades, procesos, inmobiliaria_id)

    # ── Métricas de clientes ───────────────────────────────────────────────
    cliente_stats = {'total': len(clientes), 'exclusividad_activa': 0, 'exclusividad_vencida': 0}
    demograficos = {'edades': [], 'sin_edad': 0, 'estado_civil': {}, 'pais_residencia': {}, 'nacionalidad': {}}

    for c in clientes:
        if c.get('exclusividad_activa'):
            cliente_stats['exclusividad_activa'] += 1
        else:
            cliente_stats['exclusividad_vencida'] += 1

        edad = _calcular_edad(c.get('fecha_nacimiento') or '')
        if edad is None and c.get('edad') not in (None, ''):
            try:
                edad = int(c['edad'])
            except (ValueError, TypeError):
                edad = None
        if edad is not None and edad > 0:
            demograficos['edades'].append(edad)
        else:
            demograficos['sin_edad'] += 1
        for campo in ('estado_civil', 'pais_residencia', 'nacionalidad'):
            val = (c.get(campo) or '').strip()
            if val:
                demograficos[campo][val] = demograficos[campo].get(val, 0) + 1

    # Rangos de edad
    rangos_edad = {'<25': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Sin edad': demograficos['sin_edad']}
    for edad in demograficos['edades']:
        if edad < 25:
            rangos_edad['<25'] += 1
        elif edad < 35:
            rangos_edad['25-34'] += 1
        elif edad < 45:
            rangos_edad['35-44'] += 1
        elif edad < 55:
            rangos_edad['45-54'] += 1
        else:
            rangos_edad['55+'] += 1

    # ── Métricas de procesos ───────────────────────────────────────────────
    proceso_stats = {
        'captacion': 0, 'reserva': 0, 'separacion': 0,
        'inicial': 0, 'pagos_atrasados': 0, 'contra_entrega': 0,
        'vendida': 0, 'desvinculado': 0, 'total': len(procesos),
    }
    # Por inmobiliaria: captados, reservas, separaciones, desvinculados
    por_inmo: dict = {}
    # Cierres mensuales (reserva + separacion)
    cierres_mensuales: dict = {}
    # Velocidad: tiempos captacion→reserva, reserva→separacion
    tiempos_cap_res: list = []
    tiempos_res_sep: list = []
    # Unidades más demandadas (cuántos procesos tiene cada unidad)
    demanda_unidades: dict = {}
    # Ventas por piso, metraje e inmobiliaria.
    ventas_por_piso: dict = {}
    ventas_por_metraje: dict = {}
    ventas_por_inmo: dict = {}
    unidades_vendidas: set = set()

    for p in procesos:
        estado = p.get('estado', 'captacion')
        if estado in proceso_stats:
            proceso_stats[estado] += 1

        inmo_id = p.get('inmobiliaria_id', '')
        if inmo_id not in por_inmo:
            por_inmo[inmo_id] = {'captados': 0, 'reservas': 0, 'separaciones': 0, 'desvinculados': 0}
        por_inmo[inmo_id]['captados'] += 1
        if estado in ('reserva', 'separacion', 'inicial', 'pagos_atrasados', 'contra_entrega', 'vendida'):
            por_inmo[inmo_id]['reservas'] += 1
        if estado in ESTADOS_VENTA:
            por_inmo[inmo_id]['separaciones'] += 1
        if estado == 'desvinculado':
            por_inmo[inmo_id]['desvinculados'] += 1

        # Demanda por unidad
        uid = p.get('unidad_id', '')
        unidad_nombre = p.get('unidad_nombre') or uid
        if uid:
            if uid not in demanda_unidades:
                demanda_unidades[uid] = {'unidad_id': uid, 'nombre': unidad_nombre, 'procesos': 0, 'vendida': False}
            demanda_unidades[uid]['procesos'] += 1
            if estado in ESTADOS_VENTA:
                demanda_unidades[uid]['vendida'] = True

        # Contar una sola vez cada unidad en estados comerciales no disponibles.
        if estado in ESTADOS_VENTA and uid and uid not in unidades_vendidas and uid in unidad_map:
            unidades_vendidas.add(uid)
            info = unidad_map[uid]
            piso = info['piso']
            if piso:
                ventas_por_piso[piso] = ventas_por_piso.get(piso, 0) + 1
            metraje = info['metraje']
            if metraje is not None:
                try:
                    m_key = str(float(metraje))
                    ventas_por_metraje[m_key] = ventas_por_metraje.get(m_key, 0) + 1
                except (ValueError, TypeError):
                    pass
            ventas_por_inmo[inmo_id] = ventas_por_inmo.get(inmo_id, 0) + 1

        # Cierres mensuales y velocidad desde historial
        historial = p.get('historial', [])
        ts_captacion = _parse_dt(p.get('fecha_inicio', ''))
        ts_reserva = None
        ts_separacion = None

        for entrada in historial:
            nuevo = entrada.get('estatus_nuevo', '')
            ts = _parse_dt(entrada.get('timestamp', ''))

            # Cierres mensuales
            if nuevo in ('reserva', 'separacion') and ts:
                mes = ts.strftime('%Y-%m')
                if mes not in cierres_mensuales:
                    cierres_mensuales[mes] = {'reservas': 0, 'separaciones': 0}
                if nuevo == 'reserva':
                    cierres_mensuales[mes]['reservas'] += 1
                    ts_reserva = ts
                elif nuevo == 'separacion':
                    cierres_mensuales[mes]['separaciones'] += 1
                    ts_separacion = ts

        # Velocidad
        h_cap_res = _diff_hours(ts_captacion, ts_reserva)
        if h_cap_res is not None:
            tiempos_cap_res.append(h_cap_res)
        h_res_sep = _diff_hours(ts_reserva, ts_separacion)
        if h_res_sep is not None:
            tiempos_res_sep.append(h_res_sep)

    # Promedios de velocidad
    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else None

    velocidad = {
        'captacion_a_reserva_horas': avg(tiempos_cap_res),
        'reserva_a_separacion_horas': avg(tiempos_res_sep),
    }

    # KPIs
    total_procesos = proceso_stats['total']
    kpis = {
        'pct_conversion': round(
            (proceso_stats['reserva'] + proceso_stats['separacion'] + proceso_stats['inicial']) / total_procesos * 100, 1
        ) if total_procesos > 0 else 0,
        'tasa_abandono': round(proceso_stats['desvinculado'] / total_procesos * 100, 1) if total_procesos > 0 else 0,
        'pct_bloqueos_a_venta': round(
            (proceso_stats['reserva'] + proceso_stats['separacion'] + proceso_stats['inicial']) /
            max(unidad_stats['bloqueada'] + proceso_stats['reserva'] + proceso_stats['separacion'] + proceso_stats['inicial'], 1) * 100, 1
        ),
    }

    # Cierres mensuales ordenados (últimos 6 meses)
    cierres_lista = sorted(
        [{'mes': k, **v} for k, v in cierres_mensuales.items()],
        key=lambda x: x['mes']
    )[-6:]

    # Unidades más demandadas (top 10)
    top_unidades = sorted(demanda_unidades.values(), key=lambda x: x['procesos'], reverse=True)[:10]

    # Conversión por inmobiliaria
    conversion_inmo = [
        {
            'inmobiliaria_id': inmo_id,
            'captados': d['captados'],
            'reservas': d['reservas'],
            'separaciones': ventas_por_inmo.get(inmo_id, 0),
            'desvinculados': d['desvinculados'],
            'pct_conversion': round(d['reservas'] / d['captados'] * 100, 1) if d['captados'] > 0 else 0,
        }
        for inmo_id, d in por_inmo.items()
    ]

    return ok({
        'unidad_stats': unidad_stats,
        'cliente_stats': cliente_stats,
        'proceso_stats': proceso_stats,
        'kpis': kpis,
        'velocidad': velocidad,
        'cierres_mensuales': cierres_lista,
        'top_unidades': top_unidades,
        'conversion_por_inmobiliaria': conversion_inmo,
        'demograficos': {
            'rangos_edad': rangos_edad,
            'estado_civil': demograficos['estado_civil'],
            'pais_residencia': demograficos['pais_residencia'],
            'nacionalidad': demograficos['nacionalidad'],
        },
        'ventas_por_piso': dict(sorted(ventas_por_piso.items(), key=lambda x: (x[0].isdigit(), x[0]))),
        'ventas_por_metraje': dict(sorted(ventas_por_metraje.items(), key=lambda x: float(x[0]))),
    })


def _scan_all(table, index: str, key_cond) -> list:
    """Pagina automáticamente un query por GSI."""
    items = []
    kwargs = {'IndexName': index, 'KeyConditionExpression': key_cond}
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get('Items', []))
        lek = resp.get('LastEvaluatedKey')
        if not lek:
            break
        kwargs['ExclusiveStartKey'] = lek
    return items


def _query_all(table, key_cond) -> list:
    """Pagina automaticamente un query por clave primaria."""
    items = []
    kwargs = {'KeyConditionExpression': key_cond}
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get('Items', []))
        lek = resp.get('LastEvaluatedKey')
        if not lek:
            break
        kwargs['ExclusiveStartKey'] = lek
    return items
