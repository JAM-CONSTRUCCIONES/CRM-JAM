# TK-05 - Registro de la fuente de origen

## Objetivo

Registrar de forma clara de donde proviene cada lead para que el CRM pueda identificar el canal de captacion, la cuenta de origen y, cuando aplique, la campana, anuncio o formulario que genero el contacto.

## Alcance actual

En esta etapa el alcance implementado corresponde a leads creados desde conversaciones Meta:

- Instagram.
- Messenger.
- WhatsApp, cuando quede habilitado completamente en TK-01.

La integracion de Meta Ads y formularios de clientes potenciales aun no esta implementada. Esa parte depende de permisos adicionales, configuracion de formularios y lectura mediante `leads_retrieval`.

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

## Campos preparados para futuras integraciones

El backend deja preparados los siguientes campos para cuando se integre Meta Ads o formularios:

- `campaign_id`
- `campaign_name`
- `ad_id`
- `ad_name`
- `form_id`
- `form_name`

Actualmente esos campos quedan vacios en leads creados por conversaciones, porque los mensajes directos no necesariamente entregan datos de campana o formulario.

## Reglas funcionales

- Todo lead Meta debe conservar su origen desde la primera interaccion.
- Si el lead luego se registra como cliente, oportunidad o bloqueo, el origen debe copiarse al registro comercial creado.
- La fuente no debe ser editada automaticamente por cambios de estado, asignaciones o notas.
- Si en el futuro llega informacion de campana, anuncio o formulario, debe guardarse sin reemplazar la identidad tecnica del canal.

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
- Campos preparados para campanas, anuncios y formularios.

## Pendiente o dependiente de otros tickets

- Meta Ads y formularios de clientes potenciales requieren integracion adicional.
- Lectura real de formularios requiere permisos como `leads_retrieval`.
- Resultados por campana pertenecen tambien al TK-09 de reportes y dashboards.
- Recepcion real de WhatsApp depende del cierre de permisos y configuracion del TK-01.
