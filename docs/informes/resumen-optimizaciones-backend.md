# Resumen de Optimizaciones Backend - DynamoDB Queries

**Fecha:** 2026-05-01  
**Objetivo:** Optimizar queries de DynamoDB según `docs/config1.md`

---

## ✅ PASO 1: COMPLETADO - `unidades.listar()`

### **Archivos modificados:**
1. `lambdas/jam-proyectos/routes/unidades.py`
2. `front/src/services/proyectos.service.ts`

### **Cambios realizados:**

#### **Backend (`unidades.py`):**
- ✅ Agregado import de `Attr` y `base64`
- ✅ Usa `gsi-estado` cuando se filtra por estado
- ✅ Aplica filtros en DynamoDB (no en memoria Python)
- ✅ Agregado soporte de paginación (`limit`, `next_token`)
- ✅ Filtro por rol (inmobiliaria) aplicado en DynamoDB
- ✅ Respuesta cambiada de `array` a `objeto` con `{items, count, next_token}`

**Antes:**
```python
# ❌ Lee TODAS las unidades
result = inventario.query(
    KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
)
items = result.get('Items', [])

# ❌ Filtra EN MEMORIA
if qs.get('estado'):
    items = [i for i in items if i.get('estado') == qs['estado']]
```

**Después:**
```python
# ✅ Usa GSI si hay filtro de estado
if qs.get('estado'):
    query_kwargs['IndexName'] = 'gsi-estado'
    query_kwargs['KeyConditionExpression'] = Key('estado').eq(qs['estado'])
    filter_expr = Attr('pk').eq(f'PROYECTO#{proyecto_id}')

# ✅ Aplica otros filtros en DynamoDB
if qs.get('etapa_id'):
    new_filter = Attr('etapa_id').eq(qs['etapa_id'])
    filter_expr = filter_expr & new_filter if filter_expr else new_filter
```

#### **Frontend (`proyectos.service.ts`):**
- ✅ Compatibilidad con respuesta antigua (array) y nueva (objeto)
- ✅ Agregado soporte para `limit` y `next_token`

**Cambio:**
```typescript
return apiGet<{ items: Unidad[]; count: number; next_token?: string }>(...)
  .then(response => {
    // Compatibilidad con backend antiguo
    if (Array.isArray(response)) {
      return response;
    }
    return response.items || [];
  });
```

### **Impacto esperado:**
- 🚀 **Reducción de ~80% en RCU** para queries con filtros
- 🚀 **Tiempo de respuesta más rápido** en proyectos grandes
- 🔒 **Filtro por rol más seguro** (aplicado en backend)

---

## ✅ PASO 2: COMPLETADO - `unidades.crear()` y `unidades.actualizar()`

### **Archivos modificados:**
1. `infra/lib/jam-stack.ts`
2. `lambdas/jam-proyectos/routes/unidades.py`

### **Cambios realizados:**

#### **Infraestructura (`jam-stack.ts`):**
- ✅ Agregado GSI `gsi-proyecto-id-unidad`
  - pk: `proyecto_id_unidad` (formato: `PROYECTO123#A-101`)
  - Permite validar duplicados sin leer todas las unidades

#### **Backend (`unidades.py`):**

**`crear()`:**
- ✅ Agregado campo `proyecto_id_unidad` a cada unidad
- ✅ Usa GSI para validar duplicados (1 query en lugar de leer todas)
- ✅ Más eficiente en proyectos con muchas unidades

**Antes:**
```python
# ❌ Lee TODAS las unidades del proyecto
existing = inventario.query(
    KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
)
for u in existing.get('Items', []):
    if u.get('id_unidad', '').strip().upper() == id_unidad.upper():
        return bad_request(...)
```

**Después:**
```python
# ✅ Query directo por GSI (solo 1 item)
proyecto_id_unidad = f"{proyecto_id}#{id_unidad.upper()}"
existing = inventario.query(
    IndexName='gsi-proyecto-id-unidad',
    KeyConditionExpression=Key('proyecto_id_unidad').eq(proyecto_id_unidad),
    Limit=1
)
if existing.get('Items'):
    return bad_request(...)
```

**`actualizar()`:**
- ✅ Usa el mismo GSI para validar duplicados
- ✅ Actualiza el campo `proyecto_id_unidad` si cambia `id_unidad`

### **Impacto esperado:**
- 🚀 **Reducción de ~95% en RCU** para validación de duplicados
- 🚀 **Tiempo de creación/actualización más rápido**
- 📊 **Ejemplo:** Proyecto con 1000 unidades
  - Antes: Lee 1000 unidades (~500 KB)
  - Después: Lee 1 unidad (~0.5 KB)

---

## ✅ PASO 3: Migración de datos existentes

### **Problema:**
Las unidades existentes no tienen el campo `proyecto_id_unidad`

### **Solución:**
Script de migración: `lambdas/scripts/migrar-proyecto-id-unidad.py`

### **Uso:**
```bash
# 1. Simular migración (no hace cambios)
python lambdas/scripts/migrar-proyecto-id-unidad.py --dry-run

# 2. Ejecutar migración real
python lambdas/scripts/migrar-proyecto-id-unidad.py

# 3. Para otra tabla
python lambdas/scripts/migrar-proyecto-id-unidad.py --table-name jam-inventario-dev
```

