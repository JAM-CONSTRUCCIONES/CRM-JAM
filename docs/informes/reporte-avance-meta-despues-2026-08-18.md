# Reporte de avance - Integracion CRM Meta

Fecha: 24 de agosto de 2026  
Proyecto: CRM JAM Construcciones  
Ambiente trabajado: dev  
Rama: `meta-tickets-dev`  
Ultimo commit local: `29a6f3e feat: completa gestion de leads Meta`

## Objetivo

El objetivo de este trabajo es integrar los canales de comunicacion de Meta con el CRM de JAM Construcciones para que las conversaciones e interacciones provenientes de WhatsApp, Instagram y Facebook Messenger puedan visualizarse, gestionarse y mantenerse registradas directamente dentro del sistema.

El alcance funcional buscado es que un mensaje recibido desde Meta pueda:

- Entrar al CRM mediante webhook.
- Guardarse como mensaje.
- Crear o actualizar un lead preliminar.
- Mantener historial de conversacion.
- Permitir gestion comercial por parte del equipo.
- Registrar origen, fuente, responsable, inmobiliaria, tareas y conversiones.
- Convertirse en cliente formal o bloqueo comercial cuando corresponda.

El trabajo no se limita a recibir mensajes. Tambien deja preparada la operacion diaria del lead dentro del CRM.

## Resumen ejecutivo

El modulo Meta se encuentra en estado funcional en ambiente dev para trabajo interno y pruebas con eventos de Meta.

Se implemento:

- Webhook Meta para Instagram, Messenger y WhatsApp.
- Bandeja unificada de conversaciones Meta.
- Registro de mensajes entrantes y salientes.
- Creacion automatica de leads preliminares.
- Gestion comercial de leads Meta.
- Flujo completo de gestion del lead Meta.
- Conversion de lead Meta a cliente o bloqueo comercial.
- Prevencion de duplicados por identidad tecnica del canal.
- Historial del lead separado del historial de mensajes.
- Registro completo de fuente de origen y metadata publicitaria cuando Meta la envia.
- Asignacion y reasignacion de responsable e inmobiliaria.
- Tareas y recordatorios vinculados al lead.
- Mejoras de UI/UX en `/meta-leads`.
- Deploy completo en ambiente dev.

La parte interna del CRM esta bastante avanzada. El cierre completo de los canales reales depende todavia de aprobaciones, permisos y configuraciones dentro de Meta, especialmente WhatsApp.

## Estado general actual

El modulo Meta en dev queda en estado funcional para trabajo interno con eventos de prueba y trafico real cuando Meta lo habilite.

Actualmente el sistema permite:

- Crear leads automaticamente desde mensajes Meta.
- Ver leads por canal.
- Filtrar por canal, estado, responsable e inmobiliaria.
- Abrir el detalle de un lead.
- Ir desde el lead a la conversacion de mensajes.
- Registrar cambios de estado.
- Asignar o quitar responsable.
- Asignar o quitar inmobiliaria.
- Registrar notas internas.
- Crear tareas de seguimiento.
- Marcar tareas como listas.
- Programar recordatorios por correo.
- Convertir un lead en cliente formal.
- Registrar bloqueo comercial con unidad.
- Registrar conversion sin unidad cuando aplique.
- Mantener historial de cambios y conversiones.
- Guardar origen publicitario si Meta envia datos de campana, anuncio, formulario o referral.

## Canales Meta trabajados

## Instagram

Cuentas identificadas y configuradas:

- `jamconstruccionessrl`
  - Instagram User ID: `17841451399457183`
- `caneyoriental`
  - Instagram User ID: `17841479714105082`

Avances:

- API de Instagram agregada como caso de uso en Meta Developers.
- Permisos necesarios agregados al caso de uso.
- Tokens generados.
- Tokens guardados en AWS Systems Manager Parameter Store.
- Webhook configurado.
- Campos de webhook configurados.
- Suscripcion de webhook activada para las cuentas conectadas.
- Pruebas simuladas recibidas correctamente.
- Eventos de prueba guardados en DynamoDB.
- Leads preliminares creados desde eventos Meta.
- Mensajes visibles dentro del CRM.
- Metadata de origen publicitario preparada para mensajes que vengan desde anuncios o referrals.

Pendiente:

- Aprobacion final de permisos avanzados de Instagram.
- Confirmar recepcion estable de DMs reales desde usuarios externos una vez Meta habilite la app/permisos.
- Confirmar envio real de respuestas desde el CRM bajo permisos aprobados.

## Facebook Messenger

Pagina identificada:

- Pagina: `Jam Construcciones`
- Page ID: `134590556407660`

Avances:

