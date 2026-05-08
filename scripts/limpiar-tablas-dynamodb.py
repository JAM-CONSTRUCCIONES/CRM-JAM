#!/usr/bin/env python3
"""
Script para limpiar todas las tablas de DynamoDB excepto jam-usuarios.
Elimina todos los items de las tablas manteniendo la estructura.
"""

import boto3
from botocore.exceptions import ClientError

# Cliente DynamoDB
dynamodb = boto3.resource('dynamodb')

# Tablas a limpiar (todas excepto jam-usuarios)
TABLAS_A_LIMPIAR = [
    'jam-inventario',
    'jam-clientes',
    'jam-procesos',
    'jam-historial-estatus',
    'jam-historial-bloqueos',
]

def limpiar_tabla(nombre_tabla):
    """
    Elimina todos los items de una tabla DynamoDB.
    Usa scan + batch_write para eficiencia.
    """
    print(f"\n🔄 Limpiando tabla: {nombre_tabla}")
    
    try:
        tabla = dynamodb.Table(nombre_tabla)
        
        # Obtener las claves de la tabla
        key_schema = tabla.key_schema
        key_names = [key['AttributeName'] for key in key_schema]
        
        print(f"   Claves: {', '.join(key_names)}")
        
        # Scan para obtener todos los items
        items_eliminados = 0
        scan_kwargs = {
            'ProjectionExpression': ','.join(key_names)
        }
        
        while True:
            response = tabla.scan(**scan_kwargs)
            items = response.get('Items', [])
            
            if not items:
                break
            
            # Eliminar en batch (máximo 25 por batch)
            with tabla.batch_writer() as batch:
                for item in items:
                    # Extraer solo las claves
                    key = {k: item[k] for k in key_names}
                    batch.delete_item(Key=key)
                    items_eliminados += 1
            
            print(f"   Eliminados: {items_eliminados} items...", end='\r')
            
            # Continuar si hay más items
            if 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        print(f"   ✅ Eliminados: {items_eliminados} items en total")
        return items_eliminados
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            print(f"   ⚠️  Tabla no encontrada: {nombre_tabla}")
        else:
            print(f"   ❌ Error: {e.response['Error']['Message']}")
        return 0
    except Exception as e:
        print(f"   ❌ Error inesperado: {str(e)}")
        return 0


def main():
    print("=" * 60)
    print("🧹 LIMPIEZA DE TABLAS DYNAMODB")
    print("=" * 60)
    print("\n⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de:")
    for tabla in TABLAS_A_LIMPIAR:
        print(f"   - {tabla}")
    print("\n✅ La tabla 'jam-usuarios' NO será modificada")
    
    respuesta = input("\n¿Continuar? (escribe 'SI' para confirmar): ")
    
    if respuesta.strip().upper() != 'SI':
        print("\n❌ Operación cancelada")
        return
    
    print("\n" + "=" * 60)
    print("Iniciando limpieza...")
    print("=" * 60)
    
    total_eliminados = 0
    
    for tabla in TABLAS_A_LIMPIAR:
        eliminados = limpiar_tabla(tabla)
        total_eliminados += eliminados
    
    print("\n" + "=" * 60)
    print(f"✅ LIMPIEZA COMPLETADA")
    print(f"   Total de items eliminados: {total_eliminados}")
    print("=" * 60)
    print("\n📝 Nota: Los usuarios en 'jam-usuarios' se mantienen intactos")
    print("   Recuerda eliminar manualmente los usuarios de inmobiliarias si es necesario")


if __name__ == '__main__':
    main()
