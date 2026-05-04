#!/bin/bash

# Script para desplegar la Lambda jam-proyectos con el fix del error 502

set -e

echo "🔧 Desplegando fix para error 502 en eliminación de unidades..."

# Verificar que estamos en el directorio correcto
if [ ! -d "lambdas/jam-proyectos" ]; then
    echo "❌ Error: Debe ejecutar este script desde la raíz del proyecto"
    exit 1
fi

# Navegar al directorio de infraestructura
cd infra

echo "📦 Instalando dependencias de CDK..."
npm install

echo "🚀 Desplegando stack con CDK..."
npx cdk deploy --require-approval never

echo "✅ Despliegue completado exitosamente"
echo ""
echo "🧪 Prueba la eliminación de unidades nuevamente"
echo "   El error 502 debería estar resuelto"
