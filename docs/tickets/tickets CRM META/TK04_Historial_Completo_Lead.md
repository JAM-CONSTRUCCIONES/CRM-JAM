# TK-04 - Historial completo del lead

## Objetivo

Centralizar el historial operativo de cada lead Meta para que el equipo comercial pueda revisar mensajes, cambios, notas, asignaciones y oportunidades registradas desde un solo lugar.

## Alcance definido

El historial aplica a leads provenientes de canales Meta:

- Instagram.
- Messenger.
- WhatsApp, cuando quede completamente habilitado en TK-01.

Las llamadas no forman parte del alcance actual porque el CRM no tiene una integracion telefonica activa. Si se requiere registrar llamadas reales, debe abrirse un ticket separado para integracion con una plataforma de telefonia como Amazon Connect, Twilio, Aircall u otra similar.

## Eventos que debe conservar el historial

- Mensajes recibidos.
- Mensajes enviados o registrados para envio.
- Cambios de estado.
- Cierre o descarte con motivo.
- Reapertura manual.
- Asignacion y reasignacion de responsable.
- Asignacion y reasignacion de inmobiliaria.
- Notas internas.
- Registro de cliente, oportunidad o bloqueo desde el lead.

## Reglas funcionales

- El historial no debe cambiar automaticamente el estado del lead.
- Los mensajes nuevos se registran en el historial, pero no mueven el flujo comercial por si solos.
- Todo cambio comercial relevante debe quedar trazado con fecha y usuario.
- Las oportunidades o bloqueos creados desde el lead deben quedar visibles en el historial del lead.
- Los archivos, imagenes o videos recibidos deben mostrarse como adjuntos cuando el canal los entregue y el sistema tenga acceso al recurso.

## Implementado

- Respuesta del backend con `timeline` unificado para cada conversacion Meta.
- Union de mensajes, actividades y oportunidades en una linea de tiempo unica.
- Etiquetas legibles para cambios de estado, notas, asignaciones, reaperturas, respuestas y conversiones.
- Vista de historial en el Inbox Meta.
- Vista de historial completo dentro del detalle de Leads Meta.
- Conservacion del historial de oportunidades registradas desde cada lead.
- Mantenimiento de mensajes y adjuntos dentro de la conversacion.

## Fuera del alcance actual

- Registro manual de llamadas.
- Telefonia real integrada al CRM.
- Transcripcion o grabacion de llamadas.
- Tareas y recordatorios automaticos, que corresponden al TK-07.

## Pendiente o dependiente de otros tickets

- Recepcion real de WhatsApp depende de la aprobacion y configuracion final del TK-01.
- Automatizaciones de seguimiento pertenecen al TK-07.
- Auditoria global por modulo pertenece al TK-10.
