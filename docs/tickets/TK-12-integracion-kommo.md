# TK-12 - Integración con Kommo CRM

## Objetivo

Sincronizar eventos comerciales del sistema JAM con Kommo de forma asíncrona, manteniendo el CRM externo actualizado sin bloquear el flujo interno.

---

## Alcance

### Backend (`jam-crm` — consumidor SQS)
- Lambda que consume `jam-notificaciones-queue` y envía eventos a Kommo API
- Manejo de reintentos en caso de fallo de Kommo
- Sincronización unidireccional: JAM → Kommo

### Eventos a sincronizar

| Evento | Datos enviados |
|--------|---------------|
| `cambio_estatus` | Cliente, proyecto, unidad, estatus nuevo, timestamp |

---

## Configuración requerida

| Variable | Descripción |
|----------|-------------|
| `KOMMO_BASE_URL` | URL base de la API de Kommo del cliente |
| `KOMMO_TOKEN` | Token de acceso a la API de Kommo |

Estas variables se configuran en el CDK como variables de entorno de `jam-crm`. Actualmente están vacías — se activan cuando el cliente entregue sus credenciales.

---

## Criterios de aceptación

- [ ] Kommo recibe eventos de cambio de estatus de forma asíncrona
- [ ] Si Kommo falla, el cambio de estatus interno no se revierte
- [ ] Los reintentos se manejan correctamente
- [ ] Los costos de la API de Kommo son responsabilidad del cliente

---

## Notas técnicas

- La infraestructura SQS ya está lista desde TK-06 — los eventos ya se publican
- Solo falta implementar el consumidor en `jam-crm/routes/kommo_consumer.py`
- Depende de: TK-06 (estatus comerciales), credenciales de Kommo del cliente
