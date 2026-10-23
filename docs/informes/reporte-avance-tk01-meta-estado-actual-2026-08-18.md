# Reporte de avance - TK-01 Integracion de canales Meta

Fecha: 18 de agosto de 2026  
Proyecto: CRM JAM Construcciones  
Ambiente trabajado: dev  
Alcance: integracion y gestion de conversaciones provenientes de Instagram, Facebook Messenger y WhatsApp dentro del CRM.

## Objetivo del TK-01

El TK-01 busca integrar los canales de comunicacion de Meta con el CRM para que las conversaciones recibidas y enviadas por WhatsApp, Instagram y Facebook Messenger puedan visualizarse, gestionarse y mantenerse registradas directamente dentro del sistema.

El objetivo funcional es que un mensaje recibido desde Meta pueda convertirse en un lead preliminar, ser gestionado por el equipo comercial y, cuando corresponda, convertirse en cliente formal del CRM.

## Estado general actual

El avance tecnico interno del TK-01 se encuentra en estado MVP funcional en dev.

Actualmente el CRM ya cuenta con:

- Bandeja unificada para conversaciones Meta.
- Registro de mensajes entrantes y salientes.
- Creacion automatica de leads preliminares Meta.
- Historial de mensajes y actividades.
- Gestion interna del lead.
- Preparacion para responder desde el CRM.
- Conversion de lead Meta a cliente formal.
- Validacion interna de duplicados.
- Soporte base para adjuntos y multimedia.

Lo que queda pendiente para cerrar el TK-01 completo no depende principalmente del codigo, sino de aprobaciones, permisos y configuraciones dentro de Meta.

## Canales considerados

### Instagram

Se avanzo con la configuracion de Instagram dentro de Meta Developers.

Cuentas identificadas:

- `jamconstruccionessrl`
  - Instagram User ID: `17841451399457183`
- `caneyoriental`
  - Instagram User ID: `17841479714105082`

Avances:

- Tokens generados.
- Tokens guardados en AWS Systems Manager Parameter Store.
- Webhook configurado.
- Campos de webhook configurados.
- Pruebas simuladas recibidas correctamente.
- Eventos de prueba guardados en DynamoDB.
- Lead preliminar creado desde evento Meta.
- Mensaje visible dentro del CRM.

Pendiente:

- Aprobacion de permisos avanzados de Instagram.
- Confirmar recepcion de DMs reales desde usuarios externos una vez Meta habilite la app/permisos.
- Confirmar envio real de respuestas desde CRM hacia Instagram.

### Facebook Messenger

Pagina identificada:

- Pagina: `Jam Construcciones`
- Page ID: `134590556407660`

Avances:

- Messenger from Meta agregado como caso de uso.
- Webhook configurado.
- Pagina conectada a la app.
- Suscripcion a eventos de mensajes configurada.
- Pruebas desde Meta recibidas correctamente.
- Eventos guardados en DynamoDB.
- Lead preliminar y conversacion visibles dentro del CRM.

Pendiente:

- Aprobacion de permisos de Messenger, especialmente `pages_messaging`.
- Prueba real de mensaje entrante desde Facebook Messenger.
- Prueba real de respuesta desde el CRM.

### WhatsApp

WABA y numero identificados:

- WhatsApp Business Account: `Jam Construcciones`
- WABA ID: `12798130284042`
- Numero: `+1 849-477-7000`
- Phone Number ID detectado: `109857822123688`

Avances:

- Se identifico el WABA correcto dentro de Business Manager.
- Se confirmo que el numero aparece conectado en WhatsApp Manager.
- Se configuro la base tecnica del webhook para WhatsApp.
- El backend ya puede normalizar mensajes de WhatsApp.
- El backend ya puede guardar estados de WhatsApp cuando Meta los envie.
- El backend ya puede preparar archivado de medios de WhatsApp en S3 cuando exista token valido.

Bloqueos actuales:

- Meta devuelve error `Account not registered` al intentar enviar mensajes por API.
- La llamada obligatoria de prueba para `whatsapp_business_messaging` no queda completada mientras Meta no permita enviar.
- Falta aprobacion de permisos avanzados:
  - `whatsapp_business_messaging`
  - `whatsapp_business_management`
- La cuenta/numeracion de WhatsApp sigue dependiendo de la resolucion de Meta, permisos o registro correcto del numero.

Recomendacion:

- No bloquear el avance interno del CRM por WhatsApp.
- Continuar con Instagram y Messenger.
- Retomar WhatsApp cuando el numero este correctamente registrado para Cloud API o cuando Meta apruebe/active los permisos necesarios.

## Implementacion backend realizada

### Webhook Meta

Se implemento un endpoint publico para recibir webhooks de Meta:

```text
https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/webhooks/meta/
```

Responsabilidades:

- Verificacion de webhook por `hub.challenge`.
- Recepcion de eventos POST.
- Identificacion del canal:
  - Instagram
  - Messenger
  - WhatsApp
