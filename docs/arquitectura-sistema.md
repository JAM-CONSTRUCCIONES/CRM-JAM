# Arquitectura del sistema JAM Construcciones

**Última actualización:** Abril 2026
**Estado:** TK-01 al TK-06 implementados

---

## Objetivo del sistema

Plataforma de gestión comercial e inventario para JAM Construcciones que permite:
- Gestionar inventario de unidades en tiempo real
- Controlar bloqueos sin conflictos entre inmobiliarias
- Registrar y gestionar clientes (captación + proceso de venta)
- Automatizar comunicaciones (WhatsApp + Email)
- Generar métricas comerciales

---

## Infraestructura

```
CloudFront → S3 (React + Vite)
                    ↓
             API Gateway REST
             + Cognito Authorizer
                    ↓
    ┌──────────┬────────────┬─────────────┬──────────────┬─────────┐
 jam-auth  jam-proyectos  jam-bloqueos  jam-captacion  jam-crm
                    ↓
             DynamoDB (5 tablas activas)
                    ↓
             SQS jam-notificaciones-queue
                    ↓
         EventBridge Scheduler (tareas one-time)
```

---

## Tipos de usuario

| Rol | Descripción |
|-----|-------------|
| `admin` | JAM Construcciones. Control total, puede editar todo y forzar cambios |
| `inmobiliaria` | Acceso limitado a proyectos asignados. Bloquea unidades y registra clientes |

- Los usuarios de inmobiliaria usan nombre alias (ej: "Vendedor1", "Usuario2"), no correo
- Cada inmobiliaria puede tener múltiples correos para notificaciones
- Deshabilitar una inmobiliaria preserva todo su historial

---

## Tablas DynamoDB

| Tabla | Responsabilidad |
|-------|----------------|
| `jam-usuarios` | Usuarios, inmobiliarias, roles, correos de notificación |
| `jam-inventario` | Proyectos, etapas, torres, unidades (Single Table Design) |
| `jam-clientes` | Perfil del cliente + exclusividad por proyecto |
| `jam-procesos` | Proceso de venta por cliente + unidad (con historial embebido) |
| `jam-historial-bloqueos` | Historial completo de bloqueos |

### Claves de acceso

```
jam-inventario:
  pk = PROYECTO#<id>   sk = METADATA          → proyecto
  pk = PROYECTO#<id>   sk = ETAPA#<id>        → etapa
  pk = PROYECTO#<id>   sk = TORRE#<id>        → torre/edificio
  pk = PROYECTO#<id>   sk = UNIDAD#<id>       → unidad

jam-clientes:
  pk = CLIENTE#<cedula>#<inmobiliaria_id>   sk = PROYECTO#<proyecto_id>

jam-procesos:
  pk = PROCESO#<cedula>#<inmobiliaria_id>   sk = UNIDAD#<unidad_id>

jam-historial-bloqueos:
  pk = UNIDAD#<id>   sk = BLOQUEO#<timestamp>
```

---

## Módulo 1 — Inventario y bloqueos

### Estados de una unidad

```
disponible
    ↓ inmobiliaria bloquea (con cliente)
bloqueada ──────────────────────────────────→ disponible
    │        48h automático / admin libera /
    │        desvinculación del proceso
    ↓ admin confirma reserva
no_disponible
    ↓ proceso llega a inicial
vendida  ← estado final positivo
```

| Estado | Quién lo cambia | Cómo |
|--------|----------------|------|
| `disponible` | Sistema / admin | Estado inicial, liberación de bloqueo, desvinculación |
| `bloqueada` | Inmobiliaria | `POST /bloqueos` (junto con datos del cliente) |
| `no_disponible` | Admin vía CRM | Al pasar proceso a `reserva` |
| `vendida` | Admin vía CRM | Al pasar proceso a `inicial` (cierre de venta) |

### Campos de una unidad

| Campo | Descripción |
|-------|-------------|
| ID unidad | Identificador legible (ej: A-101) |
| Proyecto | Proyecto al que pertenece |
| Etapa | Fase del proyecto |
| Torre / Edificio | Agrupación dentro de la etapa |
| Metraje | m² |
| Precio | Valor de la unidad |
| Estado | Estado actual |
| Fecha bloqueo | Cuándo se bloqueó |
| Fecha liberación | Cuándo vence el bloqueo |
| Tiempo restante | Timer visual (segundos) |

