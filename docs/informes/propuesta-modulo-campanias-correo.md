# Propuesta para modulo de campanias de correo

## Objetivo

Crear un modulo nuevo para enviar correos masivos a clientes desde el sistema, siempre seleccionando un proyecto.

Este modulo permitira realizar campanias comerciales o comunicados a grupos de clientes de un proyecto especifico, sin depender de exportar archivos y enviar correos por fuera.

No se plantea como un envio global a todos los clientes del sistema.

## Funcionamiento propuesto

El usuario podra:

- Seleccionar un proyecto.
- Crear una campania.
- Seleccionar destinatarios dentro de ese proyecto.
- Usar o editar una plantilla de correo.
- Revisar un resumen antes de enviar.
- Enviar la campania manualmente.
- Consultar el historial de envios.

El envio sera manual. El sistema no enviara campanias automaticamente.

## Destinatarios

Primero se seleccionara el proyecto. Luego, dentro de ese proyecto, la seleccion principal sera:

- Clientes sin unidad.
- Clientes con unidad.

Esto permite diferenciar campanias comerciales de comunicados.

Ejemplo: un cliente que ya tiene una unidad en Caney Oriental no deberia recibir una campania comercial de ese mismo proyecto, pero si podria recibir un comunicado sobre avances, entrega, mantenimiento o pagos.

## Plantillas

Las plantillas de correo seran editables, similar a las notificaciones actuales del sistema.

Cada campania tendra:

- Nombre.
- Grupo de destinatarios.
- Plantilla.
- Asunto.
- Mensaje.

## Validacion antes del envio

Antes de enviar, el sistema mostrara:

- Cantidad de destinatarios seleccionados.
- Correos validos.
- Clientes sin correo.
- Clientes con correo invalido.

Solo se enviara a clientes con correo valido.

## Historial

El sistema guardara un historial con:

- Campania enviada.
- Fecha de envio.
- Usuario que envio.
- Grupo usado.
- Cantidad de correos enviados.
- Clientes omitidos por no tener correo valido.

## Pendiente de definir

Antes de implementar se debe confirmar que roles podran:

- Ver campanias.
- Crear campanias.
- Enviar campanias.
- Ver historial.

## Fuera del alcance inicial

No se incluye en la primera version:

- Envios automaticos.
- Campanias programadas.
- Campanias recurrentes.
- Estadisticas avanzadas de apertura o clics.
- Editor avanzado de diseno de correos.

## Pendiente de aprobacion

Pendiente de aprobacion para realizar este modulo nuevo.
