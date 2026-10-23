# Observaciones finales - Meta / WhatsApp / CRM

Fecha: 26 de septiembre de 2026  
Proyecto: JAM Construcciones - CRM  
Origen: Relevamiento de reunion con equipo operativo

## Resumen

Segun lo conversado en la reunion, se registran las siguientes observaciones funcionales y operativas relacionadas con la integracion de WhatsApp, Meta Leads y el CRM.

Estas observaciones deben revisarse antes del cierre final del modulo, separando los puntos que correspondan a limitaciones propias de Meta/WhatsApp de los que puedan resolverse dentro del CRM.

## Observaciones registradas

### 1. Asociacion de leads Meta con clientes existentes - Completado

Si se registran automaticamente como leads todos los clientes que escriben por WhatsApp, se podria generar duplicidad, ya que muchos de esos contactos ya existen como clientes dentro del CRM.

Implementado:

- Se mantuvo la creacion del lead preliminar Meta sin deteccion automatica.
- Se agrego accion manual para asociar un lead Meta con un cliente existente.
- La asociacion se realiza por cedula, agrupando los registros del cliente aunque existan en distintos proyectos o inmobiliarias.
- El lead muestra la cedula, nombre y cantidad de registros asociados.
- Las oportunidades del cliente asociado aparecen en el panel de oportunidades del lead.
- El formulario de registro desde Meta quedo completo con datos personales adicionales: fecha de nacimiento, estado civil, nacionalidad y pais de residencia.
- Si el lead ya tiene una cedula asociada, el formulario precarga y bloquea la cedula para evitar cambiarla.
- El backend rechaza conversiones si intentan registrar el lead con una cedula distinta a la ya asociada.
- Se corrigio el contraste visual de la tarjeta de cliente asociado en modo oscuro.

### 2. Citar mensajes - Completado

Actualmente no se permite citar o responder un mensaje especifico dentro de una conversacion.

Implementado:

- Se agrego accion `Responder` sobre mensajes de WhatsApp dentro del Inbox Meta.
- El compositor muestra el mensaje citado antes de enviar y permite quitar la cita.
- El mensaje enviado queda guardado en CRM con `quoted_message_id`, texto resumido y remitente citado.
- El backend envia la referencia del mensaje original hacia WhatsApp usando el contexto del mensaje.
- Los webhooks guardan referencias de mensajes citados cuando Meta las envia, para mostrarlas dentro de la conversacion.

### 3. No permite reenviar documentos o imagenes entre chats

Actualmente no se permite reenviar documentos o imagenes desde una conversacion hacia otra dentro del CRM.

Revision requerida:

- Evaluar si se puede reutilizar el archivo previamente recibido/enviado mediante el identificador de media de WhatsApp.
- Definir si el reenvio debe quedar registrado como mensaje nuevo en la conversacion destino.
- Confirmar restricciones de permisos, expiracion de media o descarga previa del archivo.

### 4. No permite enviar notas de voz

Actualmente no se permite enviar notas de voz desde el CRM hacia WhatsApp.

Revision requerida:

- Confirmar si se soporta envio de audio mediante la API oficial de WhatsApp.
- Definir si el CRM debe permitir grabar audio directamente o subir un archivo de audio.
- Validar formatos, peso maximo y requisitos tecnicos de Meta.

### 5. Permisos del usuario coordinador para bloqueos

El usuario coordinador no esta pudiendo realizar bloqueos.

Solicitud:

- Habilitar al usuario coordinador para realizar bloqueos.
- Mantener restringida la accion de eliminar.
- La restriccion de eliminacion debe aplicar de forma general para este tipo de usuario.

Revision requerida:

- Ajustar matriz de permisos/roles.
- Verificar permisos de bloqueo desde inventario, clientes, leads Meta y cualquier flujo relacionado.
- Confirmar que el rol coordinador no pueda eliminar registros, unidades, clientes, leads, bloqueos u otros datos criticos.

### 6. Mensajes de WhatsApp que aparecen eliminados o cargando al iniciar la jornada