### Flujo de bloqueo — un solo paso

**El bloqueo y el registro del cliente son el mismo acto.** La inmobiliaria no bloquea una unidad "en el aire" — siempre hay un cliente detrás.

```
POST /bloqueos {
  proyecto_id, unidad_id,
  cedula, nombres, apellidos, telefono, correo,
  fecha_nacimiento?, estado_civil?, nacionalidad?, pais_residencia?
}
```

El sistema en un solo request:
1. Valida que la unidad esté `disponible` con `ConditionExpression` — si dos inmobiliarias intentan al mismo tiempo, el timestamp exacto decide, solo la primera gana (409 para la segunda)
2. Valida que la misma inmobiliaria no haya liberado esa unidad hace menos de 24h
3. Valida exclusividad del cliente: si otra inmobiliaria tiene al cliente activo en ese proyecto → 409, no bloquea nada
4. Cambia unidad a `bloqueada` en `jam-inventario`
5. Crea o actualiza el perfil del cliente en `jam-clientes`
6. Crea el proceso en `jam-procesos` con estado `captacion`
7. Programa en EventBridge:
   - 43h: alerta de vencimiento → SQS
   - 48h: liberación automática → unidad vuelve a `disponible`
   - 3 meses: vencimiento de exclusividad del cliente
8. Registra en `jam-historial-bloqueos`
9. Publica evento `bloqueo_registrado` en SQS

Si el bloqueo vence sin que el admin confirme la reserva, la unidad se libera sola y el proceso queda en `captacion` — el cliente sigue registrado con su exclusividad activa.

### Reglas de bloqueo

- Duración: 48 horas
- Liberación automática vía EventBridge
- No se permite doble bloqueo (ConditionExpression)
- Una inmobiliaria no puede re-bloquear la misma unidad antes de 24h desde la última liberación
- Si dos requests llegan al mismo tiempo: gana el primero por timestamp exacto

### Visibilidad del inventario

| Campo | Admin | Inmobiliaria |
|-------|-------|-------------|
| ID unidad, precio, estado, metraje | ✅ | ✅ |
| Tiempo restante del bloqueo | ✅ | ✅ |
| Cliente asociado | ✅ | ❌ |
| Inmobiliaria que bloqueó | ✅ | ❌ |
| Fecha de bloqueo | ✅ | ❌ |

### Importación de inventario

- Carga masiva desde archivo Excel (.xlsx)
- Se ordena automáticamente por estructura (Torre A, B, C...)
- Los bloques se habilitan según avanza el proyecto (TK-07)

---

## Módulo 2 — Captación de clientes

### Campos del cliente

| Campo | Requerido | Notas |
|-------|-----------|-------|
| Nombres | Sí | |
| Apellidos | Sí | |
| Cédula o # de pasaporte | Sí | Clave de unicidad |
| Teléfono | No | Requerido para WhatsApp |
| Correo | No | Requerido para Email |
| Estado civil | No | |
| Nacionalidad | No | |
| País de residencia | No | |
| Fecha de nacimiento | No | Calcula edad automáticamente |
| Edad | Auto | Calculado desde fecha de nacimiento |
| Inmobiliaria | Auto | Tomado del token de sesión |
| Proyecto | Sí | Seleccionado en el formulario |

Todos los campos son editables por admin. La inmobiliaria solo puede registrar, no editar.

### Lógica de exclusividad

- Duración: 3 meses por `cedula + proyecto`
- El mismo cliente puede registrarse en otro proyecto sin restricción
- Si otra inmobiliaria intenta registrar un cliente activo → 409, alerta al admin (TK-08)
- Al vencer: cliente queda disponible para cualquier inmobiliaria, historial se conserva
- Si la misma inmobiliaria quiere re-captar un cliente vencido → actualiza registro existente, nueva exclusividad

### Vista de la inmobiliaria

Cada inmobiliaria ve tres secciones:
- **Captación**: clientes registrados por ella en cada proyecto
- **Inventario**: unidades disponibles de sus proyectos asignados
- **Historial**: clientes que llegaron a `reserva` o superior, con su estatus actual

