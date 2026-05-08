"""
Migración: agrega campo 'tipo' a proyectos en jam-inventario
e inmobiliarias en jam-usuarios para habilitar los GSI gsi-tipo.
"""
import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# ── jam-inventario: proyectos ─────────────────────────────────
inventario = dynamodb.Table('jam-inventario')
result = inventario.scan()
items = result.get('Items', [])

proyectos_migrados = 0
for item in items:
    pk = item.get('pk', '')
    sk = item.get('sk', '')
    if pk.startswith('PROYECTO#') and sk == 'METADATA' and 'tipo' not in item:
        inventario.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET tipo = :t',
            ExpressionAttributeValues={':t': 'PROYECTO'}
        )
        print(f"  ✓ Proyecto {pk}")
        proyectos_migrados += 1

print(f"\nProyectos migrados: {proyectos_migrados}")

# ── jam-usuarios: inmobiliarias ───────────────────────────────
usuarios = dynamodb.Table('jam-usuarios')
result = usuarios.scan()
items = result.get('Items', [])

inmos_migradas = 0
for item in items:
    pk = item.get('pk', '')
    sk = item.get('sk', '')
    if pk.startswith('INMOBILIARIA#') and sk == 'METADATA' and 'tipo' not in item:
        usuarios.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET tipo = :t',
            ExpressionAttributeValues={':t': 'INMOBILIARIA'}
        )
        print(f"  ✓ Inmobiliaria {pk}")
        inmos_migradas += 1

print(f"Inmobiliarias migradas: {inmos_migradas}")
print("\nMigración completada.")
