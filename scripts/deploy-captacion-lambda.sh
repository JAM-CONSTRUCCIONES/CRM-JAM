#!/bin/bash

# Script para desplegar la Lambda jam-captacion con el nuevo endpoint de inmobiliarias públicas

set -e

echo "🔧 Desplegando Lambda jam-captacion con endpoint /publico/inmobiliarias..."

# Verificar que estamos en el directorio correcto
if [ ! -d "lambdas/jam-captacion" ]; then
    echo "❌ Error: Debe ejecutar este script desde la raíz del proyecto"
    exit 1
fi

# Navegar al directorio de infraestructura
cd infra

echo "📦 Instalando dependencias de CDK..."
npm install

echo "🏗️  Compilando TypeScript..."
npm run build

echo "🚀 Desplegando stack con CDK..."
npx cdk deploy --require-approval never

echo "✅ Despliegue completado exitosamente"
echo ""
echo "🧪 Verifica el endpoint:"
echo "   curl https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/publico/inmobiliarias"
echo ""
echo "📱 Accede al formulario global en:"
echo "   https://tu-dominio.com/captura-global"

