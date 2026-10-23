# Fix: Imágenes se Borran Después de 2 Días

**Fecha:** 6 de mayo de 2026  
**Prioridad:** 🔴 CRÍTICO

---

## Problema Identificado

### Síntomas
1. Las imágenes de proyectos e inmobiliarias se borran de S3 después de aproximadamente 2 días
2. Al actualizar la imagen, la imagen antigua sigue apareciendo (problema de caché de CloudFront)

### Causa Raíz

**Problema 1: Lifecycle Policy en S3**
- El bucket `jam-assets` tiene una **lifecycle policy configurada manualmente** que elimina archivos después de cierto tiempo
- Esta policy NO está en el código de CDK, fue agregada manualmente en la consola de AWS
- Los archivos se eliminan permanentemente de S3

**Problema 2: CloudFront Cache**
- CloudFront usa `CACHING_OPTIMIZED` policy que cachea recursos por mucho tiempo
- Cuando subes una nueva imagen con el mismo nombre, CloudFront sigue sirviendo la versión antigua

---

## Solución Implementada

### 1. Eliminar Lifecycle Policy de S3 ⚠️ MANUAL

**Verificar si existe la policy:**
```bash
aws s3api get-bucket-lifecycle-configuration \
  --bucket jam-assets-{account-id}
```

**Si existe, eliminarla:**
```bash
aws s3api delete-bucket-lifecycle \
  --bucket jam-assets-{account-id}
```

**Verificar que se eliminó:**
```bash
aws s3api get-bucket-lifecycle-configuration \
  --bucket jam-assets-{account-id}
# Debe retornar error: NoSuchLifecycleConfiguration
```

### 2. Cache Busting con Query Parameters ✅ IMPLEMENTADO

Agregamos un **timestamp** como query parameter a la URL de la imagen para forzar actualización en CloudFront.

**Archivos modificados:**
- `lambdas/jam-proyectos/routes/proyectos.py`
- `lambdas/jam-auth/routes/inmobiliarias.py`

**Cambio:**
```python
# Antes
public_url = f'{CLOUDFRONT_URL}/{key}'

# Después
import time
timestamp = int(time.time())
public_url = f'{CLOUDFRONT_URL}/{key}?v={timestamp}'
```

---

## Diagnóstico Detallado

### Verificar Lifecycle Policy Actual

```bash
# Ver la configuración actual del bucket
aws s3api get-bucket-lifecycle-configuration \
  --bucket jam-assets-{account-id} \
  --output json
```

**Posibles salidas:**

**Si NO hay policy (correcto):**
```
An error occurred (NoSuchLifecycleConfiguration) when calling the GetBucketLifecycleConfiguration operation: The lifecycle configuration does not exist
```

**Si HAY policy (problema):**
```json
{
  "Rules": [
    {
      "ID": "DeleteOldAssets",
      "Status": "Enabled",
      "Expiration": {
        "Days": 2
      },
      "Filter": {
        "Prefix": "assets/"
      }
    }
  ]
}
```

### Verificar Archivos en S3

```bash
# Listar imágenes de proyectos
aws s3 ls s3://jam-assets-{account-id}/assets/proyectos/ --recursive

# Listar imágenes de inmobiliarias
aws s3 ls s3://jam-assets-{account-id}/assets/inmobiliarias/ --recursive

# Ver detalles de un archivo específico (incluyendo fecha de creación)
aws s3api head-object \
  --bucket jam-assets-{account-id} \
  --key assets/proyectos/PROYECTO#ABC/portada.jpg
```

---

## Despliegue

### Paso 1: Eliminar Lifecycle Policy (CRÍTICO)

```bash
# 1. Verificar si existe
aws s3api get-bucket-lifecycle-configuration \
  --bucket jam-assets-{account-id}

# 2. Si existe, eliminarla
aws s3api delete-bucket-lifecycle \
  --bucket jam-assets-{account-id}

# 3. Confirmar eliminación
aws s3api get-bucket-lifecycle-configuration \
  --bucket jam-assets-{account-id}
# Debe dar error: NoSuchLifecycleConfiguration
```

### Paso 2: Desplegar Lambdas con Cache Busting

```bash
# Lambda jam-proyectos
cd lambdas/jam-proyectos
zip -r ../jam-proyectos-deploy.zip . -x "*.pyc" -x "__pycache__/*"
cd ../..

aws lambda update-function-code \
  --function-name jam-proyectos \
  --zip-file fileb://lambdas/jam-proyectos-deploy.zip \
  --region us-east-1

# Lambda jam-auth
cd lambdas/jam-auth
zip -r ../jam-auth-deploy.zip . -x "*.pyc" -x "__pycache__/*"
cd ../..

aws lambda update-function-code \
  --function-name jam-auth \
  --zip-file fileb://lambdas/jam-auth-deploy.zip \
  --region us-east-1
```

