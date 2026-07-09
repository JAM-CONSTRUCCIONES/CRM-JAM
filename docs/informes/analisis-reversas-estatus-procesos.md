# Analisis: reversas de estatus en procesos de venta

## Objetivo

Definir como debe comportarse el sistema cuando un usuario corrige un estatus hacia atras.

El cambio mantiene el flujo controlado y deja consistentes:

- El estatus del proceso.
- El estado de la unidad en inventario.
- Los schedules automaticos.
- El historial del proceso.
- Las notificaciones que correspondan.

## Regla principal

Cuando se cambia el estatus hacia atras, el sistema no solo cambia el texto del proceso. Tambien debe dejar la unidad y los schedules como si realmente estuviera en el estatus destino.

Ejemplo: si un proceso vuelve a `captacion`, la unidad debe volver a quedar `bloqueada`, con fecha de bloqueo, fecha de liberacion y schedules de alerta/liberacion por 48 horas.

## Estados relacionados

En procesos se usan:

- `captacion`.
- `reserva`.
- `separacion`.
- `inicial`.
- `pagos_atrasados`.
- `contra_entrega`.
- `vendida`.
- `desvinculado`.

En inventario se usan:

- `disponible`.
- `bloqueada`.
- `no_disponible`.
- `vendida`.

`captacion` equivale operativamente a una unidad `bloqueada`.

## Comportamiento por destino

### Captacion

- Proceso: `estado = captacion`.
- Inventario: `estado = bloqueada`.
- Inventario: guardar `bloqueado_por`, `cliente_cedula`, `fecha_bloqueo` y `fecha_liberacion`.
- Schedules: eliminar schedules antiguos de bloqueo y crear nuevos de alerta y liberacion por 48 horas.
- Separacion: eliminar alerta de separacion si existia.

### Reserva

- Proceso: `estado = reserva`.
- Inventario: `estado = no_disponible`.
- Schedules: eliminar schedules de bloqueo.
- Separacion: eliminar alerta de separacion si existia.
- Proceso: limpiar campos operativos de separacion y pago confirmado.

### Separacion

- Proceso: `estado = separacion`.
- Inventario: `estado = no_disponible`.
- Proceso: guardar nueva `fecha_separacion`.
- Schedule: recrear alerta de separacion a 30 dias.
- Proceso: limpiar pago confirmado si venia de un estado posterior.

### Inicial

- Proceso: `estado = inicial`.
- Inventario: `estado = no_disponible`.
- Proceso: marcar `pago_confirmado = true`.
- Schedule: eliminar alerta de separacion.

### Pagos atrasados

- Proceso: `estado = pagos_atrasados`.
- Inventario: `estado = no_disponible`.
- Schedule: eliminar alerta de separacion.
- No crea bloqueo ni libera unidad.

### Contra entrega

- Proceso: `estado = contra_entrega`.
- Inventario: `estado = no_disponible`.
- Schedule: eliminar alerta de separacion.
- No crea bloqueo ni libera unidad.

### Vendida

- Proceso: `estado = vendida`.
- Inventario: `estado = vendida`.
- Schedules: eliminar bloqueo y alerta de separacion.

### Desvinculado

- Proceso: `estado = desvinculado`.
- Inventario: `estado = disponible`.
- Inventario: eliminar `bloqueado_por`, `cliente_cedula`, `fecha_bloqueo` y `fecha_liberacion`.
- Schedules: eliminar bloqueo y alerta de separacion.

## Transiciones permitidas

- `captacion` -> `reserva`, `desvinculado`.
- `reserva` -> `separacion`, `desvinculado`, `captacion`.
- `separacion` -> `inicial`, `pagos_atrasados`, `desvinculado`, `reserva`, `captacion`.
- `inicial` -> `pagos_atrasados`, `contra_entrega`, `desvinculado`, `separacion`, `reserva`.
- `pagos_atrasados` -> `inicial`, `contra_entrega`, `desvinculado`, `separacion`.
- `contra_entrega` -> `vendida`, `desvinculado`, `inicial`, `pagos_atrasados`.
- `vendida` -> `contra_entrega`.

## Decision implementada

Se permite volver directamente a `captacion` solo desde `reserva` y `separacion`.

Para estados mas avanzados, la correccion debe hacerse por pasos intermedios para evitar errores fuertes sobre pagos o venta.

## Pruebas necesarias

- Cambiar de `reserva` a `captacion` y confirmar que la unidad queda `bloqueada` con 48 horas.
- Cambiar de `separacion` a `captacion` y confirmar que se elimina alerta de separacion y se crea bloqueo de 48 horas.
- Cambiar de `separacion` a `reserva` y confirmar que la unidad queda `no_disponible`, sin schedules de bloqueo.
- Cambiar de `inicial` a `separacion` y confirmar que se crea alerta de separacion.
- Cambiar de `vendida` a `contra_entrega` y confirmar que la unidad queda `no_disponible`.
- Cambiar cualquier estado activo a `desvinculado` y confirmar que la unidad queda `disponible`.
- Revisar historial del proceso despues de cada reversa.
