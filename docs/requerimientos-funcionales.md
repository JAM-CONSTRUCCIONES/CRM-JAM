# JAM Construcciones - Requerimientos Funcionales

## Contexto

Sistema de gestión comercial e inventario para reemplazar el proceso manual en Excel.
Actualmente se administran 600+ unidades con riesgo operativo por bloqueos simultáneos,
falta de trazabilidad y carga manual. El sistema se desarrolla en fases priorizando los
módulos más críticos del negocio.

---

## Tipos de Usuario

### Admin (JAM Construcciones)
- Control total del sistema
- Puede editar cualquier campo
- Puede forzar cambios de estado
- Ve todos los datos: cliente, inmobiliaria, bloqueos, analytics

### Inmobiliaria
- Acceso limitado a los proyectos asignados por admin
- El usuario de acceso es un nombre (ej: "Vendedor", "Usuario"), no un correo
- Puede registrar clientes, bloquear unidades y ver disponibilidad
- No ve: nombre del cliente ni qué inmobiliaria bloqueó una unidad

---

## Fases de Desarrollo

### Fase 1 - Captación de Clientes
### Fase 2 - Inventario y Bloqueos
### Fase 3 - CRM, Seguimiento y Analytics *(etapa posterior)*

---

## Módulo 1: Captación de Clientes

### Campos del cliente
| Campo | Requerido |
|-------|-----------|
| Nombres | Sí |
| Apellidos | Sí |
| Cédula o # de pasaporte | Sí |
| Correo | No |
| Teléfono | No |
| Estado civil | No |
| Nacionalidad | No |
| País de residencia | No |
| Fecha de nacimiento | No |
| Edad | Auto (calculado desde fecha de nacimiento) |
| Inmobiliaria | Auto (asignado por sesión) |
| Proyecto | Sí |

### Lógica de exclusividad
- Un cliente queda vinculado a una inmobiliaria por **3 meses por proyecto**
- Si la misma inmobiliaria registra al mismo cliente en otro proyecto, el sistema lo admite
- Si otra inmobiliaria intenta registrar un cliente activo, el sistema alerta y redirige a JAM
- Al vencer los 3 meses, el cliente queda disponible para cualquier inmobiliaria
- El cliente permanece en la base de datos aunque quede liberado

### Integración con bloqueos
- Si el cliente se registra desde un bloqueo, se guarda como captación
- Solo pasa a cliente activo si la unidad se vende

---

## Módulo 2: Inventario y Bloqueos

### Campos de unidad
| Campo | Descripción |
|-------|-------------|
| ID unidad | Identificador único |
| Proyecto | Proyecto al que pertenece |
| Etapa | Etapa del proyecto |
| Torre / Edificio | Bloque (A, B, C...) |
| Metraje | m² |
| Precio | Valor de la unidad |
| Estado | Disponible / Bloqueada / No disponible / Vendida |
| Fecha bloqueo | Timestamp del bloqueo |
| Fecha liberación | Timestamp de liberación automática |
| Tiempo restante | Timer visible |

### Lógica de bloqueos
- Duración: **48 horas**, con liberación automática al vencimiento
- No se permite doble bloqueo sobre la misma unidad
- Una inmobiliaria no puede bloquear la misma unidad antes de 24h de haberla liberado
- Si dos bloqueos entran simultáneamente: se usa timestamp exacto, prioridad al primero

### Extensión de bloqueo
- Solo admin puede extender manualmente en casos excepcionales

### Notificaciones de bloqueo
- Al bloquear: email a inmobiliaria + email interno
- 5 horas antes de liberar: email a inmobiliaria + email interno

### Relación bloqueo - cliente
| Caso | Resultado |
|------|-----------|
| Bloqueo con cliente registrado | Se guarda como captación |
| Unidad pasa a "No disponible" | Cliente se convierte en cliente real |
| Bloqueo sin cliente | Admin puede asignar manualmente |

### Visualización por rol
| Campo | Admin | Inmobiliaria |
|-------|-------|--------------|
| Unidad | ✔ | ✔ |
| Precio | ✔ | ✔ |
| Estado | ✔ | ✔ |
| Tiempo restante | ✔ | ✔ |
| Cliente | ✔ | ✗ |
| Inmobiliaria que bloqueó | ✔ | ✗ |

### Filtros disponibles
- Por proyecto
- Por etapa
- Por estado

### Importación de inventario
- Carga de archivos Excel (.xlsx)
- Los bloques se habilitan progresivamente según avance del proyecto
- El sistema ordena automáticamente por estructura (Torre A, B, C...)

---

## Módulo 3: CRM y Seguimiento *(Fase 3)*

### Estados del cliente y automatizaciones
| Estado | Trigger | Acción |
|--------|---------|--------|
| Captación | Registro del cliente | Notificación automática |
| Reserva | Cambio de estado | Mensaje de bienvenida a cliente y corredor + próximos pasos. Fecha límite de pago: 30 días desde el cambio |
| Separación | Cambio de estado | Confirmación de pago + pasos para firma de contrato |
| Inicial | Cambio de estado | Notificación de inicio de pago de cuotas |
| Desvinculación | Cambio de estado | Notificación al cliente + liberación de unidad + historial preservado |

- Con cada cambio de estado se muestra un modal: *"¿Desea enviar la notificación al cliente?"*
- Las notificaciones se envían solo si el cliente tiene correo y/o teléfono registrado
- Canales: WhatsApp API (Meta/Twilio) + Email (Resend u otro)
- Los costos de consumo de APIs externas son responsabilidad del cliente

---

## Gestión de Inmobiliarias

- Cada inmobiliaria puede tener múltiples correos para notificaciones
- Admin crea la inmobiliaria y le asigna usuarios
- Admin puede deshabilitar el acceso a una inmobiliaria sin perder su historial
- Cada inmobiliaria ve solo los proyectos que admin le asigne
- Vista por inmobiliaria incluye: captaciones, inventario por proyecto e historial de clientes que llegaron a reserva

---

## Analytics y KPIs *(Fase 3)*

### Dashboard
- Ventas por proyecto
- Unidades más demandadas
- Conversión por inmobiliaria
- Cierres mensuales (Reservas y Separaciones)
- Cantidad de clientes por estado
- Cantidad de unidades por estado
- Análisis de clientes por: edad, país de nacimiento, país de residencia, estado civil

### KPIs clave
- % conversión: Reservas o separaciones / clientes captados
- Tiempo promedio de cierre
- Unidades bloqueadas vs vendidas
- Conversión por inmobiliaria: ventas / clientes que trae
- Velocidad de venta: Captación → Reserva → Separación
- % unidades bloqueadas vs vendidas (alerta si es bajo: inmobiliarias "secuestrando" unidades)
- Tasa de abandono (desvinculación): clientes retirados / total clientes
