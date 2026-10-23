# Mejora del Filtrado de Procesos

**Fecha:** 2026-05-09  
**Objetivo:** Optimizar el módulo de procesos con selección obligatoria de proyecto y filtrado eficiente usando GSI

---

## 🎯 Cambios Implementados

### 1. Frontend - Selección de Proyecto con Cards

#### Nueva Vista de Proyectos
- Al entrar a `/procesos`, se muestra una vista de cards con todos los proyectos disponibles
- Diseño visual consistente con el módulo de Inventario
- Cards con imágenes o gradientes de colores
- Hover effects para mejor UX

#### Navegación Mejorada
- Botón "Volver a proyectos" con icono de flecha
- Título dinámico que muestra el proyecto seleccionado
- Breadcrumb visual claro

#### Filtrado Local (Frontend)
- **Todos los filtros se aplican localmente** después de cargar los datos
- Filtros disponibles:
  - Búsqueda por texto (cliente, cédula, unidad)
  - Inmobiliaria
  - Estado del proceso
- **Sin paginación** - todos los procesos se cargan de una vez
- Máximo esperado: ~300 procesos por proyecto

### 2. Backend - Optimización con GSI

#### Cambios en `lambdas/jam-crm/routes/estatus.py`

**Antes:**
```python
# Paginación con límite de 100-200 registros
kwargs = {
    'IndexName': 'gsi-proyecto-procesos',
    'KeyConditionExpression': key_cond,
    'Limit': limit,
}
result = query_fn(**kwargs)
items = result.get('Items', [])
```

**Después:**
```python
# Cargar TODOS los procesos del proyecto (loop de paginación)
items = []
while True:
    result = query_fn(**kwargs)
    items.extend(result.get('Items', []))
    last_key = result.get('LastEvaluatedKey')
    if not last_key:
        break
    kwargs['ExclusiveStartKey'] = last_key
```

#### Ventajas del Nuevo Enfoque

✅ **Siempre usa GSI** (`gsi-proyecto-procesos`)
- No más scans completos de la tabla
- Queries eficientes por proyecto

✅ **Carga completa en una sola llamada**
- Frontend recibe todos los procesos del proyecto
- Filtrado instantáneo sin llamadas adicionales al backend

✅ **Filtrado de inmobiliaria en backend**
- Cuando se usa GSI de proyecto + filtro de inmobiliaria
- Se filtra en Python después de la query

✅ **Sin paginación en respuesta**
- Se eliminó `next_token` de la respuesta
- Todos los datos se devuelven en `items`

---

## 📊 Flujo de Usuario

```
1. Usuario entra a /procesos
   ↓
2. Ve cards de proyectos disponibles
   ↓
3. Selecciona un proyecto (click en card)
   ↓
4. Backend carga TODOS los procesos del proyecto usando GSI
   ↓
5. Frontend recibe ~300 procesos (máximo esperado)
   ↓
6. Usuario aplica filtros locales:
   - Búsqueda por texto (instantánea)
   - Inmobiliaria (instantánea)
   - Estado (instantánea)
   ↓
7. Puede volver a proyectos con el botón de flecha
```

---

## 🚀 Rendimiento

### Antes
- Paginación con límite de 100 registros
- Múltiples llamadas al backend para ver todos los procesos
- Filtros requieren nueva llamada al backend
- Latencia acumulada por múltiples requests

### Después
- **1 sola llamada** al backend por proyecto
- Filtrado instantáneo en frontend (sin latencia)
- Búsqueda en tiempo real sin delays
- Mejor experiencia de usuario

### Estimaciones
- **300 procesos** × ~2KB por proceso = **~600KB** de datos
- Tiempo de carga: **< 1 segundo** (usando GSI)
- Filtrado local: **< 50ms** (JavaScript en memoria)

---

## 🔧 Archivos Modificados

### Frontend
- `front/src/pages/procesos/ProcesosPage.tsx`
  - Agregada vista de proyectos con cards
  - Eliminada paginación
  - Filtrado local de todos los datos
  - Navegación entre vistas

### Backend
- `lambdas/jam-crm/routes/estatus.py`
  - Loop de paginación para cargar todos los procesos
  - Eliminado `next_token` en respuesta
  - Filtrado de inmobiliaria en Python cuando se usa GSI de proyecto

---

## ✅ Ventajas del Nuevo Sistema

1. **Mejor UX**
   - Selección visual de proyectos
   - Filtrado instantáneo
   - Sin esperas entre filtros

2. **Mejor Rendimiento**
   - Siempre usa GSI (no scans)
   - 1 sola llamada al backend
   - Filtrado en memoria (muy rápido)

3. **Menor Costo**
   - Menos llamadas a DynamoDB
   - Queries eficientes por GSI
   - Sin scans costosos

4. **Escalabilidad**
   - Funciona bien hasta 500-1000 procesos por proyecto
   - Si crece más, se puede agregar paginación virtual en frontend

---

## 🎨 Diseño Visual

### Cards de Proyectos
- Imagen o gradiente de color
- Nombre y descripción del proyecto
- Hover effect con elevación
- Responsive (mobile y desktop)

### Vista de Procesos
- Header con botón de volver
- Filtros en línea (búsqueda, inmobiliaria, estado)
- Tabs: Activos / Cerrados / Historial
- Tabla o cards según dispositivo

---

## 📝 Notas Técnicas

### GSI Utilizado
- **Nombre:** `gsi-proyecto-procesos`
- **PK:** `proyecto_id`
- **SK:** `estado`
- **Uso:** Query eficiente por proyecto

### Filtrado en Capas
1. **Backend:** Filtra por proyecto (GSI)
2. **Backend:** Filtra por inmobiliaria si aplica (Python)
3. **Frontend:** Filtra por búsqueda, estado, inmobiliaria (JavaScript)

### Límites
- Máximo esperado: 300 procesos por proyecto
- Si crece más: considerar paginación virtual o lazy loading
- Actualmente: carga completa es aceptable

---

## 🔄 Próximos Pasos (Opcional)

Si en el futuro hay proyectos con > 1000 procesos:
1. Implementar paginación virtual en frontend (react-window)
2. Agregar lazy loading al hacer scroll
3. Mantener filtrado local para mejor UX

Por ahora, con 300 procesos máximo, el sistema actual es óptimo.
