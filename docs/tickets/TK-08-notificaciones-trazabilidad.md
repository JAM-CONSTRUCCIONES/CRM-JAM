# TK-08 - Notificaciones operativas y trazabilidad de eventos clave

## Estado actual (al 27/04/2026)

### Lo que YA existe en el código

**Productores SQS — ya publican mensajes a `jam-notificaciones-queue`:**

| Lambda | Evento publicado | Función |
|--------|-----------------|---------|
| `jam-bloqueos` | `bloqueo_registrado` | `bloqueos.py → bloquear()` |
| `jam-bloqueos` | `liberacion_automatica` | `scheduler_handler.py → _liberar()` |
| `jam-bloqueos` | `alerta_vencimiento` (5h antes) | `scheduler_handler.py → _alertar()` |
| `jam-bloqueos` | `liberacion_manual` | `admin_bloqueos.py → liberar()` |
| `jam-crm` | `cambio_estatus` (reserva/separacion/inicial/desvinculado) | `estatus.py → cambiar_estatus()` |
| `jam-crm` | `alerta_separacion_vencida` (30 días sin pago) | `estatus.py → manejar_alerta_separacion()` |

**Modelo de datos de correos — ya existe:**
- `INMOBILIARIA#<id>` en `jam-usuarios` tiene campo `correos: []` (lista de emails de notificación)
- `USUARIO#<sub>` en `jam-usuarios` tiene campo `correo: string` (correo del usuario individual)
- `CLIENTE#<cedula>#<inmo>` en `jam-clientes` tiene campo `correo: string` (correo del cliente)
- El frontend ya permite gestionar `correos[]` de la inmobiliaria desde el panel de Inmobiliarias

**Infraestructura CDK — ya definida:**
- SQS `jam-notificaciones-queue` creada (retención 7 días, visibilidad 60s)
- `jam-bloqueos` y `jam-crm` tienen `SQS_URL` en env y permisos `grantSendMessages`
- EventBridge Scheduler para vencimiento de exclusividad (captacion) y alerta de separación (crm)

---

### Lo que NO existe todavía

| Qué falta | Dónde |
|-----------|-------|
| Lambda consumidora `jam-notificaciones` | No existe, no está en CDK |
| DLQ `jam-notificaciones-dlq` | No definida en CDK |
| Envío real de emails (Resend/SES) | Ningún código de envío |
| Tabla `jam-auditoria` | No existe en CDK ni en código |
| Endpoints `GET /admin/auditoria` | No implementados |
| `jam-captacion` no publica a SQS | Falta `cliente_captado`, `exclusividad_vencida`, `intento_duplicado` |
| `SQS_URL` en env de `captacionLambda` | No está en CDK |
| Correo del usuario en `crearUsuarioInmobiliaria` service | El frontend envía `correo` pero el service type no lo incluye |
| Resolución de correos en productores SQS | Los mensajes publicados no incluyen los correos destino — la lambda consumidora debe resolverlos desde DynamoDB |

---

## Lo que haremos en este ticket

### Fase 1 — Lambda consumidora + email (núcleo)

**1. Nueva Lambda `jam-notificaciones`**
- Trigger: SQS `jam-notificaciones-queue` (batch size 5)
- Resuelve correos destino consultando `jam-usuarios` (inmobiliaria → `correos[]`, usuario → `correo`)
- Envía emails vía **Resend** (`RESEND_API_KEY` en env)
- Maneja tanto `"evento"` (bloqueos) como `"tipo"` (crm) — los productores usan keys distintas

**Lógica de resolución de destinatarios por evento:**

| Evento | Destinatarios | Fuente del correo |
|--------|--------------|-------------------|
| `bloqueo_registrado` | Inmobiliaria + admin | `INMOBILIARIA#<id>.correos[]` + `ADMIN_EMAIL` env |
| `alerta_vencimiento` | Inmobiliaria + admin | ídem |
| `liberacion_automatica` | Inmobiliaria | `INMOBILIARIA#<id>.correos[]` |
| `liberacion_manual` | Inmobiliaria | `INMOBILIARIA#<id>.correos[]` |
| `cambio_estatus` con `notificar: true` | Cliente + inmobiliaria | `jam-clientes.correo` + `INMOBILIARIA#<id>.correos[]` |
| `cambio_estatus` sin notificar | Solo log | — |
| `alerta_separacion_vencida` | Admin | `ADMIN_EMAIL` env |
| `cliente_captado` | Admin | `ADMIN_EMAIL` env |
| `exclusividad_vencida` | Admin + inmobiliaria | `ADMIN_EMAIL` + `INMOBILIARIA#<id>.correos[]` |
| `intento_duplicado` | Admin | `ADMIN_EMAIL` env |

**2. DLQ `jam-notificaciones-dlq`**
- Retención 14 días, `maxReceiveCount: 3`

