# Propuesta para modulo de campanias de correo

## Necesidad

Se requiere un modulo nuevo para poder enviar correos masivos a clientes desde el sistema, sin depender de exportar archivos y hacer el envio por fuera.

Este modulo ayudara al equipo comercial a comunicarse con grupos de clientes de forma ordenada, por ejemplo para seguimiento, promociones, novedades de proyectos o recordatorios.

## Propuesta

Crear un nuevo apartado llamado Campanias de correo.

Este apartado sera independiente del modulo Clientes y de la exportacion en Excel.

El usuario podra crear una campania, seleccionar a que clientes quiere enviarla, escribir el contenido del correo y registrar el envio dentro del sistema.

## Seleccion de destinatarios

El modulo debera permitir seleccionar clientes por grupos claros.

Grupos sugeridos:

- Clientes sin unidad.
- Clientes con unidad.
- Clientes por proyecto.
- Clientes por inmobiliaria.
- Clientes por estatus.
- Clientes captados.

Tambien se debera poder combinar criterios. Por ejemplo:

- Clientes sin unidad de un proyecto especifico.
- Clientes captados por una inmobiliaria especifica.
- Clientes con estatus especifico dentro de un proyecto.

## Creacion de campania

Al crear una campania, el usuario debera completar:

- Nombre de la campania.
- Asunto del correo.
- Mensaje del correo.
- Grupo de destinatarios.

Antes de enviar, el sistema debera mostrar un resumen con:

- Cantidad de destinatarios seleccionados.
- Correos validos.
- Clientes sin correo.
- Clientes con correo invalido.

## Envio

El envio debe realizarse solo a clientes que tengan correo valido.

Si un cliente no tiene correo o tiene un correo invalido, no se le enviara la campania y debera aparecer en el resumen.

El sistema no debe modificar datos de clientes automaticamente para poder enviar una campania.

## Historial

El modulo debera guardar un historial de campanias enviadas.

El historial debera mostrar:

- Nombre de la campania.
- Fecha de envio.
- Usuario que realizo el envio.
- Cantidad de destinatarios.
- Cantidad de correos enviados.
- Cantidad de clientes omitidos por no tener correo valido.

Esto permitira revisar que se envio y a que grupo de clientes.

## Permisos

Antes de implementar se debe definir que roles podran:

- Ver campanias.
- Crear campanias.
- Enviar campanias.
- Ver historial de envios.

Por seguridad, no todos los usuarios deberian poder enviar correos masivos.

## Alcance inicial recomendado

Para una primera version se recomienda incluir:

- Crear campania.
- Seleccionar destinatarios por proyecto, inmobiliaria, estatus, con unidad o sin unidad.
- Validar correos antes del envio.
- Enviar correos.
- Guardar historial basico.

## Fuera del alcance inicial

No se recomienda incluir en la primera version:

- Editor avanzado de diseno de correos.
- Automatizaciones programadas.
- Campanias recurrentes.
- Estadisticas avanzadas de apertura o clics.
- Segmentaciones complejas no definidas.

Estos puntos podrian revisarse como mejoras futuras.

## Pendiente de aprobacion

Pendiente de aprobacion para realizar este modulo nuevo.

Este modulo debe aprobarse y estimarse por separado, ya que no forma parte del cambio visual de Clientes ni de la exportacion en Excel.
