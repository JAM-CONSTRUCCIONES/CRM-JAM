#!/usr/bin/env python3
"""
Script para crear unidades de prueba en DynamoDB
Uso: python scripts/crear-unidades-prueba.py <proyecto_id>
"""

import boto3
import sys
from datetime import datetime, timezone

def crear_unidades_prueba(proyecto_id):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('jam-inventario')
    
    # Crear etapa de prueba
    etapa_id = 'ETAPA001'
    table.put_item(Item={
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'ETAPA#{etapa_id}',
        'etapa_id': etapa_id,
        'nombre': 'Etapa 1',
        'orden': 1,
        'activo': True,
        'creado_en': datetime.now(timezone.utc).isoformat()
    })
    print(f'✓ Etapa creada: {etapa_id}')
    
    # Crear torre de prueba
    torre_id = 'TORRE001'
    table.put_item(Item={
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'TORRE#{torre_id}',
        'torre_id': torre_id,
        'nombre': 'Torre A',
        'etapa_id': etapa_id,
        'orden': 1,
        'activo': True,
        'creado_en': datetime.now(timezone.utc).isoformat()
    })
    print(f'✓ Torre creada: {torre_id}')
    
    # Crear 10 unidades de prueba
    for i in range(1, 11):
        unidad_id = f'A-{i:03d}'
        now = datetime.now(timezone.utc).isoformat()
        table.put_item(Item={
            'pk': f'PROYECTO#{proyecto_id}',
            'sk': f'UNIDAD#{unidad_id}',
            'unidad_id': unidad_id,
            'id_unidad': unidad_id,
            'etapa_id': etapa_id,
            'torre_id': torre_id,
            'metraje': 50 + (i * 5),
            'precio': 100000 + (i * 10000),
            'estado': 'disponible',
            'creado_en': now,
            'actualizado_en': now
        })
        print(f'✓ Unidad creada: {unidad_id}')
    
    print(f'\n✅ Se crearon 10 unidades para el proyecto {proyecto_id}')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Uso: python scripts/crear-unidades-prueba.py <proyecto_id>')
        print('Ejemplo: python scripts/crear-unidades-prueba.py 4DCE85DF')
        sys.exit(1)
    
    proyecto_id = sys.argv[1]
    crear_unidades_prueba(proyecto_id)
