# TK-00 - Resumen general del sistema JAM Construcciones

## Descripción del proyecto

Plataforma de gestión comercial e inventario para JAM Construcciones. Permite gestionar
proyectos inmobiliarios con múltiples inmobiliarias, controlar bloqueos de unidades en
tiempo real, registrar clientes con exclusividad, automatizar comunicaciones y generar
métricas comerciales.

---

## Módulos del sistema

| Módulo | Descripción | Ticket | Estado |
|--------|-------------|--------|--------|
| Autenticación y usuarios | Login, roles, inmobiliarias, acceso por proyecto | TK-01 | ✅ Completado |
| Modelo de datos base | Proyectos, etapas, torres, unidades, CRUD completo | TK-02 | ✅ Completado |
| Visualización de inventario | Tabla con filtros, visibilidad por rol, timer de bloqueo | TK-03 | ✅ Completado |
| Bloqueo de unidades | 48h, concurrencia, liberación automática, historial | TK-04 | ✅ Completado |
| Captación de clientes | Registro, exclusividad 3 meses por proyecto, vencimiento | TK-05 | 🔄 Pendiente |
| Estatus comerciales y CRM | Flujo de venta, notificaciones, integración Kommo | TK-06 | 🔄 Pendiente |
| Carga masiva Excel | Importación de inventario por archivo .xlsx | TK-07 | 🔄 Pendiente |
| Notificaciones y auditoría | Email + WhatsApp, SQS, trazabilidad de eventos | TK-08 | 🔄 Pendiente |
| QA y estabilización | Pruebas funcionales, concurrencia, checklist producción | TK-09 | 🔄 Pendiente |
| Despliegue a producción | Infraestructura prod, smoke test, soporte inicial | TK-10 | 🔄 Pendiente |

---

## Tipos de usuario

| Rol | Descripción |
|-----|-------------|
| `admin` | JAM Construcciones. Control total del sistema |
| `inmobiliaria` | Acceso limitado a proyectos asignados. Puede registrar clientes y bloquear unidades |

- Los usuarios de inmobiliaria usan nombre alias (ej: "Vendedor1"), no correo
- Cada inmobiliaria puede tener múltiples correos para notificaciones
- Deshabilitar una inmobiliaria preserva todo su historial

---

## Flujo principal del sistema

```
Inmobiliaria inicia sesión
        ↓
Ve proyectos asignados → selecciona proyecto
        ↓
Consulta inventario (unidades disponibles)
        ↓
Bloquea unidad (48h) → registra cliente
        ↓
Admin cambia estatus: captacion → reserva → separacion → inicial
        ↓
Cada cambio dispara notificación (Email + WhatsApp)
        ↓
Desvinculación → libera unidad, preserva historial
```

---

## Lógica de bloqueos

- Duración: 48 horas, liberación automática vía EventBridge
- No se permite doble bloqueo (ConditionExpression en DynamoDB)
- Una inmobiliaria no puede re-bloquear la misma unidad antes de 24h
- Si dos requests llegan al mismo tiempo: gana el primero por timestamp exacto
- Notificaciones: al bloquear y 5h antes de vencer

---

## Lógica de clientes y exclusividad

- Exclusividad de 3 meses por `cedula + proyecto`
- El mismo cliente puede registrarse en otro proyecto sin restricción
- Si otra inmobiliaria intenta registrar un cliente activo: alerta y rechazo (409)
- Al vencer los 3 meses: cliente queda disponible, historial se conserva
- Si el cliente viene desde un bloqueo: estado inicial `captacion`, pasa a `reserva` al vender

---

## Estados de unidad

| Estado | Descripción |
|--------|-------------|
| `disponible` | Libre para bloquear |
| `bloqueada` | Bloqueada 48h por inmobiliaria |
| `no_disponible` | En proceso de reserva/venta |
| `vendida` | Venta cerrada |
| `desvinculada` | Proceso cancelado, unidad liberada |

