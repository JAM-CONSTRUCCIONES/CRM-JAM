# Flujo de procesos y correcciones de estatus

Documento de referencia del flujo actual de procesos de venta.

Fuentes revisadas:

- `lambdas/jam-crm/routes/estatus.py`
- `front/src/components/common/CambiarEstatusModal.tsx`
- `front/src/constants/estados.ts`
- `lambdas/jam-notificaciones/handler.py`

## Estatus existentes

En el codigo los estatus de proceso son:

- `captacion`: se muestra como "Captacion".
- `reserva`: se muestra como "Reserva".
- `separacion`: se muestra como "Separacion".
- `inicial`: se muestra como "Contrato firmado".
- `pagos_atrasados`: se muestra como "Pagos atrasados".
- `contra_entrega`: se muestra como "Contra entrega".
- `vendida`: se muestra como "Vendido".
- `desvinculado`: se muestra como "Desvinculado".

Importante: `inicial` es el nombre interno que usa el sistema para el estatus visible "Contrato firmado".

## Flujo principal

El flujo normal esperado es:

1. Captacion.
2. Reserva.
3. Separacion.
4. Contrato firmado.
5. Contra entrega.
6. Vendido.

`Pagos atrasados` no es un paso normal de avance comercial. Es un estado de control cuando el cliente tiene pagos pendientes.

`Desvinculado` no es un estado de unidad. Es un estado del proceso del cliente cuando sale del proceso de compra. Al desvincular, la unidad vuelve a estar disponible.

## Transiciones permitidas

Estas son las transiciones permitidas actualmente por backend y frontend.

### Desde Captacion

Puede pasar a:

- Reserva.

Cuando pasa a Reserva:

- Se cancela cualquier alerta de separacion pendiente.
- Se limpian campos de separacion y pago confirmado.
- Si venia de Captacion, se cierra el historial de bloqueo con motivo `reserva`.
- La unidad pasa a `no_disponible`.
- Se registra historial.
- Se puede enviar notificacion segun la opcion elegida.

### Desde Reserva

Puede pasar a:

- Separacion.
- Desvinculado.
- Captacion - correccion.

Cuando pasa a Separacion:

- La unidad queda como `no_disponible`.
- Se guarda `fecha_separacion`.
- Se crea una alerta automatica de separacion a 30 dias.
- Se registra historial.

Cuando vuelve a Captacion como correccion:

- Se cancela alerta de separacion.
- Se limpian campos de separacion y pago confirmado.
- Se activa un bloqueo operativo nuevo para la unidad.
- La unidad queda como `bloqueada`.
- Se crean schedules de bloqueo por 48 horas y alerta previa.
- Se registra historial.

Cuando pasa a Desvinculado:

- Se libera la unidad.
- La unidad queda como `disponible`.
- Se registra historial.

### Desde Separacion

Puede pasar a:

- Contrato firmado.
- Pagos atrasados.
- Desvinculado.
- Reserva - correccion.
- Captacion - correccion.

Cuando pasa a Contrato firmado:

- La unidad queda como `no_disponible`.
- Se cancela la alerta automatica de separacion.
- Se marca `pago_confirmado = true`.
- Se registra historial.

Cuando pasa a Pagos atrasados:

- Se cancela la alerta automatica de separacion.
- La unidad queda como `no_disponible`.
- Se registra historial.

Cuando vuelve a Reserva como correccion:

- Se cancela la alerta automatica de separacion.
- Se limpian campos de separacion y pago confirmado.
- La unidad queda como `no_disponible`.
- Se registra historial.

Cuando vuelve a Captacion como correccion:

- Se cancela la alerta automatica de separacion.
- Se limpian campos de separacion y pago confirmado.
- Se activa un bloqueo operativo nuevo para la unidad.
- La unidad queda como `bloqueada`.
- Se crean schedules de bloqueo por 48 horas y alerta previa.
- Se registra historial.

Cuando pasa a Desvinculado:

- Se cancela la alerta automatica de separacion.
- Se limpian campos de separacion y pago confirmado.
- La unidad vuelve a `disponible`.
- Se registra historial.

## Regla automatica de Separacion

Cuando un proceso esta en Separacion, el sistema crea una alerta automatica a 30 dias.

Si al cumplirse esos 30 dias el proceso sigue en `separacion` y no tiene `pago_confirmado`, el sistema:

- Cambia automaticamente el proceso a `pagos_atrasados`.
- Marca `alerta_separacion_vencida = true`.
- Guarda historial con origen `vencimiento_separacion_30_dias`.
- Envia notificacion de cambio de estatus a administracion.

Si el proceso ya no esta en Separacion o ya tiene pago confirmado, la alerta no hace cambios.

## Desde Contrato firmado

En codigo este estatus se llama `inicial`.

Puede pasar a:

- Pagos atrasados - correccion.
- Contra entrega.
- Desvinculado.
- Separacion - correccion.
- Reserva - correccion.

Cuando vuelve a Pagos atrasados como correccion:

- Se cancela alerta de separacion, si existiera.
- La unidad queda como `no_disponible`.
- Se registra historial.

Cuando pasa a Contra entrega:

- Se cancela alerta de separacion, si existiera.
- La unidad queda como `no_disponible`.
- Se registra historial.

Cuando vuelve a Separacion como correccion:

- Se limpia pago confirmado.
- La unidad queda como `no_disponible`.
- Se guarda una nueva `fecha_separacion`.
- Se crea una nueva alerta automatica de separacion a 30 dias.
- Se registra historial.

Cuando vuelve a Reserva como correccion:

- Se cancela alerta de separacion.
- Se limpian campos de separacion y pago confirmado.
- La unidad queda como `no_disponible`.
- Se registra historial.

Cuando pasa a Desvinculado:

- Se cancela alerta de separacion.
- Se limpian campos de separacion y pago confirmado.
- La unidad vuelve a `disponible`.
- Se registra historial.

## Desde Pagos atrasados

Puede pasar a:

- Contrato firmado.
- Desvinculado.
- Separacion - correccion.

Cuando pasa a Contrato firmado:

- La unidad queda como `no_disponible`.
- Se cancela alerta de separacion.
- Se marca `pago_confirmado = true`.
- Se registra historial.

Cuando vuelve a Separacion como correccion:

- Se limpia pago confirmado.
- La unidad queda como `no_disponible`.
- Se guarda una nueva `fecha_separacion`.
- Se crea una nueva alerta automatica de separacion a 30 dias.
- Se registra historial.

Cuando pasa a Desvinculado:

- La unidad vuelve a `disponible`.
- Se limpian campos de separacion y pago confirmado.
- Se registra historial.

## Desde Contra entrega

Puede pasar a:

- Vendido.
- Desvinculado.
- Contrato firmado - correccion.

Cuando pasa a Vendido:

- Se cancela alerta de separacion, si existiera.
- La unidad pasa a `vendida`.
- Se registra historial.

Cuando vuelve a Contrato firmado como correccion:

- La unidad queda como `no_disponible`.
- Se cancela alerta de separacion.
- Se marca `pago_confirmado = true`.
- Se registra historial.

Cuando pasa a Desvinculado:

- La unidad vuelve a `disponible`.
- Se registra historial.

Nota: desde Contra entrega ya no se permite pasar a Pagos atrasados.

## Desde Vendido

Puede pasar a:

- Contra entrega - correccion.

Cuando vuelve a Contra entrega:

- La unidad pasa de `vendida` a `no_disponible`.
- Se registra historial.
- Se puede enviar notificacion como correccion.

## Correcciones

El sistema considera correccion cuando se vuelve a un estatus anterior dentro del orden del flujo.

Orden usado por el frontend y las notificaciones:

1. Captacion.
2. Reserva.
3. Separacion.
4. Pagos atrasados.
5. Contrato firmado.
6. Contra entrega.
7. Vendido.