- Normalizacion de eventos entrantes.
- Prevencion de duplicados por ID externo del evento.
- Guardado de mensajes en DynamoDB.
- Creacion o actualizacion del lead preliminar asociado.

### Tabla de conversaciones Meta

Se usa una tabla DynamoDB para almacenar conversaciones y eventos Meta.

Datos principales almacenados:

- Canal.
- Cuenta origen.
- Contacto externo.
- Direccion del mensaje.
- Texto.
- Timestamp.
- Estado del mensaje.
- Adjuntos o multimedia.
- Payload resumido.
- Actividad asociada al lead.

Ejemplo conceptual:

```text
CONVERSACION#instagram#jamconstruccionessrl#{contacto_externo}
META_LEAD#instagram#jamconstruccionessrl#{contacto_externo}
```

### Leads preliminares Meta

Cuando llega un mensaje entrante, el sistema:

- Guarda el mensaje individual.
- Crea un `META_LEAD` si no existe.
- Actualiza el mismo lead si el contacto vuelve a escribir.
- Mantiene contadores de mensajes recibidos, enviados y totales.
- Registra ultimo mensaje y fecha de ultima actividad.
- Mantiene fuente/origen como Meta.

Esto evita crear clientes incompletos sin cedula, proyecto o inmobiliaria.

### Respuestas desde el CRM

Se agrego endpoint interno para responder mensajes:

```text
POST /admin/procesos?tipo=meta-mensaje&lead_pk={META_LEAD_PK}
```

Comportamiento:

- Registra el mensaje saliente en DynamoDB.
- Intenta enviarlo por la API correspondiente de Meta.
- Si Meta acepta, queda como `enviado`.
- Si falta token o permiso, queda como `pendiente_configuracion`.
- Si Meta rechaza, queda como `fallido`.
- El error queda visible en el CRM.

Esto permite que el CRM este listo para operar aunque algun canal siga pendiente de aprobacion.

### Conversion a cliente formal

Se implemento conversion de lead Meta a cliente formal del CRM.

Endpoint:

```text
PUT /admin/procesos?tipo=meta-lead&accion=convertir&lead_pk={META_LEAD_PK}
```

Datos requeridos:

- Cedula o pasaporte.
- Proyecto.
- Inmobiliaria.
- Nombres.
- Apellidos.

Datos opcionales:

- Telefono.
- Correo.
- Unidad de interes.
- Estado civil.
- Nacionalidad.
- Pais de residencia.
- Fecha de nacimiento.

Al convertir:

- Se crea el cliente formal.
- Se conserva referencia al lead Meta original.
- Si se selecciona una unidad, se crea proceso en estado `captacion`.
- Se registra actividad de conversion en el historial del lead Meta.

### Validacion de duplicados

Se agregaron controles para evitar duplicados al convertir:

- Bloqueo por cedula/pasaporte cuando ya existe cliente en el mismo proyecto e inmobiliaria.
- Bloqueo por exclusividad activa con otra inmobiliaria en el mismo proyecto.
- Bloqueo de posible duplicado por telefono dentro del mismo proyecto.
- Bloqueo de posible duplicado por correo dentro del mismo proyecto.
- Bloqueo si la unidad seleccionada ya tiene un proceso activo.

## Implementacion frontend realizada

### Ruta `Leads Meta`

URL dev:

```text
https://d12nm0khvt8zd9.cloudfront.net/meta-leads
```

Funciones:

- Listar leads preliminares Meta.
- Filtrar por canal y estado.
- Buscar por contacto, mensaje, responsable o inmobiliaria.
- Ver detalle del lead.
- Ver mensajes.
- Gestionar estado.
- Asignar responsable.
- Asignar inmobiliaria.
- Agregar notas.
- Convertir a cliente formal.
- Ver actividad del lead.

### Ruta `Inbox Meta`

URL dev:

```text
https://d12nm0khvt8zd9.cloudfront.net/meta-inbox
```

Funciones:

- Bandeja tipo chat para uso diario.
- Lista de conversaciones.
- Filtro por canal.
- Busqueda de conversaciones.
- Vista central tipo conversacion.
- Panel lateral del lead.
- Cambio rapido de estado.
- Asignacion rapida de responsable.
- Asignacion rapida de inmobiliaria.
- Respuesta desde el CRM.
- Respuestas rapidas predefinidas.
- Visualizacion de mensajes entrantes y salientes.
- Visualizacion de estados de envio.
- Visualizacion de errores de Meta.
- Visualizacion base de adjuntos.
- Conversion del lead Meta a cliente formal desde el mismo inbox.

## Manejo de adjuntos y multimedia

El sistema ya contempla adjuntos recibidos desde Meta.

Soporte base:

- Imagenes.
- Videos.
- Audios.
- Documentos.
- Stickers.
- Links o adjuntos enviados por Messenger/Instagram.

Para WhatsApp:

- Se guarda metadata del archivo.
- Si existe token valido, se intenta descargar el medio desde Meta.
- El archivo puede archivarse en S3.
- Se guarda `public_url` cuando el archivo queda disponible desde CloudFront.

