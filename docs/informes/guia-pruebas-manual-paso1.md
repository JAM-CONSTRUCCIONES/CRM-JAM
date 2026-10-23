# Guía de Pruebas Manual - Paso 1: Optimización unidades.listar()

**Fecha:** 2026-05-01  
**Método:** Pruebas desde frontend localhost

---

## 🚀 Preparación

### **1. Desplegar Backend**

```bash
cd infra
npm run build
cdk deploy JamStack
```

**Esperar a que termine el despliegue (~3-5 minutos)**

---

### **2. Iniciar Frontend Local**

```bash
cd front
npm run dev
```

**Abrir:** http://localhost:5173

---

## 🧪 Casos de Prueba

### **✅ Test 1: Listar todas las unidades (sin filtros)**

**Pasos:**
1. Login con usuario admin
2. Ir a **Inventario**
3. Seleccionar un proyecto
4. Observar la lista de unidades

**Verificar:**
- ✅ Las unidades se cargan correctamente
- ✅ No hay errores en la consola del navegador
- ✅ Abrir **DevTools → Network → XHR**
- ✅ Buscar la llamada a `/proyectos/{id}/unidades`
- ✅ Ver la respuesta:

**Respuesta esperada (nuevo formato):**
```json
{
  "items": [
    {
      "unidad_id": "ABC123",
      "id_unidad": "A-101",
      "estado": "disponible",
      ...
    }
  ],
  "count": 50,
  "next_token": "..." // opcional
}
```

**Si ves un array directamente, el backend aún no está desplegado:**
```json
[
  {
    "unidad_id": "ABC123",
    ...
  }
]
```

---

### **✅ Test 2: Filtrar por estado**

**Pasos:**
1. En la página de inventario
2. Usar el filtro de **Estado**
3. Seleccionar "Disponible"
4. Observar que la lista se actualiza

**Verificar en Network:**
- ✅ URL debe incluir: `?estado=disponible`
- ✅ Solo se muestran unidades disponibles
- ✅ La respuesta es más rápida (usa GSI)

**Para confirmar que usa GSI:**
- Ir a **CloudWatch → Log groups → /aws/lambda/jam-proyectos**
- Buscar logs recientes
- Debe aparecer algo como:
```
IndexName: gsi-estado
KeyConditionExpression: estado = disponible
```

---

### **✅ Test 3: Múltiples filtros**

**Pasos:**
1. Aplicar filtro de **Estado: Disponible**
2. Aplicar filtro de **Etapa: Etapa 1**
3. Aplicar filtro de **Tipo: Apartamento**

**Verificar en Network:**
- ✅ URL: `?estado=disponible&etapa_id=ETAPA1&tipo=apartamento`
- ✅ Solo se muestran unidades que cumplen TODOS los filtros
- ✅ La lista se actualiza correctamente

---

### **✅ Test 4: Usuario inmobiliaria (filtro por rol)**

**Pasos:**
1. Logout del admin
2. Login con usuario de **inmobiliaria**
3. Ir a **Inventario**
4. Seleccionar un proyecto

**Verificar:**
- ✅ Solo se muestran unidades con estado "Disponible" o "Bloqueada"
- ✅ NO se muestran unidades con estado "No disponible", "Vendida", etc.
- ✅ En la respuesta NO deben aparecer estos campos:
  - `bloqueado_por`
  - `cliente_id`
  - `cliente_cedula`
  - `comentario`

**Verificar en Network → Response:**
```json
{
  "items": [
    {
      "unidad_id": "ABC123",
      "estado": "disponible",
      "precio": 150000
      // ❌ NO debe tener: bloqueado_por, cliente_id, etc.
    }
  ]
}
```

---

### **✅ Test 5: Paginación (si hay muchas unidades)**

**Pasos:**
1. Seleccionar un proyecto con más de 100 unidades
2. Observar la lista

**Verificar en Network:**
- ✅ La respuesta incluye `next_token` si hay más de 100 unidades
- ✅ El frontend carga las primeras 100

**Nota:** La paginación automática en el frontend aún no está implementada, pero el backend ya la soporta.

---

### **✅ Test 6: Rendimiento**

**Comparar tiempos de respuesta:**

