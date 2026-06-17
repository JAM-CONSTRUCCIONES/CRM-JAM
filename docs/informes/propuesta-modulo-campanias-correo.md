# Propuesta para modulo de campanias de correo

## Objetivo

Crear un modulo nuevo para enviar correos masivos a clientes desde el sistema, siempre seleccionando un proyecto.

Este modulo permitira realizar campanias comerciales o comunicados a grupos de clientes de un proyecto especifico, sin depender de exportar archivos y enviar correos por fuera.

No se plantea como un envio global a todos los clientes del sistema.

Este modulo no formaba parte del alcance inicial del proyecto. Se esta agregando como un modulo nuevo, por lo que cualquier ampliacion adicional al alcance descrito debera cotizarse por separado.

## Conceptos principales

Para evitar confusiones, el modulo separara estos conceptos:

- Plantilla: contenido editable del correo, con titulo, descripcion, asunto, mensaje e imagenes.
- Campania o envio: accion de usar una plantilla, seleccionar proyecto y destinatarios, revisar el resumen y enviar los correos.

## Funcionamiento propuesto

Al ingresar al modulo, el usuario no seleccionara el proyecto de inmediato. Primero vera las plantillas disponibles como tarjetas y tendra dos opciones:

- Seleccionar una plantilla base.
- Crear una campania nueva.

Si crea una campania nueva, se abrira una plantilla en blanco.

Si selecciona una plantilla existente, podra usarla como base para el envio.

Luego, dentro del envio, el usuario podra:

- Seleccionar el proyecto al que pertenece la campania.
- Seleccionar destinatarios dentro de ese proyecto.
- Editar el asunto y el mensaje.
- Subir imagenes para usarlas dentro del cuerpo del correo.
- Colocar las imagenes en la parte del mensaje donde correspondan.
- Ver una vista previa del correo antes de enviarlo.
- Revisar un resumen antes de enviar.
- Enviar la campania manualmente.
- Consultar el historial de envios.

El envio sera manual. El sistema no enviara campanias automaticamente.

## Destinatarios

Los destinatarios se seleccionaran despues de elegir el proyecto de la campania. Dentro de ese proyecto, la seleccion principal sera:

- Clientes sin unidad.
- Clientes con unidad.

Tambien se podra filtrar la seleccion por:

- Pais de residencia.
- Nacionalidad.

Estos filtros usaran los mismos catalogos de paises y nacionalidades ya definidos para clientes, para evitar diferencias de escritura.

Los filtros se combinaran entre si. Por ejemplo, si se selecciona "Clientes sin unidad", un pais de residencia y una nacionalidad, el sistema solo tomara clientes que cumplan todas esas condiciones.

Si un cliente aparece mas de una vez dentro de la seleccion, se enviara un correo por cada registro seleccionado.

Esto permite diferenciar campanias comerciales de comunicados.

Ejemplo: un cliente que ya tiene una unidad en Caney Oriental no deberia recibir una campania comercial de ese mismo proyecto, pero si podria recibir un comunicado sobre avances, entrega, mantenimiento o pagos.

Si un cliente fue captado para un proyecto y vence su exclusividad, el cliente no se elimina del sistema ni del proyecto. El sistema solo deja de marcarlo como cliente con exclusividad activa. Por eso, para este modulo, el cliente podra seguir apareciendo como cliente del proyecto mientras conserve su registro asociado.

## Plantillas

Al ingresar al modulo, las plantillas se mostraran como tarjetas para que el usuario pueda seleccionar una de forma clara.

Las plantillas seran globales y reutilizables. No dependeran de un proyecto especifico.

Cuando se cree una campania desde una plantilla, el sistema copiara el contenido de esa plantilla dentro de la campania. Asi el usuario podra editar asunto, mensaje e imagenes para esa campania sin cambiar la plantilla original.

Cada plantilla tendra:

- Titulo.
- Descripcion.
- Asunto sugerido.
- Mensaje base.
- Imagenes o espacios para imagenes, cuando correspondan.

Al abrir una plantilla, el usuario podra editarla. La pantalla tendra estas opciones:

- Guardar cambios en esa plantilla.
- Crear una nueva plantilla a partir de esa plantilla.

Cada campania tendra:

- Nombre.
- Grupo de destinatarios.
- Plantilla.
- Asunto.
- Mensaje.
- Imagenes subidas al sistema y colocadas dentro del cuerpo del correo.

El mensaje no dependera solo de URLs externas para imagenes. El usuario podra subir imagenes desde su equipo y ubicarlas dentro del contenido del correo.

Las imagenes se guardaran en S3 y el sistema las usara dentro del correo. Si una imagen no carga correctamente, el sistema mostrara el error en esa imagen para que el usuario pueda eliminarla y subirla nuevamente antes de enviar.

No se definira un limite de cantidad de imagenes para la primera version, pero cada imagen tendra un peso maximo de 5 MB para evitar correos demasiado pesados. Los formatos permitidos seran JPG, PNG y WEBP.

## Estados de campania

Los envios manejaran estados simples:

- En preparacion.
- Enviada.
- Error.

La primera version no incluira borradores avanzados ni cancelacion de envios iniciados.

## Validacion antes del envio

Antes de enviar, el sistema mostrara:

- Vista previa del correo.
- Resumen del envio.
- Cantidad de destinatarios seleccionados.
- Correos validos.
- Clientes sin correo.
- Clientes con correo invalido.

Solo se enviara a clientes con correo valido.

## Historial

El sistema guardara un historial con:

- Titulo.
- Descripcion.
- Proyecto.
- Fecha de envio.
- Usuario que envio.
- Grupo usado.
- Cantidad de clientes seleccionados.
- Cantidad de correos enviados.
- Clientes omitidos por no tener correo valido.

El historial guardara solo la informacion resumida del envio. No se guardara todo el cuerpo del correo ni una auditoria completa de cada correo individual en esta primera version.

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
- Envio de prueba antes del envio masivo.
- Cancelacion de una campania despues de iniciar el envio.
- Auditoria completa de cada correo individual.

Si se desea incluir alguno de estos puntos, se debera revisar y cotizar como una ampliacion del modulo.

## Pendiente de aprobacion

Pendiente de aprobacion para realizar este modulo nuevo.
