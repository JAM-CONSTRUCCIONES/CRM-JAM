# Entrega TK-06 — Estatus comerciales, procesos de venta y unificación del flujo

**Fecha de entrega:** Abril 2026
**Estado:** Completado

---

## Resumen

Se implementó el flujo comercial completo desde el bloqueo hasta el cierre de venta. El cambio más importante fue unificar el bloqueo y el registro del cliente en un solo paso, eliminando la separación artificial entre ambos. Se creó la tabla `jam-procesos` como entidad central del ciclo de venta, y se conectaron los tres módulos (bloqueos, captación, CRM) en un flujo coherente.

---

## Cómo funciona el sistema ahora

### El flujo completo de punta a punta

```
Inmobiliaria bloquea unidad + registra cliente (un solo paso)
        ↓
Admin confirma reserva
        ↓
Admin avanza: separacion → inicial
        ↓
Unidad vendida / proceso cerrado
```

---

### Paso 1 — Bloqueo con cliente (jam-bloqueos)

La inmobiliaria ve el inventario, selecciona una unidad disponible y llena el formulario con los datos del cliente. Todo ocurre en un solo request.

```
POST /bloqueos {
  proyecto_id, unidad_id,
  cedula, nombres, apellidos,
  correo?, telefono?, fecha_nacimiento?,
  estado_civil?, nacionalidad?, pais_residencia?
}
```

El backend en orden:

1. Valida exclusividad del cliente antes de tocar la unidad — si otra inmobiliaria tiene al cliente activo en ese proyecto, rechaza con 409 sin bloquear nada
2. Valida restricción de re-bloqueo (< 24h desde última liberación)
3. Bloquea la unidad con `ConditionExpression` — si dos inmobiliarias intentan al mismo tiempo, solo la primera gana
4. Crea o actualiza el perfil del cliente en `jam-clientes`
5. Crea el proceso de venta en `jam-procesos` con estado `captacion`
6. Programa en EventBridge:
   - 43h: alerta de vencimiento → SQS
   - 48h: liberación automática → unidad vuelve a `disponible`
7. Registra en `jam-historial-bloqueos`
8. Publica `bloqueo_registrado` en SQS

Si el bloqueo vence sin que el admin confirme la reserva, la unidad se libera sola y el proceso queda en `captacion` — el cliente sigue registrado con su exclusividad activa.

El campo `cliente_cedula` se guarda en la unidad bloqueada para que al liberar automáticamente se pueda marcar el proceso como `desvinculado`.

---

### Paso 2 — Confirmación de reserva (jam-crm)

El admin entra a `/clientes`, abre el drawer del cliente y ve sus procesos de venta. Cada proceso muestra la unidad y el estado actual.

```
PUT /admin/clientes/{cedula}/proyecto/{id}/unidad/{uid}/estatus
{ estatus: "reserva", inmobiliaria_id, notificar }
```

Al confirmar `reserva`:
1. Valida que la unidad siga `disponible` o `bloqueada` — si ya fue tomada por otro proceso, rechaza
2. Actualiza el proceso a `reserva`
3. Cancela los schedules de EventBridge del bloqueo (liberación automática ya no aplica)
4. Cambia la unidad a `no_disponible` en inventario
5. Registra en el historial embebido del proceso
6. Publica `cambio_estatus` en SQS

---

### Paso 3 — Avance del proceso (jam-crm)

```
captacion → reserva → separacion → inicial
    ↓           ↓          ↓           ↓
              desvinculado (desde cualquier punto)
```

| Transición | Efecto en unidad |
|-----------|-----------------|
| `captacion → reserva` | `bloqueada/disponible → no_disponible` + cancela schedule |
| `reserva → separacion` | Sin cambio |
| `separacion → inicial` | Sin cambio |
| `inicial` (llegada) | `no_disponible → vendida` |
| `→ desvinculado` | `no_disponible → disponible` |

Cada cambio:
- Registra en el historial embebido del proceso (quién, cuándo, si se notificó)
- Publica evento en SQS para notificaciones (TK-08)
- Modal en el frontend: "¿Desea enviar notificación al cliente?" (solo si tiene correo o teléfono)

---

## Modelo de datos

### jam-clientes — perfil + exclusividad

```
pk = CLIENTE#<cedula>#<inmobiliaria_id>
sk = PROYECTO#<proyecto_id>
```

Campos: nombres, apellidos, cedula, correo, telefono, estado_civil, nacionalidad,
pais_residencia, fecha_nacimiento, edad (calculada), inmobiliaria_id, proyecto_id,
exclusividad_activa, fecha_captacion, fecha_vencimiento

La exclusividad es por `cedula + proyecto`. El mismo cliente puede estar en otro proyecto sin restricción. Cada inmobiliaria tiene su propio registro del cliente — el historial nunca se pisa.

### jam-procesos — proceso de venta

```
pk = PROCESO#<cedula>#<inmobiliaria_id>
sk = UNIDAD#<unidad_id>
```

Campos: cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre, estado,
historial (array embebido), fecha_inicio, actualizado_en

El historial embebido contiene cada cambio de estatus:
```json
{
  "estatus_anterior": "captacion",
  "estatus_nuevo": "reserva",
  "ejecutado_por": "sub-del-admin",
  "ejecutado_por_nombre": "Admin JAM",
  "notificacion_enviada": true,
  "timestamp": "2026-04-17T..."
}
```

Un cliente puede tener múltiples procesos en paralelo — uno por cada unidad de interés.

---

## Estados

### Unidad

| Estado | Descripción | Cómo llega |
|--------|-------------|-----------|
| `disponible` | Libre para bloquear | Estado inicial / liberación / desvinculación |
| `bloqueada` | Apartada 48h | `POST /bloqueos` |
| `no_disponible` | En proceso de venta | Admin confirma `reserva` |
| `vendida` | Venta cerrada | Proceso llega a `inicial` |

