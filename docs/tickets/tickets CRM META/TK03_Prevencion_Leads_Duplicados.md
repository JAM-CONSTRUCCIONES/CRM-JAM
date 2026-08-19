# TK-03 - Prevencion de leads duplicados

## Objetivo

Evitar duplicados operativos dentro del CRM sin cruzar identidades entre canales de Meta.

## Alcance definido

Cada canal se considera independiente:

- Instagram mantiene sus propios leads.
- Messenger mantiene sus propios leads.
- WhatsApp mantiene sus propios leads.
- Si una misma persona escribe por Instagram y luego por WhatsApp, se tratan como leads distintos.

El sistema solo debe evitar duplicados dentro del mismo canal y durante el registro formal de cliente, oportunidad o bloqueo.

## Regla tecnica de identidad del lead

Un lead Meta se identifica por:

- `channel`
- `account_id`
- `external_contact_id`

Con esta combinacion, un mensaje repetido o una nueva interaccion del mismo contacto en la misma cuenta/canal actualiza el lead existente y agrega el mensaje al historial.

## Reglas de validacion comercial

Al registrar cliente, oportunidad o bloqueo desde un lead:

- Si la cedula ya existe para el mismo proyecto e inmobiliaria, se reutiliza/actualiza el cliente existente.
- Si el telefono o correo coincide con otro cliente del mismo proyecto, se muestra conflicto para evitar duplicados.
- Si se intenta registrar la misma unidad desde el mismo lead, se bloquea la operacion.
- Si la unidad no esta disponible, se bloquea la operacion.
- Si la unidad ya tiene un proceso activo, se bloquea la operacion.
- No se intenta detectar automaticamente si un usuario de Instagram, Messenger y WhatsApp es la misma persona.

## Implementado

- Upsert de leads Meta por identidad tecnica del canal.
- Compatibilidad con leads creados antes usando alias de cuenta.
- Idempotencia de mensajes por `external_event_id`.
- Validacion de cedula para reutilizar cliente existente.
- Validacion de telefono/correo contra clientes del mismo proyecto.
- Bloqueo de registro duplicado de la misma unidad desde el mismo lead.
- Validacion de unidad disponible antes de crear bloqueo.
- Validacion de proceso activo antes de crear bloqueo.

## Pendiente o dependiente de otros tickets

- La recepcion real de nuevos mensajes desde WhatsApp depende del cierre de permisos y configuracion del TK-01.
- La deteccion avanzada entre canales queda fuera de alcance por decision funcional.
