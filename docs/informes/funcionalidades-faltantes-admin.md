# Funcionalidades Faltantes para Rol Admin (Problemas 5 y 7)

**Fecha:** 7 de mayo de 2026  
**Objetivo:** Implementar rol super admin que pueda editar todo lo visible en las tablas de DynamoDB

## Estado Actual del Sistema de Permisos

### Roles Existentes
- **admin, coordinador, supervisor**: Roles internos con permisos administrativos
- **inmobiliaria**: Rol con permisos limitados a sus proyectos asignados

### Verificación de Permisos
- Backend: `require_admin(event)` verifica si el usuario pertenece a `ROLES_INTERNOS`
- Frontend: `canEdit` se determina por `usuario?.rol !== 'inmobiliaria'`

---

## ✅ Funcionalidades que el Admin YA PUEDE hacer

### 1. **Gestión de Proyectos**
- ✅ Crear proyectos
- ✅ Editar proyectos (nombre, descripción, imagen)
- ✅ Eliminar/desactivar proyectos

### 2. **Gestión de Etapas**
- ✅ Crear etapas
- ✅ Editar etapas
- ✅ Eliminar etapas

### 3. **Gestión de Unidades**
- ✅ Crear unidades
- ✅ Editar unidades (todos los campos)
- ✅ Eliminar unidades

### 4. **Gestión de Bloqueos**
- ✅ Ver todos los bloqueos activos
- ✅ Liberar bloqueos manualmente
- ✅ Extender tiempo de bloqueos
- ✅ Ver historial de bloqueos
- ✅ Asignar cliente a bloqueo sin cliente

### 5. **Gestión de Clientes (Parcial)**
- ✅ Ver todos los clientes (búsqueda global)
- ✅ Buscar clientes por nombre o cédula
- ✅ Filtrar por proyecto e inmobiliaria
- ✅ **Editar datos personales del cliente** (nombres, apellidos, correo, teléfono, etc.)
- ✅ Ver procesos de venta asociados

### 6. **Gestión de Inmobiliarias**
- ✅ Crear inmobiliarias
- ✅ Editar inmobiliarias (nombre, correos, proyectos asignados, imagen)
- ✅ Deshabilitar/habilitar inmobiliarias
- ✅ Eliminar inmobiliarias
- ✅ Ver como inmobiliaria (modo preview)

### 7. **Gestión de Usuarios de Inmobiliarias**
- ✅ Crear usuarios para inmobiliarias
- ✅ Deshabilitar/habilitar usuarios
- ✅ Eliminar usuarios

### 8. **Gestión de Usuarios del Sistema**
- ✅ Ver todos los usuarios internos
- ✅ Crear usuarios internos (admin, coordinador, supervisor)
- ✅ Editar usuarios internos (nombre, rol)
- ✅ Deshabilitar/habilitar usuarios
- ✅ Eliminar usuarios
- ⚠️ **Limitación:** No puede editar/eliminar su propio usuario

### 9. **Migración de Inventario**
- ✅ Subir archivos Excel
- ✅ Validar y corregir datos
- ✅ Confirmar migración

---

## ❌ Funcionalidades que el Admin AÚN NO PUEDE hacer

### 1. **Gestión de Procesos de Venta** 🔴 CRÍTICO
**Ubicación:** `ClientesPage.tsx` - Drawer de detalle de cliente

#### Limitaciones Actuales:
- ❌ **No puede crear procesos de venta manualmente**
  - Los procesos solo se crean automáticamente al bloquear una unidad con cliente
  - No hay interfaz para que admin asigne una unidad a un cliente existente sin bloqueo previo
  
- ❌ **No puede editar campos del proceso**
  - `fecha_separacion`: Fecha en que se realizó la separación
  - `pago_confirmado`: Si el pago de separación fue confirmado
  - `alerta_separacion_vencida`: Flag de alerta (se calcula automáticamente)
  
- ❌ **No puede eliminar procesos de venta**
  - No hay opción para eliminar un proceso erróneo o de prueba
  - Solo puede cambiar el estatus a "desvinculado" pero el registro persiste

#### Impacto:
- Si un cliente fue registrado manualmente (sin bloqueo), no hay forma de asignarle una unidad
- Si hay un error en la fecha de separación, no se puede corregir
- Procesos de prueba quedan en el sistema permanentemente

