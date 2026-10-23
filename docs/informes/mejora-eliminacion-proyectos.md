# Mejora: Eliminación de Proyectos con Unidades

**Fecha:** 2026-05-08  
**Tipo:** Mejora de funcionalidad  
**Módulo:** Gestión de Inventario - Proyectos

## Resumen

Se modificó la lógica de eliminación de proyectos para permitir eliminar proyectos que tengan unidades, siempre y cuando estas unidades estén en estado **disponible** y no tengan procesos de venta activos.

## Problema Anterior

La implementación anterior bloqueaba completamente la eliminación de proyectos si tenían unidades registradas, obligando al administrador a eliminar manualmente cada unidad antes de poder eliminar el proyecto.

```
❌ Proyecto con unidades → No se puede eliminar (sin importar el estado)
```

## Nueva Implementación

### Lógica de Validación

La nueva implementación realiza las siguientes validaciones en orden:

1. **Verificar unidades del proyecto**
   - Si no hay unidades → Permite eliminar directamente

2. **Verificar estado de las unidades**
   - Si todas están en estado `disponible` → Continúa validación
   - Si hay unidades en otros estados (`bloqueada`, `reserva`, `separacion`, etc.) → **Bloquea eliminación**

3. **Verificar procesos activos**
   - Consulta la tabla `PROCESOS_TABLE` buscando procesos en estados: `captacion`, `reserva`, `separacion`, `inicial`
   - Si encuentra procesos activos → **Bloquea eliminación**
   - Si no hay procesos activos → Permite eliminar

4. **Eliminación en cascada**
   - Elimina físicamente todas las unidades disponibles
   - Desactiva el proyecto (soft delete: `activo = false`)
   - Desvincula el proyecto de todas las inmobiliarias

### Flujo de Decisión

```
┌─────────────────────────────┐
│ Solicitud de eliminación    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ ¿Tiene unidades?            │
└──────────┬──────────────────┘
           │
     ┌─────┴─────┐
     │           │
    NO          SÍ
     │           │
     │           ▼
     │  ┌─────────────────────────────┐
     │  │ ¿Todas disponibles?         │
     │  └──────────┬──────────────────┘
     │             │
     │       ┌─────┴─────┐
     │       │           │
     │      NO          SÍ
     │       │           │
     │       │           ▼
     │       │  ┌─────────────────────────────┐
     │       │  │ ¿Hay procesos activos?      │
     │       │  └──────────┬──────────────────┘
     │       │             │
     │       │       ┌─────┴─────┐
     │       │       │           │
     │       │      SÍ          NO
     │       │       │           │
     │       ▼       ▼           ▼
     │   ❌ ERROR  ❌ ERROR   ✅ ELIMINAR
     │   (estados) (procesos)  (cascada)
     │       │       │           │
     └───────┴───────┴───────────┘
```

### Mensajes de Error Informativos

La implementación proporciona mensajes detallados según el motivo del bloqueo:

**Unidades no disponibles:**
```
No se puede eliminar el proyecto porque tiene 3 unidad(es) no disponible(s): 
2 bloqueada, 1 reserva. Solo se pueden eliminar proyectos con unidades en 
estado "disponible".
```

**Procesos activos:**
```
No se puede eliminar el proyecto porque tiene 2 proceso(s) de venta activo(s): 
1 en reserva, 1 en separacion. Finaliza o cancela estos procesos primero.
```

**Eliminación exitosa:**
```
Proyecto desactivado y desvinculado de inmobiliarias (5 unidades eliminadas)
```

## Cambios Técnicos

### Backend

**Archivo:** `lambdas/jam-proyectos/routes/proyectos.py`

**Función modificada:** `eliminar(proyecto_id)`

**Cambios principales:**
- ✅ Consulta todas las unidades del proyecto (no solo verifica si existen)
- ✅ Valida que todas estén en estado `disponible`
- ✅ Consulta tabla de procesos usando GSI `gsi-proyecto-procesos`
- ✅ Filtra procesos activos: `captacion`, `reserva`, `separacion`, `inicial`
- ✅ Elimina físicamente las unidades disponibles antes de desactivar el proyecto
- ✅ Proporciona mensajes de error detallados con conteo por estado
- ✅ Manejo robusto de errores con logging

### Frontend

**Archivo:** `front/src/pages/inventario/InventarioPage.tsx`

**Cambios principales:**
- ✅ Actualizado texto del `Popconfirm`: "¿Eliminar proyecto?" (antes: "¿Desactivar proyecto?")
- ✅ Agregada descripción explicativa en el modal de confirmación
- ✅ Botón de confirmación marcado como `danger` (rojo)
- ✅ Mensaje de éxito al eliminar correctamente
- ✅ Manejo mejorado de errores 409 (Conflict)

## Casos de Uso

### ✅ Caso 1: Proyecto sin unidades
```
Proyecto A (0 unidades)
→ Se elimina directamente
```

### ✅ Caso 2: Proyecto con unidades disponibles
```
Proyecto B
├── Unidad 101 (disponible)
├── Unidad 102 (disponible)
└── Unidad 103 (disponible)

→ Se eliminan las 3 unidades
→ Se desactiva el proyecto
→ Mensaje: "Proyecto desactivado y desvinculado de inmobiliarias (3 unidades eliminadas)"
```

