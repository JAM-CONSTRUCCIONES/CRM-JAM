"""
Script para vaciar las tablas de prueba.
Uso: python scripts/vaciar-tablas.py
"""
import boto3

REGION = 'us-east-1'
TABLAS = ['jam-inventario', 'jam-clientes', 'jam-historial-bloqueos']

dynamodb = boto3.resource('dynamodb', region_name=REGION)

for nombre in TABLAS:
    tabla = dynamodb.Table(nombre)
    scan = tabla.scan(ProjectionExpression='pk, sk')
    items = scan.get('Items', [])

    # Paginación por si hay muchos items
    while 'LastEvaluatedKey' in scan:
        scan = tabla.scan(
            ProjectionExpression='pk, sk',
            ExclusiveStartKey=scan['LastEvaluatedKey']
        )
        items.extend(scan.get('Items', []))

    if not items:
        print(f'{nombre}: vacía')
        continue

    with tabla.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={'pk': item['pk'], 'sk': item['sk']})

    print(f'{nombre}: {len(items)} items borrados')

print('Listo.')
