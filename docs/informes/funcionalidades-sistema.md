# JAM Construcciones — Funcionalidades del sistema

**Fecha:** Abril 2026
**Acceso:** https://d12nm0khvt8zd9.cloudfront.net

**Credenciales de acceso (Admin):**
- Usuario: `JAM_ADMIN`
- Contraseña: `nombreAdmin123!`
- Correo: diana.reyes@jamconstruccionesrl.com
- Rol: Administrador

---

El sistema es una plataforma web para gestionar el inventario y el proceso comercial de JAM Construcciones. Reemplaza el control manual en Excel. Desde aquí se administran los proyectos, las unidades, las inmobiliarias que venden, los clientes que registran y todo el seguimiento hasta que una unidad se vende.

Hay cuatro tipos de usuario: **admin** (JAM Construcciones, control total), **coordinador** y **supervisor** (internos de JAM con acceso amplio pero sin gestión de usuarios), e **inmobiliaria** (acceso limitado a sus proyectos asignados).

---

## Lo que puede hacer el sistema hoy

### Entrar al sistema

Para entrar se usa un nombre de usuario y contraseña. Los usuarios internos de JAM tienen MFA obligatorio — al iniciar sesión el sistema pide un código del autenticador (Google Authenticator, Authy, etc.). Si es la primera vez, el sistema muestra un código QR para configurarlo. Las inmobiliarias no tienen MFA obligatorio. Si alguien intenta acceder a una sección que no le corresponde, el sistema lo redirige a una pantalla de acceso denegado.

---

### Gestionar inmobiliarias y usuarios

El admin puede crear inmobiliarias con nombre, correos de notificación y proyectos asignados. Cada inmobiliaria puede tener múltiples correos. Una vez creada, el admin le agrega usuarios con nombre alias (por ejemplo "Vendedor1") y contraseña — no se usa correo como usuario. Se puede deshabilitar una inmobiliaria completa o solo un usuario específico sin perder ningún historial. También se puede eliminar permanentemente.

Para los usuarios internos de JAM (coordinadores, supervisores), el admin los crea desde la sección "Usuarios" del sistema, asignándoles rol y contraseña.

---

### Gestionar proyectos e inventario

Los proyectos se muestran como tarjetas con imagen de portada, nombre y descripción. El admin puede crear, editar y desactivar proyectos, y subir una imagen de portada directamente desde el panel. Las inmobiliarias solo ven los proyectos que el admin les asignó.

Dentro de cada proyecto hay etapas (fases del proyecto) y dentro de cada etapa hay unidades. El admin puede crear, editar y eliminar etapas desde un panel lateral. Las unidades tienen bastantes campos: identificador legible (ej: A-101), tipo, manzana, piso, metraje del apartamento, metraje de terraza, metraje de patio, parqueos, precio total, precio de reserva, precio de separación, precio inicial, monto de cuota mensual, número de meses y contra entrega. También hay un campo de comentario interno que solo ve JAM — las inmobiliarias no lo ven.

El inventario se puede filtrar por etapa, estado, tipo, manzana y piso. Las inmobiliarias solo ven unidades disponibles o bloqueadas, y no ven quién bloqueó ni qué cliente tiene asociado — eso es información interna.

---

### Bloquear unidades

Cuando una inmobiliaria encuentra una unidad disponible, la puede bloquear por 48 horas. El bloqueo y el registro del cliente son el mismo paso: al bloquear se ingresan los datos del cliente (cédula, nombres, apellidos, correo, teléfono, fecha de nacimiento, estado civil, nacionalidad, país de residencia). Si el cliente ya existe en el sistema, sus datos se precargan automáticamente al buscar por cédula. También se puede bloquear sin cliente y asignarlo después.

El sistema garantiza que dos inmobiliarias no puedan bloquear la misma unidad al mismo tiempo — si llegan simultáneamente, solo la primera gana. Tampoco se puede re-bloquear la misma unidad antes de 24 horas desde la última liberación. Si el cliente ya tiene exclusividad activa con otra inmobiliaria en ese proyecto, el bloqueo se rechaza.

A las 43 horas el sistema publica una alerta de que el bloqueo está por vencer. A las 48 horas exactas la unidad se libera automáticamente si nadie confirmó la reserva. Todo esto lo maneja EventBridge Scheduler sin intervención manual.

