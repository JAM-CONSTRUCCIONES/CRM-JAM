# TK-05 - Captación de clientes y exclusividad por proyecto

## Objetivo

Registro de clientes potenciales por inmobiliaria con control de exclusividad
por proyecto durante 3 meses.

---

## Alcance

### Backend (`jam-captacion`)
- Endpoint para registrar un cliente con validación de exclusividad
- Validación de duplicidad por cédula/pasaporte + proyecto
- Vencimiento automático de exclusividad vía EventBridge Scheduler
- Consulta de clientes por inmobiliaria y por proyecto

### Frontend (React + Vite)
- Formulario de captación con todos los campos del cliente
- Alerta cuando el cliente ya está activo en otra inmobiliaria (mismo proyecto)
- Registro permitido si el cliente es en otro proyecto
- Vista de clientes captados por la inmobiliaria

---

## Campos del cliente

| Campo | Requerido | Notas |
|-------|-----------|-------|
| Nombres | Sí | |
| Apellidos | Sí | |
| Cédula o # de pasaporte | Sí | Clave de unicidad |
| Correo | No | Requerido para notificaciones |
| Teléfono | No | Requerido para WhatsApp |
| Estado civil | No | |
| Nacionalidad | No | |
| País de residencia | No | |
| Fecha de nacimiento | No | Calcula edad automáticamente |
| Edad | Auto | Calculado desde fecha de nacimiento |
| Inmobiliaria | Auto | Tomado del token de sesión |
| Proyecto | Sí | Seleccionado en el formulario |

> Todos los campos son editables por admin. La inmobiliaria solo puede registrar, no editar.

---

## Lógica de exclusividad

```
Inmobiliaria registra cliente (cédula + proyecto)
        ↓
¿Existe registro con misma cédula + mismo proyecto + misma inmobiliaria?
        ↓ Sí
¿exclusividad_activa = true? → actualizar datos, renovar exclusividad
¿exclusividad_activa = false? → re-captar: nueva fecha, nueva exclusividad
        ↓ No (no existe registro propio)
¿Existe registro activo (exclusividad_activa = true) de OTRA inmobiliaria?
        ↓ Sí → Rechazar (409). Notificación al admin en TK-08
        ↓ No (exclusividad vencida o nunca registrado)
Crear registro nuevo para esta inmobiliaria
Programar vencimiento en EventBridge Scheduler
        ↓
Cliente queda en estado: captacion
```

- La exclusividad es por `cedula + proyecto`, no global
- El mismo cliente puede registrarse en otro proyecto sin restricción
- Cada inmobiliaria tiene su propio registro del cliente — el historial nunca se pisa
- Al vencer los 3 meses: `exclusividad_activa = false`, cliente queda disponible para cualquier inmobiliaria
- El registro nunca se elimina, solo cambia su estado de exclusividad
- La inmobiliaria siempre ve sus clientes aunque haya vencido la exclusividad, marcados como "Vencido"
- Si la misma inmobiliaria quiere re-captar un cliente vencido, se actualiza su registro existente con nueva fecha y exclusividad — sin crear duplicado
- La notificación al admin por intento de duplicado se implementa en TK-08

---

## Modelo de datos

### Tabla: `jam-clientes`

> **Decisión de diseño:** la clave incluye `inmobiliaria_id` para que cada inmobiliaria tenga su propio registro del cliente. Esto permite que múltiples inmobiliarias tengan historial independiente del mismo cliente en el mismo proyecto a lo largo del tiempo, sin pisarse entre sí.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `CLIENTE#<cedula>#<inmobiliaria_id>` |
| sk | String | `PROYECTO#<proyecto_id>` |
| nombres | String | |
| apellidos | String | |
| cedula | String | Cédula o pasaporte |
| correo | String | |
| telefono | String | |
| estado_civil | String | |
| nacionalidad | String | |
| pais_residencia | String | |
| fecha_nacimiento | String | ISO date |
| inmobiliaria_id | String | Quién lo captó |
| proyecto_id | String | Proyecto asociado |
| estado | String | Ver estados abajo |
| exclusividad_activa | Boolean | true durante los 3 meses |
| fecha_captacion | String | ISO timestamp |
| fecha_vencimiento | String | fecha_captacion + 3 meses |
| unidad_id | String | Si viene desde un bloqueo |

### GSI

| GSI | pk | sk | Uso |
|-----|----|----|-----|
| `gsi-inmobiliaria-clientes` | `inmobiliaria_id` | `fecha_captacion` | Clientes por inmobiliaria |
| `gsi-proyecto-clientes` | `proyecto_id` | `estado` | Clientes por proyecto y estado |

---

## Estados del cliente

| Estado | Descripción |
|--------|-------------|
| `captacion` | Registrado, exclusividad activa |
| `disponible` | Exclusividad vencida, puede ser captado por otra inmobiliaria |
| `reserva` | Unidad reservada (TK-06 CRM) |
| `separacion` | En proceso de separación |
| `inicial` | En pago de cuotas iniciales |
| `desvinculado` | Proceso cancelado, historial preservado |

---

## Integración con bloqueos

- Si el cliente se registra desde el flujo de bloqueo (TK-04):
  - Se guarda con `unidad_id` referenciando la unidad bloqueada
  - Estado inicial: `captacion`
  - Solo pasa a `reserva` cuando la unidad se marca como vendida

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/clientes` | inmobiliaria | Registrar nuevo cliente |
| `GET` | `/clientes` | inmobiliaria | Listar clientes propios (captación + historial de reservas) |
| `GET` | `/clientes/{cedula}/proyecto/{id}` | admin | Ver cliente en proyecto |
| `PUT` | `/admin/clientes/{cedula}/proyecto/{id}` | admin | Editar datos del cliente |
| `GET` | `/admin/clientes` | admin | Ver todos los clientes |

## Vista por inmobiliaria

Cada inmobiliaria tiene acceso a:
- Pestaña **Captación**: clientes registrados por ella en cada proyecto
- Pestaña **Inventario**: unidades disponibles de sus proyectos asignados
- Pestaña **Historial**: clientes que lograron llegar a `reserva` o superior, con su estatus actual

---

## Criterios de aceptación

- [ ] El sistema registra clientes con los campos definidos
- [ ] Un cliente activo no puede ser duplicado por otra inmobiliaria en el mismo proyecto
- [ ] El mismo cliente sí puede registrarse en otro proyecto
- [ ] La exclusividad vence automáticamente a los 3 meses vía EventBridge
- [ ] El historial del cliente se conserva aunque venza la exclusividad
- [ ] El formulario calcula la edad automáticamente desde la fecha de nacimiento
- [ ] La inmobiliaria se asigna automáticamente desde el token de sesión

---

## Notas técnicas

- La clave de unicidad es `CLIENTE#<cedula>#<inmobiliaria_id>` + `PROYECTO#<proyecto_id>` — cada inmobiliaria tiene su propio registro del cliente
- La validación de exclusividad activa se hace buscando registros con `exclusividad_activa = true` de OTRAS inmobiliarias para esa `cedula + proyecto_id`
- EventBridge Scheduler one-time al registrar para el vencimiento de exclusividad
- Admin puede editar cualquier campo del cliente; inmobiliaria solo puede registrar
- Intento de duplicado activo → 409 sin notificación por ahora, notificación al admin se implementa en TK-08
- Depende de: TK-01 (auth), TK-02 (modelo de datos)