Cuando el usuario selecciona una correccion:

- El modal muestra una advertencia visual.
- La opcion aparece con el texto `- correccion`.
- El cambio queda registrado en historial.
- Si se envia correo, la notificacion usa la plantilla general `cambio_estatus_actualizacion`.

Cuando el cambio no es correccion:

- Se usa la plantilla especifica del nuevo estatus, por ejemplo `cambio_estatus_reserva`, `cambio_estatus_separacion`, `cambio_estatus_pagos_atrasados`, etc.

## Notificaciones disponibles al cambiar estatus

Al cambiar estatus desde el modal, el usuario puede elegir:

- Notificar a todos: cliente, inmobiliaria y administracion.
- Solo administracion.
- Continuar sin enviar notificacion.

Si el cliente no tiene correo, la opcion de notificar a todos envia a inmobiliaria y administracion.

## Efectos sobre inventario

El proceso afecta el estado de la unidad en inventario asi:

- Captacion por correccion: unidad `bloqueada`, con schedules de bloqueo de 48 horas.
- Reserva: unidad `no_disponible`.
- Separacion: unidad `no_disponible`.
- Contrato firmado: unidad `no_disponible`.
- Pagos atrasados: unidad `no_disponible`.
- Contra entrega: unidad `no_disponible`.
- Vendido: unidad `vendida`.
- Desvinculado: unidad `disponible`.

## Campos auxiliares del proceso

El sistema usa algunos campos auxiliares:

- `fecha_inicio`: fecha de creacion del proceso.
- `fecha_separacion`: se crea al entrar a Separacion.
- `pago_confirmado`: se marca como `true` al entrar a Contrato firmado.
- `alerta_separacion_vencida`: se marca cuando la separacion vence y pasa automaticamente a Pagos atrasados.
- `historial`: lista de cambios de estatus realizados.

Cuando se retrocede a Captacion o Reserva se limpian campos relacionados con separacion y pago confirmado.

Cuando se retrocede a Separacion se crea una nueva fecha de separacion y una nueva alerta de 30 dias.

## Schedules existentes

### Bloqueo

Cuando una unidad queda bloqueada por correccion a Captacion:

- Se crea un schedule de alerta antes del vencimiento.
- Se crea un schedule de liberacion a las 48 horas.

### Separacion

Cuando un proceso entra a Separacion:

- Se crea un schedule a 30 dias.
- Si al cumplirse sigue en Separacion sin pago confirmado, pasa a Pagos atrasados.
- Si antes cambia a otro estado, el schedule se cancela.

## Puntos importantes para QA

- Validar que las listas de procesos se separen asi:
  - Activos: Captacion, Reserva, Separacion, Pagos atrasados, Contrato firmado y Contra entrega.
  - Cerrados: Vendido.
  - Desvinculados: Desvinculado.
  - Historial de bloqueos: historial operativo de bloqueos, separado de los procesos de venta.
- Validar que desde Contrato firmado se pueda volver a Pagos atrasados como correccion.
- Validar que desde Pagos atrasados no se pueda ir a Contra entrega.
- Validar que cuando la unidad este bloqueada no se muestre el boton de cambiar estatus para desvincular; se debe usar Liberar bloqueo.
- Validar que desde Captacion no exista la opcion Desvinculado.
- Validar que al pasar de Captacion a Reserva el historial de bloqueo quede cerrado con motivo `reserva`.
- Validar que desde Contra entrega no aparezca Pagos atrasados.
- Validar que al volver a Captacion se cree bloqueo nuevo con 48 horas.
- Validar que al volver a Separacion se cree una nueva alerta de 30 dias.
- Validar que al desvincular la unidad vuelva a Disponible.
- Validar que al volver desde Vendido a Contra entrega la unidad deje de estar como Vendida y pase a No disponible.
- Validar que las correcciones usen la plantilla de Actualizacion de estatus.