---

### 2. **Edición de Campos Críticos de Cliente** 🔴 CRÍTICO
**Ubicación:** `ClientesPage.tsx` - Modal de editar cliente

#### Campos que NO se pueden editar:
- ❌ **cedula**: Cédula/pasaporte (es la clave primaria)
- ❌ **inmobiliaria_id**: Inmobiliaria que captó al cliente
- ❌ **proyecto_id**: Proyecto de interés
- ❌ **exclusividad_activa**: Estado de exclusividad (booleano)
- ❌ **fecha_captacion**: Fecha en que fue captado
- ❌ **fecha_vencimiento**: Fecha de vencimiento de exclusividad

#### Impacto:
- Si un cliente fue asignado a la inmobiliaria incorrecta, no se puede corregir
- Si la fecha de captación es incorrecta, afecta el cálculo de exclusividad
- No se puede transferir un cliente de una inmobiliaria a otra
- No se puede cambiar el proyecto de interés de un cliente

---

### 3. **Gestión de Exclusividad de Clientes** 🟡 IMPORTANTE
**Ubicación:** Backend - `lambdas/jam-captacion/routes/clientes.py`

#### Limitaciones:
- ❌ **No puede extender manualmente la exclusividad**
  - La exclusividad vence automáticamente a los 3 meses
  - No hay endpoint para extender o renovar manualmente
  
- ❌ **No puede liberar exclusividad antes de tiempo**
  - Si una inmobiliaria ya no trabaja con un cliente, la exclusividad sigue activa
  
- ❌ **No puede transferir exclusividad entre inmobiliarias**
  - Si un cliente quiere cambiar de inmobiliaria, no hay forma de hacerlo

#### Impacto:
- Clientes quedan "atrapados" con una inmobiliaria por 3 meses obligatorios
- No hay flexibilidad para casos especiales

---

### 4. **Eliminación de Registros de Cliente** 🟡 IMPORTANTE
**Ubicación:** `ClientesPage.tsx`

#### Limitaciones:
- ❌ **No puede eliminar registros de cliente**
  - No hay botón de eliminar en la interfaz
  - No hay endpoint en el backend para eliminar clientes
  
- ❌ **No puede eliminar registros duplicados**
  - Si un cliente fue registrado múltiples veces por error, no se puede limpiar

#### Impacto:
- Datos de prueba quedan permanentemente en el sistema
- Registros duplicados contaminan las búsquedas

---

### 5. **Edición de Historial de Estatus** 🟢 MEJORA
**Ubicación:** `HistorialEstatusDrawer.tsx`

#### Limitaciones:
- ❌ **No puede editar entradas del historial**
  - Si se cambió un estatus por error, no se puede corregir
  - No se puede editar el timestamp de un cambio
  
- ❌ **No puede eliminar entradas del historial**
  - Cambios erróneos quedan registrados permanentemente

#### Impacto:
- El historial puede contener información incorrecta
- No hay forma de "deshacer" un cambio de estatus erróneo

---

### 6. **Gestión de Notificaciones** 🟢 MEJORA
**Ubicación:** Backend - `lambdas/jam-notificaciones/handler.py`

#### Limitaciones:
- ❌ **No puede reenviar notificaciones**
  - Si un correo no llegó, no hay forma de reenviarlo
  
- ❌ **No puede ver historial de notificaciones enviadas**
  - No hay registro de qué correos se enviaron y a quién
  
- ❌ **No puede editar plantillas de correo**
  - Las plantillas están hardcodeadas en el código

#### Impacto:
- Dificulta el debugging de problemas de notificaciones
- No hay visibilidad de la comunicación con clientes

---

### 7. **Gestión de Schedules (Tareas Programadas)** 🟢 MEJORA
**Ubicación:** Backend - `lambdas/jam-captacion/utils/scheduler.py`

#### Limitaciones:
- ❌ **No puede ver schedules activos**
  - Los schedules de vencimiento de exclusividad son invisibles
  
- ❌ **No puede editar schedules**
  - Si una fecha de vencimiento es incorrecta, el schedule sigue ejecutándose
  