- Messenger from Meta agregado como caso de uso.
- Pagina conectada a la app.
- Webhook configurado.
- Suscripcion a eventos de mensajes configurada.
- Eventos de prueba recibidos correctamente.
- Eventos guardados en DynamoDB.
- Lead preliminar y conversacion visibles dentro del CRM.
- Preparacion para responder mensajes desde el CRM.
- Metadata de referral/anuncio preparada cuando venga en el payload.

Pendiente:

- Aprobacion de permisos de Messenger, especialmente `pages_messaging`.
- Prueba real de mensaje entrante desde Facebook Messenger con app en modo aprobado.
- Prueba real de respuesta desde el CRM.

## WhatsApp

WABA y numero identificados:

- WhatsApp Business Account: `Jam Construcciones`
- WABA ID: `12798130284042`
- Numero: `+1 849-477-7000`
- Phone Number ID detectado: `109857822123688`

Avances:

- Se identifico el WABA correcto dentro de Business Manager.
- Se confirmo que el numero aparece conectado en WhatsApp Manager.
- Se configuro la base tecnica del webhook para WhatsApp.
- El backend normaliza mensajes de WhatsApp.
- El backend guarda estados de WhatsApp cuando Meta los envia.
- El backend prepara archivado de medios de WhatsApp en S3 cuando existe token valido.
- Se preparo la captura de metadata CTWA/referral cuando un mensaje venga desde un anuncio Click to WhatsApp.

Bloqueos actuales:

- Meta devuelve error `Account not registered` al intentar enviar mensajes por API.
- La llamada obligatoria de prueba para `whatsapp_business_messaging` no queda completada mientras Meta no permita enviar.
- Falta aprobacion o activacion completa de permisos avanzados:
  - `whatsapp_business_messaging`
  - `whatsapp_business_management`
- El cierre real de WhatsApp depende de la resolucion del numero, WABA, permisos y revision de Meta.

Decision tomada:

- No bloquear el avance interno del CRM por WhatsApp.
- Continuar desarrollando la gestion de leads y dejar WhatsApp preparado para cuando Meta habilite el canal correctamente.

## Implementacion tecnica base

## Webhook Meta

Se implemento un endpoint publico para recibir eventos de Meta:

```text
https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/webhooks/meta/
```

Responsabilidades implementadas:

- Verificacion de webhook por `hub.challenge`.
- Recepcion de eventos `POST`.
- Identificacion del canal:
  - Instagram.
  - Facebook Messenger.
  - WhatsApp.
- Normalizacion de eventos entrantes.
- Prevencion de duplicados por ID externo del evento.
- Guardado de mensajes en DynamoDB.
- Creacion o actualizacion del lead preliminar asociado.
- Registro de estados de mensaje cuando el canal los envia.
- Preparacion para media/adjuntos.
- Registro de metadata publicitaria cuando viene dentro del payload.

## Bandeja de conversaciones

Se implemento una bandeja tipo inbox para conversaciones Meta.

Funciones disponibles:

- Ver conversaciones por canal.
- Ver mensajes entrantes y salientes.
- Identificar contacto externo.
- Ver errores de envio o eventos.
- Mantener una vista separada para conversacion completa.

## Leads Meta

Se implemento una vista comercial de leads Meta en:

```text
/meta-leads
```

Esta vista concentra la gestion del prospecto, mientras que la bandeja de mensajes conserva la conversacion.

## Avance por ticket

## TK-01 - Integracion de canales de comunicacion

El TK-01 cubre la integracion y visualizacion dentro del CRM de conversaciones provenientes de WhatsApp, Instagram y Facebook Messenger.

Implementado:

- Webhook central para Meta.
- Normalizacion de mensajes por canal.
- Registro de mensajes en DynamoDB.
- Creacion automatica de leads preliminares.
- Bandeja de conversaciones Meta.
- Vista de leads Meta.
- Preparacion para responder desde el CRM.
- Registro de estados de mensajes cuando el canal los entregue.
- Soporte base para adjuntos y multimedia.
- Se mejoro la vista `/meta-leads` para que funcione como bandeja comercial de leads Meta.
- Se separo la gestion del lead de la lectura completa de mensajes.
- En la tabla de leads ahora se usa un boton para ir al historial/conversacion, evitando duplicar todos los mensajes dentro del listado.
- WhatsApp sigue preparado a nivel backend, pero su cierre depende de Meta y del estado correcto del WABA/numero.

Estado:

- Internamente funcional en dev.
- Bloqueado parcialmente por aprobaciones y permisos de Meta para trafico real completo.

## TK-02 - Flujo completo de gestion de leads

Se avanzo el flujo comercial del lead Meta.

Implementado:

- Estados manuales del lead:
  - `nuevo`
  - `en_seguimiento`
  - `convertido`
  - `cerrado`
