# Instrucciones de Despliegue - Optimizaciones Backend

**Fecha:** 2026-05-01  
**Cambios:** Pasos 1, 2 y 3 completados

---

## 📦 Resumen de Cambios

### **Paso 1: `unidades.listar()`**
- Usa GSI `gsi-estado` para filtros
- Aplica filtros en DynamoDB (no en memoria)
- Soporte de paginación
- Respuesta cambiada a objeto `{items, count, next_token}`

### **Paso 2: `unidades.crear()` y `unidades.actualizar()`**
- Nuevo GSI `gsi-proyecto-id-unidad`
- Validación de duplicados optimizada
- Nuevo campo `proyecto_id_unidad` en cada unidad

### **Paso 3: Migración de datos**
- Script para agregar `proyecto_id_unidad` a unidades existentes

---

## 🚀 Orden de Despliegue

### **1. Desplegar Infraestructura (CDK)**

```bash
cd infra
npm run build
cdk deploy JamStack
```

**Tiempo estimado:** 5-10 minutos

**Qué hace:**
- Crea el nuevo GSI `gsi-proyecto-id-unidad` en la tabla `jam-inventario`
- DynamoDB comenzará a construir el índice (puede tardar si hay muchos items)

**Verificar:**
```bash
aws dynamodb describe-table --table-name jam-inventario \
  | jq '.Table.GlobalSecondaryIndexes[] | select(.IndexName == "gsi-proyecto-id-unidad")'
```

**Esperado:**
```json
{
  "IndexName": "gsi-proyecto-id-unidad",
  "IndexStatus": "CREATING" o "ACTIVE",
  ...
}
```

**⚠️ IMPORTANTE:** Esperar a que el índice esté en estado `ACTIVE` antes de continuar.

---

### **2. Ejecutar Migración de Datos**

**⚠️ Solo ejecutar cuando el GSI esté ACTIVE**

```bash
# Primero, simular (no hace cambios)
python lambdas/scripts/migrar-proyecto-id-unidad.py --dry-run
```

**Revisar el output:**
- Cuántas unidades se actualizarán
- Si hay errores o advertencias

**Ejecutar migración real:**
```bash
python lambdas/scripts/migrar-proyecto-id-unidad.py
```

**Confirmar con:** `yes`

**Tiempo estimado:** Depende del número de unidades
- 100 unidades: ~10 segundos
- 1000 unidades: ~1-2 minutos
- 10000 unidades: ~10-15 minutos

**Verificar:**
```bash
# Verificar que una unidad tenga el nuevo campo
aws dynamodb get-item \
  --table-name jam-inventario \
  --key '{"pk":{"S":"PROYECTO#TU_PROYECTO"},"sk":{"S":"UNIDAD#TU_UNIDAD"}}' \
  | jq '.Item.proyecto_id_unidad'
```

**Esperado:**
```json
{
  "S": "TU_PROYECTO#A-101"
}
```

---

### **3. Desplegar Lambdas (automático con CDK)**

Las lambdas se despliegan automáticamente con el CDK, pero si necesitas forzar actualización:

```bash
cd infra
cdk deploy JamStack --force
```

**Verificar:**
```bash
# Ver versión de la lambda
aws lambda get-function --function-name jam-proyectos \
  | jq '.Configuration.LastModified'
```

---

### **4. Desplegar Frontend**

```bash
cd front
npm run build

# Subir a S3 (ajustar según tu método de despliegue)
aws s3 sync dist/ s3://tu-bucket-frontend/
```

---

## 🧪 Pruebas

### **Desde Frontend Local:**

```bash
cd front
npm run dev
```

**Abrir:** http://localhost:5173

### **Test 1: Listar unidades**
1. Login
2. Ir a Inventario
3. Seleccionar un proyecto
4. **Verificar en DevTools → Network:**
   - Respuesta debe ser objeto con `{items, count}`
   - No debe haber errores

### **Test 2: Filtrar por estado**
1. Aplicar filtro "Disponible"
2. **Verificar:**
   - Solo se muestran unidades disponibles
   - URL incluye `?estado=disponible`

### **Test 3: Crear unidad**
1. Crear una nueva unidad con nombre "TEST-001"
2. **Verificar:** Se crea correctamente
3. Intentar crear otra con el mismo nombre
4. **Verificar:** Error "Ya existe una unidad..."