---

## Módulo 3 — CRM y seguimiento

### Estados del proceso de venta

```
captacion ──→ reserva ──→ separacion ──→ inicial ──→ (vendida)
    ↓              ↓            ↓             ↓
              desvinculado (desde cualquier punto activo)
              → unidad vuelve a disponible
              → historial preservado
```

| Estado | Descripción | Efecto en unidad | Notificación |
|--------|-------------|-----------------|-------------|
| `captacion` | Registrado al bloquear | Sin cambio | — |
| `reserva` | Admin confirma reserva | → `no_disponible` + cancela schedule bloqueo | Bienvenida + próximos pasos + fecha límite pago (30 días) |
| `separacion` | Pago inicial confirmado | Sin cambio | Confirmación de pago + pasos para firma |
| `inicial` | En pago de cuotas | → `vendida` | Notificación inicio de cuotas |
| `desvinculado` | Proceso cancelado | → `disponible` | Aviso de desvinculación |

### Reglas de transición

```
captacion   → [reserva, desvinculado]
reserva     → [separacion, desvinculado]
separacion  → [inicial, desvinculado]
inicial     → [desvinculado]
```

Las transiciones inválidas son rechazadas con 409.

### Notificaciones automáticas

Con cada cambio de estatus el admin ve el modal: **"¿Desea enviar la notificación al cliente?"**

- Las notificaciones solo se envían si el cliente tiene correo o teléfono registrado
- Canales: Email (Resend) + WhatsApp (Meta/Twilio) — costos a cargo del cliente
- Arquitectura desacoplada: cambio de estatus → SQS → Lambda consumidora (TK-08)
- Si el canal falla, el cambio de estatus interno no se revierte

### Fecha límite de pago en reserva

Al pasar a `reserva`, se programa un EventBridge schedule a 30 días para recordatorio de pago. Se implementa en TK-08.

---

## Flujo completo integrado

```
Inmobiliaria bloquea unidad + registra cliente (un solo paso)
        ↓
jam-bloqueos:
  - Unidad → bloqueada
  - Cliente creado en jam-clientes (exclusividad 3 meses)
  - Proceso creado en jam-procesos (estado: captacion)
  - EventBridge: 43h alerta, 48h liberación, 3m exclusividad
  - SQS: bloqueo_registrado
        ↓
Admin confirma reserva (jam-crm)
        ↓
  - Proceso → reserva
  - Unidad → no_disponible
  - Schedule de bloqueo cancelado (EventBridge)
  - SQS: cambio_estatus (notificar al cliente si aplica)
        ↓
Admin avanza: separacion → inicial
        ↓
  - Proceso → inicial
  - Unidad → vendida
  - SQS: cambio_estatus
        ↓
Si en cualquier punto: desvinculado
  - Proceso → desvinculado
  - Unidad → disponible
  - Historial preservado
  - SQS: cambio_estatus
```

---

## Separación de responsabilidades

| Lambda | Responsabilidad |
|--------|----------------|
| `jam-auth` | Login, MFA, gestión de usuarios y grupos Cognito |
| `jam-proyectos` | CRUD de proyectos, etapas, torres, unidades |
| `jam-bloqueos` | Bloqueo + creación de cliente + proceso (un solo paso) |
| `jam-captacion` | Consultas de clientes y procesos para la inmobiliaria |
| `jam-crm` | Avance del proceso de venta, historial de estatus |

---

## Eventos SQS (jam-notificaciones-queue)

| Evento | Publicado por | Datos clave |
|--------|--------------|-------------|
| `bloqueo_registrado` | jam-bloqueos | unidad, proyecto, inmobiliaria, cliente, fechas |
| `alerta_vencimiento` | EventBridge → jam-bloqueos | unidad, proyecto, inmobiliaria, fecha_liberacion |
| `liberacion_automatica` | EventBridge → jam-bloqueos | unidad, proyecto, inmobiliaria |
| `liberacion_manual` | jam-bloqueos | unidad, proyecto, inmobiliaria, liberado_por |
| `cambio_estatus` | jam-crm | cedula, proyecto, unidad, estatus, correo, telefono, notificar |

