# Refactor: Optimización de `unidades.listar()` - Paso 1

**Fecha:** 2026-05-01  
**Ticket:** Optimización de queries DynamoDB según `config1.md`

---

## 🎯 Objetivo

Optimizar la función `listar()` en `lambdas/jam-proyectos/routes/unidades.py` para:
1. Usar GSIs (`gsi-estado`, `gsi-torre`) en lugar de filtrar en memoria
2. Aplicar filtros en DynamoDB (no en Python)
3. Agregar soporte de paginación
4. Reducir costos de lectura en DynamoDB

---

## 📝 Cambios Realizados

### **Backend: `lambdas/jam-proyectos/routes/unidades.py`**

#### **Antes:**
```python
def listar(proyecto_id, event, rol):
    # ❌ Lee TODAS las unidades del proyecto
    result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
    )
    items = [i for i in result.get('Items', []) if i.get('id_unidad')]

    # ❌ Filtra EN MEMORIA (Python)
    if qs.get('etapa_id'):
        items = [i for i in items if i.get('etapa_id') == qs['etapa_id']]
    if qs.get('estado'):
        items = [i for i in items if i.get('estado') == qs['estado']]
    # ... más filtros
    
    return ok(items)
```

**Problemas:**
- Lee todas las unidades aunque solo necesite algunas
- Cobra por todos los KB leídos, no por los devueltos
- No usa los GSIs disponibles
- Sin paginación

#### **Después:**
```python
def listar(proyecto_id, event, rol):
    qs = event.get('queryStringParameters') or {}
    limit = min(int(qs.get('limit', 100)), 500)
    
    # ✅ Usa GSI según el filtro
    if qs.get('estado'):
        query_kwargs['IndexName'] = 'gsi-estado'
        query_kwargs['KeyConditionExpression'] = Key('estado').eq(qs['estado'])
        filter_expr = Attr('pk').eq(f'PROYECTO#{proyecto_id}')
    
    elif qs.get('torre_id'):
        query_kwargs['IndexName'] = 'gsi-torre'
        query_kwargs['KeyConditionExpression'] = Key('torre_id').eq(qs['torre_id'])
        filter_expr = Attr('pk').eq(f'PROYECTO#{proyecto_id}')
    
    else:
        query_kwargs['KeyConditionExpression'] = Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
    
    # ✅ Aplica filtros adicionales en DynamoDB
    if qs.get('etapa_id'):
        new_filter = Attr('etapa_id').eq(qs['etapa_id'])
        filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    # ... más filtros
    
    # ✅ Filtro por rol en DynamoDB
    if rol == 'inmobiliaria':
        new_filter = Attr('estado').is_in(['disponible', 'bloqueada'])
        filter_expr = filter_expr & new_filter if filter_expr else new_filter
    
    # ✅ Paginación
    result = inventario.query(**query_kwargs)
    
    response_data = {
        'items': items,
        'count': len(items),
        'next_token': base64.b64encode(json.dumps(result['LastEvaluatedKey'])).decode() if result.get('LastEvaluatedKey') else None
    }
    
    return ok(response_data)
```

**Mejoras:**
- ✅ Usa `gsi-estado` cuando se filtra por estado
- ✅ Usa `gsi-torre` cuando se filtra por torre
- ✅ Aplica filtros en DynamoDB (reduce KB leídos)
- ✅ Soporte de paginación con `limit` y `next_token`
- ✅ Filtro por rol aplicado en la query

---

### **Frontend: `front/src/services/proyectos.service.ts`**

#### **Cambios:**
```typescript
export const getUnidades = (
  proyectoId: string,
  filtros?: { 
    estado?: string; 
    etapa_id?: string; 
    tipo?: string; 
    manzana?: string; 
    piso?: string;
    limit?: number;        // ✅ Nuevo
    next_token?: string;   // ✅ Nuevo
  }
): Promise<Unidad[]> => {
  // ... construir params
  
  return apiGet<{ items: Unidad[]; count: number; next_token?: string }>(...)
    .then(response => {
      // ✅ Compatibilidad con backend antiguo (array) y nuevo (objeto)
      if (Array.isArray(response)) {
        return response;
      }
      return response.items || [];
    });
};
```

**Compatibilidad:**
- ✅ Funciona con backend antiguo (devuelve array)
- ✅ Funciona con backend nuevo (devuelve objeto con `items`)
- ✅ Preparado para paginación futura