Pendiente futuro:

- Descargar y archivar medios de Instagram/Messenger si Meta entrega URL autorizada o endpoint persistente.
- Mejorar preview de audio/video/documentos.
- Permitir envio de archivos desde el CRM.

## Despliegue realizado

Se desplego backend en dev mediante CDK.

Stack:

```text
JamConstrucciones
```

API dev:

```text
https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/
```

Frontend dev:

```text
https://d12nm0khvt8zd9.cloudfront.net
```

Tambien se desplego el frontend en S3 y se invalido CloudFront.

Estado de invalidacion:

```text
Completed
```

## Pruebas realizadas

### Pruebas tecnicas exitosas

- Verificacion de webhook Meta por GET.
- Recepcion de webhook simulado de Instagram.
- Recepcion de webhook simulado de Messenger.
- Recepcion de webhook simulado de WhatsApp.
- Guardado de mensajes en DynamoDB.
- Prevencion de duplicados al reenviar el mismo evento.
- Creacion automatica de `META_LEAD`.
- Actualizacion del mismo lead cuando llega otro mensaje del mismo contacto.
- Visualizacion del lead en el CRM.
- Visualizacion de conversacion en el CRM.
- Asignacion de responsable.
- Asignacion de inmobiliaria.
- Cambio de estado.
- Registro de actividad.
- Conversion de lead Meta a cliente formal.
- Validacion de duplicado por cedula.
- Validacion de posible duplicado por telefono/correo.

### Pruebas pendientes

- DM real de Instagram hacia CRM con app aprobada.
- Respuesta real desde CRM hacia Instagram.
- Mensaje real de Messenger hacia CRM con permisos aprobados.
- Respuesta real desde CRM hacia Messenger.
- Mensaje real de WhatsApp hacia CRM.
- Respuesta real desde CRM hacia WhatsApp.
- Prueba con multimedia real por cada canal.

## Archivos principales modificados o creados

Backend:

- `lambdas/jam-meta-webhooks/handler.py`
- `lambdas/jam-crm/routes/meta.py`
- `lambdas/jam-crm/handler.py`

Frontend:

- `front/src/pages/meta/MetaInboxPage.tsx`
- `front/src/pages/meta/MetaLeadsPage.tsx`
- `front/src/pages/meta/MetaCompliancePages.tsx`
- `front/src/services/meta.service.ts`
- `front/src/App.tsx`
- `front/src/components/layout/Sidebar.tsx`

Infraestructura:

- `infra/lib/jam-stack.ts`

Documentacion:

- `docs/tickets/tickets CRM META/TK-01-checklist-cierre-integracion-canales-meta.md`
- `docs/informes/reporte-avance-integracion-meta-tk01.md`
- `docs/informes/reporte-avance-tk01-meta-estado-actual-2026-08-18.md`

## Pendientes para cerrar TK-01 sin depender de Meta

El TK-01 interno ya queda en estado MVP. Lo que queda sin depender de integraciones reales es principalmente pulido:

- Reintento manual de mensajes fallidos desde el CRM.
- Refresco automatico del inbox.
- Mejor preview de adjuntos reales.
- Prueba manual completa de conversion usando un lead real de dev.
- Ajustes visuales menores segun uso del equipo.

## Pendientes bloqueados por Meta

- Aprobacion de permisos avanzados de Instagram.
- Aprobacion de permisos avanzados de Messenger.
- Aprobacion de permisos avanzados de WhatsApp.
- Verificacion del negocio en Meta.
- Resolucion del numero de WhatsApp/WABA.
- Llamada obligatoria de prueba para WhatsApp Messaging.
- Confirmacion de webhooks con trafico real.
- Tokens definitivos o de larga duracion para produccion.

## Riesgos

- Meta puede tardar varios dias o semanas en aprobar permisos.
- WhatsApp sigue siendo el mayor bloqueo por registro del numero y permisos.
- Si se solicitan permisos innecesarios, Meta puede demorar o rechazar la revision.
- El stack de CloudFormation esta cerca del limite de 500 recursos, por lo que conviene evitar crear recursos nuevos innecesarios.
- En produccion habra que repetir configuraciones con URLs, tokens y parametros separados de dev.

## Resumen ejecutivo

Se avanzo el TK-01 hasta dejar funcional la base interna del CRM para gestionar conversaciones Meta. El sistema ya puede recibir eventos simulados, guardar mensajes, crear leads preliminares, mostrar conversaciones en una bandeja tipo chat, responder desde el CRM, registrar errores, asignar responsable/inmobiliaria y convertir el lead a cliente formal.

La parte interna del CRM esta practicamente lista como MVP. El cierre completo del ticket depende de que Meta apruebe permisos y permita el trafico real de Instagram, Messenger y WhatsApp. WhatsApp continua siendo el canal mas bloqueado por el estado del WABA, el numero y la llamada obligatoria de prueba.