### **Qué hace:**
1. Escanea todas las unidades en la tabla
2. Para cada unidad:
   - Extrae `proyecto_id` del `pk`
   - Crea `proyecto_id_unidad = f"{proyecto_id}#{id_unidad.upper()}"`
   - Actualiza el item con el nuevo campo
3. Muestra resumen de actualizaciones

### **Cuándo ejecutar:**
- **Después** de desplegar la infraestructura (GSI creado)
- **Antes** de desplegar el código de las lambdas
- Solo necesita ejecutarse **una vez**

---

## 🔄 PASO 4: REVISAR - Otras lambdas

### **Lambdas a revisar:**

#### **1. `jam-bloqueos/routes/bloqueos.py`**

**Función: `listar_activos()`**
```python
# ✅ Ya usa gsi-estado correctamente
result = inventario.query(
    IndexName='gsi-estado',
    KeyConditionExpression=Key('estado').eq('bloqueada'),
    Limit=limit,
)
```
**Estado:** ✅ Optimizado

---

#### **2. `jam-crm/routes/analytics.py`**

**Función: `get_analytics()`**
```python
# ✅ Ya usa GSIs correctamente
procesos = _scan_all(
    procesos_table,
    index='gsi-proyecto-procesos',
    key_cond=Key('proyecto_id').eq(proyecto_id),
)

clientes = _scan_all(
    clientes_table,
    index='gsi-proyecto-clientes',
    key_cond=Key('proyecto_id').eq(proyecto_id),
)

# ⚠️ Posible optimización: agregar paginación
unidades_raw = inventario_table.query(
    KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
)
```

**Recomendación:**
- Agregar `Limit` si el proyecto tiene muchas unidades
- O usar paginación automática en `_scan_all()`

---

#### **3. `jam-proyectos/routes/proyectos.py`**

**Función: `listar()`**
```python
# ✅ Ya usa gsi-tipo correctamente
result = inventario.query(
    IndexName='gsi-tipo',
    KeyConditionExpression=Key('tipo').eq('PROYECTO'),
    FilterExpression=Attr('activo').eq(True)
)
```
**Estado:** ✅ Optimizado

---

#### **4. `jam-proyectos/routes/etapas.py`**

**Revisar si hay queries que puedan optimizarse**

---

## 📊 Resumen de GSIs Disponibles

### **Tabla: `jam-inventario`**
- ✅ `gsi-tipo` (pk: `tipo`, sk: `creado_en`)
- ✅ `gsi-estado` (pk: `estado`, sk: `fecha_bloqueo`) - **USADO en Paso 1**
- ✅ `gsi-inmobiliaria` (pk: `bloqueado_por`, sk: `sk`)
- ✅ `gsi-proyecto-id-unidad` (pk: `proyecto_id_unidad`) - **NUEVO en Paso 2**
- ❌ `gsi-torre` - **NO EXISTE**

### **Tabla: `jam-usuarios`**
- ✅ `gsi-tipo` (pk: `tipo`, sk: `creado_en`)
- ✅ `gsi-por-inmobiliaria` (pk: `inmobiliaria_id`, sk: `pk`)

### **Tabla: `jam-clientes`**
- ✅ `gsi-inmobiliaria-clientes` (pk: `inmobiliaria_id`, sk: `fecha_captacion`)
- ✅ `gsi-proyecto-clientes` (pk: `proyecto_id`, sk: `fecha_captacion`)
- ✅ `gsi-cedula-proyecto` (pk: `cedula`, sk: `sk`)

### **Tabla: `jam-procesos`**
- ✅ `gsi-cedula-procesos` (pk: `cedula`, sk: `actualizado_en`)
- ✅ `gsi-proyecto-procesos` (pk: `proyecto_id`, sk: `estado`)
- ✅ `gsi-inmobiliaria-procesos` (pk: `inmobiliaria_id`, sk: `actualizado_en`)

---

## 🎯 Plan de Acción

### **Completado:**
- [x] **Paso 1:** Optimizar `unidades.listar()`
- [x] **Paso 2:** Optimizar `unidades.crear()` y `unidades.actualizar()`
- [x] **Paso 3:** Script de migración de datos

### **Ahora (para probar):**
1. [ ] **Desplegar infraestructura** (CDK)
2. [ ] **Ejecutar migración** de datos existentes
3. [ ] **Desplegar lambdas** actualizadas
4. [ ] **Probar desde frontend local**

### **Siguiente (Paso 4):**
- [ ] Revisar `analytics.py` (agregar paginación si es necesario)
- [ ] Revisar `etapas.py`
- [ ] Revisar otras lambdas

---

## 📝 Notas

- **Compatibilidad:** Todos los cambios son retrocompatibles
- **Frontend:** Maneja ambos formatos (array y objeto)
- **Despliegue:** Desplegar backend primero, luego frontend
- **Rollback:** Si hay problemas, el frontend sigue funcionando con formato antiguo

---

## 🔗 Referencias

- `docs/config1.md` - Guía de arquitectura
- `docs/informes/refactor-unidades-listar-paso1.md` - Detalles técnicos Paso 1
- `docs/informes/guia-pruebas-manual-paso1.md` - Guía de pruebas
