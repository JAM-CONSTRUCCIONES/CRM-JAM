# INCIDENTE: Borrado de Imágenes Durante Deploy

**Fecha:** 7 de mayo de 2026  
**Prioridad:** 🔴 CRÍTICO  
**Estado:** ✅ RESUELTO

---

## Resumen Ejecutivo

Durante el deploy del frontend, se eliminaron todas las imágenes de proyectos almacenadas en `s3://jam-assets-479324457361/assets/proyectos/`. La causa fue el uso del flag `--delete` en el comando `aws s3 sync` que sincroniza los assets del frontend.

---

## Cronología del Incidente

| Hora | Evento |
|------|--------|
| ~14:00 | Deploy del frontend ejecutado con `aws s3 sync --delete` |
| ~14:01 | Todas las imágenes en `assets/proyectos/` eliminadas de S3 |
| ~16:00 | Usuario reporta que las imágenes desaparecieron |
| 16:15 | Investigación iniciada |
| 16:30 | Causa raíz identificada |
| 16:45 | Documentación actualizada y solución implementada |

---

## Causa Raíz

### Comando Problemático

```bash
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ \
  --delete --cache-control "public, max-age=31536000, immutable"
```

### ¿Por qué falló?

El flag `--delete` elimina **todos los archivos en S3 que no existen en el directorio local**.

**Estructura del bucket:**
```
s3://jam-assets-479324457361/
├── assets/
│   ├── index-abc123.js          ← Assets del frontend (en dist/assets/)
│   ├── index-abc123.css         ← Assets del frontend (en dist/assets/)
│   ├── proyectos/               ← Imágenes subidas por usuarios (NO en dist/assets/)
│   │   ├── PROYECTO#001/portada-1234.jpg
│   │   └── PROYECTO#002/portada-5678.jpg
│   └── inmobiliarias/           ← Imágenes subidas por usuarios (NO en dist/assets/)
│       └── INMO#001/logo-9012.png
```

**Directorio local:**
```
dist/assets/
├── index-abc123.js
└── index-abc123.css
```

Al ejecutar `aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ --delete`:
1. Sube `index-abc123.js` y `index-abc123.css` ✅
2. Detecta que `proyectos/` e `inmobiliarias/` no existen en `dist/assets/`
3. **Elimina** `proyectos/` e `inmobiliarias/` completos ❌

---

## Impacto

| Área | Impacto |
|------|---------|
| **Imágenes de proyectos** | ❌ Todas eliminadas |
| **Imágenes de inmobiliarias** | ❌ Todas eliminadas |
| **Assets del frontend** | ✅ Sin impacto |
| **Base de datos** | ✅ Sin impacto (URLs guardadas, pero archivos no existen) |
| **Usuarios** | 🔴 No pueden ver imágenes de proyectos |

---

## Solución Implementada

### 1. Actualizar Comando de Deploy

**Antes:**
```bash
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ \
  --delete --cache-control "public, max-age=31536000, immutable"
```

**Después:**
```bash
# IMPORTANTE: NO usar --delete porque borraría las imágenes de proyectos/inmobiliarias
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ \
  --cache-control "public, max-age=31536000, immutable"
```

### 2. Documentar en README

Agregada sección de advertencia al inicio del README:

```markdown
## ⚠️ ADVERTENCIA CRÍTICA: Bucket S3 de Assets

**NUNCA uses el flag `--delete` al sincronizar assets del frontend con S3.**

El bucket contiene:
- Assets del frontend (JS, CSS) en `assets/`
- Imágenes de proyectos en `assets/proyectos/` (subidas por usuarios)
- Imágenes de inmobiliarias en `assets/inmobiliarias/` (subidas por usuarios)
```

### 3. Recuperación de Datos

**Opciones:**
1. **Pedir a usuarios que vuelvan a subir las imágenes** (más simple)
2. **Restaurar desde backup de S3** (si está habilitado el versionado)
3. **Restaurar desde snapshots de base de datos** (si hay backups recientes)

**Verificar si hay versionado en S3:**
```bash
aws s3api get-bucket-versioning --bucket jam-assets-479324457361
```

Si el versionado está habilitado, se pueden recuperar las versiones anteriores:
```bash
# Listar versiones de un archivo
aws s3api list-object-versions \
  --bucket jam-assets-479324457361 \
  --prefix assets/proyectos/

# Restaurar una versión específica
aws s3api copy-object \
  --bucket jam-assets-479324457361 \
  --copy-source jam-assets-479324457361/assets/proyectos/PROYECTO#001/portada.jpg?versionId=VERSION_ID \
  --key assets/proyectos/PROYECTO#001/portada.jpg
```

