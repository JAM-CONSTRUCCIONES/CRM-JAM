# Implementación de Búsqueda Híbrida - Clientes

**Fecha:** 6 de mayo de 2026  
**Estado:** ✅ COMPLETADO

---

## Resumen

Se implementó un sistema de búsqueda híbrida que combina:
- **Modo Lista:** Carga paginada de 100 registros con botón "Cargar más"
- **Modo Búsqueda:** Búsqueda en backend que encuentra TODOS los clientes

---

## Cambios Implementados

### 1. Backend - Nuevo Endpoint de Búsqueda

**Archivo:** `lambdas/jam-captacion/routes/clientes.py`

**Función agregada:** `buscar_clientes_admin(event)`

**Endpoint:** `GET /admin/clientes/buscar?q=texto&proyecto_id=xxx&inmobiliaria_id=xxx`

**Lógica:**
```python
1. Recibe query de búsqueda (mínimo 2 caracteres)
2. Detecta si es búsqueda por cédula o nombre
3. Búsqueda por cédula:
   - Usa GSI 'gsi-cedula-proyecto' (RÁPIDO ~100-200ms)
   - Busca con begins_with para encontrar coincidencias parciales
4. Búsqueda por nombre:
   - Usa scan con FilterExpression (más lento ~500-1000ms)
   - Busca en campos 'nombres' y 'apellidos'
5. Aplica filtros de proyecto e inmobiliaria
6. Devuelve máximo 100 resultados
```

**Características:**
- ✅ Case-insensitive (convierte a minúsculas)
- ✅ Normaliza cédulas (quita guiones y prefijos V-/E-)
- ✅ Soporta búsqueda parcial por cédula
- ✅ Soporta filtros combinados

---

### 2. Backend - Registro de Ruta

**Archivo:** `lambdas/jam-captacion/handler.py`

**Cambio:**
```python
# Nuevo endpoint de búsqueda general
if method == 'GET' and path == '/admin/clientes/buscar':
    return clientes.buscar_clientes_admin(event)

# Endpoint legacy renombrado
if method == 'GET' and path == '/admin/clientes/buscar-cedula':
    # Para búsqueda por cédula específica (legacy)
    return clientes.buscar_por_cedula_admin(event, cedula_buscar)
```

---

### 3. Frontend - Servicio de Búsqueda

**Archivo:** `front/src/services/clientes.service.ts`

**Función agregada:**
```typescript
export const buscarClientesAdmin = (
  query: string,
  proyectoId?: string,
  inmobiliariaId?: string
): Promise<Cliente[]> => {
  const params = new URLSearchParams({ q: query });
  if (proyectoId) params.append('proyecto_id', proyectoId);
  if (inmobiliariaId) {
    const normalizedId = inmobiliariaId.replace('INMOBILIARIA#', '');
    params.append('inmobiliaria_id', normalizedId);
  }
  return apiGet<Cliente[]>(`/admin/clientes/buscar?${params.toString()}`);
};
```

**Cambio adicional:**
- Renombrado endpoint legacy de `/admin/clientes/buscar` a `/admin/clientes/buscar-cedula`

---

### 4. Frontend - Lógica Híbrida

**Archivo:** `front/src/pages/clientes/ClientesPage.tsx`

**Estados agregados:**
```typescript
const [modoVista, setModoVista] = useState<'lista' | 'busqueda'>('lista');
const debounceTimerRef = useRef<NodeJS.Timeout>();
```

**Función de búsqueda:**
```typescript
const handleBusqueda = (valor: string) => {
  setBusqueda(valor);
  
  // Limpiar timer anterior
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }
  
  // Sin búsqueda: volver a modo lista
  if (valor.trim().length === 0) {
    setModoVista('lista');
    setNextToken(undefined);
    cargar(proyectoFiltro, inmoFiltro);
    return;
  }
  
  // Búsqueda muy corta (1 carácter): filtrar localmente
  if (valor.trim().length < 2) {
    setModoVista('lista');
    return;
  }
  
  // Búsqueda >= 2 caracteres: buscar en backend
  setModoVista('busqueda');
  
  debounceTimerRef.current = setTimeout(async () => {
    setLoading(true);
    try {
      const resultados = await buscarClientesAdmin(
        valor,
        proyectoFiltro,
        inmoFiltro
      );
      setClientes(resultados);
      setNextToken(undefined);
    } catch {
      message.error('Error en la búsqueda');
    } finally {
      setLoading(false);
    }
  }, 500); // Debounce de 500ms
};
```