- ❌ **No puede eliminar schedules manualmente**
  - Solo se eliminan automáticamente al re-captar un cliente

#### Impacto:
- Schedules erróneos pueden ejecutarse y causar problemas
- No hay visibilidad de qué tareas están programadas

---

### 8. **Auditoría y Logs** 🟢 MEJORA

#### Limitaciones:
- ❌ **No hay registro de quién hizo qué cambio**
  - Solo algunos cambios registran `ejecutado_por`
  - No hay log centralizado de acciones administrativas
  
- ❌ **No puede ver historial de cambios en unidades**
  - Si una unidad cambió de precio, no hay registro de cuándo ni quién
  
- ❌ **No puede ver historial de cambios en proyectos/etapas**

#### Impacto:
- Dificulta la investigación de problemas
- No hay accountability de acciones administrativas

---

## 📊 Resumen por Prioridad

### 🔴 CRÍTICOS (Bloquean operaciones importantes)
1. **Gestión completa de procesos de venta** (crear, editar, eliminar)
2. **Edición de campos críticos de cliente** (inmobiliaria_id, proyecto_id, fechas)

### 🟡 IMPORTANTES (Mejoran flexibilidad operativa)
3. **Gestión de exclusividad** (extender, liberar, transferir)
4. **Eliminación de registros de cliente** (limpiar datos de prueba)

### 🟢 MEJORAS (Nice to have)
5. **Edición de historial de estatus**
6. **Gestión de notificaciones**
7. **Gestión de schedules**
8. **Auditoría y logs**

---

## 🎯 Recomendaciones de Implementación

### Fase 1: Funcionalidades Críticas (Problemas 5 y 7)
1. **Crear interfaz de gestión de procesos**
   - Botón "Asignar unidad" en detalle de cliente
   - Modal para seleccionar unidad disponible
   - Campos editables: fecha_separacion, pago_confirmado
   - Botón "Eliminar proceso" con confirmación

2. **Habilitar edición de campos críticos de cliente**
   - Agregar campos al modal de edición: inmobiliaria_id, proyecto_id
   - Agregar controles para fechas: fecha_captacion, fecha_vencimiento
   - Agregar toggle para exclusividad_activa
   - Validar que los cambios no rompan integridad referencial

3. **Crear endpoints backend necesarios**
   - `POST /admin/clientes/{cedula}/procesos` - Crear proceso manualmente
   - `PUT /admin/procesos/{proceso_id}` - Editar proceso
   - `DELETE /admin/procesos/{proceso_id}` - Eliminar proceso
   - `PUT /admin/clientes/{cedula}/proyecto/{proyecto_id}` - Actualizar campos críticos (ya existe, ampliar)
   - `DELETE /admin/clientes/{cedula}/proyecto/{proyecto_id}` - Eliminar registro de cliente

### Fase 2: Funcionalidades Importantes
4. **Gestión de exclusividad**
   - Botón "Extender exclusividad" en detalle de cliente
   - Botón "Liberar exclusividad" 
   - Botón "Transferir a otra inmobiliaria"

5. **Eliminación de registros**
   - Botón "Eliminar registro" en cada registro de cliente
   - Confirmación con advertencia de impacto

### Fase 3: Mejoras
6. **Auditoría básica**
   - Agregar campo `modificado_por` en todas las tablas
   - Registrar timestamp de última modificación
   - Crear tabla de auditoría para cambios críticos

---

## 🔒 Consideraciones de Seguridad

1. **Validación de permisos**: Todas las operaciones deben verificar `require_admin()`
2. **Confirmaciones**: Operaciones destructivas deben requerir doble confirmación
3. **Logs**: Todas las acciones administrativas deben quedar registradas
4. **Integridad referencial**: Validar que los cambios no rompan relaciones entre tablas
5. **Notificaciones**: Cambios críticos deben notificar a las partes afectadas

---

## 📝 Notas Adicionales

- El sistema actual ya tiene buena cobertura de funcionalidades administrativas
- Las limitaciones principales están en la **edición de datos existentes** y **gestión de procesos**
- La mayoría de las funcionalidades faltantes son **casos edge** o **corrección de errores**
- Implementar Fase 1 resolvería los Problemas 5 y 7 completamente
