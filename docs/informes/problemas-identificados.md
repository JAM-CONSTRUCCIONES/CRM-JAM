# Problemas Identificados en el Sistema

**Fecha:** 6 de mayo de 2026

---

## 1. Proyectos de Prueba

**Descripción del problema:**
- Actualmente se visualizan múltiples proyectos de prueba en el sistema
- Solo se debería trabajar con el proyecto "Caney Oriental"
- Los proyectos de prueba fueron creados para validar migraciones

**Impacto:**
- Confusión en la visualización de datos
- Datos de prueba mezclados con datos reales

**Tu solución propuesta:**
[Los proyectos de prueba fueron creados únicamente para validar migraciones y realizar pruebas internas del sistema. Una vez que se pruebe correctamente el sistema y se confirme que no existen inconvenientes con dichas migraciones, se procederá con la eliminación de esos proyectos de prueba, dejando únicamente la información correspondiente al proyecto activo.]

---

## 2. Acceso de Inmobiliarias

**Descripción del problema:**
- En el apartado de inmobiliarias se visualizan las registradas
- No queda claro si desde este mismo módulo se gestiona también el acceso de sus usuarios

**Nota técnica:**
- La funcionalidad SÍ existe: al hacer clic en una inmobiliaria se abre un modal con sus usuarios
- El problema es de visibilidad/claridad en la interfaz

**Impacto:**
- Usuario no encuentra cómo gestionar usuarios de inmobiliarias

**Tu solución propuesta:**
[Sí, desde el mismo módulo de inmobiliarias se podrá gestionar el acceso de los usuarios asociados a cada inmobiliaria. Para que esta opción sea más clara, se agregará un botón más visible de “Gestionar usuarios”.]

---

## 3. Orden de Visualización de Clientes

**Descripción del problema:**
- Al acceder al módulo de clientes, no está claro bajo qué criterio se están organizando
- No se sabe si es alfabético, por unidad, por fecha, etc.
- Esto dificulta la búsqueda y operatividad diaria

**Impacto:**
- Dificultad para encontrar clientes específicos
- Tiempo perdido en búsquedas

**Tu solución propuesta:**
[se pondra una manera de ordenar los clientes]

---

## 4. Inconsistencia entre Módulos (Cliente vs Proceso) ⚠️ CRÍTICO

**Descripción del problema:**
- **Ejemplo concreto:** La clienta Liliana de la Cruz Mendoza aparece en el apartado de "Procesos" pero NO se visualiza en el listado general de "Clientes"
- Esto indica que hay datos desincronizados entre módulos

**Análisis técnico:**
- El sistema usa dos tablas separadas: CLIENTES y PROCESOS
- Pueden existir procesos sin cliente correspondiente en la tabla CLIENTES
- Pueden existir clientes que no aparecen por filtros de exclusividad

**Impacto:**
- Pérdida de información crítica
- Imposibilidad de gestionar clientes que solo aparecen en procesos
- Datos inconsistentes

**Tu solución propuesta:**
[el error es que al momento de filtrar solo filtra por 50 en 50]

---

## 5. Edición de Inmobiliaria en Cliente ⚠️ CRÍTICO

**Descripción del problema:**
- Siguiendo el ejemplo de Liliana: ¿Qué pasa si tengo que cambiarle la inmobiliaria?
- Actualmente no existe opción para cambiar la inmobiliaria asignada a un cliente
- Se entiende que debería ser editable desde el perfil del cliente

**Análisis técnico:**
- La inmobiliaria está en la clave primaria de la base de datos: `CLIENTE#{cedula}#{inmobiliaria_id}`
- Cambiar la inmobiliaria no es una simple actualización de campo
- Requiere crear nuevo registro, migrar datos, actualizar procesos asociados

**Impacto:**
- Imposibilidad de corregir asignaciones incorrectas
- Dependencia de soporte técnico para cambios simples
- Bloqueo operativo

**Tu solución propuesta:**
[se tiene que implementar el como una clase se super admin que pueda editar todo]

---

## 6. Asignación de Inmobiliaria al Crear Cliente desde Unidad

**Descripción del problema:**
- Las unidades que no tienen clientes asignados tienen una opción de agregarlo
- Dentro de ese apartado NO da la opción de seleccionar la inmobiliaria
- Esto limita el flujo correcto de registro

**Contexto:**
- Para usuarios de inmobiliaria: la inmobiliaria se asigna automáticamente (del usuario autenticado)
- Para administradores: debería poder seleccionar la inmobiliaria manualmente

**Impacto:**
- Administrador no puede asignar cliente a inmobiliaria específica desde unidad
- Flujo de trabajo limitado

**Tu solución propuesta:**
[Este comportamiento responde al flujo definido inicialmente, donde una inmobiliaria puede crear un bloqueo incluso sin cliente asignado. Según la lógica enviada para el desarrollo del sistema:
Si el bloqueo se realiza con cliente, se guarda como captación.
Si pasa a “No disponible”, el cliente se convierte en cliente real.
Si no tiene cliente, el administrador puede asignarlo manualmente.
Por ese motivo, al agregar un cliente desde una unidad, la inmobiliaria ya viene asociada previamente según el flujo del bloqueo. De todas formas, revisaremos que este proceso quede claro y funcional para evitar confusiones en la operación.]

---

## 7. Control Administrativo (Punto Crítico) ⚠️ CRÍTICO

**Descripción del problema:**
- Es importante dejar establecido que todo lo relacionado a:
  - Proyectos
  - Clientes
  - Inmobiliarias
  - Notificaciones
- Debe ser completamente editable por el administrador, sin depender de terceros