Al iniciar el trabajo en la manana, algunos mensajes enviados por clientes desde la flota o desde los equipos conectados a WhatsApp aparecen como eliminados o con estado de carga. Sin embargo, en el Inbox del CRM si se visualizan.

Pregunta registrada:

- Hay alguna explicacion para este comportamiento?

Revision requerida:

- Verificar si ocurre por sincronizacion tardia, expiracion de media, cache local de WhatsApp, sesiones de dispositivos vinculados o diferencias entre WhatsApp y el inbox CRM.
- Comparar los mensajes afectados contra los eventos recibidos por webhook.
- Confirmar si el CRM esta mostrando correctamente lo recibido por Meta aunque WhatsApp en los dispositivos lo muestre como eliminado/cargando.
- Documentar si es limitacion del cliente WhatsApp, de los dispositivos vinculados o de la integracion.

### 7. Acceso para marketing y leads Meta

Si el equipo de marketing necesita conectarse al CRM, se plantea manejar un usuario de acceso especifico para leads Meta.

Revision requerida:

- Definir si se creara un rol/usuario especifico para marketing.
- Limitar el acceso solo a Leads Meta, conversaciones y funciones necesarias para seguimiento.
- Evitar acceso innecesario a modulos administrativos, eliminacion, configuracion o datos sensibles.
- Evaluar si el acceso debe ser por usuario individual o usuario compartido.

### 8. Mensajes editados desde WhatsApp no muestran la version editada

En el apartado de Leads Meta, cuando se edita un mensaje desde WhatsApp, arriba aparece el mensaje sin editar y debajo la palabra `edit`, indicando que fue editado, pero no aparece la version editada.

Revision requerida:

- Revisar como Meta envia eventos de mensajes editados.
- Confirmar si el webhook esta recibiendo el contenido actualizado.
- Si se recibe la version editada, actualizar el mensaje original dentro del CRM.
- Si solo se recibe una marca de edicion sin contenido actualizado, documentarlo como limitacion de Meta.
- Ajustar la interfaz para mostrar claramente el estado del mensaje editado y, si esta disponible, la version final.

### 9. Optimizacion de llamadas, filtros y tiempos de carga del modulo Meta - Completado

Se requiere optimizar las llamadas y los tiempos de carga relacionados con el modulo Meta, especialmente en Leads Meta, conversaciones, inbox y vistas asociadas.

Implementado:

- Se agrego la GSI `gsi-meta-leads-feed` en la tabla de conversaciones Meta.
- Se agregaron los campos `feed_pk` y `feed_sk` a los leads Meta para ordenar por ultima actividad.
- Se realizo backfill en dev y prod para poblar el indice con los leads existentes.
- La carga inicial del Inbox Meta usa `Query` sobre la GSI en lugar de escanear toda la tabla.
- Se agrego paginacion de conversaciones en Inbox Meta con carga inicial de 50 registros y boton para cargar mas.
- Se ajusto la busqueda y filtracion para ejecutarse desde backend usando la misma GSI, evitando buscar solo dentro de los primeros 50 registros cargados.
- Se desplego la optimizacion en dev y produccion.

## Prioridad sugerida

Alta:

- Permisos del usuario coordinador para realizar bloqueos sin poder eliminar.
- Mensajes editados que no muestran la version actualizada.

Media:

- Explicacion y trazabilidad de mensajes eliminados/cargando en WhatsApp.
- Acceso controlado para marketing en Leads Meta.
- Reenviar documentos o imagenes entre chats.
- Enviar notas de voz.

Baja o dependiente de Meta:

- Validaciones finales segun restricciones externas de Meta/WhatsApp.

## Pendientes de validacion tecnica

- Confirmar capacidades reales de la API oficial de WhatsApp para reenviar media y enviar audio.
- Revisar eventos de webhook para mensajes editados.
- Revisar matriz de permisos del rol coordinador.
- Definir alcance exacto del acceso de marketing al modulo Leads Meta.
