# Plan de Pruebas - Paso 1: Optimización unidades.listar()

**Fecha:** 2026-05-01  
**Estado:** ✅ Código actualizado, listo para probar

---

## 📋 Checklist Pre-Despliegue

### **Backend:**
- [x] Modificado `lambdas/jam-proyectos/routes/unidades.py`
- [x] Agregado import de `Attr` y `base64`
- [x] Implementado uso de `gsi-estado` para filtros por estado
- [x] Agregado soporte de paginación
- [x] Filtros aplicados en DynamoDB (no en memoria)

### **Frontend:**
- [x] Actualizado `front/src/services/proyectos.service.ts`
- [x] Compatibilidad con respuesta antigua (array) y nueva (objeto)
- [x] Preparado para paginación futura

---

## 🧪 Escenarios de Prueba

### **Escenario 1: Sin filtros (comportamiento base)**

**Request:**
```bash
curl -X GET \
  'https://API_URL/proyectos/PROYECTO123/unidades' \
  -H 'Authorization: Bearer TOKEN'
```

**Esperado:**
```json
{
  "items": [
    {
      "unidad_id": "ABC123",
      "id_unidad": "A-101",
      "estado": "disponible",
      "precio": 150000,
      ...
    }
  ],
  "count": 50,
  "next_token": "eyJ..." // si hay más de 100 resultados
}
```

**Validar:**
- ✅ Devuelve objeto con `items`, `count`
- ✅ Máximo 100 unidades por defecto
- ✅ Incluye `next_token` si hay más resultados

---

### **Escenario 2: Filtro por estado (usa GSI)**

**Request:**
```bash
curl -X GET \
  'https://API_URL/proyectos/PROYECTO123/unidades?estado=disponible' \
  -H 'Authorization: Bearer TOKEN'
```

**Esperado:**
- ✅ Usa `gsi-estado` (verificar en CloudWatch Logs)
- ✅ Solo devuelve unidades con `estado=disponible`
- ✅ Más eficiente que leer todas las unidades

**Logs esperados en CloudWatch:**
```
IndexName: gsi-estado
KeyConditionExpression: estado = disponible
FilterExpression: pk = PROYECTO#PROYECTO123
```

---

### **Escenario 3: Múltiples filtros**

**Request:**
```bash
curl -X GET \
  'https://API_URL/proyectos/PROYECTO123/unidades?estado=disponible&etapa_id=ETAPA1&tipo=apartamento' \
  -H 'Authorization: Bearer TOKEN'
```

**Esperado:**
- ✅ Usa `gsi-estado` para filtro principal
- ✅ Aplica `etapa_id` y `tipo` en `FilterExpression`
- ✅ Devuelve solo unidades que cumplen TODOS los filtros

---

### **Escenario 4: Usuario inmobiliaria (filtro por rol)**

**Request:**
```bash
curl -X GET \
  'https://API_URL/proyectos/PROYECTO123/unidades' \
  -H 'Authorization: Bearer TOKEN_INMOBILIARIA'
```

**Esperado:**
```json
{
  "items": [
    {
      "unidad_id": "ABC123",
      "id_unidad": "A-101",
      "estado": "disponible",
      "precio": 150000
      // ❌ NO incluye: bloqueado_por, cliente_id, cliente_cedula, comentario
    }
  ],
  "count": 30
}
```

**Validar:**
- ✅ Solo devuelve unidades con `estado IN (disponible, bloqueada)`
- ✅ Campos sensibles ocultos
- ✅ Filtro aplicado en DynamoDB (no en memoria)

---

### **Escenario 5: Paginación**

**Request 1:**
```bash
curl -X GET \
  'https://API_URL/proyectos/PROYECTO123/unidades?limit=10' \
  -H 'Authorization: Bearer TOKEN'
```

**Response 1:**
```json
{
  "items": [...], // 10 unidades
  "count": 10,
  "next_token": "eyJwayI6IlBST1lFQ1RPIzEyMyIsInNrIjoiVU5JREFEIzEwIn0="
}
```

**Request 2 (siguiente página):**
```bash
curl -X GET \
  'https://API_URL/proyectos/PROYECTO123/unidades?limit=10&next_token=eyJwayI6IlBST1lFQ1RPIzEyMyIsInNrIjoiVU5JREFEIzEwIn0=' \
  -H 'Authorization: Bearer TOKEN'
```

**Response 2:**
```json
{
  "items": [...], // siguientes 10 unidades
  "count": 10,
  "next_token": "..." // o null si no hay más
}
```

