# TK-02 - Flujo completo de gestion de leads

## Objetivo

Definir e implementar el flujo operativo de un lead dentro del CRM desde su captacion inicial hasta su conversion en cliente, manteniendo trazabilidad de cambios, gestion manual y control humano antes de convertir.

## Alcance funcional

Un lead Meta nace automaticamente cuando ingresa una interaccion desde un canal conectado, como Instagram, Messenger o WhatsApp. El registro puede iniciar sin responsable interno y sin inmobiliaria asignada.

El CRM debe permitir que el equipo comercial gestione el lead de forma manual, revise la conversacion, agregue notas, cambie el estado, asigne o retire responsable, asigne o retire inmobiliaria, descarte el lead y lo convierta formalmente en cliente cuando corresponda.

## Estados del lead

- `nuevo`: estado inicial de todo lead recibido desde Meta.
- `en_seguimiento`: lead atendido o en proceso comercial.
- `convertido`: lead convertido a cliente formal del CRM.
- `cerrado`: lead descartado o cerrado comercialmente.

## Reglas del flujo

- Todo lead recibido desde Meta inicia como `nuevo`.
- El lead puede permanecer sin responsable al inicio.
- El lead puede permanecer sin inmobiliaria en cualquier momento del flujo.
- La conversion a cliente es manual y requiere revision humana.
- No se permite marcar un lead como `convertido` solo cambiando el estado. Debe usarse la accion formal de conversion.
- Un lead `cerrado` puede reabrirse manualmente hacia `nuevo` o `en_seguimiento`.
- Si un lead `convertido` recibe nuevos mensajes, se mantiene como `convertido`.
- Si un lead `cerrado` recibe nuevos mensajes, se mantiene como `cerrado`.
- Todo cambio de estado debe ser manual; los mensajes nuevos no cambian automaticamente el flujo comercial.
- Al cerrar un lead se debe registrar el motivo de cierre.
- El registro comercial debe validar los mismos datos requeridos por el CRM al crear un cliente formal.
- El registro comercial puede realizarse con unidad o sin unidad.
- Si se registra con unidad, se valida que la unidad este disponible y que no tenga un proceso de venta activo.
- Si se registra con unidad, se debe crear el proceso comercial en `captacion` y activar el bloqueo de la unidad usando la logica existente del CRM.
- Un mismo lead Meta puede generar mas de una oportunidad/bloqueo, incluso en distintos proyectos o distintas unidades del mismo proyecto, siempre respetando reglas de disponibilidad, exclusividad y procesos activos.
- El lead conserva historial de cada registro comercial con los datos principales usados.
- El usuario debe poder ver desde el lead todas las oportunidades o bloqueos registrados previamente.

## Motivos de cierre

- No interesado
- No responde
- Presupuesto insuficiente
- Contacto incorrecto
- Duplicado
- Compra pospuesta
- Otro

## Historial requerido

El historial del lead debe registrar:

- Cambios de estado.
- Motivo de cierre.
- Reapertura de leads cerrados.
- Asignacion y reasignacion de responsable.
- Asignacion y reasignacion de inmobiliaria.
- Notas internas.
- Conversion a cliente.
- Datos principales de conversion.

## Implementado

- Gestion manual de estados en leads Meta.
- Lead Meta puede existir sin responsable.
- Lead Meta puede existir sin inmobiliaria.
- Cierre de lead con motivo obligatorio.
- Reapertura manual de lead cerrado con actividad registrada.
- Bloqueo de conversion falsa por cambio simple de estado.
- Registro formal de cliente/oportunidad desde lead Meta.
- Registro con unidad o sin unidad.
- Registro con unidad integrado al bloqueo real de inventario.
- Soporte para registrar mas de una oportunidad desde el mismo lead Meta.
- Validacion de duplicados por cedula, telefono y correo durante la conversion.
- Registro de historial de conversion dentro del lead.
- Vista de oportunidades/bloqueos registrados desde el lead, incluyendo fecha, proyecto, unidad, inmobiliaria, cliente y usuario.
- Vista de Inbox Meta con gestion rapida.
- Vista de Leads Meta con gestion comercial y conversion.
- Acceso visual desde el lead hacia el historial de mensajes.

## Pendiente o dependiente de otros tickets

- Automatizaciones de tareas y recordatorios pertenecen al TK-07.
- Reportes y dashboards pertenecen al TK-09.
- Auditoria general del sistema pertenece al TK-10.
- Flujo final con WhatsApp real depende de aprobacion y registro correcto de WhatsApp Business API en TK-01.
