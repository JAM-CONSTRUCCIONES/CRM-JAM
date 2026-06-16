# Propuesta para modulo de campanias de correo

## Objetivo

Crear un modulo nuevo para enviar correos masivos a clientes desde el sistema, siempre seleccionando un proyecto.

Este modulo permitira realizar campanias comerciales o comunicados a grupos de clientes de un proyecto especifico, sin depender de exportar archivos y enviar correos por fuera.

No se plantea como un envio global a todos los clientes del sistema.

Este modulo no formaba parte del alcance inicial del proyecto. Se esta agregando como un modulo nuevo, por lo que cualquier ampliacion adicional al alcance descrito debera cotizarse por separado.

## Funcionamiento propuesto

El usuario podra:

- Seleccionar un proyecto.
- Crear una campania.
- Seleccionar destinatarios dentro de ese proyecto.
- Usar o editar una plantilla de correo.
- Insertar imagenes en el cuerpo del correo de la forma mas practica y segura para campanias.
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

Si un cliente fue captado para un proyecto y vence su exclusividad, el cliente no se elimina del sistema ni del proyecto. El sistema solo deja de marcarlo como cliente con exclusividad activa. Por eso, para este modulo, el cliente podra seguir apareciendo como cliente del proyecto mientras conserve su registro asociado.

Filtros adicionales como pais de residencia y nacionalidad pueden agregarse, pero se consideran una ampliacion del modulo porque implican mas criterios de seleccion y segmentacion.

## Plantillas

Las plantillas de correo seran editables, similar a las notificaciones actuales del sistema.

Cada campania tendra:

- Nombre.
- Grupo de destinatarios.
- Plantilla.
- Asunto.
- Mensaje.
- Imagenes en el cuerpo del correo, cuando la campania lo requiera.

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

## Permisos

Los permisos propuestos para esta primera version son:

- Administrador: ver el modulo, crear campanias, enviar campanias y ver historial.
- Coordinador: ver el modulo, crear campanias, enviar campanias y ver historial.
- Supervisor: ver el modulo y ver historial.

"Ver campanias" significa poder entrar al modulo y consultar campanias, plantillas y configuracion visible segun el rol.

"Ver historial" significa consultar campanias que ya fueron enviadas, incluyendo fecha, usuario, grupo usado y resumen del envio.

## Fuera del alcance inicial

No se incluye en la primera version:

- Envios automaticos.
- Campanias programadas.
- Campanias recurrentes.
- Estadisticas avanzadas de apertura o clics.
- Editor avanzado de diseno de correos.
- Segmentaciones avanzadas o filtros adicionales no definidos en este alcance.

Si se desea incluir alguno de estos puntos, se debera revisar y cotizar como una ampliacion del modulo.

## Pendiente de aprobacion

Pendiente de aprobacion para realizar este modulo nuevo.