---

### **Escenario 6: Compatibilidad con frontend antiguo**

**Validar que el frontend:**
- ✅ Maneja respuesta tipo array (backend antiguo)
- ✅ Maneja respuesta tipo objeto (backend nuevo)
- ✅ No rompe funcionalidad existente

**Código del servicio:**
```typescript
.then(response => {
  // Si es array (backend antiguo), devolverlo directamente
  if (Array.isArray(response)) {
    return response;
  }
  // Si es objeto (backend nuevo), devolver items
  return response.items || [];
});
```

---

## 📊 Métricas a Monitorear

### **CloudWatch Logs (Lambda jam-proyectos):**

Buscar en los logs:
```
IndexName: gsi-estado
```

Esto confirma que se está usando el GSI.

### **DynamoDB Metrics:**

**Antes del cambio:**
- Query con filtro `estado=disponible` en proyecto con 1000 unidades
- **Read Capacity Units (RCU):** ~125 (lee todas las 1000 unidades)

**Después del cambio:**
- Query con filtro `estado=disponible` en proyecto con 1000 unidades (200 disponibles)
- **Read Capacity Units (RCU):** ~25 (lee solo las 200 disponibles)

**Ahorro esperado:** ~80% en RCU para queries filtradas

---

## 🚀 Pasos para Desplegar

### **1. Desplegar Backend**

```bash
cd infra
npm run build
cdk deploy JamStack --require-approval never
```

**Verificar:**
- ✅ Lambda `jam-proyectos` actualizada
- ✅ Sin errores en el despliegue

### **2. Probar Backend (antes de desplegar frontend)**

```bash
# Obtener token de autenticación
TOKEN=$(curl -X POST https://API_URL/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"PASSWORD"}' \
  | jq -r '.idToken')

# Probar endpoint sin filtros
curl -X GET "https://API_URL/proyectos/PROYECTO_ID/unidades" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.items | length'

# Probar endpoint con filtro de estado
curl -X GET "https://API_URL/proyectos/PROYECTO_ID/unidades?estado=disponible" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.items | length'
```

### **3. Desplegar Frontend**

```bash
cd front
npm run build
# Subir a S3 o tu método de despliegue
```

### **4. Verificar en Producción**

- ✅ Abrir el sistema en el navegador
- ✅ Navegar a Inventario
- ✅ Aplicar filtros (estado, etapa, tipo)
- ✅ Verificar que los datos se cargan correctamente
- ✅ Revisar Network tab (debe devolver objeto con `items`)

---

## 🐛 Troubleshooting

### **Error: "IndexName not found"**

**Causa:** El GSI `gsi-estado` no existe en DynamoDB

**Solución:**
```bash
# Verificar GSIs en la tabla
aws dynamodb describe-table --table-name jam-inventario \
  | jq '.Table.GlobalSecondaryIndexes[].IndexName'
```

Debe incluir: `gsi-estado`

---

### **Error: "FilterExpression syntax error"**

**Causa:** Error en la construcción del FilterExpression

**Solución:** Revisar logs de CloudWatch para ver el error exacto

---

### **Frontend muestra array vacío**

**Causa:** El frontend espera array pero recibe objeto

**Solución:** Verificar que el código de compatibilidad está desplegado:
```typescript
if (Array.isArray(response)) {
  return response;
}
return response.items || [];
```

---

## ✅ Criterios de Éxito

- [ ] Backend desplegado sin errores
- [ ] Endpoint devuelve objeto con `items` y `count`
- [ ] Filtro por estado usa `gsi-estado` (verificado en logs)
- [ ] Paginación funciona correctamente
- [ ] Usuario inmobiliaria solo ve unidades permitidas
- [ ] Frontend carga datos correctamente
- [ ] No hay errores en consola del navegador
- [ ] Métricas de DynamoDB muestran reducción en RCU

---

## 📝 Notas

- Este es el **Paso 1** de la optimización
- Próximos pasos:
  - **Paso 2:** Optimizar validación de duplicados en `unidades.crear()`
  - **Paso 3:** Revisar otras lambdas con problemas similares
  - **Paso 4:** Considerar agregar `gsi-torre` si es necesario

---

## 🔗 Referencias

- `docs/informes/refactor-unidades-listar-paso1.md` - Detalles técnicos
- `lambdas/jam-proyectos/routes/unidades.py` - Código modificado
- `front/src/services/proyectos.service.ts` - Servicio actualizado