### ❌ Caso 3: Proyecto con unidades bloqueadas
```
Proyecto C
├── Unidad 101 (disponible)
├── Unidad 102 (bloqueada)  ← Bloqueada por Inmobiliaria X
└── Unidad 103 (disponible)

→ ERROR 409: "No se puede eliminar el proyecto porque tiene 1 unidad(es) 
   no disponible(s): 1 bloqueada..."
```

### ❌ Caso 4: Proyecto con procesos activos
```
Proyecto D
├── Unidad 101 (disponible)
└── Unidad 102 (disponible)

Procesos activos:
└── Cliente Juan Pérez → Unidad 102 (estado: reserva)

→ ERROR 409: "No se puede eliminar el proyecto porque tiene 1 proceso(s) 
   de venta activo(s): 1 en reserva..."
```

### ❌ Caso 5: Proyecto con unidades en múltiples estados
```
Proyecto E
├── Unidad 101 (disponible)
├── Unidad 102 (bloqueada)
├── Unidad 103 (reserva)
├── Unidad 104 (separacion)
└── Unidad 105 (disponible)

→ ERROR 409: "No se puede eliminar el proyecto porque tiene 3 unidad(es) 
   no disponible(s): 1 bloqueada, 1 reserva, 1 separacion..."
```

## Seguridad y Validaciones

### ✅ Protecciones Implementadas

1. **Verificación de estados:** No permite eliminar si hay unidades en estados que indican compromiso comercial
2. **Verificación de procesos:** Consulta activamente la tabla de procesos para evitar inconsistencias
3. **Transaccionalidad:** Si falla la verificación de procesos, bloquea la eliminación por seguridad
4. **Logging:** Registra errores y advertencias para auditoría
5. **Permisos:** Solo administradores pueden eliminar proyectos (validación en handler)

### Estados que Bloquean la Eliminación

- `bloqueada` - Unidad bloqueada por una inmobiliaria
- `reserva` - Unidad reservada por un cliente
- `separacion` - Cliente ha pagado separación
- `inicial` - Cliente ha pagado inicial
- `vendida` - Unidad vendida (estado final)
- `no_disponible` - Unidad marcada como no disponible

### Estados de Procesos que Bloquean

- `captacion` - Cliente captado, en proceso
- `reserva` - Proceso en estado de reserva
- `separacion` - Proceso en estado de separación
- `inicial` - Proceso en estado de inicial

## Impacto

### Beneficios

✅ **Eficiencia operativa:** Elimina la necesidad de borrar manualmente cada unidad  
✅ **Seguridad:** Protege contra eliminación accidental de datos comerciales activos  
✅ **Transparencia:** Mensajes claros sobre por qué no se puede eliminar  
✅ **Limpieza de datos:** Facilita la eliminación de proyectos de prueba o descartados  

### Riesgos Mitigados

✅ Eliminación de unidades con procesos activos  
✅ Pérdida de datos de clientes en proceso  
✅ Inconsistencias entre tablas de inventario y procesos  
✅ Eliminación accidental sin confirmación clara  

## Testing Recomendado

### Casos de Prueba

1. **Eliminar proyecto vacío**
   - Crear proyecto sin unidades
   - Intentar eliminar
   - ✅ Debe permitir

2. **Eliminar proyecto con unidades disponibles**
   - Crear proyecto con 3 unidades disponibles
   - Intentar eliminar
   - ✅ Debe eliminar las 3 unidades y desactivar el proyecto

3. **Bloquear eliminación por unidad bloqueada**
   - Crear proyecto con 2 unidades
   - Bloquear 1 unidad como inmobiliaria
   - Intentar eliminar como admin
   - ❌ Debe mostrar error con detalle

4. **Bloquear eliminación por proceso activo**
   - Crear proyecto con 1 unidad disponible
   - Crear proceso de captación para esa unidad
   - Intentar eliminar
   - ❌ Debe mostrar error indicando proceso activo

5. **Verificar desvinculación de inmobiliarias**
   - Crear proyecto
   - Asignar a 2 inmobiliarias
   - Eliminar proyecto
   - ✅ Verificar que se removió de ambas inmobiliarias

## Notas Adicionales

- La eliminación del proyecto sigue siendo un **soft delete** (marca `activo = false`)
- Las unidades se eliminan **físicamente** de DynamoDB
- Las etapas asociadas al proyecto quedan huérfanas (consideración para futura mejora)
- Si la tabla de procesos no está disponible, se bloquea la eliminación por seguridad

## Archivos Modificados

```
lambdas/jam-proyectos/routes/proyectos.py
front/src/pages/inventario/InventarioPage.tsx
```

## Próximas Mejoras Sugeridas

1. Eliminar también las etapas asociadas al proyecto
2. Agregar opción de "forzar eliminación" para casos especiales (con confirmación adicional)
3. Implementar papelera de reciclaje para proyectos eliminados
4. Agregar endpoint para reactivar proyectos desactivados
5. Implementar eliminación en lote de proyectos