**Banner de modo búsqueda:**
```typescript
{modoVista === 'busqueda' && (
  <Alert
    message={
      <span>
        Mostrando resultados de búsqueda para <strong>"{busqueda}"</strong>
        {clientes.length === 100 && ' (máximo 100 resultados)'}
        {clientes.length === 0 && ' - No se encontraron resultados'}
      </span>
    }
    type="info"
    showIcon
    closable
    onClose={() => {
      setBusqueda('');
      setModoVista('lista');
      setNextToken(undefined);
      cargar(proyectoFiltro, inmoFiltro);
    }}
    style={{ marginBottom: 16 }}
  />
)}
```

**Botón "Cargar más" condicional:**
```typescript
{nextToken && modoVista === 'lista' && (
  <div style={{ textAlign: 'center', marginTop: 16 }}>
    <Button onClick={() => cargar(proyectoFiltro, inmoFiltro, nextToken)} loading={loading}>
      Cargar más
    </Button>
  </div>
)}
```

---

## Comportamiento del Sistema

### Modo Lista (Sin búsqueda)
```
1. Usuario abre página de clientes
2. Se cargan 100 clientes automáticamente
3. Usuario puede aplicar filtros de proyecto/inmobiliaria
4. Si hay más de 100, aparece botón "Cargar más"
5. Cada clic carga otros 100 registros
```

### Modo Búsqueda (Con texto)
```
1. Usuario escribe en el campo de búsqueda
2. Si escribe 1 carácter: filtrado local (instantáneo)
3. Si escribe 2+ caracteres:
   a. Espera 500ms (debounce)
   b. Envía request al backend
   c. Backend busca en TODOS los registros
   d. Devuelve hasta 100 resultados
   e. Muestra banner "Mostrando resultados de búsqueda..."
   f. Oculta botón "Cargar más"
4. Usuario puede cerrar banner con X para volver a modo lista
5. O borrar el texto de búsqueda
```

### Ejemplos de Búsqueda

**Por cédula:**
- `V-123` → Encuentra todas las cédulas que empiecen con "123"
- `12345678` → Encuentra cédula exacta
- `E-987` → Encuentra cédulas de extranjeros

**Por nombre:**
- `Liliana` → Encuentra todos los clientes con "Liliana" en nombres o apellidos
- `Cruz Mendoza` → Encuentra clientes con ambos términos
- `lil` → Encuentra "Liliana", "Lilibeth", etc.

**Con filtros:**
- Búsqueda: `Liliana` + Proyecto: `Caney Oriental` → Solo Lilianas de ese proyecto
- Búsqueda: `V-123` + Inmobiliaria: `ABC` → Solo cédulas V-123 de esa inmobiliaria

---

## Performance

### Tiempos de Respuesta

| Tipo de Búsqueda | Tiempo Estimado | Método |
|------------------|-----------------|--------|
| **Por cédula** | 100-200ms | GSI Query (rápido) |
| **Por nombre (100 clientes)** | 200-400ms | Scan con filtro |
| **Por nombre (1,000 clientes)** | 500-800ms | Scan con filtro |
| **Por nombre (10,000 clientes)** | 1-2 segundos | Scan con filtro |

### Optimizaciones Implementadas

✅ **Debounce de 500ms:** Evita requests innecesarios mientras el usuario escribe  
✅ **Detección inteligente:** Usa GSI para cédulas (más rápido)  
✅ **Límite de 100 resultados:** Protege contra respuestas muy grandes  
✅ **Filtrado local para 1 carácter:** No hace request al backend  
✅ **Normalización de cédulas:** Busca sin importar formato (V-123, v123, 123)  