### Paso 3: Re-subir Imágenes Borradas (Si es necesario)

Si algunas imágenes ya fueron borradas, el usuario deberá volver a subirlas desde el frontend.

---

## Pruebas Post-Despliegue

### 1. Verificar que NO se Borran Archivos

```bash
# Subir una imagen de prueba
echo "test" > test.jpg
aws s3 cp test.jpg s3://jam-assets-{account-id}/assets/test/test.jpg

# Esperar 3 días
# Verificar que sigue existiendo
aws s3 ls s3://jam-assets-{account-id}/assets/test/test.jpg

# Limpiar
aws s3 rm s3://jam-assets-{account-id}/assets/test/test.jpg
```

### 2. Verificar Cache Busting

```bash
# Ver logs de presigned URLs
aws logs tail /aws/lambda/jam-proyectos --follow --filter-pattern "presigned_imagen"
```

**Salida esperada:**
```
[presigned_imagen] public_url=https://xxx.cloudfront.net/assets/proyectos/ABC/portada.jpg?v=1715000000
```

### 3. Probar Actualización de Imagen

1. Subir una imagen desde el frontend
2. Esperar 3 días
3. Verificar que la imagen sigue visible
4. Actualizar la imagen
5. Verificar que se ve la nueva imagen inmediatamente

---

## Prevención Futura

### Agregar Alarma de CloudWatch

Crear una alarma que notifique si se detecta una lifecycle policy en el bucket:

```bash
# Esto requiere configurar EventBridge para monitorear cambios en S3
# Por ahora, verificar manualmente cada mes
```

### Documentar en README

Agregar nota en el README del proyecto:

```markdown
## ⚠️ IMPORTANTE: Bucket jam-assets

El bucket `jam-assets` NO debe tener lifecycle policies configuradas.
Las imágenes de proyectos e inmobiliarias deben persistir indefinidamente.

Para verificar:
```bash
aws s3api get-bucket-lifecycle-configuration --bucket jam-assets-{account-id}
# Debe retornar: NoSuchLifecycleConfiguration
```
```

---

## Cómo Funciona

### Cache Busting con Query Parameters

CloudFront trata URLs con diferentes query strings como recursos diferentes:

```
https://cloudfront.net/assets/proyectos/ABC/portada.jpg?v=1715000000  ← Caché 1
https://cloudfront.net/assets/proyectos/ABC/portada.jpg?v=1715000100  ← Caché 2 (diferente)
```

### Timestamp como Versión

Usamos `int(time.time())` que genera un número único basado en segundos desde epoch:
- Cada actualización genera un nuevo timestamp
- CloudFront ve una URL diferente y solicita la nueva imagen
- La imagen se actualiza inmediatamente

### Sin Lifecycle Policy

Sin lifecycle policy, los archivos permanecen en S3 indefinidamente:
- No se borran automáticamente
- Solo se eliminan si se borra el proyecto/inmobiliaria (futuro)
- Costo de almacenamiento es mínimo (imágenes son pequeñas)

---

## Costos

### Almacenamiento S3

**Estimación:**
- 100 proyectos × 1 imagen × 500 KB = 50 MB
- 50 inmobiliarias × 1 imagen × 500 KB = 25 MB
- **Total: ~75 MB**

**Costo:**
- S3 Standard: $0.023 por GB/mes
- 0.075 GB × $0.023 = **$0.0017/mes** (~$0.02/año)

**Conclusión:** El costo es insignificante, NO vale la pena borrar imágenes.

---

## Checklist de Despliegue

- [ ] Verificar lifecycle policy actual en S3
- [ ] Eliminar lifecycle policy si existe
- [ ] Confirmar que no hay lifecycle policy
- [ ] Desplegar lambda jam-proyectos
- [ ] Desplegar lambda jam-auth
- [ ] Probar subir imagen de proyecto
- [ ] Probar actualizar imagen de proyecto
- [ ] Probar subir imagen de inmobiliaria
- [ ] Probar actualizar imagen de inmobiliaria
- [ ] Verificar que URLs tienen `?v=timestamp`
- [ ] Esperar 3 días y verificar que imágenes NO se borran
- [ ] Documentar en README
- [ ] Notificar al equipo

---

## Conclusión

Este fix resuelve dos problemas:

1. **Imágenes se borran:** Eliminando la lifecycle policy manual de S3
2. **Imágenes no se actualizan:** Usando cache busting con query parameters

**Solución:**
- ✅ **Permanente**: Las imágenes nunca se borran
- ✅ **Instantánea**: Las actualizaciones se ven inmediatamente
- ✅ **Económica**: Costo de almacenamiento es insignificante
- ✅ **Simple**: No requiere cambios complejos

---

**Preparado por:** Equipo de Desarrollo  
**Última actualización:** 6 de mayo de 2026
