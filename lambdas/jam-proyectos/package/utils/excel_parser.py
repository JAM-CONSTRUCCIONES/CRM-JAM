"""Parsea un archivo Excel de S3 y genera el JSON de preview."""
import json
import boto3
import os
import tempfile
import logging
from boto3.dynamodb.conditions import Key
from utils.helpers import now
from utils.excel_helpers import col_idx, parse_decimal, parse_int, parse_fecha
from utils.excel_bedrock import llamar_bedrock

s3_client  = boto3.client('s3')
dynamodb   = boto3.resource('dynamodb')
usuarios_t = dynamodb.Table(os.environ['USUARIOS_TABLE'])
inventario_t = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
logger     = logging.getLogger()

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

    logger.info(
        '[excel_parser] inicio job_id=%s proyecto_id=%s bucket=%s key=%s usuarios_table=%s inventario_table=%s',
        job_id, proyecto_id, bucket, key, os.environ.get('USUARIOS_TABLE'), os.environ.get('INVENTARIO_TABLE'),
    )

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
    logger.info(
        '[excel_parser] workbook cargado job_id=%s sheet=%s total_rows=%s header_row=%s headers=%s data_rows=%s',
        job_id, ws.title, len(rows), header_row_idx + 1, headers, len(data_rows),
    )

    # Obtener inmobiliarias existentes para matching
    inmos_result = usuarios_t.query(
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('INMOBILIARIA'),
    )
    inmobiliarias_existentes = [
        {'id': i['pk'].replace('INMOBILIARIA#', ''), 'nombre': i.get('nombre', '')}
        for i in inmos_result.get('Items', [])
    ]
    logger.info(
        '[excel_parser] inmobiliarias sistema job_id=%s count=%s scanned=%s nombres=%s',
        job_id,
        len(inmobiliarias_existentes),
        inmos_result.get('ScannedCount'),
        [i.get('nombre', '') for i in inmobiliarias_existentes[:50]],
    )

    # Extraer valores únicos para Bedrock
    c_nombre = col_idx(headers, ['NOMBRE CLIENTE', 'NOMBRE', 'CLIENTE'])
    c_inmo   = col_idx(headers, ['INMOBILIARIA', 'INMO', 'AGENCIA'])
    logger.info(
        '[excel_parser] columnas detectadas job_id=%s c_nombre=%s c_inmo=%s',
        job_id, c_nombre, c_inmo,
    )

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
    logger.info(
        '[excel_parser] valores excel job_id=%s nombres_count=%s inmos_count=%s inmos_excel=%s',
        job_id, len(nombres_excel), len(inmos_excel), inmos_excel[:50],
    )

    ia          = llamar_bedrock(headers, nombres_excel, inmos_excel, inmobiliarias_existentes)
    col_map     = ia.get('column_map', {})
    nombres_map = ia.get('nombres_map', {})
    inmos_map   = ia.get('inmos_map', {})
    logger.info(
        '[excel_parser] respuesta ia job_id=%s column_map_keys=%s nombres_map_count=%s inmos_map_count=%s inmos_map=%s',
        job_id, list(col_map.keys()), len(nombres_map), len(inmos_map), inmos_map,
    )

    filas              = []
    id_unidades_vistos = set()
    id_unidades_existentes = _obtener_ids_unidades_existentes(proyecto_id)

    for i, row in enumerate(data_rows):
        if not row or all(c is None for c in row):
            continue

        def gc(keys):
            idx = col_idx(headers, keys, col_map)
            return row[idx] if idx is not None and idx < len(row) else None

        id_unidad_raw = gc(['unidad', 'id_unidad', 'UNIDAD', 'ID Unidad', 'ID UNIDAD'])
        if not id_unidad_raw:
            continue
        id_unidad = str(id_unidad_raw).strip()

        # Si el Excel tiene torre/edificio en columna separada, combinar con la unidad
        # Ej: Torre="A", Unidad="101" → id_unidad="A-101"
        torre_raw = gc(['Torre', 'TORRE', 'Edificio', 'EDIFICIO', 'Bloque', 'BLOQUE'])
        if torre_raw:
            torre_str = str(torre_raw).strip().upper().replace('TORRE', '').replace('EDIFICIO', '').replace('BLOQUE', '').strip()
            if torre_str and not id_unidad.upper().startswith(torre_str):
                id_unidad = f'{torre_str}-{id_unidad}'

        metraje      = parse_decimal(gc(['Area', 'AREA', 'Metraje', 'METRAJE', 'metraje', 'M2',
                                         'Área', 'Area Total', 'Área Total', 'Area Construida',
                                         'Area Util', 'Área Útil', 'M2 Construidos', 'Sup. Construida',
                                         'Metros', 'Metros Cuadrados']), metraje=True)
        precio       = parse_decimal(gc(['Precios US$', 'precio', 'PRECIO', 'PRECIO VENTA', 'Precios US', 'Precio']))
        estatus_raw  = gc(['ESTATUS', 'ESTADO', 'STATUS', 'estado', 'Estado'])
        estatus_norm = str(estatus_raw).strip().upper() if estatus_raw else 'DISPONIBLE'
        estado_interno, estado_proceso = ESTATUS_MAP.get(estatus_norm, ('disponible', None))

        nombre_cliente = str(gc(['NOMBRE CLIENTE', 'Cliente Nombre', 'NOMBRE', 'CLIENTE']) or '').strip()
        nombres_ia     = nombres_map.get(nombre_cliente, {})

        # Fallback: si la IA no separó, intentar separación simple por palabras
        nombres_final   = nombres_ia.get('nombres') or ''
        apellidos_final = nombres_ia.get('apellidos') or ''
        if nombre_cliente and not nombres_final:
            partes = nombre_cliente.split()
            if len(partes) >= 4:
                nombres_final   = ' '.join(partes[:2])
                apellidos_final = ' '.join(partes[2:])
            elif len(partes) == 3:
                nombres_final   = partes[0]
                apellidos_final = ' '.join(partes[1:])
            elif len(partes) == 2:
                nombres_final   = partes[0]
                apellidos_final = partes[1]
            else:
                nombres_final   = nombre_cliente

        cedula_raw           = str(gc(['Cliente Cédula', 'Cliente Cedula', 'CLIENTE CEDULA',
                                       'Cédula', 'Cedula', 'CEDULA', 'CC', 'DNI',
                                       'Identificacion', 'Identificación', 'No. Cedula',
                                       'Num Cedula', 'No Identificacion']) or '').strip()
        cedula_excel         = cedula_raw or None

        telefono_excel       = str(gc(['Cliente Teléfono', 'Cliente Telefono', 'CLIENTE TELEFONO',
                                       'Teléfono', 'Telefono', 'TELEFONO', 'Celular', 'CELULAR',
                                       'Cel', 'Móvil', 'Movil', 'Tel', 'Whatsapp', 'Contacto']) or '').strip() or None

        correo_excel         = str(gc(['Cliente Correo', 'CLIENTE CORREO', 'Correo', 'CORREO',
                                       'Email', 'EMAIL', 'Correo Electronico', 'Correo Electrónico',
                                       'E-mail', 'Mail']) or '').strip() or None

        inmo_excel           = str(gc(['INMOBILIARIA', 'Inmobiliaria', 'INMO', 'AGENCIA']) or '').strip()
        inmo_match           = inmos_map.get(inmo_excel, {})
        inmo_id_sugerido     = inmo_match.get('id', '')
        inmo_confianza       = inmo_match.get('confianza', 0)
        inmo_es_nueva        = inmo_match.get('es_nueva', not bool(inmo_id_sugerido))
        if inmo_excel:
            logger.info(
                '[excel_parser] match fila job_id=%s fila=%s unidad=%s inmo_excel=%r match=%s id_sugerido=%r confianza=%s es_nueva=%s',
                job_id, header_row_idx + 2 + i, id_unidad, inmo_excel, inmo_match,
                inmo_id_sugerido, inmo_confianza, inmo_es_nueva,
            )

        errores, advertencias = _validar_fila(
            id_unidad, id_unidades_vistos, precio, metraje, estatus_norm, estatus_raw,
            inmo_excel, inmo_confianza, inmo_es_nueva, id_unidades_existentes,
            nombre_cliente, nombres_final, apellidos_final, cedula_excel,
        )
        id_unidades_vistos.add(id_unidad)

        def _dec(keys):
            v = parse_decimal(gc(keys))
            return str(v) if v is not None else None

        filas.append({
            'fila_excel':                   header_row_idx + 2 + i,
            'id_unidad':                    id_unidad,
            'metraje':                      str(metraje) if metraje is not None else None,
            'precio':                       str(precio)  if precio  is not None else None,
            'num_cuartos':                  parse_int(gc(['No Cuartos', 'Cuartos', 'CUARTOS', 'HABITACIONES'])),
            'num_banos':                    parse_int(gc(['No. baños', 'Baños', 'BAÑOS', 'BANOS'])),
            'tipo':                         str(gc(['Tipo', 'TIPO']) or '').strip() or None,
            'piso':                         parse_int(gc(['Piso', 'PISO'])),
            'parqueos':                     parse_int(gc(['Parqueos', 'PARQUEOS', 'PARKING'])),
            'estado':                       estado_interno,
            'estado_proceso':               estado_proceso,
            'cliente_nombre_excel':         nombre_cliente or None,
            'cliente_telefono':             telefono_excel,
            'cliente_correo':               correo_excel,
            'nombres_sugerido':             nombres_final or None,
            'apellidos_sugerido':           apellidos_final or None,
            'cedula':                       cedula_excel,
            'inmobiliaria_excel':           inmo_excel or None,
            'inmobiliaria_id_sugerido':     inmo_id_sugerido or None,
            'inmobiliaria_nombre_sugerido': inmo_match.get('nombre', inmo_excel) or None,
            'inmobiliaria_confianza':       inmo_confianza,
            'inmobiliaria_es_nueva':        inmo_es_nueva,
            'fecha_bloqueo':                parse_fecha(gc(['FECHA BLOQUEO', 'Fecha Bloqueo', 'FECHA_BLOQUEO', 'FECHA INICIO'])),
            'fecha_liberacion':             parse_fecha(gc(['FECHA FIN BLOQUEO/ PAGO SEPARACION',
                                                            'Fecha Liberación', 'FECHA LIBERACION',
                                                            'FECHA LIBERACIÓN', 'FECHA FIN', 'FECHA_FIN'])),
            'comentario':                   str(gc(['COMENTARIO', 'Comentario', 'OBSERVACION', 'NOTAS']) or '').strip() or None,
            'manzana':                      str(gc(['Manzana', 'MANZANA', 'MZ']) or '').strip() or None,
            'metraje_terraza':              _dec(['Metraje Terraza', 'METRAJE TERRAZA', 'TERRAZA',
                                                  'M2 TERRAZA', 'Area Terraza', 'Área Terraza',
                                                  'Metros Terraza', 'M2 Balcon', 'Balcon', 'Balcón',
                                                  'Sup. Terraza']),
            'metraje_patio':                _dec(['Metraje Patio', 'METRAJE PATIO', 'PATIO',
                                                  'M2 PATIO', 'Area Patio', 'Área Patio',
                                                  'Metros Patio', 'Jardín', 'Jardin',
                                                  'Sup. Patio', 'M2 Jardin']),
            'precio_reserva':               _dec(['Precio Reserva', 'PRECIO RESERVA', 'RESERVA']),
            'precio_separacion':            _dec(['Precio Separación', 'Precio Separacion',
                                                  'PRECIO SEPARACIÓN', 'PRECIO SEPARACION', 'SEPARACION']),
            'precio_inicial':               _dec(['Precio Inicial', 'PRECIO INICIAL', 'INICIAL']),
            'cuota_monto':                  _dec(['Cuota Monto', 'CUOTA MONTO', 'CUOTAS 24', 'CUOTA']),
            'cuota_meses':                  parse_int(gc(['Cuota Meses', 'CUOTA MESES', 'Meses',
                                                          'Plazo', 'PLAZO', 'Cuotas', 'N Cuotas',
                                                          'Num Cuotas', 'Meses Plazo'])),
            'contra_entrega':               _dec(['Contra Entrega', 'CONTRA ENTREGA', 'CONTRAENTREGA']),
            'errores':                      errores,
            'advertencias':                 advertencias,
            'ia_sugerido':                  bool(nombres_ia.get('nombres') or nombres_final or inmo_id_sugerido),
            'etapa_nombre':                 str(gc(['ETAPA', 'Etapa', 'etapa', 'FASE', 'Fase']) or '').strip() or None,
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
    logger.info(
        '[excel_parser] preview guardado job_id=%s total_filas=%s filas_con_inmo=%s filas_con_id_sugerido=%s bucket=%s',
        job_id,
        len(filas),
        len([f for f in filas if f.get('inmobiliaria_excel')]),
        len([f for f in filas if f.get('inmobiliaria_id_sugerido')]),
        ARCHIVOS_BUCKET,
    )
    return preview


def _normalizar_id_unidad(id_unidad):
    return (id_unidad or '').strip().upper()


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


def _validar_fila(id_unidad, vistos, precio, metraje, estatus_norm, estatus_raw,
                  inmo_excel, inmo_confianza, inmo_es_nueva, existentes=None,
                  nombre_cliente='', nombres='', apellidos='', cedula=None):
    errores, advertencias = [], []
    existentes = existentes or set()
    id_normalizado = _normalizar_id_unidad(id_unidad)
    vistos_normalizados = {_normalizar_id_unidad(v) for v in vistos}
    if not id_unidad:
        errores.append('id_unidad vacío')
    if id_normalizado in vistos_normalizados:
        errores.append(f'id_unidad duplicado: {id_unidad}')
    if id_normalizado in existentes:
        errores.append(f'La unidad {id_unidad} ya existe en este proyecto')
    if precio is None:
        errores.append('precio inválido o vacío')
    if metraje is None:
        errores.append('metraje inválido o vacío')
    if estatus_norm not in ESTATUS_MAP:
        errores.append(f'estado desconocido: {estatus_raw}')
    # Si estado no es disponible, inmobiliaria es obligatoria
    if estatus_norm != 'DISPONIBLE' and not inmo_excel:
        errores.append('inmobiliaria requerida para este estado')
    if inmo_excel and inmo_confianza < 80 and not inmo_es_nueva:
        advertencias.append(f'Inmobiliaria con baja confianza ({inmo_confianza}%)')
    # Si hay nombre de cliente y NO viene cédula del Excel → error (debe ingresarla)
    if nombre_cliente and not cedula:
        errores.append('cédula obligatoria cuando hay cliente')
    if cedula and not str(cedula).strip().isdigit():
        errores.append('cédula solo debe contener números')
    if nombre_cliente and not inmo_excel:
        advertencias.append('Sin inmobiliaria, el cliente no se registrará')
    # Si hay nombre de cliente pero faltan nombres/apellidos separados → advertencia
    if nombre_cliente and (not nombres or not apellidos):
        advertencias.append('Completa nombres y apellidos para registrar el cliente')
    return errores, advertencias
