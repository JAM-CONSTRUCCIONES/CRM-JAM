import json
import uuid
import boto3
import os
from boto3.dynamodb.conditions import Key
from utils.response import ok, bad_request, conflict, not_found
from utils.helpers import now
from utils.excel_parser import parsear_excel  # noqa: F401 — usado por jam-excel-parser
from utils.excel_writer import escribir_migracion

s3_client    = boto3.client('s3')
dynamodb     = boto3.resource('dynamodb')
inventario_t = dynamodb.Table(os.environ['INVENTARIO_TABLE'])

ARCHIVOS_BUCKET = os.environ.get('ARCHIVOS_BUCKET', '')


def get_upload_url(event):
    qs          = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id', '').strip()
    if not proyecto_id:
        return bad_request('proyecto_id requerido')

    result = inventario_t.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
        Limit=1,
    )
    if result.get('Items'):
        return conflict('Este proyecto ya tiene unidades. La migracion solo aplica a proyectos nuevos.')

    job_id = str(uuid.uuid4())
    key    = f'inventario/uploads/{proyecto_id}/{job_id}.xlsx'

    url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket':      ARCHIVOS_BUCKET,
            'Key':         key,
            'ContentType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Metadata':    {'proyecto_id': proyecto_id, 'job_id': job_id},
        },
        ExpiresIn=300,
    )
    return ok({'upload_url': url, 'job_id': job_id, 'key': key})


def get_preview(job_id):
    try:
        obj = s3_client.get_object(Bucket=ARCHIVOS_BUCKET, Key=f'inventario/previews/{job_id}.json')
        return ok(json.loads(obj['Body'].read()))
    except Exception:
        return not_found('Preview no encontrado o expirado')


def confirmar(job_id, event):
    body           = json.loads(event.get('body') or '{}')
    filas_editadas = body.get('filas', [])

    try:
        obj     = s3_client.get_object(Bucket=ARCHIVOS_BUCKET, Key=f'inventario/previews/{job_id}.json')
        preview = json.loads(obj['Body'].read())
    except Exception:
        return not_found('Preview no encontrado o expirado')

    proyecto_id = preview['proyecto_id']

    filas_map = {f['id_unidad']: f for f in preview['filas']}
    for fe in filas_editadas:
        id_u = fe.get('id_unidad')
        if id_u and id_u in filas_map:
            filas_map[id_u].update(fe)

    filas = list(filas_map.values())

    filas_con_error = [f for f in filas if f.get('errores')]
    if filas_con_error:
        return bad_request(f'{len(filas_con_error)} filas tienen errores. Corrigelas antes de confirmar.')

    stats = escribir_migracion(proyecto_id, filas)

    reporte = {
        'job_id':        job_id,
        'archivo':       preview.get('archivo', ''),
        'proyecto_id':   proyecto_id,
        'total_filas':   len(filas),
        **stats,
        'completado_en': now(),
    }
    s3_client.put_object(
        Bucket=ARCHIVOS_BUCKET,
        Key=f'inventario/reportes/{job_id}.json',
        Body=json.dumps(reporte, ensure_ascii=False, default=str),
        ContentType='application/json',
    )

    # Borrar el Excel original — ya no se necesita después de confirmar
    try:
        excel_key = f'inventario/uploads/{proyecto_id}/{job_id}.xlsx'
        s3_client.delete_object(Bucket=ARCHIVOS_BUCKET, Key=excel_key)
    except Exception:
        pass  # No crítico si falla el borrado

    return ok(reporte)


def listar_reportes(event):
    """GET /admin/inventario/reportes?proyecto_id=xxx — lista historial de migraciones."""
    qs          = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id', '').strip()

    paginator = s3_client.get_paginator('list_objects_v2')
    pages     = paginator.paginate(Bucket=ARCHIVOS_BUCKET, Prefix='inventario/reportes/')

    reportes = []
    for page in pages:
        for obj in page.get('Contents', []):
            try:
                body = s3_client.get_object(Bucket=ARCHIVOS_BUCKET, Key=obj['Key'])
                data = json.loads(body['Body'].read())
                # Filtrar por proyecto si se especifica
                if proyecto_id and data.get('proyecto_id') != proyecto_id:
                    continue
                reportes.append({
                    'job_id':           data.get('job_id'),
                    'archivo':          data.get('archivo'),
                    'proyecto_id':      data.get('proyecto_id'),
                    'total_filas':      data.get('total_filas', 0),
                    'unidades_cargadas': data.get('unidades_cargadas', 0),
                    'clientes_creados': data.get('clientes_creados', 0),
                    'inmobiliarias_creadas': data.get('inmobiliarias_creadas', 0),
                    'advertencias':     data.get('advertencias', 0),
                    'completado_en':    data.get('completado_en'),
                })
            except Exception:
                continue

    # Ordenar por fecha descendente
    reportes.sort(key=lambda r: r.get('completado_en') or '', reverse=True)
    return ok(reportes)


def get_reporte(job_id):
    try:
        obj = s3_client.get_object(Bucket=ARCHIVOS_BUCKET, Key=f'inventario/reportes/{job_id}.json')
        return ok(json.loads(obj['Body'].read()))
    except Exception:
        return not_found('Reporte no encontrado')
