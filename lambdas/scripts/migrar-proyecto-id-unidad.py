#!/usr/bin/env python3
"""
Script de migración: Agregar campo proyecto_id_unidad a unidades existentes

Este script agrega el campo proyecto_id_unidad a todas las unidades existentes
en la tabla jam-inventario para soportar el nuevo GSI gsi-proyecto-id-unidad.

Uso:
    python lambdas/scripts/migrar-proyecto-id-unidad.py [--dry-run] [--table-name NOMBRE]

Opciones:
    --dry-run       Simula la migración sin hacer cambios
    --table-name    Nombre de la tabla (default: jam-inventario)
"""

import boto3
import sys
from decimal import Decimal

# Configuración
TABLE_NAME = 'jam-inventario'
DRY_RUN = '--dry-run' in sys.argv

# Permitir override del nombre de tabla
if '--table-name' in sys.argv:
    idx = sys.argv.index('--table-name')
    if idx + 1 < len(sys.argv):
        TABLE_NAME = sys.argv[idx + 1]

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

def scan_all_unidades():
    """Escanea todas las unidades de la tabla."""
    unidades = []
    last_key = None
    
    while True:
        if last_key:
            response = table.scan(
                FilterExpression='begins_with(sk, :unidad)',
                ExpressionAttributeValues={':unidad': 'UNIDAD#'},
                ExclusiveStartKey=last_key
            )
        else:
            response = table.scan(
                FilterExpression='begins_with(sk, :unidad)',
                ExpressionAttributeValues={':unidad': 'UNIDAD#'}
            )
        
        unidades.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        
        if not last_key:
            break
    
    return unidades

def migrar_unidad(unidad):
    """Agrega el campo proyecto_id_unidad a una unidad."""
    pk = unidad.get('pk', '')
    id_unidad = unidad.get('id_unidad', '')
    
    if not pk or not id_unidad:
        print(f"⚠️  Unidad sin pk o id_unidad: {unidad.get('sk')}")
        return False
    
    # Extraer proyecto_id del pk (formato: PROYECTO#ABC123)
    proyecto_id = pk.replace('PROYECTO#', '')
    
    # Crear campo compuesto
    proyecto_id_unidad = f"{proyecto_id}#{id_unidad.upper()}"
    
    # Verificar si ya tiene el campo
    if unidad.get('proyecto_id_unidad') == proyecto_id_unidad:
        return False  # Ya migrado
    
    if DRY_RUN:
        print(f"[DRY-RUN] Actualizaría {pk} / {unidad.get('sk')}: proyecto_id_unidad = {proyecto_id_unidad}")
        return True
    
    try:
        table.update_item(
            Key={'pk': pk, 'sk': unidad.get('sk')},
            UpdateExpression='SET proyecto_id_unidad = :val',
            ExpressionAttributeValues={':val': proyecto_id_unidad}
        )
        return True
    except Exception as e:
        print(f"❌ Error actualizando {pk} / {unidad.get('sk')}: {e}")
        return False

def main():
    print("=" * 60)
    print("Migración: Agregar campo proyecto_id_unidad")
    print("=" * 60)
    print(f"Tabla: {TABLE_NAME}")
    print(f"Modo: {'DRY-RUN (simulación)' if DRY_RUN else 'PRODUCCIÓN'}")
    print()
    
    if not DRY_RUN:
        confirm = input("⚠️  Esto modificará la base de datos. ¿Continuar? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Cancelado.")
            return
    
    print("📊 Escaneando unidades...")
    unidades = scan_all_unidades()
    print(f"✅ Encontradas {len(unidades)} unidades")
    print()
    
    actualizadas = 0
    ya_migradas = 0
    errores = 0
    
    for i, unidad in enumerate(unidades, 1):
        if i % 50 == 0:
            print(f"Progreso: {i}/{len(unidades)} ({i*100//len(unidades)}%)")
        
        resultado = migrar_unidad(unidad)
        if resultado:
            actualizadas += 1
        elif unidad.get('proyecto_id_unidad'):
            ya_migradas += 1
        else:
            errores += 1
    
    print()
    print("=" * 60)
    print("Resumen de Migración")
    print("=" * 60)
    print(f"Total de unidades: {len(unidades)}")
    print(f"✅ Actualizadas: {actualizadas}")
    print(f"⏭️  Ya migradas: {ya_migradas}")
    print(f"❌ Errores: {errores}")
    print()
    
    if DRY_RUN:
        print("ℹ️  Esto fue una simulación. Ejecuta sin --dry-run para aplicar cambios.")
    else:
        print("✅ Migración completada.")
        print()
        print("Próximos pasos:")
        print("1. Verificar que el GSI gsi-proyecto-id-unidad esté activo en DynamoDB")
        print("2. Probar crear/actualizar unidades desde el frontend")
        print("3. Verificar que la validación de duplicados funciona")

if __name__ == '__main__':
    main()
