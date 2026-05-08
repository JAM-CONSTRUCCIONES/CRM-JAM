"""Parsea un archivo Excel de S3 y genera el JSON de preview."""
import json
import boto3
import os
import tempfile
from boto3.dynamodb.conditions import Key
from utils.helpers import now
from utils.excel_helpers import col_idx, parse_decimal, parse_int, parse_fecha, extraer_torre
from utils.excel_bedrock import llamar_bedrock

s3_client  = boto3.client('s3')
dynamodb   = boto3.resource('dynamodb')
usuarios_t = dynamodb.Table(os.environ['USUARIOS_TABLE'])

ARCHIVOS_BUCKET = os.environ.get('ARCHIVOS_BUCKET', '')

ESTATUS_MAP = {
    'DISPONIBLE':       ('disponible',    None),
    'BLOQUEADO':        ('bloqueada',     'captacion'),
    'NO DISPONIBLE':    ('no_disponible', 'reserva'),
    'SEPARACIÓN':       ('no_disponible', 'separacion'),
    'SEPARACION':       ('no_disponible', 'separacion'),
    'CONTRATO FIRMADO': ('no_disponible', 'inicial'),
}


def parsear_excel(bucket, key, proyecto_id, job_id):
    """Descarga el Excel, parsea con openpyxl, llama a Bedrock y guarda preview en S3."""
    import openpyxl

    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        s3_client.download_fileobj(bucket, key, tmp)
        tmp_path = tmp.name

    wb   = openpyxl.load_workbook(tmp_path, data_only=True)
    ws   = wb.active
    rows = list(ws.iter_rows(values_only=True))

    # Detectar fila de headers (primera con ≥4 celdas no nulas)
    header_row_idx = None
    for i, row in enumerate(rows):
        if len([c for c in row if c is not None]) >= 4:
            header_row_idx = i
            break

    if header_row_idx is None:
        return {'error': 'No se encontró fila de encabezados válida'}

    headers   = [str(c).strip() if c else '' for c in rows[header_row_idx]]
    data_rows = rows[header_row_idx + 1:]

    # Obtener inmobiliarias existentes para matching
    inmos_result = usuarios_t.query(
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('INMOBILIARIA'),
    )
    inmobiliarias_existentes = [
        {'id': i['pk'].replace('INMOBILIARIA#', ''), 'nombre': i.get('nombre', '')}
        for i in inmos_result.get('Items', [])
    ]

    # Extraer valores únicos para Bedrock
    c_nombre = col_idx(headers, ['NOMBRE CLIENTE', 'NOMBRE', 'CLIENTE'])
    c_inmo   = col_idx(headers, ['INMOBILIARIA', 'INMO', 'AGENCIA'])

    nombres_excel = list({
        str(r[c_nombre]).strip()
        for r in data_rows
        if r and c_nombre is not None and c_nombre < len(r) and r[c_nombre]
    })
    inmos_excel = list({
        str(r[c_inmo]).strip()
        for r in data_rows
        if r and c_inmo is not None and c_inmo < len(r) and r[c_inmo]
    })

    ia          = llamar_bedrock(headers, nombres_excel, inmos_excel, inmobiliarias_existentes)
    col_map     = ia.get('column_map', {})
    nombres_map = ia.get('nombres_map', {})
    inmos_map   = ia.get('inmos_map', {})

    filas              = []
    id_unidades_vistos = set()

    for i, row in enumerate(data_rows):
        if not row or all(c is None for c in row):
            continue

        def gc(keys):
            idx = col_idx(headers, keys, col_map)
            return row[idx] if idx is not None and idx < len(row) else None

        id_unidad_raw = gc(['unidad', 'id_unidad', 'UNIDAD'])
        if not id_unidad_raw:
            continue
        id_unidad = str(id_unidad_raw).strip()

        metraje      = parse_decimal(gc(['Area', 'AREA', 'metraje', 'M2']), metraje=True)
        precio       = parse_decimal(gc(['Precios US$', 'precio', 'PRECIO', 'PRECIO VENTA', 'Precios US']))
        estatus_raw  = gc(['ESTATUS', 'ESTADO', 'STATUS', 'estado'])
        estatus_norm = str(estatus_raw).strip().upper() if estatus_raw else 'DISPONIBLE'
        estado_interno, estado_proceso = ESTATUS_MAP.get(estatus_norm, ('disponible', None))

        nombre_cliente = str(gc(['NOMBRE CLIENTE', 'NOMBRE', 'CLIENTE']) or '').strip()
        nombres_ia     = nombres_map.get(nombre_cliente, {})

        inmo_excel           = str(gc(['INMOBILIARIA', 'INMO', 'AGENCIA']) or '').strip()
        inmo_match           = inmos_map.get(inmo_excel, {})
        inmo_id_sugerido     = inmo_match.get('id', '')
        inmo_confianza       = inmo_match.get('confianza', 0)
        inmo_es_nueva        = inmo_match.get('es_nueva', not bool(inmo_id_sugerido))

        errores, advertencias = _validar_fila(
            id_unidad, id_unidades_vistos, precio, metraje, estatus_norm, estatus_raw,
            inmo_excel, inmo_confianza, inmo_es_nueva,
        )
        id_unidades_vistos.add(id_unidad)

        filas.append({
            'fila_excel':                   header_row_idx + 2 + i,
            'id_unidad':                    id_unidad,
            'metraje':                      str(metraje) if metraje is not None else None,
            'precio':                       str(precio)  if precio  is not None else None,
            'num_cuartos':                  parse_int(gc(['No Cuartos', 'CUARTOS', 'HABITACIONES'])),
            'num_banos':                    parse_int(gc(['No. baños', 'BAÑOS', 'BANOS'])),
            'tipo':                         str(gc(['Tipo', 'TIPO']) or '').strip() or None,
            'piso':                         parse_int(gc(['Piso', 'PISO'])),
            'parqueos':                     parse_int(gc(['Parqueos', 'PARQUEOS', 'PARKING'])),
            'estado':                       estado_interno,
            'estado_proceso':               estado_proceso,
            'cliente_nombre_excel':         nombre_cliente or None,
            'nombres_sugerido':             nombres_ia.get('nombres') or None,
            'apellidos_sugerido':           nombres_ia.get('apellidos') or None,
            'cedula':                       None,
            'inmobiliaria_excel':           inmo_excel or None,
            'inmobiliaria_id_sugerido':     inmo_id_sugerido or None,
            'inmobiliaria_nombre_sugerido': inmo_match.get('nombre', inmo_excel) or None,
            'inmobiliaria_confianza':       inmo_confianza,
            'inmobiliaria_es_nueva':        inmo_es_nueva,
            'fecha_bloqueo':                parse_fecha(gc(['FECHA BLOQUEO', 'FECHA_BLOQUEO', 'FECHA INICIO'])),
            'fecha_liberacion':             parse_fecha(gc(['FECHA FIN BLOQUEO/ PAGO SEPARACION', 'FECHA FIN', 'FECHA_FIN'])),
            'comentario':                   str(gc(['COMENTARIO', 'OBSERVACION', 'NOTAS']) or '').strip() or None,
            'errores':                      errores,
            'advertencias':                 advertencias,
            'ia_sugerido':                  bool(nombres_ia.get('nombres') or inmo_id_sugerido),
        })

    preview = {
        'job_id':      job_id,
        'proyecto_id': proyecto_id,
        'archivo':     key.split('/')[-1],
        'total_filas': len(filas),
        'filas':       filas,
        'creado_en':   now(),
    }

    s3_client.put_object(
        Bucket=ARCHIVOS_BUCKET,
        Key=f'inventario/previews/{job_id}.json',
        Body=json.dumps(preview, ensure_ascii=False, default=str),
        ContentType='application/json',
    )
    return preview


def _validar_fila(id_unidad, vistos, precio, metraje, estatus_norm, estatus_raw,
                  inmo_excel, inmo_confianza, inmo_es_nueva):
    errores, advertencias = [], []
    if not id_unidad:
        errores.append('id_unidad vacío')
    if id_unidad in vistos:
        errores.append(f'id_unidad duplicado: {id_unidad}')
    if precio is None:
        errores.append('precio inválido o vacío')
    if metraje is None:
        errores.append('metraje inválido o vacío')
    if estatus_norm not in ESTATUS_MAP:
        errores.append(f'estado desconocido: {estatus_raw}')
    if inmo_excel and inmo_confianza < 80 and not inmo_es_nueva:
        advertencias.append(f'Inmobiliaria con baja confianza ({inmo_confianza}%)')
    return errores, advertencias
