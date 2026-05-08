# TK-06 - Gestión de estatus comerciales e integración con Kommo

## Objetivo

Permitir el avance del cliente por los estatus comerciales del proceso de venta
y sincronizar eventos relevantes con Kommo de forma asíncrona.

---

## Alcance

### Backend (`jam-crm`)
- Endpoint para cambiar el estatus de un cliente
- Validación de transiciones permitidas
- Registro de historial de cambios con timestamp y usuario que ejecutó el cambio
- Publicación de evento a SQS al cambiar estatus
- Lambda de integración (`jam-crm`) consume la cola y envía a Kommo

### Frontend (React + Vite)
- Botón / acción de cambio de estatus en la vista del cliente
- Modal de confirmación: "¿Desea enviar la notificación al cliente?"
- Vista de historial de estatus por cliente

---

## Flujo de estatus

```
captacion → reserva → separacion → inicial
                ↓
          desvinculacion (desde cualquier estatus activo)
```

| Estatus | Descripción | Acción sobre unidad |
|---------|-------------|---------------------|
| `captacion` | Cliente registrado | Sin cambio |
| `reserva` | Unidad reservada | Unidad → `no_disponible` |
| `separacion` | Pago confirmado | Sin cambio |
| `inicial` | Inicio de cuotas | Sin cambio |
| `desvinculado` | Proceso cancelado | Unidad → `disponible` |

---

## Lógica de cambio de estatus

```
Admin cambia estatus del cliente
        ↓
Validar transición permitida
        ↓
Actualizar estado en jam-clientes
        ↓
Actualizar estado de unidad si aplica (reserva / desvinculacion)
        ↓
Registrar en jam-historial-estatus
        ↓
Publicar evento en SQS jam-notificaciones-queue
        ↓ (asíncrono)
Lambda jam-crm consume evento
        ├→ Enviar notificación al cliente (si correo/teléfono disponible)
        └→ Sincronizar con Kommo API
```

- El flujo principal no espera respuesta de Kommo ni de notificaciones
- Si Kommo falla, el sistema interno no se ve afectado (desacoplado por SQS)

---

## Modal de confirmación de notificación

Al cambiar cualquier estatus, el frontend muestra:

> "¿Desea enviar la notificación al cliente?"
> [Sí, enviar] [No, solo cambiar estatus]

- Si el cliente no tiene correo ni teléfono, el modal no aparece
- La decisión queda registrada en el historial

---

## Mensajes por estatus

| Estatus | Mensaje al cliente | Mensaje al corredor | Fecha límite |
|---------|-------------------|---------------------|-------------|
| `captacion` | — | — | — |
| `reserva` | Bienvenida + próximos pasos | Confirmación de reserva | Pago en 30 días (EventBridge) |
| `separacion` | Confirmación de pago + pasos para firma | Confirmación | — |
| `inicial` | Notificación de inicio de pago de cuotas | Confirmación | — |
| `desvinculado` | Proceso de desvinculación iniciado | Aviso de liberación de unidad | — |

> Las notificaciones solo se envían si el cliente tiene correo o teléfono registrado.
> Con cada cambio de estatus el frontend muestra: "¿Desea enviar la notificación al cliente?" → [Sí] [No]

---

## Modelo de historial

### Tabla: `jam-historial-estatus`

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `CLIENTE#<cedula>` |
| sk | String | `ESTATUS#<timestamp>` |
| proyecto_id | String | Proyecto asociado |
| estatus_anterior | String | Estado previo |
| estatus_nuevo | String | Estado nuevo |
| ejecutado_por | String | ID del admin |
| notificacion_enviada | Boolean | Si se envió notificación |
| timestamp | String | ISO timestamp |

---

## Integración con Kommo

- La sincronización es unidireccional: JAM → Kommo
- Se envía al cambiar estatus: datos del cliente, estatus nuevo, proyecto y unidad
- La Lambda `jam-crm` maneja reintentos en caso de fallo de Kommo
- Los costos de la API de Kommo son responsabilidad del cliente

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `PUT` | `/admin/clientes/{cedula}/proyecto/{id}/estatus` | admin | Cambiar estatus del cliente |
| `GET` | `/admin/clientes/{cedula}/proyecto/{id}/historial` | admin | Ver historial de estatus |

---

## Criterios de aceptación

- [ ] Los cambios de estatus se registran con fecha y usuario que los ejecutó
- [ ] Las transiciones inválidas son rechazadas
- [ ] La unidad se libera automáticamente al marcar `desvinculado`
- [ ] La unidad pasa a `no_disponible` al marcar `reserva`
- [ ] El modal de notificación aparece en cada cambio de estatus
- [ ] Kommo recibe los eventos de forma asíncrona sin bloquear el sistema
- [ ] Si Kommo falla, el cambio de estatus interno no se revierte

---

## Notas técnicas

- SQS desacopla el sistema principal de Kommo y notificaciones
- EventBridge puede usarse para la fecha límite de pago de reserva (30 días)
- Canales de notificación: Email (Resend) + WhatsApp (Meta/Twilio) — costos a cargo del cliente
- Depende de: TK-01 (auth), TK-02 (modelo de datos), TK-05 (captación de clientes)
- **Pendiente de TK-05:** cuando una inmobiliaria bloquea una unidad y registra un cliente en el mismo flujo, el cliente queda en `captacion`. El cambio a `reserva` ocurre aquí en TK-06 cuando el admin confirma la reserva y marca la unidad como `no_disponible`
