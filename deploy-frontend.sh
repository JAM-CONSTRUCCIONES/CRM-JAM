#!/bin/bash
# Script de deploy seguro para el frontend de JAM Construcciones
# Previene el borrado accidental de imágenes de proyectos e inmobiliarias

set -e

BUCKET_FRONTEND="jam-frontend-479324457361"
BUCKET_ASSETS="jam-assets-479324457361"
CLOUDFRONT_ID="E1WI58DFYF9AST"
REGION="us-east-1"

echo "🚀 Deploy Frontend - JAM Construcciones"
echo "========================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d "front" ]; then
  echo "❌ Error: Debes ejecutar este script desde la raíz del proyecto"
  exit 1
fi

# Verificar que hay imágenes en S3 (advertencia de seguridad)
echo "🔍 Verificando imágenes en S3..."
PROYECTOS_COUNT=$(aws s3 ls s3://$BUCKET_ASSETS/assets/proyectos/ --recursive 2>/dev/null | wc -l || echo "0")
INMOBILIARIAS_COUNT=$(aws s3 ls s3://$BUCKET_ASSETS/assets/inmobiliarias/ --recursive 2>/dev/null | wc -l || echo "0")

echo "📊 Imágenes actuales en S3:"
echo "   - Proyectos: $PROYECTOS_COUNT archivos"
echo "   - Inmobiliarias: $INMOBILIARIAS_COUNT archivos"
echo ""

if [ "$PROYECTOS_COUNT" -gt 0 ] || [ "$INMOBILIARIAS_COUNT" -gt 0 ]; then
  echo "⚠️  ADVERTENCIA: Hay imágenes de usuarios en S3"
  echo "⚠️  Este script NO usará --delete para proteger esas imágenes"
  echo ""
fi

# Build del frontend
echo "📦 Building frontend..."
cd front
npm run build
cd ..
echo "✅ Build completado"
echo ""

# Subir index.html (sin caché)
echo "📤 Subiendo index.html (sin caché)..."
aws s3 cp front/dist/index.html s3://$BUCKET_FRONTEND/ \
  --content-type "text/html" \
  --cache-control "no-cache" \
  --region $REGION
echo "✅ index.html subido"
echo ""

# Subir assets (con caché, SIN --delete)
echo "📤 Subiendo assets del frontend (con caché)..."
echo "⚠️  NO se usará --delete para proteger imágenes de usuarios"
aws s3 sync front/dist/assets/ s3://$BUCKET_ASSETS/assets/ \
  --cache-control "public, max-age=31536000, immutable" \
  --region $REGION
echo "✅ Assets subidos"
echo ""

# Invalidar CloudFront
echo "🔄 Invalidando caché de CloudFront..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)
echo "✅ Invalidación creada: $INVALIDATION_ID"
echo ""

# Verificar que las imágenes siguen ahí
echo "🔍 Verificando que las imágenes NO se borraron..."
PROYECTOS_COUNT_AFTER=$(aws s3 ls s3://$BUCKET_ASSETS/assets/proyectos/ --recursive 2>/dev/null | wc -l || echo "0")
INMOBILIARIAS_COUNT_AFTER=$(aws s3 ls s3://$BUCKET_ASSETS/assets/inmobiliarias/ --recursive 2>/dev/null | wc -l || echo "0")

echo "📊 Imágenes después del deploy:"
echo "   - Proyectos: $PROYECTOS_COUNT_AFTER archivos"
echo "   - Inmobiliarias: $INMOBILIARIAS_COUNT_AFTER archivos"
echo ""

if [ "$PROYECTOS_COUNT" != "$PROYECTOS_COUNT_AFTER" ] || [ "$INMOBILIARIAS_COUNT" != "$INMOBILIARIAS_COUNT_AFTER" ]; then
  echo "❌ ERROR: Se perdieron imágenes durante el deploy!"
  echo "   Antes: $PROYECTOS_COUNT proyectos, $INMOBILIARIAS_COUNT inmobiliarias"
  echo "   Después: $PROYECTOS_COUNT_AFTER proyectos, $INMOBILIARIAS_COUNT_AFTER inmobiliarias"
  exit 1
fi

echo "✅ Deploy completado exitosamente"
echo ""
echo "🌐 URLs:"
echo "   CloudFront: https://$(aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.DomainName' --output text)"
echo "   Frontend Bucket: s3://$BUCKET_FRONTEND"
echo "   Assets Bucket: s3://$BUCKET_ASSETS"
echo ""
echo "⏳ Nota: La invalidación de CloudFront puede tardar 5-10 minutos"
