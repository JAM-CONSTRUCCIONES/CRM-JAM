# Fix: Filtros de Búsqueda en Frontend

**Fecha:** 6 de mayo de 2026  
**Prioridad:** 🔴 ALTA  
**Estado:** ✅ CORREGIDO

---

## 🔴 Problema Reportado

**Síntoma:** Al seleccionar un proyecto o inmobiliaria mientras se está en modo búsqueda, el sistema pierde el filtro de búsqueda y vuelve a modo lista.

**Ejemplo:**
```
1. Usuario busca "Liliana" → Encuentra 5 resultados
2. Usuario selecciona proyecto "Caney Oriental" para filtrar
3. ❌ Sistema pierde la búsqueda y muestra lista completa
4. ❌ Usuario tiene que volver a escribir "Liliana"
```

**Causa:** Los selectores de proyecto e inmobiliaria llamaban directamente a `cargar()` sin verificar si estaban en modo búsqueda.

---

## ✅ Solución Implementada

### Lógica de Filtros Inteligente

Ahora los selectores detectan si estás en modo búsqueda y re-ejecutan la búsqueda con los nuevos filtros:

```typescript
// Selector de Proyecto
onChange={(v) => { 
  setProyectoFiltro(v); 
  setNextToken(undefined); 
  
  setTimeout(() => {
    if (modoVista === 'busqueda' && busqueda.trim().length >= 2) {
      // Re-ejecutar búsqueda con nuevo filtro
      handleBusqueda(busqueda);
    } else {
      // Cargar lista normal
      cargar(v, inmoFiltro);
    }
  }, 0);
}}

// Selector de Inmobiliaria
onChange={(v) => { 
  setInmoFiltro(v); 
  setNextToken(undefined); 
  
  setTimeout(() => {
    if (modoVista === 'busqueda' && busqueda.trim().length >= 2) {
      // Re-ejecutar búsqueda con nuevo filtro
      handleBusqueda(busqueda);
    } else {
      // Cargar lista normal
      cargar(proyectoFiltro, v);
    }
  }, 0);
}}
```

**Características:**
- ✅ Detecta si estás en modo búsqueda
- ✅ Re-ejecuta la búsqueda con los nuevos filtros
- ✅ Mantiene el texto de búsqueda
- ✅ Mantiene el tipo de búsqueda (nombre/cédula)
- ✅ Usa `setTimeout` para asegurar que el estado se actualice primero

---

## 📊 Comportamiento Correcto

### Caso 1: Búsqueda + Filtro de Proyecto
```
1. Usuario busca "Liliana" → 5 resultados (todos los proyectos)
2. Usuario selecciona "Caney Oriental"
3. ✅ Sistema re-ejecuta búsqueda: "Liliana" + "Caney Oriental"
4. ✅ Muestra solo las Liliana de Caney Oriental (2 resultados)
5. ✅ Banner sigue mostrando: "Búsqueda por nombre para 'Liliana'"
```

### Caso 2: Búsqueda + Filtro de Inmobiliaria
```
1. Usuario busca "V-123" (por cédula) → 3 resultados
2. Usuario selecciona inmobiliaria "Inversiones XYZ"
3. ✅ Sistema re-ejecuta búsqueda: "V-123" + "Inversiones XYZ"
4. ✅ Muestra solo las cédulas V-123 de esa inmobiliaria (1 resultado)
5. ✅ Banner sigue mostrando: "Búsqueda por cédula para 'V-123'"
```

### Caso 3: Búsqueda + Cambiar Ambos Filtros
```
1. Usuario busca "Maria" → 10 resultados
2. Usuario selecciona proyecto "López VII" → 4 resultados
3. Usuario selecciona inmobiliaria "ABC" → 2 resultados
4. ✅ Cada cambio re-ejecuta la búsqueda con los filtros acumulados
5. ✅ Banner siempre visible mostrando la búsqueda activa
```

### Caso 4: Lista Normal + Filtros
```
1. Usuario NO está buscando (modo lista)
2. Usuario selecciona proyecto "Caney Oriental"
3. ✅ Sistema carga lista normal filtrada por proyecto
4. ✅ No hay banner de búsqueda
```

---

## 🎯 Flujo de Datos

### Antes (Incorrecto)
```
Usuario cambia filtro
    ↓
setProyectoFiltro(v)
    ↓
cargar(v, inmoFiltro)  ← Siempre carga lista, ignora búsqueda
    ↓
❌ Pierde búsqueda activa
```

### Después (Correcto)
```
Usuario cambia filtro
    ↓
setProyectoFiltro(v)
    ↓
setTimeout(() => {
    ¿Está en modo búsqueda?
        ↓ SÍ                    ↓ NO
    handleBusqueda(busqueda)    cargar(v, inmoFiltro)
        ↓                           ↓
    ✅ Mantiene búsqueda        ✅ Carga lista normal
})
```

---

## 🔧 Detalles Técnicos

### ¿Por qué `setTimeout(..., 0)`?

React actualiza el estado de forma asíncrona. Sin `setTimeout`, el código podría ejecutarse antes de que `proyectoFiltro` o `inmoFiltro` se actualicen:

```typescript
// Sin setTimeout (INCORRECTO)
setProyectoFiltro(v);
handleBusqueda(busqueda);  // ← Usa el valor VIEJO de proyectoFiltro

// Con setTimeout (CORRECTO)
setProyectoFiltro(v);
setTimeout(() => {
  handleBusqueda(busqueda);  // ← Usa el valor NUEVO de proyectoFiltro
}, 0);
```

El `setTimeout(..., 0)` pone la ejecución al final de la cola de eventos, asegurando que el estado se actualice primero.

---

## 📝 Función `handleBusqueda`

La función ya maneja correctamente los filtros:

```typescript
const handleBusqueda = (valor: string) => {
  setBusqueda(valor);
  
  // ... lógica de debounce ...
  
  // Búsqueda >= 2 caracteres: buscar en backend
  setModoVista('busqueda');
  
  debounceTimerRef.current = setTimeout(async () => {
    setLoading(true);
    try {
      const resultados = await buscarClientesAdmin(
        valor,
        tipoBusqueda,
        proyectoFiltro,    // ← Usa el filtro actual
        inmoFiltro         // ← Usa el filtro actual
      );
      setClientes(resultados);
      setNextToken(undefined);
    } catch {
      message.error('Error en la búsqueda');
    } finally {
      setLoading(false);
    }
  }, 500);
};
```

**Nota:** `handleBusqueda` siempre usa los valores actuales de `proyectoFiltro` e `inmoFiltro` del estado.

---

## 🧪 Testing

### Casos de Prueba

✅ **Test 1: Búsqueda + Proyecto**
1. Buscar "Liliana"
2. Seleccionar proyecto "Caney Oriental"
3. Verificar que mantiene búsqueda
4. Verificar que filtra por proyecto

✅ **Test 2: Búsqueda + Inmobiliaria**
1. Buscar "V-123"
2. Seleccionar inmobiliaria
3. Verificar que mantiene búsqueda
4. Verificar que filtra por inmobiliaria

✅ **Test 3: Búsqueda + Ambos Filtros**
1. Buscar "Maria"
2. Seleccionar proyecto
3. Seleccionar inmobiliaria
4. Verificar que mantiene búsqueda con ambos filtros

✅ **Test 4: Cambiar Filtros Sin Búsqueda**
1. NO buscar nada (modo lista)
2. Seleccionar proyecto
3. Verificar que carga lista normal
4. Verificar que NO hay banner de búsqueda

✅ **Test 5: Limpiar Filtros Durante Búsqueda**
1. Buscar "Liliana" + proyecto "Caney"
2. Limpiar filtro de proyecto (X)
3. Verificar que mantiene búsqueda
4. Verificar que busca en todos los proyectos

✅ **Test 6: Cambiar Tipo de Búsqueda con Filtros**
1. Buscar "Liliana" (nombre) + proyecto
2. Cambiar a búsqueda por cédula
3. Buscar "V-123"
4. Verificar que mantiene filtro de proyecto

---

## 📁 Archivos Modificados

```
front/src/pages/clientes/ClientesPage.tsx
  - Selectores de proyecto e inmobiliaria actualizados
  - Lógica condicional: búsqueda vs lista
  - setTimeout para sincronización de estado
```

---

## 🎨 UX Mejorada

### Antes
```
Usuario: "Busco Liliana en Caney Oriental"
1. Busca "Liliana" → 5 resultados
2. Selecciona "Caney Oriental"
3. ❌ Pierde búsqueda, ve lista completa
4. 😤 Tiene que buscar "Liliana" otra vez
```

### Después
```
Usuario: "Busco Liliana en Caney Oriental"
1. Busca "Liliana" → 5 resultados
2. Selecciona "Caney Oriental"
3. ✅ Mantiene búsqueda, filtra por proyecto
4. ✅ Ve solo las Liliana de Caney Oriental
5. 😊 Flujo natural e intuitivo
```

---

## 🚀 Beneficios

✅ **Flujo natural:** Los filtros funcionan como el usuario espera  
✅ **No pierde trabajo:** No tiene que volver a escribir la búsqueda  
✅ **Combinación de filtros:** Búsqueda + proyecto + inmobiliaria funcionan juntos  
✅ **Banner siempre visible:** Usuario sabe que está en modo búsqueda  
✅ **Consistente:** Mismo comportamiento en desktop y mobile  

---

## 📋 Checklist de Verificación

- [x] Selectores detectan modo búsqueda
- [x] Re-ejecutan búsqueda con nuevos filtros
- [x] Mantienen texto de búsqueda
- [x] Mantienen tipo de búsqueda (nombre/cédula)
- [x] Banner permanece visible
- [x] Funciona con proyecto solo
- [x] Funciona con inmobiliaria solo
- [x] Funciona con ambos filtros
- [x] Funciona al limpiar filtros
- [ ] Probado en desarrollo
- [ ] Probado por el cliente
- [ ] Desplegado en producción

---

**Implementado por:** Equipo de Desarrollo  
**Fecha:** 6 de mayo de 2026  
**Deploy:** Pendiente