- El lead puede iniciar sin responsable.
- El lead puede estar sin inmobiliaria en cualquier momento del flujo.
- Los cambios de estado son manuales.
- Un lead descartado/cerrado puede reabrirse manualmente.
- La conversion conserva el estado `convertido` hasta que un usuario realice otro cambio manual.
- La conversion permite registrar cliente con o sin unidad, respetando la logica existente del CRM.
- Se agrego soporte para historial de conversiones.
- Se permite registrar mas de una conversion/bloqueo asociado a un lead cuando el prospecto esta interesado en mas de una unidad.

Decision funcional:

- El sistema no fuerza asignar responsable ni inmobiliaria al crear el lead Meta.
- La revision humana sigue siendo parte del flujo.
- No se automatizan cambios comerciales sensibles sin accion del usuario.

## TK-03 - Prevencion de leads duplicados

Se implemento la regla minima acordada para evitar duplicados dentro del mismo canal/cuenta/contacto.

Implementado:

- El lead Meta se identifica por:
  - Canal.
  - Cuenta Meta asociada.
  - Identificador externo del contacto.
- Si llega otro mensaje del mismo contacto por el mismo canal y cuenta, se actualiza el lead existente.
- No se intenta unificar automaticamente un contacto entre Instagram, Messenger y WhatsApp.

Decision funcional:

- Si una persona escribe por Instagram y luego por Messenger, se trata como leads separados.
- La deduplicacion entre canales queda fuera del alcance actual porque requiere reglas de identidad mas complejas y datos confiables como telefono/correo/documento.

## TK-04 - Historial completo del lead

Se ordeno la trazabilidad para que el lead tenga historial comercial sin mezclarlo con una lista gigante de mensajes.

Implementado:

- Historial de cambios de estado.
- Historial de asignacion de responsable.
- Historial de asignacion de inmobiliaria.
- Historial de notas internas.
- Historial de tareas creadas.
- Historial de tareas completadas.
- Historial de conversiones.
- Boton para abrir el historial del lead.
- Boton separado para ir a los mensajes/conversacion.

Decision funcional:

- No se registran llamadas manuales porque no forman parte del alcance actual operativo.
- Los mensajes se mantienen en la conversacion, no como filas repetidas dentro del historial comercial del lead.

## TK-05 - Registro de la fuente de origen

Se reforzo el registro de origen para cubrir mensajes provenientes de anuncios/campanas sin pedir permisos adicionales de administracion de Ads.

Implementado:

- `fuente`
- `origen`
- `origen_plataforma`
- `origen_canal`
- `origen_tipo_interaccion`
- `origen_cuenta_id`
- `origen_cuenta_alias`
- `origen_contacto_id`
- `origen_detalle`

Tambien se agrego captura de metadata publicitaria cuando Meta la envia en el webhook:

- `campaign_id`
- `campaign_name`
- `adset_id`
- `adset_name`
- `ad_id`
- `ad_name`
- `form_id`
- `form_name`
- `referral_source`
- `referral_type`
- `referral_url`
- `ctwa_clid`
- `ads_origin`

Esto aplica para:

- Instagram.
- Facebook Messenger.
- WhatsApp, cuando Meta envie eventos reales del canal.

Decision funcional:

- No se implemento administracion de campanas.
- No se implemento lectura directa de Ads Manager.
- No se requieren permisos nuevos solo para guardar el origen que venga dentro del mensaje.
- Si Meta envia solo IDs y no nombres legibles, se guardan los IDs sin inventar informacion.

Verificacion realizada:

- Se envio un webhook de prueba con metadata de campana/anuncio/referral.
- DynamoDB guardo correctamente:
  - `campaign_id`
  - `campaign_name`
  - `ad_id`
  - `ad_name`
  - `referral_source`
  - `referral_type`
  - `referral_url`
- El dato de prueba fue eliminado despues de validar.

## TK-06 - Asignacion y reasignacion de leads

Se agrego manejo operativo de asignacion.

Implementado:

- Filtro por responsable.
- Filtro por inmobiliaria.
- Opcion para ver leads sin responsable.
- Opcion para ver leads sin inmobiliaria.
- Visualizacion de responsable en la tabla.
- Visualizacion de inmobiliaria en la tabla.
- Actualizacion manual desde el detalle del lead.
- Registro de historial cuando cambia el responsable.
- Registro de historial cuando cambia la inmobiliaria.

Decision funcional:

- El lead puede permanecer sin responsable.
- El lead puede permanecer sin inmobiliaria.
- La asignacion es manual.

## TK-07 - Tareas y recordatorios automaticos

Se implemento el minimo funcional solicitado para seguimiento de prospectos.

Implementado:

- Crear tarea desde un lead Meta.
- Seleccionar responsable de la tarea.
- Definir fecha.
- Definir hora.
- Definir prioridad.
- Definir recordatorio:
  - 30 minutos antes.
  - 1 hora antes.
  - 1 dia antes.