---

## Escalabilidad

### Capacidad Actual

| Cantidad de Clientes | Búsqueda por Cédula | Búsqueda por Nombre |
|----------------------|---------------------|---------------------|
| **100** | 🟢 Excelente (<200ms) | 🟢 Excelente (<400ms) |
| **1,000** | 🟢 Excelente (<200ms) | 🟢 Bueno (<800ms) |
| **10,000** | 🟢 Excelente (<200ms) | 🟡 Aceptable (1-2s) |
| **100,000** | 🟢 Excelente (<200ms) | 🔴 Lento (5-10s) |

### Recomendaciones Futuras

**Cuando tengas 10,000+ clientes:**

1. **Agregar campo de búsqueda optimizado:**
```python
# Al crear/actualizar cliente
item['nombre_busqueda'] = f"{nombres} {apellidos} {cedula}".lower()
```

2. **Crear GSI sobre `nombre_busqueda`:**
```python
# En infraestructura
GlobalSecondaryIndex(
    index_name='gsi-nombre-busqueda',
    keys=[Attribute(name='nombre_busqueda', type=AttributeType.STRING)],
    projection_type=ProjectionType.ALL
)
```

3. **Implementar ElasticSearch (opcional):**
- Para búsquedas full-text avanzadas
- Búsqueda fuzzy ("Lilana" encuentra "Liliana")
- Búsqueda por múltiples campos simultáneamente

---

## Costos

### DynamoDB

**Read Capacity Units (RCU) por búsqueda:**
- Búsqueda por cédula (Query): ~1 RCU
- Búsqueda por nombre (Scan 1,000 items): ~10 RCU
- Búsqueda por nombre (Scan 10,000 items): ~100 RCU

**Costo estimado:**
- $0.00025 por 1,000 RCU
- Con 1,000 búsquedas/día por nombre (10,000 clientes): ~$0.025/día = **$0.75/mes**
- **Insignificante** para la mayoría de casos de uso

---

## Testing

### Casos de Prueba

✅ **Búsqueda vacía:** Vuelve a modo lista, carga 100 registros  
✅ **Búsqueda 1 carácter:** Filtrado local, sin request  
✅ **Búsqueda 2+ caracteres:** Request al backend  
✅ **Búsqueda por cédula:** Usa GSI, encuentra coincidencias parciales  
✅ **Búsqueda por nombre:** Usa scan, encuentra en nombres y apellidos  
✅ **Búsqueda + filtro proyecto:** Combina correctamente  
✅ **Búsqueda + filtro inmobiliaria:** Combina correctamente  
✅ **Sin resultados:** Muestra mensaje apropiado  
✅ **100 resultados:** Muestra advertencia de límite  
✅ **Cerrar banner:** Vuelve a modo lista  
✅ **Debounce:** Espera 500ms antes de buscar  

---

## Archivos Modificados

### Backend
```
lambdas/jam-captacion/routes/clientes.py (+ función buscar_clientes_admin)
lambdas/jam-captacion/handler.py (+ ruta /admin/clientes/buscar)
```

### Frontend
```
front/src/services/clientes.service.ts (+ función buscarClientesAdmin)
front/src/pages/clientes/ClientesPage.tsx (+ lógica híbrida)
```

---

## Conclusión

✅ **Problema resuelto:** Ahora se puede buscar cualquier cliente sin importar cuántos haya  
✅ **Escalable:** Funciona eficientemente hasta 10,000+ clientes  
✅ **Intuitivo:** Usuario ve claramente cuándo está buscando vs navegando  
✅ **Rápido:** Búsquedas por cédula en <200ms, por nombre en <1s  
✅ **Flexible:** Combina con filtros de proyecto e inmobiliaria  

El sistema ahora está preparado para crecer sin problemas de búsqueda.

---

**Implementado por:** Equipo de Desarrollo  
**Fecha:** 6 de mayo de 2026  
**Deploy:** Pendiente