### **Test 4: Actualizar unidad**
1. Editar una unidad existente
2. Cambiar el nombre a uno que ya existe
3. **Verificar:** Error "Ya existe una unidad..."

---

## 📊 Monitoreo

### **CloudWatch Logs:**

```bash
# Ver logs de jam-proyectos
aws logs tail /aws/lambda/jam-proyectos --follow
```

**Buscar:**
- `IndexName: gsi-estado` → Confirma uso de GSI en listar
- `IndexName: gsi-proyecto-id-unidad` → Confirma uso de GSI en crear/actualizar

### **DynamoDB Metrics:**

1. Ir a **AWS Console → DynamoDB → jam-inventario → Metrics**
2. Ver **Read Capacity Units (RCU)**
3. Comparar antes/después

**Esperado:**
- Reducción significativa en RCU para queries con filtros

---

## 🐛 Troubleshooting

### **Problema: "IndexName not found: gsi-proyecto-id-unidad"**

**Causa:** El GSI aún no está activo

**Solución:**
```bash
# Verificar estado del GSI
aws dynamodb describe-table --table-name jam-inventario \
  | jq '.Table.GlobalSecondaryIndexes[] | select(.IndexName == "gsi-proyecto-id-unidad") | .IndexStatus'
```

Si está en `CREATING`, esperar a que cambie a `ACTIVE`.

---

### **Problema: "Ya existe una unidad..." al crear unidad nueva**

**Causa:** La migración no se ejecutó o falló

**Solución:**
```bash
# Verificar si las unidades tienen el campo
aws dynamodb scan \
  --table-name jam-inventario \
  --filter-expression "begins_with(sk, :unidad)" \
  --expression-attribute-values '{":unidad":{"S":"UNIDAD#"}}' \
  --projection-expression "pk,sk,proyecto_id_unidad" \
  --max-items 5

# Si no tienen proyecto_id_unidad, ejecutar migración
python lambdas/scripts/migrar-proyecto-id-unidad.py
```

---

### **Problema: Frontend muestra array vacío**

**Causa:** El frontend no maneja el nuevo formato

**Solución:**
```bash
cd front
npm run build
# Recargar con Ctrl+Shift+R
```

---

### **Problema: Migración muy lenta**

**Causa:** Muchas unidades en la tabla

**Solución:**
- La migración es segura, puede tardar
- Monitorear el progreso en la consola
- Si se interrumpe, se puede ejecutar de nuevo (skip unidades ya migradas)

---

## ✅ Checklist de Validación

- [ ] Infraestructura desplegada
- [ ] GSI `gsi-proyecto-id-unidad` en estado ACTIVE
- [ ] Migración de datos ejecutada exitosamente
- [ ] Lambdas actualizadas
- [ ] Frontend desplegado
- [ ] Test 1: Listar unidades ✅
- [ ] Test 2: Filtrar por estado ✅
- [ ] Test 3: Crear unidad ✅
- [ ] Test 4: Actualizar unidad ✅
- [ ] Sin errores en CloudWatch Logs
- [ ] Métricas de DynamoDB mejoradas

---

## 📝 Rollback (si es necesario)

### **Si hay problemas críticos:**

1. **Revertir código de lambdas:**
```bash
cd infra
git checkout HEAD~1 lambdas/jam-proyectos/routes/unidades.py
cdk deploy JamStack
```

2. **El GSI puede quedarse** (no afecta negativamente)

3. **El campo `proyecto_id_unidad`** puede quedarse (no afecta negativamente)

4. **Frontend es retrocompatible** (maneja ambos formatos)

---

## 🎯 Próximos Pasos

Una vez validado todo:

1. Monitorear métricas por 24-48 horas
2. Documentar mejoras observadas
3. Continuar con Paso 4 (revisar otras lambdas)

---

## 🔗 Referencias

- `docs/informes/resumen-optimizaciones-backend.md` - Resumen completo
- `docs/informes/refactor-unidades-listar-paso1.md` - Detalles Paso 1
- `docs/informes/guia-pruebas-manual-paso1.md` - Guía de pruebas
- `lambdas/scripts/migrar-proyecto-id-unidad.py` - Script de migración
