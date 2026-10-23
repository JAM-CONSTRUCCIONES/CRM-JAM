# TK-01 - Checklist de cierre: Integracion de canales Meta

Ultima actualizacion: 2026-09-21

## Objetivo del ticket

Integrar y visualizar dentro del CRM las conversaciones e interacciones provenientes de WhatsApp, Instagram y Facebook Messenger, permitiendo que los mensajes recibidos y enviados puedan gestionarse y quedar registrados directamente dentro del CRM.

## Hecho en backend

- [x] Webhook unico de Meta configurado para recibir eventos.
- [x] Verificacion de webhook mediante token de verificacion.
- [x] Recepcion y normalizacion de eventos de Instagram.
- [x] Recepcion y normalizacion de eventos de Facebook Messenger.
- [x] Recepcion y normalizacion base de eventos de WhatsApp Cloud API.
- [x] Creacion automatica de lead preliminar Meta al recibir un mensaje.
- [x] Actualizacion del lead existente cuando llega un nuevo mensaje del mismo contacto/canal.
- [x] Registro de mensajes entrantes en DynamoDB.
- [x] Registro de mensajes salientes en DynamoDB.
- [x] Endpoint interno para responder mensajes desde el CRM.
- [x] Lectura de tokens desde AWS Systems Manager Parameter Store.
- [x] Manejo de estado `pendiente_configuracion` cuando falta token o aprobacion de Meta.
- [x] Manejo de estado `fallido` cuando Meta rechaza el envio.
- [x] Registro de actividad del lead cuando se envia una respuesta.
- [x] Conversion de lead Meta preliminar a cliente formal del CRM.
- [x] Bloqueo de conversion cuando ya existe cliente con la misma cedula en el mismo proyecto/inmobiliaria.
- [x] Bloqueo de posible duplicado por telefono o correo dentro del mismo proyecto al convertir un lead Meta.
- [x] Soporte base para estados de WhatsApp (entregado/leido/fallido).
- [x] Soporte base para adjuntos entrantes: imagenes, videos, audios, documentos, stickers.
- [x] Archivado en S3 para archivos de WhatsApp cuando el webhook recibe `media_id`.

### Agregado en esta sesion (2026-09-21)

- [x] Token permanente (System User, no expira) para WhatsApp — cargado en Secrets Manager.
- [x] Multi-tenant: cada conexion guarda su propio access token; el envio usa el token/numero del tenant correcto.
- [x] Endpoint publico controlado para WhatsApp Embedded Signup (`/channels/whatsapp/connect`).
- [x] Soporte de coexistencia: mensajes enviados desde la app del celular (smb_message_echoes) aparecen en el CRM.
- [x] Envio de multimedia saliente (imagen/video/audio/PDF) desde el CRM via presigned URL a S3.
- [x] Estado real del numero en Meta (verificationStatus, numberReady, qualityRating) guardado en la conexion.
- [x] Paginacion de mensajes: carga los ultimos 50 al abrir, "cargar anteriores" sin salto de scroll.
- [x] Tokens de Instagram copiados y validos en SSM dev (JAM y CANEY).
- [x] Nombre editable por contacto (nombre_manual) para numeros de WhatsApp.

## Hecho en frontend

- [x] Ruta administrativa `Leads Meta`.
- [x] Ruta nueva `Inbox Meta` para uso diario tipo bandeja/chat.
- [x] Lista de conversaciones por canal.
- [x] Filtro por Instagram, Messenger y WhatsApp.
- [x] Busqueda por contacto, mensaje, responsable, inmobiliaria o cuenta (incluyendo nombre manual).
- [x] Vista de conversacion tipo chat.
- [x] Panel lateral con datos del lead (colapsable con boton "Detalles").
- [x] Cambio rapido de estado del lead.
- [x] Asignacion rapida de responsable.
- [x] Asignacion rapida de inmobiliaria.
- [x] Conversion del lead Meta a cliente formal desde `Leads Meta`.
- [x] Conversion del lead Meta a cliente formal desde `Inbox Meta`.
- [x] Composer para responder mensajes.
- [x] Visualizacion de estado de mensajes salientes.
- [x] Visualizacion de errores devueltos por Meta.
- [x] Visualizacion de adjuntos entrantes.

### Agregado en esta sesion (2026-09-21)

- [x] Boton adjuntar archivos con subida a S3 y envio multimedia por WhatsApp.
- [x] Reproductor de audio inline (sin abrir nueva ventana).
- [x] Imagenes y videos inline en la burbuja.
- [x] Nombre editable por contacto con boton de edicion en la cabecera.
- [x] Separadores de fecha (Hoy / Ayer / fecha) entre mensajes de dias distintos.
- [x] Hora discreta en cada burbuja (no fecha completa repetida).
- [x] Burbujas con esquinas redondeadas asimetricas (estilo chat).
- [x] Polling incremental: solo pide mensajes nuevos (after), no recarga toda la conversacion.
- [x] Backoff en el polling ante fallos de API.
- [x] Envio optimista: el mensaje aparece al instante sin esperar la respuesta del backend.
- [x] Auto-scroll al mensaje mas reciente al abrir un chat.
- [x] Cargar mensajes anteriores mantiene la posicion del scroll (no salta al inicio).
- [x] Tags de canal sin fondo (solo color de texto).
- [x] Layout full-width sin margenes laterales (ocupa toda la pantalla como WhatsApp Web).
- [x] Header del inbox compacto con titulo dentro del panel de lista.
- [x] Panel Lead colapsable con boton "Detalles".
- [x] Boton "Conectar WhatsApp" oculto si ya hay una conexion activa.
- [x] Sin contador de mensajes recibidos/enviados ni seccion de actividad reciente.

## Pendiente para cerrar el MVP en PROD

- [ ] Confirmar que los webhooks de produccion quedan configurados con la URL final.
- [ ] Confirmar que el dominio `crm.jamconstrucciones.com` queda activo en prod.
- [ ] Tokens de Instagram en SSM prod (JAM y CANEY).
- [ ] Verificacion del numero de WhatsApp en Meta (hoy `NOT_VERIFIED`).
- [ ] Metodo de pago en Meta para escalar conversaciones.
- [ ] Probar conversion de lead Meta a cliente formal con un caso real (pendiente confirmacion).

## Diferido / fuera del MVP actual

- Messenger (Facebook): diferido hasta que IG este estable en prod.
- Plantillas de WhatsApp para iniciar conversaciones fuera de la ventana de 24h.
- Rate-limiting del endpoint publico `/channels/whatsapp/connect`.
- Reintento manual de mensajes fallidos desde la interfaz.
- Dashboard de rendimiento por canal y tasa de respuesta.
- Unificacion de duplicados entre canales.

## Canales en DEV — estado actual

| Canal | Recepcion | Envio texto | Envio multimedia | Token |
|-------|-----------|-------------|-----------------|-------|
| WhatsApp | ✅ | ✅ | ✅ | Token permanente (System User) |
| Instagram JAM | ✅ | ✅ | ✅ | Token valido en SSM dev |
| Instagram CANEY | ✅ | ✅ | ✅ | Token valido en SSM dev |
| Messenger | ⏸ diferido | ⏸ diferido | ⏸ diferido | Pendiente |
