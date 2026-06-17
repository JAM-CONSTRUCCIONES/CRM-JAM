"""Llamada a Bedrock para mapeo de columnas, nombres e inmobiliarias."""
import json
import re
import boto3
import os
import logging

bedrock_client = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
BEDROCK_MODEL  = 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
logger         = logging.getLogger()


def llamar_bedrock(headers, nombres, inmos_excel, inmos_sistema):
    """
    Una sola llamada a Bedrock con todo el contexto del Excel.
    Retorna dict con column_map, nombres_map, inmos_map.
    """
    prompt = (
        "Eres un asistente de migración de datos inmobiliarios. "
        "Responde SOLO con JSON válido, sin texto adicional.\n\n"
        f"HEADERS DEL EXCEL: {json.dumps(headers)}\n\n"
        "SCHEMA ESPERADO: ID Unidad, Etapa, Tipo, Manzana, Piso, Metraje, "
        "Metraje Terraza, Metraje Patio, Cuartos, Banos, Parqueos, Precio, "
        "Precio Reserva, Precio Separacion, Precio Inicial, Cuota Monto, "
        "Cuota Meses, Contra Entrega, Estado, Documento, Cliente Nombre, "
        "Cliente Telefono, Cliente Correo, Fecha Nacimiento, Pais Residencia, "
        "Nacionalidad, Inmobiliaria, Estado Proceso, Fecha Bloqueo, "
        "Fecha Liberacion, Comentario.\n"
        "Si un header ya coincide exactamente con el schema, conserva ese header. "
        "Usa column_map solo para headers con nombres diferentes o ambiguos.\n\n"
        f"NOMBRES A SEPARAR (hispanos, 1-2 nombres + 2 apellidos):\n{json.dumps(nombres[:50])}\n\n"
        f"INMOBILIARIAS EN EXCEL: {json.dumps(inmos_excel)}\n"
        f"INMOBILIARIAS EN SISTEMA: {json.dumps(inmos_sistema)}\n\n"
        'Responde con este JSON exacto:\n'
        '{\n'
        '  "column_map": {"header_excel": "campo_schema"},\n'
        '  "nombres_map": {"NOMBRE COMPLETO": {"nombres": "...", "apellidos": "..."}},\n'
        '  "inmos_map": {\n'
        '    "nombre_excel": {\n'
        '      "id": "id_si_existe_o_vacio",\n'
        '      "nombre": "nombre_normalizado",\n'
        '      "confianza": 0,\n'
        '      "es_nueva": true\n'
        '    }\n'
        '  }\n'
        '}'
    )
    logger.info(
        '[excel_bedrock] invoke start model=%s headers_count=%s nombres_count=%s inmos_excel_count=%s inmos_sistema_count=%s prompt_chars=%s',
        BEDROCK_MODEL, len(headers), len(nombres), len(inmos_excel), len(inmos_sistema), len(prompt),
    )

    try:
        response = bedrock_client.invoke_model(
            modelId=BEDROCK_MODEL,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 4096,
                'messages': [{'role': 'user', 'content': prompt}],
            }),
        )
        result = json.loads(response['body'].read())
        text   = result['content'][0]['text']
        logger.info(
            '[excel_bedrock] invoke ok stop_reason=%s response_chars=%s text_preview=%r',
            result.get('stop_reason'), len(text), text[:500],
        )
        match  = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            logger.info(
                '[excel_bedrock] json parsed column_map_count=%s nombres_map_count=%s inmos_map_count=%s',
                len(parsed.get('column_map', {})),
                len(parsed.get('nombres_map', {})),
                len(parsed.get('inmos_map', {})),
            )
            return parsed
        logger.warning('[excel_bedrock] respuesta sin JSON util text_preview=%r', text[:500])
    except Exception as e:
        logger.warning('[excel_bedrock] Bedrock error type=%s message=%s', type(e).__name__, e)

    logger.info('[excel_bedrock] fallback vacio usado')
    return {'column_map': {}, 'nombres_map': {}, 'inmos_map': {}}