El admin puede ver todos los bloqueos activos en tiempo real con un timer, liberar un bloqueo manualmente, extender el tiempo de un bloqueo con una justificación, y asignar un cliente a un bloqueo que quedó sin cliente. También hay un historial completo de todos los bloqueos pasados con motivo de liberación y quién lo liberó.

---

### Registrar y gestionar clientes

Los clientes se registran con cédula o pasaporte, nombres, apellidos y opcionalmente correo, teléfono, fecha de nacimiento, estado civil, nacionalidad y país de residencia. La edad se calcula automáticamente. Cada cliente queda vinculado a una inmobiliaria por proyecto durante 3 meses — eso es la exclusividad. Si otra inmobiliaria intenta registrar al mismo cliente en el mismo proyecto mientras la exclusividad está activa, el sistema lo rechaza. Al vencer los 3 meses, el cliente queda disponible para cualquier inmobiliaria pero su historial se conserva.

Cada inmobiliaria tiene un enlace único para que sus clientes se registren solos desde un formulario público, sin necesidad de login. El enlace se copia desde el sidebar con un clic.

El admin ve todos los clientes agrupados por cédula, puede buscar por nombre o cédula, filtrar por proyecto e inmobiliaria, y cargar más resultados de forma incremental. Puede editar cualquier campo del cliente. Las inmobiliarias solo ven sus propios clientes.

---

### Seguimiento del proceso de venta

Cada cliente vinculado a una unidad tiene un proceso de venta que pasa por estos estados: **captación → reserva → separación → inicial**, o puede terminar en **desvinculado** desde cualquier punto.

Solo el admin puede avanzar el estatus. Las transiciones inválidas se rechazan — no se puede saltar de captación a inicial directamente. Al pasar a reserva, la unidad pasa a "no disponible" y se cancelan los schedules de liberación automática del bloqueo. Al pasar a separación, el sistema programa una alerta automática a 30 días por si no se confirma el pago. Al pasar a inicial, la unidad queda como vendida. Al desvincular, la unidad vuelve a disponible.

Cada cambio de estatus queda registrado en el historial del proceso: quién lo cambió, cuándo, de qué estado a cuál, y si se envió notificación. Ese historial es visible desde la ficha del cliente. Si un proceso lleva más de 25 días en separación sin avanzar, el sistema muestra una alerta visual en la ficha del cliente con los días restantes.

---

### Dashboard y métricas

El dashboard muestra métricas por proyecto. Se puede cambiar de proyecto con un selector en la parte superior.

Se ven los totales de unidades (disponibles, bloqueadas, vendidas), total de clientes y procesos. Los KPIs principales son: porcentaje de conversión (procesos en reserva/separación/inicial sobre el total), tasa de abandono (desvinculados sobre el total), porcentaje de bloqueos que terminan en venta (si es bajo indica inmobiliarias bloqueando sin intención real de vender), y el tiempo promedio desde captación hasta reserva.

También hay gráficas de distribución de unidades por estado y procesos por estado, una tabla de cierres mensuales con reservas y separaciones, velocidad de venta (tiempo promedio entre etapas), y una tabla de conversión por inmobiliaria con barra de progreso. Para los datos demográficos de clientes hay distribuciones por estado civil, rango de edad, país de residencia y nacionalidad.

---

## Lo que viene próximamente

El sistema está diseñado para crecer. Estas funcionalidades ya están planificadas y en parte diseñadas:

**Notificaciones a clientes** — Cuando el admin cambia el estatus de un proceso, hay una opción de notificar al cliente. Hoy esa opción existe en la interfaz pero el envío real aún no está conectado. Próximamente se enviarán correos y mensajes de WhatsApp automáticamente al cliente y a la inmobiliaria en cada cambio de estatus, cuando un bloqueo esté por vencer, y como recordatorio de pago a los 30 días de estar en reserva.

**Carga masiva de inventario desde Excel** — El admin podrá subir un archivo `.xlsx` con todas las unidades de un proyecto y el sistema las cargará automáticamente, creando etapas, torres y unidades en lote. Las unidades ya existentes no se sobreescriben. Se generará un reporte con las unidades cargadas y los errores por fila.

**Reportes** — La sección de reportes existe en el sistema pero está deshabilitada visualmente hasta que se implemente. Incluirá reportes exportables del inventario, clientes y procesos.

**Integración con Kommo CRM** — Sincronización bidireccional con Kommo para que los cambios de estatus en JAM se reflejen automáticamente en el CRM y viceversa.
 

---

*Documento generado en Abril 2026. Se actualiza con cada nueva funcionalidad.*