- Listar tareas asociadas al lead.
- Marcar una tarea como `Lista`.
- Mostrar tareas pendientes.
- Mostrar tareas vencidas.
- Registrar en historial del lead cuando se crea una tarea.
- Registrar en historial del lead cuando se completa una tarea.

Recordatorios:

- Se agrego programacion con EventBridge Scheduler.
- El scheduler invoca la lambda de tareas al momento correspondiente.
- La lambda envia correo por SES.
- El correo se envia al email del usuario responsable cuando existe.
- Si no se encuentra correo del responsable, usa correo administrador de respaldo.

Decision funcional:

- No se agrego automatizacion extra al crear leads.
- No se agregaron tareas automaticas por duplicados.
- No se complico el flujo con reglas no pedidas.

## Mejoras de UI/UX

Se mejoro la experiencia de gestion en `/meta-leads`.

Avances:

- Vista mas enfocada a gestion comercial.
- Tabla con filtros operativos.
- Separacion entre lead, historial y mensajes.
- Boton para ver mensajes.
- Boton para ver historial.
- Panel de tareas y recordatorios dentro del detalle.
- Panel de origen publicitario cuando el lead trae metadata de campana/anuncio.
- Conversion a cliente/bloqueo desde el lead.
- Seleccion de unidades disponibles al registrar conversion con unidad.

## Backend e infraestructura

Backend actualizado:

- `lambdas/jam-meta-webhooks/handler.py`
- `lambdas/jam-crm/routes/meta.py`
- `lambdas/jam-tareas/handler.py`

Frontend actualizado:

- `front/src/pages/meta/MetaLeadsPage.tsx`
- `front/src/services/meta.service.ts`
- `front/src/services/tareas.service.ts`

Infraestructura actualizada:

- `infra/lib/jam-stack.ts`

Documentacion agregada o actualizada:

- `docs/tickets/tickets CRM META/TK02_Flujo_Completo_Gestion_Leads.md`
- `docs/tickets/tickets CRM META/TK03_Prevencion_Leads_Duplicados.md`
- `docs/tickets/tickets CRM META/TK04_Historial_Completo_Lead.md`
- `docs/tickets/tickets CRM META/TK05_Registro_Fuente_Origen.md`
- `docs/tickets/tickets CRM META/TK06_Asignacion_Reasignacion_Leads.md`
- `docs/tickets/tickets CRM META/TK07_Tareas_Recordatorios_Automaticos.md`

## Deploy y verificacion

Ambiente dev:

- Backend desplegado con CDK.
- Frontend compilado correctamente.
- Frontend publicado en S3.
- CloudFront invalidado.

URL dev:

```text
https://d12nm0khvt8zd9.cloudfront.net
```

Rutas principales:

```text
/meta-leads
/meta-inbox
```

Validaciones realizadas:

- Build del frontend correcto.
- Deploy CDK correcto.
- Webhook Meta respondio correctamente a evento de prueba.
- DynamoDB guardo lead y mensaje con metadata publicitaria.
- Se confirmo visualizacion funcional de leads Meta en dev.

Nota:

- No se pudo ejecutar `py_compile` localmente porque Python no esta disponible correctamente en la sesion de Windows, pero el deploy CDK construyo y publico las lambdas correspondientes.

## Pendientes que dependen de Meta

Siguen pendientes por aprobaciones o configuracion externa:

- Aprobacion final de permisos de Instagram.
- Aprobacion final de permisos de Messenger.
- Aprobacion de permisos de WhatsApp.
- Resolucion definitiva del numero de WhatsApp/WABA.
- Llamada obligatoria de prueba para `whatsapp_business_messaging`.
- Trafico real completo desde usuarios externos.
- Tokens definitivos o de larga duracion para produccion.
- Repetir configuraciones en produccion con URLs y parametros de prod.

## Pendientes internos recomendados

Sin depender directamente de Meta, lo que podria seguirse trabajando es:

- Reportes y dashboards del TK-09.
- Indicadores por fuente, canal, responsable e inmobiliaria.
- Conteo de conversiones desde leads Meta.
- Rendimiento por campana cuando exista metadata publicitaria.
- Exportacion a Excel de leads/conversaciones cuando corresponda al TK-11.
- Pulido visual menor segun uso real del equipo.

## Conclusiones

El sistema ya no queda limitado a recibir y mostrar mensajes. Ahora permite administrar el lead, asignarlo, darle seguimiento, crear tareas, registrar recordatorios, convertirlo en cliente o bloqueo, conservar historial y guardar el origen comercial/publicitario cuando Meta lo entrega.

La parte interna del CRM para TK-01 al TK-07 queda bastante avanzada en dev. Lo que sigue bloqueando el cierre completo de los canales reales depende principalmente de Meta: permisos, revision de app, verificacion del negocio y resolucion del canal WhatsApp.
