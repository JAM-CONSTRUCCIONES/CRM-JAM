# TK-09 - Filtros, reportes y dashboards

## Objetivo

Disponer de filtros, indicadores y dashboards para medir el comportamiento de los leads Meta dentro del CRM.

El alcance cubre exactamente:

- Leads captados.
- Tasa de conversion.
- Ventas generadas.
- Rendimiento por fuente.
- Rendimiento por vendedor.
- Rendimiento por inmobiliaria.
- Resultados por campana.
- Estado general del proceso comercial.

## Implementado

Se agrego una pestana `Dashboard` dentro de la vista `Leads Meta` (`/meta-leads`), usando los datos reales de leads Meta ya registrados en el sistema.

Indicadores disponibles:

- Leads captados.
- Tasa de conversion.
- Ventas generadas.

Reportes disponibles:

- Rendimiento por fuente.
- Rendimiento por vendedor.
- Rendimiento por inmobiliaria.
- Resultados por campana.
- Estado general del proceso comercial.

## Vista operativa

La vista `/meta-leads` queda dividida en dos pestanas:

- `Gestion`: trabajo diario de leads.
- `Dashboard`: filtros, indicadores y reportes del TK-09.

La pestana `Gestion` mantiene:

- Canal.
- Contacto.
- Estado.
- Responsable.
- Inmobiliaria.
- Origen.
- Ultimo mensaje.
- Acceso a mensajes e historial.

Los indicadores comerciales se muestran separados de la tabla operativa para evitar mezclar gestion diaria con reporteria.

## Criterio de conversion

Para el dashboard, una venta generada se calcula como:

- Una conversion registrada en el historial de conversiones del lead.
- O, si no existe historial, un lead con estado `convertido`.

Esto permite medir ventas generadas sin depender todavia de una integracion externa de ventas o facturacion.

## Campanas

El reporte por campana usa la metadata que Meta envie dentro del mensaje:

- `campaign_name`
- `campaign_id`
- `ad_name`
- `ad_id`
- `form_name`
- `form_id`
- `referral_source`
- `referral_type`

Si Meta no envia datos de campana o anuncio, el lead queda agrupado como `Sin campania registrada`.

No se implementa administracion de campanas ni lectura directa de Ads Manager en este ticket.

## Pendiente o dependiente de otros tickets

- Exportacion a Excel, correspondiente al TK-11.
- Datos reales de WhatsApp, dependientes del cierre del TK-08.
- Nombres completos de campanas si Meta solo envia IDs tecnicos.
- Integracion directa con formularios Lead Ads si se decide implementar `leads_retrieval`.

## Estado

Implementado dentro de `Leads Meta`, en una pestana separada de `Dashboard`.