---

## Estados del cliente

| Estado | Descripción |
|--------|-------------|
| `captacion` | Registrado, exclusividad activa |
| `disponible` | Exclusividad vencida |
| `reserva` | Unidad reservada (unidad → `no_disponible`) |
| `separacion` | Pago confirmado |
| `inicial` | En pago de cuotas iniciales |
| `desvinculado` | Proceso cancelado (unidad → `disponible`) |

---

## Visibilidad de datos por rol

| Campo en inventario | Admin | Inmobiliaria |
|--------------------|-------|--------------|
| ID unidad, precio, estado, metraje | ✔ | ✔ |
| Tiempo restante de bloqueo | ✔ | ✔ |
| Cliente asociado | ✔ | ✗ |
| Inmobiliaria que bloqueó | ✔ | ✗ |
| Fecha de bloqueo | ✔ | ✗ |

---

## Dashboard y analytics (admin)

- Ventas por proyecto
- Unidades más demandadas
- Conversión por inmobiliaria (ventas / clientes captados)
- Cierres mensuales (reservas y separaciones)
- Cantidad de clientes por estatus
- Cantidad de unidades por estatus
- Análisis de clientes por: edad, país de nacimiento, país de residencia, estado civil

### KPIs clave

| KPI | Descripción |
|-----|-------------|
| % conversión | Reservas o separaciones / clientes captados |
| Tiempo promedio de cierre | Captación → Reserva → Separación |
| Unidades bloqueadas vs vendidas | % de bloqueos que terminan en venta |
| Conversión por inmobiliaria | Ventas / clientes que trae cada inmobiliaria |
| Velocidad de venta | Tiempo promedio entre etapas del proceso |
| % unidades bloqueadas vs vendidas | Si es bajo → inmobiliarias "secuestrando" unidades |
| Tasa de abandono | Clientes desvinculados / total clientes |

---

## Notificaciones y canales

| Canal | Proveedor | Responsabilidad de costos |
|-------|-----------|--------------------------|
| Email | Resend (u otro) | Cliente (JAM) |
| WhatsApp | Meta / Twilio | Cliente (JAM) |

- Las notificaciones se envían solo si el cliente tiene correo o teléfono registrado
- Con cada cambio de estatus: modal "¿Desea enviar notificación al cliente?"
- Arquitectura desacoplada: SQS → Lambda jam-crm → proveedores externos

---

## Infraestructura AWS

```
CloudFront → S3 (React + Vite)
                ↓
         API Gateway REST
         + Cognito Authorizer
                ↓
    ┌───────────┼───────────┐
 jam-auth  jam-proyectos  jam-bloqueos
    │           │              │
 DynamoDB   DynamoDB       DynamoDB
 usuarios   inventario     historial
                              │
                           SQS → jam-crm → Email / WhatsApp / Kommo
                              │
                        EventBridge Scheduler
                        (liberación 48h, alerta 43h, vencimiento exclusividad)
```

---

## Dependencias entre tickets

```
TK-01 (auth)
  └→ TK-02 (modelo datos)
       └→ TK-03 (visualización)
       └→ TK-04 (bloqueos)
            └→ TK-05 (captación)
                 └→ TK-06 (estatus / CRM)
                      └→ TK-08 (notificaciones)
       └→ TK-07 (carga Excel)
  └→ TK-09 (QA) — depende de TK-01 al TK-08
       └→ TK-10 (producción)
```

---

## Notas generales

- Single Table Design en DynamoDB para minimizar costos y latencia
- Todos los IDs generados con UUID v4
- Todos los timestamps en ISO 8601 UTC
- Los costos de APIs externas (WhatsApp, Kommo, Email) son responsabilidad del cliente
- El sistema está diseñado para escalar a 600+ unidades por proyecto
- Pueden existir modificaciones o adiciones dentro del alcance descrito
