#!/bin/bash
# Script para limpiar todas las tablas de DynamoDB excepto jam-usuarios

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Tablas a limpiar
TABLAS=(
    "jam-inventario"
    "jam-clientes"
    "jam-procesos"
    "jam-historial-estatus"
    "jam-historial-bloqueos"
)

echo "============================================================"
echo "🧹 LIMPIEZA DE TABLAS DYNAMODB"
echo "============================================================"
echo ""
echo -e "${YELLOW}⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de:${NC}"
for tabla in "${TABLAS[@]}"; do
    echo "   - $tabla"
done
echo ""
echo -e "${GREEN}✅ La tabla 'jam-usuarios' NO será modificada${NC}"
echo ""
read -p "¿Continuar? (escribe 'SI' para confirmar): " respuesta

if [ "$respuesta" != "SI" ]; then
    echo -e "\n${RED}❌ Operación cancelada${NC}"
    exit 0
fi

echo ""
echo "============================================================"
echo "Iniciando limpieza..."
echo "============================================================"

total_eliminados=0

for tabla in "${TABLAS[@]}"; do
    echo ""
    echo -e "${CYAN}🔄 Limpiando tabla: $tabla${NC}"
    
    # Obtener las claves de la tabla
    key_schema=$(aws dynamodb describe-table --table-name "$tabla" --query 'Table.KeySchema[*].AttributeName' --output text)
    
    if [ -z "$key_schema" ]; then
        echo -e "${RED}   ❌ No se pudo obtener el esquema de la tabla${NC}"
        continue
    fi
    
    echo "   Claves: $key_schema"
    
    items_eliminados=0
    
    # Scan y eliminar items
    while true; do
        # Obtener items (solo las claves)
        items=$(aws dynamodb scan \
            --table-name "$tabla" \
            --projection-expression "$key_schema" \
            --max-items 25 \
            --output json)
        
        # Verificar si hay items
        count=$(echo "$items" | jq '.Items | length')
        
        if [ "$count" -eq 0 ]; then
            break
        fi
        
        # Eliminar cada item
        echo "$items" | jq -c '.Items[]' | while read -r item; do
            # Extraer solo las claves
            key=$(echo "$item" | jq -c)
            
            # Eliminar el item
            aws dynamodb delete-item \
                --table-name "$tabla" \
                --key "$key" \
                --output json > /dev/null
            
            ((items_eliminados++)) || true
            echo -ne "   Eliminados: $items_eliminados items...\r"
        done
        
        # Verificar si hay más items
        next_token=$(echo "$items" | jq -r '.NextToken // empty')
        if [ -z "$next_token" ]; then
            break
        fi
    done
    
    echo -e "${GREEN}   ✅ Eliminados: $items_eliminados items en total${NC}"
    ((total_eliminados += items_eliminados)) || true
done

echo ""
echo "============================================================"
echo -e "${GREEN}✅ LIMPIEZA COMPLETADA${NC}"
echo "   Total de items eliminados: $total_eliminados"
echo "============================================================"
echo ""
echo -e "${CYAN}📝 Nota: Los usuarios en 'jam-usuarios' se mantienen intactos${NC}"
echo "   Recuerda eliminar manualmente los usuarios de inmobiliarias si es necesario"
