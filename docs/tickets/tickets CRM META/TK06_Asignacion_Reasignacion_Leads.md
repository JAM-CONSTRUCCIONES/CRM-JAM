# TK-06 - Asignacion y reasignacion de leads

## Objetivo

Permitir que los leads provenientes de Meta puedan asignarse y reasignarse manualmente a un responsable interno y/o a una inmobiliaria, conservando historial de cada cambio realizado.

## Alcance funcional

- El lead puede iniciar sin responsable asignado.
- El lead puede permanecer sin inmobiliaria en cualquier etapa del flujo.
- La asignacion es manual; el sistema no reasigna automaticamente leads.
- Un usuario autorizado puede cambiar responsable interno, inmobiliaria, estado y notas desde la gestion del lead.
- Cada cambio de responsable o inmobiliaria queda registrado en el historial del lead.
- El historial conserva:
  - usuario que realizo el cambio;
  - fecha y hora;
  - valor anterior;
  - valor nuevo;
  - tipo de actividad.

## Implementado

- Gestion manual de responsable interno en leads Meta.
- Gestion manual de inmobiliaria en leads Meta.
- Reasignacion sin perder informacion previa del lead.
- Posibilidad de dejar un lead sin responsable o sin inmobiliaria.
- Registro de actividad por cambio de responsable.
- Registro de actividad por cambio de inmobiliaria.
- Visualizacion del responsable e inmobiliaria actual en la tabla de leads Meta.
- Filtros por responsable e inmobiliaria en la vista de leads Meta.
- Filtros para identificar leads sin responsable o sin inmobiliaria.
- El historial del lead muestra las asignaciones y reasignaciones realizadas.

## Reglas de negocio

- La asignacion no convierte el lead en cliente.
- La conversion a cliente/proceso/bloqueo se realiza mediante una accion manual separada.
- Si el lead ya fue convertido, cualquier cambio posterior de asignacion debe hacerse manualmente.
- Las asignaciones no modifican automaticamente los mensajes ni la conversacion original.
- El lead conserva su fuente de origen Meta aunque cambie de responsable o inmobiliaria.

## Criterios de aceptacion

- Se puede asignar un responsable a un lead Meta.
- Se puede cambiar el responsable de un lead Meta.
- Se puede quitar el responsable de un lead Meta.
- Se puede asignar una inmobiliaria a un lead Meta.
- Se puede cambiar la inmobiliaria de un lead Meta.
- Se puede quitar la inmobiliaria de un lead Meta.
- La tabla permite filtrar leads por responsable.
- La tabla permite filtrar leads por inmobiliaria.
- La tabla permite filtrar leads sin responsable.
- La tabla permite filtrar leads sin inmobiliaria.
- Cada asignacion o reasignacion queda visible en el historial del lead.

## Dependencias

- Requiere que el lead Meta exista previamente en el CRM.
- Requiere usuarios internos activos para asignar responsables.
- Requiere inmobiliarias activas para asignar inmobiliaria.

## Fuera de alcance

- Asignacion automatica por reglas comerciales.
- Round robin de vendedores.
- Balanceo de carga por vendedor.
- Asignacion automatica segun campana, proyecto o canal.
- Notificaciones automaticas al responsable asignado.

## Pendiente opcional

- Definir reglas de asignacion automatica si el cliente lo solicita.
- Agregar notificaciones cuando un lead sea asignado o reasignado.
- Crear reportes de rendimiento por responsable e inmobiliaria usando estas asignaciones.