**Estado actual:**
- ✅ Proyectos: Editable por admin
- ✅ Inmobiliarias: Editable por admin
- ⚠️ Clientes: Edición limitada (no se puede cambiar inmobiliaria, ver punto 5)
- ❌ Notificaciones: Configuración está en código, no es editable desde interfaz

**Impacto:**
- Dependencia de desarrolladores para cambios operativos
- Falta de autonomía administrativa
- Bloqueos operativos

**Tu solución propuesta:**
[lo mismo admin que pueda ediar todo lo visible de las tablas en dy]

---

## 8. Importación y Exportación de Datos

**Descripción del problema:**
- Actualmente el sistema permite importar información vía Excel
- NO permite exportar datos
- Esto es necesario para control, auditoría y reportes

**Módulos que necesitan exportación:**
- Clientes
- Inventario (unidades)
- Procesos de venta
- Inmobiliarias
- Historial de cambios

**Impacto:**
- Imposibilidad de generar reportes externos
- Dificultad para auditorías
- No se pueden hacer respaldos en formato legible

**Tu solución propuesta:**
[se aniadira exportar tabla por proyecto]

---

## 9. Registro de Clientes por Inmobiliaria (Captación)

**Descripción del problema:**
- Actualmente cada inmobiliaria tiene un link único para registro de clientes
- Esto puede generar conflictos en el registro

**Propuesta del cliente:**
- Manejar un único formulario de registro
- Con opción de selección de inmobiliaria
- El sistema asigna automáticamente el cliente según la selección realizada

**Ventajas propuestas:**
- Un solo formulario para mantener
- Evita confusión con múltiples links
- Más fácil de auditar

**Desventajas potenciales:**
- Cliente debe conocer/recordar el nombre de su inmobiliaria
- Posible confusión si hay inmobiliarias con nombres similares

**Tu solución propuesta:**
link unico global ademas del ya creado con la mismas bases la diferencia es al seleccional inmobiliaria a comienzo del fomr

---

## 10. Gestión de Schedules de EventBridge ⚠️ CRÍTICO

**Descripción del problema:**
- Los schedules de EventBridge creados para bloqueos y migraciones no se gestionan correctamente
- **Problema 1:** Los schedules disparados no se eliminan automáticamente, se acumulan en EventBridge
- **Problema 2:** Falta de visibilidad sobre si los schedules se están creando correctamente en migraciones

**Contexto técnico:**
- Los schedules se crean para:
  - **Bloqueos normales:** Liberación a las 48h + Alerta a las 43h
  - **Bloqueos de migración:** Liberación a las 24h + Alerta a las 19h
  - **Exclusividad de clientes:** Vencimiento a los 3 meses
- Aunque tienen `ActionAfterCompletion='DELETE'`, esto solo funciona si Lambda retorna éxito
- Si hay errores parciales, los schedules permanecen

**Impacto:**
- Acumulación infinita de schedules ejecutados en AWS
- Costos innecesarios por schedules huérfanos
- Imposibilidad de distinguir entre schedules activos y ejecutados
- Dificultad para diagnosticar problemas en migraciones

**Tu solución implementada:**
1. **Eliminación explícita post-ejecución:** Los schedules se eliminan explícitamente después de ejecutarse como respaldo
2. **Logging mejorado:** Logs detallados con símbolos visuales (✓, ⚠, ✗) para fácil diagnóstico
3. **Validación de variables:** Verificación y logging de variables de entorno al detectar problemas
4. **Contador de éxito:** Confirmación de cuántos schedules se crearon exitosamente

**Archivos modificados:**
- `lambdas/jam-bloqueos/routes/scheduler_handler.py`
- `lambdas/jam-captacion/routes/scheduler_handler.py`
- `lambdas/jam-bloqueos/utils/scheduler.py`
- `lambdas/jam-captacion/utils/scheduler.py`
- `lambdas/jam-proyectos/utils/excel_writer.py`

**Documentación:**
- [Análisis técnico completo](./fix-schedules-migracion.md)
- [Instrucciones de despliegue](./DESPLIEGUE-FIX-SCHEDULES.md)
- [Resumen ejecutivo](./RESUMEN-FIX-SCHEDULES.md)

**Estado:** ✅ IMPLEMENTADO - Pendiente de despliegue

---

## Resumen de Prioridades

### 🔴 CRÍTICOS (Bloquean operación)
- **Problema 4:** Inconsistencia Cliente vs Proceso ✅ RESUELTO
- **Problema 5:** Edición de inmobiliaria en cliente
- **Problema 7:** Control administrativo completo
- **Problema 10:** Gestión de schedules de EventBridge ✅ IMPLEMENTADO

### 🟡 IMPORTANTES (Afectan operatividad)
- **Problema 3:** Orden de visualización de clientes
- **Problema 6:** Asignación de inmobiliaria desde unidad
- **Problema 8:** Exportación de datos

### 🟢 MEJORAS (Baja prioridad)
- **Problema 1:** Proyectos de prueba
- **Problema 2:** Visibilidad de gestión de usuarios
- **Problema 9:** Formulario único de captación

---

## Notas Adicionales

**Otros puntos mencionados que no se tocaron:**
- Registrar un cliente como tal
- Anuarios
- Notificaciones (configuración)
- Estadísticas
- Cargar un proyecto

**Razón:** Se solicitó resolver los puntos anteriores primero antes de ejecutar lo demás.

---

**Próximos pasos:**
1. Revisar cada problema
2. Proponer solución específica para cada uno
3. Validar soluciones con el equipo
4. Priorizar implementación
5. Ejecutar correcciones

---

**Preparado por:** Equipo de Desarrollo  
**Última actualización:** 6 de mayo de 2026