---

## Prevención Futura

### 1. Separar Assets del Frontend

**Opción recomendada:** Mover assets del frontend a un subdirectorio separado.

```
s3://jam-assets-479324457361/
├── frontend/                    ← Assets del frontend (JS, CSS)
│   ├── index-abc123.js
│   └── index-abc123.css
├── proyectos/                   ← Imágenes de proyectos
└── inmobiliarias/               ← Imágenes de inmobiliarias
```

**Cambios necesarios:**
1. Actualizar CloudFront para servir `/assets/*` desde `frontend/`
2. Actualizar comando de deploy:
   ```bash
   aws s3 sync dist/assets/ s3://jam-assets-479324457361/frontend/ --delete
   ```

### 2. Usar Exclude en el Comando

Si no queremos cambiar la estructura:

```bash
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ \
  --delete \
  --exclude "proyectos/*" \
  --exclude "inmobiliarias/*" \
  --cache-control "public, max-age=31536000, immutable"
```

### 3. Habilitar Versionado en S3

```bash
aws s3api put-bucket-versioning \
  --bucket jam-assets-479324457361 \
  --versioning-configuration Status=Enabled
```

**Ventajas:**
- Permite recuperar archivos eliminados accidentalmente
- Historial completo de cambios

**Desventajas:**
- Costo adicional de almacenamiento
- Requiere gestión de versiones antiguas

### 4. Script de Deploy Seguro

Crear un script que valide antes de ejecutar:

```bash
#!/bin/bash
# deploy-frontend.sh

set -e

echo "🔍 Verificando estructura de S3..."
PROYECTOS_COUNT=$(aws s3 ls s3://jam-assets-479324457361/assets/proyectos/ --recursive | wc -l)
echo "📊 Imágenes de proyectos en S3: $PROYECTOS_COUNT"

if [ "$PROYECTOS_COUNT" -gt 0 ]; then
  echo "⚠️  ADVERTENCIA: Hay $PROYECTOS_COUNT imágenes de proyectos en S3"
  echo "⚠️  NO uses --delete en el comando de sync"
  read -p "¿Continuar sin --delete? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deploy cancelado"
    exit 1
  fi
fi

echo "📦 Building frontend..."
cd front
npm run build

echo "📤 Uploading to S3..."
aws s3 cp dist/index.html s3://jam-frontend-479324457361/ \
  --content-type "text/html" --cache-control "no-cache"

aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ \
  --cache-control "public, max-age=31536000, immutable"

echo "🔄 Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id E1WI58DFYF9AST --paths "/*"

echo "✅ Deploy completado"
```

---

## Checklist de Verificación

- [x] Identificar causa raíz
- [x] Actualizar comando de deploy en README
- [x] Agregar advertencia en README
- [x] Documentar incidente
- [ ] Verificar si hay versionado en S3
- [ ] Intentar recuperar imágenes (si hay versionado)
- [ ] Notificar a usuarios sobre re-subida de imágenes
- [ ] Considerar implementar versionado en S3
- [ ] Considerar separar assets del frontend
- [ ] Crear script de deploy seguro

---

## Lecciones Aprendidas

1. **Nunca usar `--delete` en buckets compartidos** que contienen datos de usuarios
2. **Separar assets estáticos de contenido dinámico** en diferentes prefijos o buckets
3. **Habilitar versionado en S3** para buckets críticos
4. **Documentar comandos peligrosos** con advertencias claras
5. **Crear scripts de deploy** que validen antes de ejecutar operaciones destructivas

---

## Comandos de Verificación

### Verificar estado actual del bucket

```bash
# Ver estructura del bucket
aws s3 ls s3://jam-assets-479324457361/assets/ --recursive

# Contar imágenes de proyectos
aws s3 ls s3://jam-assets-479324457361/assets/proyectos/ --recursive | wc -l

# Contar imágenes de inmobiliarias
aws s3 ls s3://jam-assets-479324457361/assets/inmobiliarias/ --recursive | wc -l

# Ver si hay versionado habilitado
aws s3api get-bucket-versioning --bucket jam-assets-479324457361
```

### Verificar CloudTrail (eventos de eliminación)

```bash
# Ver eventos DeleteObject recientes
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteObject \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 50 \
  --region us-east-1 \
  --output json
```

---

## Contacto

Para preguntas sobre este incidente, contactar al equipo de desarrollo.

**Preparado por:** Equipo de Desarrollo  
**Última actualización:** 7 de mayo de 2026