TK-08 implementa el consumidor que lee esta cola y envía Email + WhatsApp.

---

## EventBridge Scheduler

| Schedule | Creado por | Cuándo | Acción |
|----------|-----------|--------|--------|
| `bloqueo-{id}-alerta` | jam-bloqueos al bloquear | 43h después | Alerta a SQS |
| `bloqueo-{id}-liberacion` | jam-bloqueos al bloquear | 48h después | Libera unidad |
| `exclusividad-{cedula}-{inmo}-{proy}` | jam-bloqueos al bloquear | 3 meses después | Vence exclusividad |
| `reserva-pago-{id}` | jam-crm al reservar | 30 días después | Recordatorio de pago (TK-08) |

Al confirmar reserva: schedules de bloqueo se cancelan.

---

## Analytics — Dashboard admin

| Métrica | Descripción |
|---------|-------------|
| Ventas por proyecto | Unidades vendidas agrupadas por proyecto |
| Unidades más demandadas | Unidades con más bloqueos históricos |
| Conversión por inmobiliaria | Reservas / clientes captados por inmobiliaria |
| Cierres mensuales | Reservas y separaciones por mes |
| Clientes por estatus | Distribución de clientes en cada etapa |
| Unidades por estado | Disponibles, bloqueadas, no disponibles, vendidas |
| Análisis demográfico | Por edad, país de nacimiento, país de residencia, estado civil |

### KPIs clave

| KPI | Fórmula |
|-----|---------|
| % conversión | Reservas o separaciones / clientes captados |
| Tiempo promedio de cierre | Captación → Reserva → Separación (días promedio) |
| Bloqueos vs ventas | % de bloqueos que terminan en venta |
| Conversión por inmobiliaria | Ventas / clientes que trae cada inmobiliaria |
| Velocidad de venta | Tiempo promedio entre cada etapa del proceso |
| % unidades bloqueadas vs vendidas | Si es bajo → inmobiliarias "secuestrando" unidades |
| Tasa de abandono | Clientes desvinculados / total clientes |

---

## Ajustes pendientes (gap entre spec y código actual)

### Críticos — afectan el flujo principal

**1. Bloqueo y captación son pasos separados**
La spec define que son un solo paso. Actualmente `POST /bloqueos` no recibe datos del cliente y `POST /clientes` es un endpoint separado. Hay que unificarlos en `jam-bloqueos`.

**2. Schedule de bloqueo no se cancela al reservar**
Al pasar a `reserva`, `jam-crm` debe cancelar los schedules de EventBridge del bloqueo. Actualmente quedan huérfanos.

**3. Unidad no pasa a `vendida`**
No hay transición implementada que cambie la unidad a `vendida`. Según la spec, debería ocurrir al llegar a `inicial`.

### Menores — no bloquean el flujo

**4. `jam-historial-estatus` existe pero no se usa**
El historial está embebido en `jam-procesos`. La tabla puede eliminarse del CDK.

**5. `actualizar_admin` en `jam-captacion` tiene `estado` en campos editables**
El campo `estado` ya no existe en `jam-clientes`. Hay que quitarlo.

**6. Fecha límite de pago en reserva (30 días)**
El EventBridge schedule para recordatorio de pago no está implementado. Va en TK-08.

**7. Múltiples correos por inmobiliaria**
La spec requiere que cada inmobiliaria pueda tener más de un correo para notificaciones. El modelo actual de `jam-usuarios` tiene un solo correo por inmobiliaria.

---

## Tickets pendientes

| Ticket | Descripción | Ajustes de spec incluidos |
|--------|-------------|--------------------------|
| TK-07 | Carga masiva de unidades desde Excel | — |
| TK-08 | Notificaciones Email + WhatsApp + recordatorio 30 días reserva | Múltiples correos por inmobiliaria |
| TK-09 | QA y estabilización | — |
| TK-10 | Despliegue a producción | — |
| — | Unificar bloqueo + captación en un solo paso | Ajuste crítico #1 |
| — | Cancelar schedule al reservar | Ajuste crítico #2 |
| — | Transición a `vendida` al llegar a `inicial` | Ajuste crítico #3 |