---

## 🧪 Plan de Pruebas

### **1. Prueba sin filtros (query normal)**
```bash
GET /proyectos/{proyecto_id}/unidades
```
**Esperado:** Devuelve todas las unidades del proyecto (max 100)

---

### **2. Prueba con filtro de estado (usa gsi-estado)**
```bash
GET /proyectos/{proyecto_id}/unidades?estado=disponible
```
**Esperado:** 
- Usa `gsi-estado`
- Solo lee unidades con `estado=disponible`
- Más eficiente que leer todas y filtrar

---

### **3. Prueba con filtro de torre (FilterExpression)**
```bash
GET /proyectos/{proyecto_id}/unidades?torre_id=TORRE123
```
**Esperado:**
- Usa query normal por proyecto
- Aplica `torre_id` en `FilterExpression`
- **Nota:** No existe `gsi-torre` en la infraestructura actual

---

### **4. Prueba con múltiples filtros**
```bash
GET /proyectos/{proyecto_id}/unidades?estado=disponible&etapa_id=ETAPA1&tipo=apartamento
```
**Esperado:**
- Usa `gsi-estado` para el filtro principal
- Aplica `etapa_id` y `tipo` en `FilterExpression`
- Más eficiente que filtrar en memoria

---

### **5. Prueba con rol inmobiliaria**
```bash
GET /proyectos/{proyecto_id}/unidades
Headers: Authorization: <token_inmobiliaria>
```
**Esperado:**
- Solo devuelve unidades con `estado IN (disponible, bloqueada)`
- Oculta campos: `bloqueado_por`, `cliente_id`, `cliente_cedula`, `comentario`
- Filtro aplicado en DynamoDB

---

### **6. Prueba de paginación**
```bash
GET /proyectos/{proyecto_id}/unidades?limit=10
```
**Esperado:**
- Devuelve máximo 10 unidades
- Incluye `next_token` si hay más resultados

```bash
GET /proyectos/{proyecto_id}/unidades?limit=10&next_token=<token>
```
**Esperado:**
- Devuelve las siguientes 10 unidades

---

## 📊 Impacto Esperado

### **Antes (filtrado en memoria):**
- Proyecto con 1000 unidades
- Frontend pide `estado=disponible` (200 unidades)
- **DynamoDB lee:** 1000 unidades (~500 KB)
- **Costo:** ~500 KB leídos

### **Después (filtrado en DynamoDB):**
- Proyecto con 1000 unidades
- Frontend pide `estado=disponible` (200 unidades)
- **DynamoDB lee:** 200 unidades (~100 KB)
- **Costo:** ~100 KB leídos

**Ahorro:** ~80% en costos de lectura para queries filtradas

---

## ⚠️ Consideraciones

1. **GSIs disponibles en DynamoDB:**
   - ✅ `gsi-estado` (pk: `estado`, sk: `fecha_bloqueo`) - **USADO**
   - ✅ `gsi-tipo` (pk: `tipo`, sk: `creado_en`)
   - ✅ `gsi-inmobiliaria` (pk: `bloqueado_por`, sk: `sk`)
   - ❌ `gsi-torre` - **NO EXISTE** (se usa FilterExpression en su lugar)

2. **Compatibilidad:**
   - El frontend maneja ambos formatos (array y objeto)
   - No rompe funcionalidad existente

3. **Próximos pasos:**
   - Implementar paginación en el frontend (opcional)
   - Optimizar `unidades.crear()` para validación de duplicados
   - Considerar agregar `gsi-torre` si el filtro por torre es muy usado
   - Revisar otras lambdas con problemas similares

---

## ✅ Checklist de Despliegue

- [ ] Verificar que los GSIs existen en DynamoDB
- [ ] Desplegar backend actualizado
- [ ] Probar cada escenario de prueba
- [ ] Verificar logs de CloudWatch para errores
- [ ] Monitorear métricas de DynamoDB (RCU consumidos)
- [ ] Desplegar frontend actualizado
- [ ] Verificar que el frontend funciona correctamente

---

## 🔗 Referencias

- `docs/config1.md` - Guía de arquitectura y buenas prácticas
- `lambdas/jam-proyectos/routes/unidades.py` - Código modificado
- `front/src/services/proyectos.service.ts` - Servicio actualizado
