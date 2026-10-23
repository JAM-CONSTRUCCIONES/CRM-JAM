# Entrega TK-04 — Bloqueo de unidades con control de concurrencia y liberación automática

**Fecha de entrega:** Abril 2026
**Estado:** Completado

---

## Resumen

Se implementó el flujo completo de bloqueo de unidades por 48 horas. Incluye control de concurrencia con escritura condicional en DynamoDB para evitar race conditions, restricción de re-bloqueo por 24h, liberación automática vía EventBridge Scheduler, notificaciones vía SQS, historial completo de bloqueos, y frontend completo para inmobiliarias y administradores.

---

## Qué se construyó

### Lambda nueva: `jam-bloqueos`

Nueva lambda independiente con responsabilidad exclusiva sobre el ciclo de vida de los bloqueos.

**Endpoints implementados:**

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/bloqueos` | inmobiliaria | Bloquear una unidad |
| `GET` | `/bloqueos/activos` | admin | Ver todos los bloqueos activos |
| `GET` | `/admin/bloqueos/historial` | admin | Ver historial completo de bloqueos |
| `DELETE` | `/admin/bloqueos/{unidad_id}` | admin | Liberar manualmente |
| `PUT` | `/admin/bloqueos/{unidad_id}/extender` | admin | Extender bloqueo con justificación |

**Estructura de archivos:**
```
lambdas/jam-bloqueos/
├── handler.py
├── routes/
│   ├── bloqueos.py         # POST /bloqueos, GET /bloqueos/activos
│   ├── admin_bloqueos.py   # DELETE y PUT /admin/bloqueos/...
│   ├── historial.py        # GET /admin/bloqueos/historial
│   └── scheduler_handler.py # Eventos de EventBridge Scheduler
└── utils/
    ├── auth.py
    ├── response.py
    └── scheduler.py        # Helpers para EventBridge Scheduler
