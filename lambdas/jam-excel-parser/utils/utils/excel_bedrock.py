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
        "SCHEMA ESPERADO: unidad, Area, No Cuartos, No. baños, Tipo, Piso, Parqueos, "
        "NOMBRE CLIENTE, Precios US$, ESTATUS, INMOBILIARIA, FECHA BLOQUEO, "
        "FECHA FIN BLOQUEO/ PAGO SEPARACION, COMENTARIO\n\n"
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
        match  = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as e:
        logger.warning(f'Bedrock error: {e}')

    return {'column_map': {}, 'nombres_map': {}, 'inmos_map': {}}
