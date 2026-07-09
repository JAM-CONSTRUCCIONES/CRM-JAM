# Hallazgo: liberacion automatica e historial de bloqueos

## Contexto

Se reviso el comportamiento de la liberacion automatica de bloqueos.

El flujo esperado es:

1. Se bloquea una unidad.
2. Se crea un schedule de alerta antes del vencimiento.
3. Se crea un schedule de liberacion automatica.
4. Al vencerse el bloqueo, la unidad vuelve a disponible.
5. Se actualiza el historial de bloqueos con motivo `automatica`.
6. Se envia la notificacion de liberacion automatica.

## Hallazgo principal

El schedule de liberacion automatica puede ejecutarse y devolver la unidad a disponible, pero no siempre queda actualizado el historial de bloqueos ni se envia la notificacion de liberacion automatica.

El caso observado ocurre principalmente con datos que vienen de migracion.

## Causa probable

Cuando una unidad viene de migracion, puede existir una unidad bloqueada sin un historial de bloqueo completo o sin un registro de historial que coincida exactamente con la fecha de bloqueo usada por el sistema.

Entonces, al ejecutarse la liberacion automatica:

- La unidad puede pasar correctamente a `disponible`.
- El cliente/proceso puede quedar desvinculado segun la regla actual.
- Pero si no existe el registro correcto en historial, no se actualiza `motivo_liberacion`.
- Si el flujo depende de ese dato o no deja suficiente traza, puede parecer que la liberacion ocurrio sin historial.

## Detalle tecnico observado

El handler de liberacion automatica intenta actualizar el historial usando:

- `pk = UNIDAD#<unidad_id>`
- `sk = BLOQUEO#<fecha_bloqueo>`

Si `fecha_bloqueo` no coincide exactamente con el registro guardado en historial, o si el historial no existe, la actualizacion falla.

Actualmente esa parte esta dentro de un `try/except` silencioso, por lo que el sistema puede continuar sin dejar un error claro en logs.

## Diferencia con bloqueos creados desde el sistema

En bloqueos creados directamente desde el sistema, normalmente se crea el historial en el mismo flujo del bloqueo.

En bloqueos que vienen de migracion, el historial puede no existir para todas las unidades o puede no estar completamente alineado con el bloqueo operativo actual.

Por eso se puede ver este comportamiento:

- Algunas unidades migradas si tienen historial.
- Otras unidades migradas no tienen historial.
- Si se libera automaticamente una unidad sin historial, la unidad cambia a disponible, pero no queda registro completo de liberacion en historial.

## Impacto

El problema no parece estar en la creacion del schedule, porque los schedules se crean.

El problema esta en la consistencia posterior:

- Historial de bloqueos incompleto.
- Motivo de liberacion automatica no registrado.
- Notificacion de liberacion automatica no confirmada o no enviada en todos los casos.

## Puntos a revisar antes de corregir

1. Confirmar si toda unidad importada como bloqueada debe crear historial de bloqueo durante la migracion.
2. Confirmar si la liberacion automatica debe crear un registro de historial cuando no encuentre uno existente.
3. Confirmar si la notificacion de liberacion automatica debe enviarse aunque no exista historial previo.
4. Agregar logs claros cuando falle la actualizacion de historial, para evitar errores silenciosos.

## Recomendacion inicial

La correccion mas segura seria:

- Al importar una unidad bloqueada, crear siempre el historial de bloqueo correspondiente.
- En la liberacion automatica, si no se encuentra el historial exacto, buscar el bloqueo abierto mas reciente de esa unidad.
- Si no existe historial, crear un registro minimo de liberacion automatica para no perder trazabilidad.
- No silenciar errores de historial; registrar el error en logs.
- Enviar la notificacion de liberacion automatica aunque el historial no exista, siempre que la unidad haya sido liberada correctamente.

Esto evitaria que una unidad vuelva a disponible sin dejar rastro claro en historial.

