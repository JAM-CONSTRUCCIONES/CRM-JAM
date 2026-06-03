"""
Handler para jam-excel-parser.
Disparado por evento S3 cuando se sube un .xlsx a inventario/uploads/
Usa el mismo código de jam-proyectos — sin duplicar utils.
"""
import logging
from utils.excel_parser import parsear_excel

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    for record in event.get('Records', []):
        bucket = record['s3']['bucket']['name']
        key    = record['s3']['object']['key']

        # key = inventario/uploads/{proyecto_id}/{job_id}.xlsx
        parts = key.split('/')
        if len(parts) < 4:
            logger.warning(f'Key inesperada: {key}')
            continue

        proyecto_id = parts[2]
        job_id      = parts[3].replace('.xlsx', '')

        logger.info(f'Procesando job_id={job_id} proyecto_id={proyecto_id}')
        try:
            result = parsear_excel(bucket, key, proyecto_id, job_id)
            if result.get('error'):
                logger.error(f'Error en parseo: {result["error"]}')
            else:
                logger.info(f'Preview guardado: {result.get("total_filas")} filas')
        except Exception as e:
            logger.exception(f'Error procesando {key}: {e}')
