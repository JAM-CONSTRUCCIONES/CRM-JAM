# TK-01 - Checklist de cierre: Integracion de canales Meta

## Objetivo del ticket

Integrar y visualizar dentro del CRM las conversaciones e interacciones provenientes de WhatsApp, Instagram y Facebook Messenger, permitiendo que los mensajes recibidos y enviados puedan gestionarse y quedar registrados directamente dentro del CRM.

## Hecho en backend

- Webhook unico de Meta configurado para recibir eventos.
- Verificacion de webhook mediante token de verificacion.
- Recepcion y normalizacion de eventos de Instagram.
- Recepcion y normalizacion de eventos de Facebook Messenger.
- Recepcion y normalizacion base de eventos de WhatsApp Cloud API.
- Creacion automatica de lead preliminar Meta al recibir un mensaje.
- Actualizacion del lead existente cuando llega un nuevo mensaje del mismo contacto/canal.
- Registro de mensajes entrantes en DynamoDB.
- Registro de mensajes salientes en DynamoDB.
- Endpoint interno para responder mensajes desde el CRM.
- Lectura de tokens desde AWS Systems Manager Parameter Store.
- Manejo de estado `pendiente_configuracion` cuando falta token o aprobacion de Meta.
- Manejo de estado `fallido` cuando Meta rechaza el envio.
- Registro de actividad del lead cuando se envia una respuesta.
- Conversion de lead Meta preliminar a cliente formal del CRM.
- Bloqueo de conversion cuando ya existe cliente con la misma cedula en el mismo proyecto/inmobiliaria.
- Bloqueo de posible duplicado por telefono o correo dentro del mismo proyecto al convertir un lead Meta.
- Soporte base para estados de WhatsApp, como entregado/leido/fallido cuando Meta los envie.
- Soporte base para adjuntos entrantes: imagenes, videos, audios, documentos, stickers o links enviados por Meta.
- Archivado propio en S3 para archivos de WhatsApp cuando el webhook recibe `media_id` y existe token configurado.

## Hecho en frontend

- Ruta administrativa `Leads Meta`.
- Ruta nueva `Inbox Meta` para uso diario tipo bandeja/chat.
- Lista de conversaciones por canal.
- Filtro por Instagram, Messenger y WhatsApp.
- Busqueda por contacto, mensaje, responsable, inmobiliaria o cuenta.
- Vista de conversacion tipo chat.
- Panel lateral con datos del lead.
- Cambio rapido de estado del lead.
- Asignacion rapida de responsable.
- Asignacion rapida de inmobiliaria.
- Conversion del lead Meta a cliente formal desde `Leads Meta`.
- Conversion del lead Meta a cliente formal desde `Inbox Meta`.
- Composer para responder mensajes.
- Respuestas rapidas predefinidas.
- Visualizacion de estado de mensajes salientes.
- Visualizacion de errores devueltos por Meta.
- Visualizacion base de adjuntos entrantes.

## Falta para cerrar el MVP funcional

- Guardar token real de Messenger en Parameter Store.
- Guardar token real de WhatsApp en Parameter Store cuando Meta permita usar el numero/WABA.
- Probar conversion de lead Meta a cliente formal con un caso real desde `Inbox Meta`.
- Probar mensaje real entrante de Instagram y respuesta real desde Inbox Meta.
- Probar mensaje real entrante de Messenger y respuesta real desde Inbox Meta.
- Probar mensaje real entrante de WhatsApp y respuesta real desde Inbox Meta.
- Confirmar que los webhooks de produccion quedan configurados con la URL final.
- Confirmar que el dominio final `crm.jamconstrucciones.com` queda activo si se usara para revision/produccion.

## Bloqueado por Meta o cliente

- Aprobacion de permisos avanzados de Instagram.
- Aprobacion de permisos avanzados de Messenger.
- Aprobacion de permisos avanzados de WhatsApp.
- Verificacion del negocio en Meta Business.
- Liberacion o vinculacion correcta del numero de WhatsApp `+1 849-477-7000`.
- Confirmacion de tokens permanentes o de larga duracion para produccion.

## Recomendado despues del MVP

- Descargar medios de Instagram/Messenger a S3 cuando Meta entregue URLs persistentes o endpoints autorizados.
- Enviar archivos desde el CRM, no solo texto.
- Reintento manual de mensajes fallidos desde la interfaz.
- Refresco automatico de la bandeja cada cierto tiempo.
- Unificacion de duplicados entre canales cuando se identifique que una misma persona escribio por mas de un canal.
- Mostrar nombre real/username/foto del contacto cuando Meta lo permita.
- Dashboard de rendimiento por canal y tasa de respuesta.