```

### Control de concurrencia

El doble bloqueo se previene con `ConditionExpression` en DynamoDB. Solo el primer request que encuentre la unidad en estado `disponible` gana — los demás reciben 409.

### Restricción de re-bloqueo

Una inmobiliaria no puede bloquear la misma unidad si la liberó hace menos de 24h. Se valida consultando `jam-historial-bloqueos`.

### Liberación automática (EventBridge Scheduler)

Al bloquear una unidad se crean dos schedules one-time:
- `bloqueo-{id}-liberacion` → a las 48h libera la unidad automáticamente
- `bloqueo-{id}-alerta` → a las 43h envía notificación de alerta (5h antes)

Al liberar manualmente o extender, los schedules se eliminan/recrean.

### Notificaciones (SQS)

Cola `jam-notificaciones-queue` recibe mensajes para cada evento:
- `bloqueo_registrado` — al bloquear
- `alerta_vencimiento` — 5h antes de vencer
- `liberacion_automatica` — al liberar por scheduler
- `liberacion_manual` — al liberar por admin

### Historial de bloqueos

Tabla `jam-historial-bloqueos` registra cada bloqueo con: inmobiliaria (nombre), proyecto, fechas, motivo de liberación y quién liberó (nombre del admin).

### Modificación en `jam-proyectos`

`GET /proyectos/{id}/unidades` ahora incluye `fecha_liberacion` y `tiempo_restante` (segundos) para unidades en estado `bloqueada`, alimentando el timer visual del frontend.

---

## Frontend

### Botón de bloqueo en inventario (inmobiliaria)

- Unidades `disponible` muestran botón "Bloquear" con confirmación
- Al confirmar, la tabla se actualiza automáticamente sin recargar la página
- Retry automático en caso de cold start de Lambda (502/503)
- Mensajes diferenciados: unidad no disponible (409), re-bloqueo en 24h (429)
- Unidades `bloqueada` muestran tag con timer de tiempo restante (verde/amarillo según proximidad al vencimiento)

### Timer visual en tabla de unidades

- Columna Estado muestra el tag + tiempo restante para unidades bloqueadas
- Color verde si quedan más de 5h, amarillo si quedan menos de 5h

### Página de bloqueos activos (admin)

Nueva página `/bloqueos` accesible desde el sidebar (sección Administración).

**Pestaña Activos:**
- Tabla con todos los bloqueos en curso
- Columnas: unidad, proyecto, bloqueado por, fecha bloqueo, fecha vencimiento, tiempo restante con color
- Acción "Extender": modal con horas adicionales y justificación obligatoria
- Acción "Liberar": popconfirm de confirmación, la unidad vuelve a disponible
- Botón de actualizar manual

**Pestaña Historial:**
- Tabla con todos los bloqueos pasados y activos
- Columnas: unidad, proyecto, inmobiliaria (nombre), bloqueado, liberado, motivo, liberado por (nombre)
- Motivos con colores: automática (verde), manual (azul), venta (morado), activo (amarillo)

---

## Infraestructura (CDK)

Recursos nuevos agregados al stack:

| Recurso | Nombre | Descripción |
|---------|--------|-------------|
| DynamoDB | `jam-historial-bloqueos` | Historial de todos los bloqueos |
| SQS | `jam-notificaciones-queue` | Cola de notificaciones por email |
| IAM Role | `jam-scheduler-role` | Permite a EventBridge invocar `jam-bloqueos` |
| Lambda | `jam-bloqueos` | Nueva lambda de bloqueos |
| API Gateway | `/bloqueos`, `/admin/bloqueos/*` | Rutas nuevas |

Permisos otorgados a `jam-bloqueos`:
- `jam-inventario` read/write
- `jam-historial-bloqueos` read/write
- `jam-usuarios` read (para resolver nombres)
- SQS `SendMessage`
- EventBridge Scheduler `CreateSchedule` + `DeleteSchedule`
- IAM `PassRole` sobre `jam-scheduler-role`

---

## Archivos creados / modificados

| Archivo | Tipo |
|---------|------|
| `lambdas/jam-bloqueos/handler.py` | Creado |
| `lambdas/jam-bloqueos/routes/bloqueos.py` | Creado |
| `lambdas/jam-bloqueos/routes/admin_bloqueos.py` | Creado |
| `lambdas/jam-bloqueos/routes/historial.py` | Creado |
| `lambdas/jam-bloqueos/routes/scheduler_handler.py` | Creado |
| `lambdas/jam-bloqueos/utils/auth.py` | Creado |
| `lambdas/jam-bloqueos/utils/response.py` | Creado |
| `lambdas/jam-bloqueos/utils/scheduler.py` | Creado |
| `lambdas/jam-proyectos/routes/unidades.py` | Modificado — `fecha_liberacion` y `tiempo_restante` |
| `front/src/pages/inventario/InventarioPage.tsx` | Modificado — botón bloquear, timer |
| `front/src/pages/bloqueos/BloqueosPage.tsx` | Creado |
| `front/src/services/bloqueos.service.ts` | Creado |
| `front/src/types/index.ts` | Modificado — `Bloqueo`, `HistorialBloqueo` |
| `front/src/App.tsx` | Modificado — ruta `/bloqueos` |
| `front/src/components/layout/Sidebar.tsx` | Modificado — item Bloqueos |
| `infra/lib/jam-stack.ts` | Modificado — todos los recursos nuevos |

---

## Criterios de aceptación

- [x] Una unidad no puede quedar bloqueada por dos corredores al mismo tiempo
- [x] El primer request válido gana, los demás reciben 409
- [x] La misma inmobiliaria no puede re-bloquear la misma unidad antes de 24h
- [x] El bloqueo expira automáticamente a las 48h vía EventBridge
- [x] Se envían notificaciones al bloquear y 5h antes de vencer (vía SQS)
- [x] Admin puede liberar o extender con trazabilidad completa
- [x] Todo queda registrado en `jam-historial-bloqueos`
- [x] `GET /proyectos/{id}/unidades` retorna `fecha_liberacion` y `tiempo_restante`
- [x] Frontend completo: botón bloquear, timer, página de bloqueos activos e historial

---

## Próximas entregas

| Ticket | Descripción |
|--------|-------------|
| TK-05 | Registro y gestión de clientes captados por inmobiliaria |
| TK-06 | Cambio de estados comerciales (reserva, separación, venta) |
| TK-07 | Carga masiva de unidades desde Excel |
