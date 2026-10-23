# Implementación: Crear Bloqueo Manual desde Admin

## 📋 Resumen

Se implementó la funcionalidad para que el **administrador** pueda crear bloqueos manualmente desde la vista de inventario, siguiendo el flujo:

1. **Seleccionar inmobiliaria** primero
2. **Seleccionar/crear cliente** (o bloquear sin cliente)
3. **Crear el bloqueo**

## 🎯 Objetivo

Permitir al admin crear procesos de venta manualmente desde la vista de proyectos/inventario, seleccionando la inmobiliaria y el cliente, sin necesidad de que la inmobiliaria lo haga.

## ✅ Cambios Realizados

### 1. Nuevo Componente: `ModalCrearBloqueoAdmin.tsx`

**Ubicación:** `front/src/components/inventario/ModalCrearBloqueoAdmin.tsx`

**Características:**
- ✅ Flujo en 2 pasos: primero inmobiliaria, luego cliente
- ✅ Búsqueda global de clientes por **nombre o cédula**
- ✅ Tres modos de asignación:
  - **Cliente existente**: Búsqueda con autocompletado
  - **Nuevo cliente**: Formulario completo
  - **Sin cliente**: Bloqueo temporal sin cliente
- ✅ Validación de campos requeridos
- ✅ Interfaz intuitiva con feedback visual

### 2. Actualización: `TablaUnidades.tsx`

**Cambios:**
- ✅ Agregado prop `onCrearBloqueoAdmin?: (u: Unidad) => void`
- ✅ Botón "Crear bloqueo" visible solo para admin en unidades disponibles
- ✅ Soporte en vista móvil (cards) y desktop (tabla)

### 3. Actualización: `InventarioPage.tsx`

**Cambios:**
- ✅ Estado para modal de creación de bloqueo admin
- ✅ Handler `handleCrearBloqueoAdmin` con manejo de errores
- ✅ Integración con el componente `ModalCrearBloqueoAdmin`
- ✅ Callback pasado a `TablaUnidades`

### 4. Actualización: `bloqueos.service.ts`

**Cambios:**
- ✅ Agregado parámetro opcional `inmobiliaria_id` en `bloquearUnidad`
- ✅ Permite al admin especificar la inmobiliaria al crear el bloqueo

## 🔄 Flujo de Usuario

### Para el Admin:

1. **Navegar a Inventario** → Seleccionar proyecto → Ver unidades
2. **Click en "Crear bloqueo"** en una unidad disponible
3. **Seleccionar inmobiliaria** del dropdown (solo activas)
4. **Elegir modo de cliente:**
   - **Cliente existente**: Buscar por nombre o cédula
   - **Nuevo cliente**: Llenar formulario completo
   - **Sin cliente**: Crear bloqueo temporal
5. **Confirmar** → El bloqueo se crea y aparece en Procesos

## 🎨 Mejoras de UX

- ✅ **Búsqueda inteligente**: Detecta automáticamente si es cédula o nombre
- ✅ **Feedback visual**: Cards con colores para inmobiliaria y cliente seleccionados
- ✅ **Validación en tiempo real**: Mensajes claros de error
- ✅ **Debounce en búsqueda**: Evita llamadas excesivas al backend (400ms)
- ✅ **Estados de carga**: Spinners durante búsqueda y guardado

## 🔧 Integración con Backend

El componente utiliza:
- `buscarClientesAdmin(query, tipo, proyectoId, inmobiliariaId)` - Búsqueda de clientes
- `bloquearUnidad({ proyecto_id, unidad_id, inmobiliaria_id, forzar_admin: true, ...clienteData })` - Crear bloqueo

### Cambios en el Backend

**Archivo:** `lambdas/jam-bloqueos/routes/bloqueos.py`

**Modificaciones:**

1. **Nuevo parámetro `forzar_admin`**: Permite al admin saltarse validaciones de exclusividad
2. **Soporte para `inmobiliaria_id`**: El admin puede especificar la inmobiliaria al crear el bloqueo
3. **Lógica actualizada**:
   ```python
   # Si es admin y especifica inmobiliaria_id, usar esa
   es_admin = require_admin(event)
   if es_admin and body.get('inmobiliaria_id'):
       inmo_id = body.get('inmobiliaria_id').replace('INMOBILIARIA#', '')
       # Obtener nombre de la inmobiliaria
       inmo_info = usuarios.get_item(Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}).get('Item', {})
       inmo_nombre = inmo_info.get('nombre', inmo_id)
   
   # Validar exclusividad solo si NO es forzar_admin
   if tiene_cliente and not forzar_admin:
       # ... validaciones de exclusividad
   ```

### Privilegios del Admin

✅ **El admin puede:**
- Saltarse restricciones de exclusividad con `forzar_admin: true`
- Asignar cualquier cliente a cualquier inmobiliaria
- Crear bloqueos sin validar si el cliente tiene exclusividad con otra inmobiliaria
- Especificar manualmente la inmobiliaria del bloqueo

## 📝 Validaciones

- ✅ Inmobiliaria es requerida
- ✅ Si modo "Cliente existente": debe seleccionar un cliente de la lista
- ✅ Si modo "Nuevo cliente": cédula, nombres y apellidos son requeridos
- ✅ Si modo "Sin cliente": no requiere datos adicionales

## 🚀 Próximos Pasos

Esta implementación cubre el **primer punto crítico** de la lista:

- ✅ **Crear procesos manualmente** desde proyectos (admin)
- ⏳ **Editar fecha_separacion y pago_confirmado** en procesos
- ⏳ **Contador de exclusividad** visible para admin
- ⏳ **Botón eliminar cliente** en interfaz

## 🧪 Testing Sugerido

1. Crear bloqueo con cliente existente
2. Crear bloqueo con nuevo cliente
3. Crear bloqueo sin cliente
4. Verificar que aparece en la vista de Procesos
5. Verificar búsqueda por nombre y por cédula
6. Verificar validaciones de campos requeridos
7. Verificar manejo de errores (409, 429, etc.)

## 📚 Archivos Modificados

**Frontend:**
```
front/src/components/inventario/ModalCrearBloqueoAdmin.tsx (NUEVO)
front/src/components/inventario/TablaUnidades.tsx
front/src/pages/inventario/InventarioPage.tsx
front/src/services/bloqueos.service.ts
```

**Backend:**
```
lambdas/jam-bloqueos/routes/bloqueos.py
```