**Antes (si tienes acceso a logs antiguos):**
- Proyecto con 1000 unidades
- Filtro `estado=disponible`
- Tiempo: ~2-3 segundos

**Después (con optimización):**
- Proyecto con 1000 unidades
- Filtro `estado=disponible`
- Tiempo: ~0.5-1 segundo

**Verificar en Network → Timing:**
- ✅ El tiempo de respuesta debe ser menor
- ✅ Especialmente notable en proyectos grandes

---

## 🐛 Problemas Comunes

### **Problema 1: Frontend muestra array vacío**

**Síntoma:** La lista de unidades está vacía pero antes funcionaba

**Causa:** El frontend no está manejando el nuevo formato

**Solución:**
```bash
cd front
npm run build
# Recargar la página con Ctrl+Shift+R
```

---

### **Problema 2: Error "IndexName not found"**

**Síntoma:** Error 500 en la llamada API

**Causa:** El GSI `gsi-estado` no existe en DynamoDB

**Solución:**
```bash
# Verificar que el despliegue de CDK terminó correctamente
cd infra
cdk deploy JamStack

# Verificar GSIs en DynamoDB
aws dynamodb describe-table --table-name jam-inventario \
  | grep -A 5 GlobalSecondaryIndexes
```

---

### **Problema 3: Filtros no funcionan**

**Síntoma:** Los filtros no reducen la lista

**Causa:** El backend antiguo aún está activo

**Solución:**
1. Verificar que el despliegue terminó
2. Esperar 1-2 minutos para que Lambda se actualice
3. Hacer hard refresh (Ctrl+Shift+R)

---

## 📊 Métricas a Revisar

### **CloudWatch Logs**

```bash
# Ver logs en tiempo real
aws logs tail /aws/lambda/jam-proyectos --follow
```

**Buscar:**
- `IndexName: gsi-estado` → Confirma que usa GSI
- `FilterExpression` → Confirma que filtra en DynamoDB

---

### **DynamoDB Metrics**

1. Ir a **AWS Console → DynamoDB → jam-inventario → Metrics**
2. Ver **Read Capacity Units (RCU)**
3. Comparar antes/después de aplicar filtros

**Esperado:**
- Reducción de ~80% en RCU cuando se usan filtros

---

## ✅ Checklist de Validación

Marca cada item después de probarlo:

- [ ] Backend desplegado correctamente
- [ ] Frontend local corriendo
- [ ] Test 1: Listar sin filtros ✅
- [ ] Test 2: Filtrar por estado ✅
- [ ] Test 3: Múltiples filtros ✅
- [ ] Test 4: Usuario inmobiliaria ✅
- [ ] Test 5: Paginación (si aplica) ✅
- [ ] Test 6: Rendimiento mejorado ✅
- [ ] Sin errores en consola del navegador
- [ ] Sin errores en CloudWatch Logs
- [ ] Respuesta en formato nuevo (objeto con `items`)

---

## 📝 Reporte de Resultados

Después de probar, documenta:

### **✅ Funciona correctamente:**
- [ ] Listar unidades
- [ ] Filtros por estado
- [ ] Filtros múltiples
- [ ] Filtro por rol (inmobiliaria)
- [ ] Paginación
- [ ] Rendimiento

### **❌ Problemas encontrados:**
```
Describe aquí cualquier problema:
- Problema 1: ...
- Problema 2: ...
```

### **📊 Métricas observadas:**
```
- Tiempo de respuesta sin filtros: ___ ms
- Tiempo de respuesta con filtro estado: ___ ms
- Reducción de tiempo: ___% 
```

---

## 🎯 Próximos Pasos

Una vez validado el Paso 1:

1. **Paso 2:** Optimizar `unidades.crear()` (validación de duplicados)
2. **Paso 3:** Revisar otras lambdas con problemas similares
3. **Paso 4:** Implementar paginación en el frontend (opcional)

---

## 🔗 Referencias

- `docs/informes/refactor-unidades-listar-paso1.md` - Detalles técnicos
- `docs/informes/test-plan-paso1.md` - Plan de pruebas completo
- `lambdas/jam-proyectos/routes/unidades.py` - Código modificado
