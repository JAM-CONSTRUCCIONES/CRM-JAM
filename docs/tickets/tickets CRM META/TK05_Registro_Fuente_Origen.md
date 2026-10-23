# TK-05 - Registro de la fuente de origen

## Objetivo

Registrar de forma clara de donde proviene cada lead para que el CRM pueda identificar el canal de captacion, la cuenta de origen y, cuando aplique, la campana, anuncio o formulario que genero el contacto.

## Alcance actual

En esta etapa el alcance implementado corresponde a leads creados desde conversaciones Meta:

- Instagram.
- Messenger.
- WhatsApp, cuando quede habilitado completamente en TK-01.

La integracion para administrar Meta Ads o leer formularios de clientes potenciales aun no esta implementada. Sin embargo, si un mensaje recibido desde Meta incluye metadata de anuncio, campana, formulario o referral, el CRM la registra automaticamente como parte del origen del lead.

## Estructura de origen para conversaciones Meta

Para cada lead recibido por mensajes se guarda:

- `fuente`: nombre funcional del canal, por ejemplo `Instagram`, `Facebook Messenger` o `WhatsApp`.
- `origen`: proveedor general, actualmente `meta`.
- `origen_plataforma`: plataforma propietaria, actualmente `Meta`.
- `origen_canal`: canal tecnico, por ejemplo `instagram`, `messenger` o `whatsapp`.
- `origen_tipo_interaccion`: tipo de interaccion, por ejemplo `mensaje`, `mensaje_media`, `respuesta_boton`, `postback`, `lectura` o `entrega`.
- `origen_cuenta_id`: identificador tecnico de la cuenta, pagina o WABA.
- `origen_cuenta_alias`: alias interno usado por el CRM para la cuenta conectada.
- `origen_contacto_id`: identificador externo del contacto dentro del canal.
- `origen_detalle`: bloque con el detalle normalizado de origen.

## Metadata publicitaria capturada desde mensajes

Cuando Meta envia informacion asociada al mensaje, el backend guarda los siguientes campos:

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

Estos datos se guardan solo cuando vienen en el payload oficial de Meta. No se consultan ni administran campanas desde Ads Manager para este ticket.

## Reglas funcionales

- Todo lead Meta debe conservar su origen desde la primera interaccion.
- Si el lead luego se registra como cliente, oportunidad o bloqueo, el origen debe copiarse al registro comercial creado.
- La fuente no debe ser editada automaticamente por cambios de estado, asignaciones o notas.
- Si en el futuro llega informacion de campana, anuncio o formulario, debe guardarse sin reemplazar la identidad tecnica del canal.
- Si Meta solo entrega IDs tecnicos y no nombres legibles, el CRM debe conservar esos IDs sin inventar datos.

## Implementado

- Registro de fuente basica por canal.
- Registro de proveedor general `meta`.
- Registro de canal tecnico.
- Registro de cuenta Meta asociada.
- Registro de identificador externo del contacto.
- Registro de tipo de interaccion.
- Estructura `origen_detalle` para conservar los datos normalizados.
- Copia de datos de origen al cliente cuando se registra desde un lead Meta.
- Copia de datos de origen al proceso/bloqueo cuando se registra desde un lead Meta.
- Captura de metadata de campana, conjunto de anuncios, anuncio, formulario y referral cuando viene dentro del mensaje.
- Visualizacion del origen publicitario en la lista y detalle de leads Meta.

## Pendiente o dependiente de otros tickets

- Administracion de Meta Ads y lectura directa de formularios de clientes potenciales requieren integracion adicional.
- Lectura real de formularios requiere permisos como `leads_retrieval`.
- Resultados por campana pertenecen tambien al TK-09 de reportes y dashboards.
- Recepcion real de WhatsApp depende del cierre de permisos y configuracion del TK-01.