### Proceso de venta

| Estado | Descripción | Efecto en unidad |
|--------|-------------|-----------------|
| `captacion` | Registrado al bloquear | — |
| `reserva` | Admin confirma | → `no_disponible` |
| `separacion` | Pago inicial | — |
| `inicial` | En cuotas | → `vendida` |
| `desvinculado` | Cancelado | → `disponible` |

---

## Visibilidad por rol

| Campo en inventario | Admin | Inmobiliaria |
|--------------------|-------|-------------|
| Unidad, precio, estado, metraje | ✅ | ✅ |
| Timer de bloqueo | ✅ | ✅ |
| Cliente asociado | ✅ | ❌ |
| Inmobiliaria que bloqueó | ✅ | ❌ |
| Fecha de bloqueo | ✅ | ❌ |

| Acción | Admin | Inmobiliaria |
|--------|-------|-------------|
| Bloquear unidad + registrar cliente | ❌ | ✅ |
| Ver sus propios clientes y procesos | — | ✅ (lectura) |
| Ver todos los clientes | ✅ | ❌ |
| Cambiar estatus del proceso | ✅ | ❌ |
| Crear proceso manualmente (sin bloqueo) | ✅ | ❌ |
| Liberar / extender bloqueo | ✅ | ❌ |

---

## Lambdas y responsabilidades

| Lambda | Responsabilidad |
|--------|----------------|
| `jam-bloqueos` | Bloqueo + creación de cliente + proceso (un solo paso) |
| `jam-captacion` | Consultas de clientes y procesos para la inmobiliaria |
| `jam-crm` | Avance del proceso, historial, cancelación de schedules |

---

## EventBridge Scheduler

| Schedule | Creado por | Cuándo | Acción |
|----------|-----------|--------|--------|
| `bloqueo-{id}-alerta` | jam-bloqueos al bloquear | 43h | Alerta a SQS |
| `bloqueo-{id}-liberacion` | jam-bloqueos al bloquear | 48h | Libera unidad |
| `exclusividad-{...}` | jam-captacion al registrar | 3 meses | Vence exclusividad |

Al confirmar `reserva`: schedules de bloqueo se cancelan desde `jam-crm`.

---

## Eventos SQS (jam-notificaciones-queue)

| Evento | Publicado por | Cuándo |
|--------|--------------|--------|
| `bloqueo_registrado` | jam-bloqueos | Al bloquear |
| `alerta_vencimiento` | EventBridge → jam-bloqueos | 5h antes de vencer |
| `liberacion_automatica` | EventBridge → jam-bloqueos | Al vencer 48h |
| `liberacion_manual` | jam-bloqueos | Admin libera |
| `cambio_estatus` | jam-crm | Cada cambio de estatus |

TK-08 implementa el consumidor que envía Email + WhatsApp.

---

## Archivos creados / modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `lambdas/jam-bloqueos/routes/bloqueos.py` | Modificado | Recibe datos del cliente, crea cliente + proceso |
| `lambdas/jam-bloqueos/utils/clientes.py` | Reescrito | `registrar_cliente_y_proceso` + `desvincular_unidad` |
| `lambdas/jam-crm/routes/estatus.py` | Modificado | Cancela schedule al reservar, unidad → vendida al llegar a inicial |
| `lambdas/jam-captacion/routes/clientes.py` | Modificado | Limpieza: sin `estado` ni `unidades[]` en jam-clientes |
| `front/src/pages/inventario/InventarioPage.tsx` | Modificado | Un solo request en handleBloquear |
| `front/src/services/bloqueos.service.ts` | Modificado | Payload con datos del cliente |
| `front/src/pages/clientes/ClientesPage.tsx` | Creado/Modificado | Drawer con procesos, modal estatus, historial |
| `front/src/components/common/CambiarEstatusModal.tsx` | Creado | Modal de cambio de estatus por proceso |
| `front/src/components/common/HistorialEstatusDrawer.tsx` | Creado | Timeline de historial embebido |
| `front/src/services/crm.service.ts` | Creado | cambiarEstatus, getProcesosCliente, crearProceso |
| `front/src/types/index.ts` | Modificado | Proceso, HistorialProcesoEntry, Cliente sin estado/unidades |
| `infra/lib/jam-stack.ts` | Modificado | jam-procesos table + GSIs, permisos, scheduler para jam-crm |

---

## Criterios de aceptación

- [x] Bloqueo y registro del cliente ocurren en un solo request
- [x] Si el cliente tiene exclusividad con otra inmobiliaria, el bloqueo se rechaza completo
- [x] Al confirmar reserva, el schedule de liberación automática se cancela
- [x] La unidad pasa a `no_disponible` al confirmar reserva
- [x] La unidad pasa a `vendida` al llegar a `inicial`
- [x] La unidad vuelve a `disponible` al desvincularse
- [x] Cada cambio de estatus queda registrado con quién lo ejecutó y cuándo
- [x] Las transiciones inválidas son rechazadas
- [x] Un cliente puede tener múltiples procesos en paralelo (una por unidad)
- [x] El admin puede crear un proceso manualmente si el cliente fue captado sin unidad
- [x] La inmobiliaria ve sus procesos en modo lectura desde el drawer del cliente
- [x] Eventos publicados a SQS en cada cambio para TK-08

---

## Próximas entregas

| Ticket | Descripción |
|--------|-------------|
| TK-07 | Carga masiva de unidades desde Excel |
| TK-08 | Notificaciones Email + WhatsApp consumiendo SQS |
| TK-09 | QA y estabilización |
| TK-10 | Despliegue a producción |