**3. CDK — agregar a `jam-stack.ts`:**
- DLQ + asociación a la queue principal
- Lambda `jam-notificaciones` con trigger SQS
- `RESEND_API_KEY`, `ADMIN_EMAIL`, `USUARIOS_TABLE`, `CLIENTES_TABLE` en env
- `grantConsumeMessages` + `grantReadData` en tablas necesarias

---

### Fase 2 — Completar productores faltantes

**4. `jam-captacion` publica a SQS en:**
- `_crear()` → evento `cliente_captado` (cedula, inmobiliaria_id, proyecto_id, nombres, apellidos)
- Scheduler `vencer_exclusividad` → evento `exclusividad_vencida`
- Conflicto 409 en `registrar()` y `registrar_publico()` → evento `intento_duplicado`

**5. CDK — agregar `SQS_URL` al env de `captacionLambda` + `grantSendMessages`**

---

### Fase 3 — Corrección menor en frontend

**6. `inmobiliarias.service.ts` — agregar `correo` al tipo de `crearUsuarioInmobiliaria`:**

```typescript
// Actualmente falta correo en el tipo del payload
export const crearUsuarioInmobiliaria = (
  pk: string,
  data: { username: string; password: string; nombre?: string; correo?: string }
): Promise<void> => ...
```

El formulario ya lo envía, el backend ya lo guarda, pero el tipo TypeScript no lo declara.

---

### Fase 4 — Auditoría (post-sprint si hay tiempo)

- Tabla `jam-auditoria` en DynamoDB
- La lambda `jam-notificaciones` registra cada evento procesado (éxito o fallo de envío)
- Endpoints `GET /admin/auditoria` con filtros por tipo, proyecto, usuario, rango de fechas

---

## Estructura de mensajes SQS (normalizada para la consumidora)

Los productores actuales usan keys distintas. La lambda consumidora debe manejar ambas:

```python
# Normalizar al recibir
tipo = msg.get('tipo') or msg.get('evento')
```

Estructura base que deben tener todos los mensajes nuevos:
```json
{
  "tipo": "cliente_captado",
  "timestamp": "2026-04-27T10:00:00Z",
  "proyecto_id": "CANEY-ORIENTAL",
  "inmobiliaria_id": "C1EB1D79",
  "metadata": { ... }
}
```

---

## Infraestructura CDK a agregar

```typescript
// DLQ
const notificacionesDlq = new sqs.Queue(this, 'JamNotificacionesDlq', {
  queueName: 'jam-notificaciones-dlq',
  retentionPeriod: cdk.Duration.days(14),
});

// Queue principal — agregar deadLetterQueue a la existente
// (modificar la definición actual de notificacionesQueue)
deadLetterQueue: { queue: notificacionesDlq, maxReceiveCount: 3 }

// Lambda consumidora
const notificacionesLambda = new lambda.Function(this, 'JamNotificacionesLambda', {
  functionName: 'jam-notificaciones',
  runtime: lambda.Runtime.PYTHON_3_12,
  handler: 'handler.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-notificaciones')),
  timeout: cdk.Duration.seconds(30),
  environment: {
    RESEND_API_KEY: '...',
    ADMIN_EMAIL: 'admin@jamconstrucciones.com',
    USUARIOS_TABLE: usuariosTable.tableName,
    CLIENTES_TABLE: clientesTable.tableName,
  },
});

notificacionesQueue.grantConsumeMessages(notificacionesLambda);
notificacionesLambda.addEventSource(
  new lambdaEventSources.SqsEventSource(notificacionesQueue, { batchSize: 5 })
);
usuariosTable.grantReadData(notificacionesLambda);
clientesTable.grantReadData(notificacionesLambda);

// Agregar SQS_URL a captacionLambda
// (modificar env existente de captacionLambda)
SQS_URL: notificacionesQueue.queueUrl
notificacionesQueue.grantSendMessages(captacionLambda);
```

---

## Prerequisitos antes de implementar

- [ ] Cuenta de Resend creada y API key disponible
- [ ] Dominio verificado en Resend para el remitente (ej: `notificaciones@jamconstrucciones.com`)
- [ ] Email del admin definido (`ADMIN_EMAIL`)

---

## Criterios de aceptación

- [ ] Lambda `jam-notificaciones` procesa todos los eventos de la queue
- [ ] Correos se resuelven correctamente desde DynamoDB (inmobiliaria, cliente, admin)
- [ ] Emails se envían vía Resend en los eventos definidos
- [ ] Mensajes fallidos van a DLQ sin afectar la operación principal
- [ ] `jam-captacion` publica `cliente_captado`, `exclusividad_vencida` e `intento_duplicado`
- [ ] CDK actualizado con DLQ, lambda consumidora, permisos y `SQS_URL` en captacion
- [ ] Tipo de `crearUsuarioInmobiliaria` incluye `correo` en el frontend

---

## Dependencias

- Resend API key + dominio verificado
- Depende de: TK-01, TK-02, TK-04, TK-05, TK-06
