# TK-07 - Tareas y recordatorios automaticos

## Objetivo

Permitir configurar tareas y recordatorios para facilitar el seguimiento de prospectos y evitar oportunidades comerciales sin atender.

## Definicion funcional

Una tarea es una accion de seguimiento que debe realizar un usuario interno sobre un lead, cliente, proceso o bloqueo.

Para este ticket, el alcance se enfoca en leads Meta y en seguimiento comercial manual.

## Alcance implementado

- Crear tareas de seguimiento desde un lead Meta.
- Asignar la tarea a un usuario interno activo.
- Definir fecha y hora de vencimiento.
- Definir prioridad de la tarea.
- Configurar recordatorio simple:
  - 30 minutos antes;
  - 1 hora antes;
  - 1 dia antes.
- Crear un EventBridge Scheduler individual para ejecutar el recordatorio en la fecha/hora configurada.
- Enviar recordatorio por correo mediante AWS SES cuando llegue la hora configurada.
- Relacionar la tarea con el lead Meta.
- Ver tareas asociadas dentro del detalle del lead.
- Identificar tareas pendientes y vencidas desde el lead.
- Completar tareas directamente desde el detalle del lead.
- Registrar en el historial del lead la creacion de la tarea.
- Registrar en el historial del lead cuando una tarea se completa desde Meta Leads.
- Mantener la gestion completa de la tarea en el modulo Agenda / Tareas.

## Reglas de negocio

- La tarea debe tener responsable.
- La tarea debe tener fecha y hora.
- La tarea no cambia automaticamente el estado del lead.
- La tarea no convierte el lead en cliente.
- La tarea queda relacionada al lead Meta para trazabilidad.
- Una tarea vencida se identifica de forma visual si sigue pendiente o en progreso despues de su fecha/hora.
- Si la tarea se completa o cancela antes del recordatorio, el schedule se elimina o se omite el envio.
- Si la fecha, hora o recordatorio cambian, el schedule se recalcula.

## Fuera de alcance en esta etapa

- Creacion automatica de tareas al recibir cada mensaje.
- Deduplicacion avanzada de tareas.
- Reglas automaticas por vendedor, campana o inmobiliaria.
- Notificaciones por correo, WhatsApp o SMS.
- Calendario avanzado o tareas recurrentes.

## Criterios de aceptacion

- Desde un lead Meta se puede crear una tarea.
- La tarea permite seleccionar responsable.
- La tarea permite seleccionar fecha y hora.
- La tarea permite seleccionar prioridad.
- La tarea permite seleccionar recordatorio.
- La tarea queda visible dentro del lead.
- La tarea queda visible en Agenda / Tareas.
- Si la tarea vence y sigue pendiente, se muestra como vencida.
- El historial del lead registra que se creo una tarea de seguimiento.
- El responsable recibe recordatorio por correo si la tarea sigue pendiente/en progreso.
- Se puede marcar la tarea como lista desde el lead.

## Pendiente opcional

- Crear reglas automaticas de seguimiento por tipo de lead o canal.
