# TK-01 - Integración de canales de comunicación

**Proyecto:** JAM Construcciones - CRM  
**Prioridad:** Alta  
**Tipo:** Integración / CRM / Comunicación  
**Canales incluidos:** WhatsApp, Instagram y Facebook  

---

# Descripción

Se requiere integrar dentro del CRM las conversaciones e interacciones provenientes de WhatsApp, Instagram y Facebook, permitiendo que los mensajes recibidos y enviados a través de estos canales puedan visualizarse, gestionarse y mantenerse registrados directamente en la ficha del lead o contacto correspondiente.

La integración deberá apoyarse en las funcionalidades oficiales disponibles en Meta Developers y en las APIs correspondientes para cada canal.

---

# Objetivo

Centralizar la comunicación con prospectos y clientes dentro del CRM, evitando que las conversaciones comerciales queden dispersas entre diferentes plataformas.

El usuario del CRM deberá poder consultar el historial de interacciones por canal, revisar mensajes enviados y recibidos, identificar el contacto asociado y continuar el seguimiento comercial desde una única vista.

---

# Alcance funcional

## WhatsApp

- Visualizar conversaciones de WhatsApp dentro del CRM.
- Registrar mensajes enviados y recibidos.
- Mostrar datos básicos del contacto asociado.
- Mantener historial completo de la conversación.
- Asociar mensajes al lead o contacto correspondiente.
- Registrar estados de mensaje cuando la plataforma lo permita:
  - Enviado.
  - Entregado.
  - Leído.
  - Fallido.

## Instagram

- Recibir mensajes directos de Instagram dentro del CRM.
- Registrar interacciones disponibles mediante la integración oficial de Meta.
- Asociar mensajes e interacciones al lead o contacto correspondiente.
- Mantener historial de comunicación por canal.
- Permitir identificar el origen de la interacción como Instagram.

## Facebook

- Recibir mensajes de Facebook Messenger dentro del CRM.
- Registrar interacciones disponibles mediante la integración oficial de Meta.
- Recibir registros generados mediante formularios de clientes potenciales de Facebook e Instagram.
- Asociar mensajes, formularios e interacciones al lead o contacto correspondiente.
- Permitir identificar el origen de la interacción como Facebook.

---

# Alcance técnico

- Utilizar la cuenta disponible de Meta Developers para configurar la integración.
- Configurar la aplicación de Meta necesaria para el CRM.
- Configurar permisos requeridos para WhatsApp, Instagram y Facebook.
- Configurar webhooks para recepción de eventos y mensajes.
- Procesar eventos entrantes desde los canales integrados.
- Registrar identificadores externos enviados por Meta.
- Evitar duplicidad de eventos mediante control de idempotencia.
- Registrar errores técnicos de integración para revisión y soporte.
- Proteger tokens, credenciales y secretos de integración.

---

# Reglas de negocio

- Toda conversación o interacción recibida debe quedar asociada a un lead o contacto cuando exista coincidencia.
- Las interacciones que no puedan asociarse automáticamente deberán quedar disponibles para revisión.
- Los mensajes e interacciones deben conservar canal, fecha, origen y referencia externa cuando exista.
- Los usuarios solo podrán visualizar conversaciones según sus permisos dentro del CRM.
- Las integraciones deberán respetar las limitaciones oficiales de Meta y de cada canal.
- Los datos sensibles no deben exponerse en logs funcionales ni técnicos.

---

# Criterios de aceptación

- El CRM permite visualizar conversaciones e interacciones de WhatsApp, Instagram y Facebook.
- Los mensajes enviados y recibidos quedan registrados dentro del CRM.
- Cada mensaje o interacción muestra canal, fecha y contacto asociado cuando exista.
- Las conversaciones asociadas a un lead aparecen en su historial.
- Los formularios de clientes potenciales de Facebook e Instagram generan registros procesables dentro del CRM.
- Los mensajes sin coincidencia automática quedan disponibles para revisión.
- Los estados de WhatsApp se registran cuando la plataforma los proporcione.
- Los eventos repetidos desde Meta no generan registros duplicados.
- La integración respeta permisos de usuarios, vendedores e inmobiliarias.
- Las credenciales, tokens y secretos no se muestran en pantalla ni logs.

---

# Dependencias

- Acceso a Meta Developers.
- App de Meta configurada para el CRM.
- Páginas de Facebook e Instagram vinculadas.
- Cuenta o número de WhatsApp Business habilitado cuando aplique.
- Permisos aprobados para los productos de Meta requeridos.
- URL pública del CRM para recepción de webhooks.
- Modelo de datos del CRM para leads, contactos, conversaciones e historial.

---

# Evidencias de cierre

- Captura o video de conversaciones visibles dentro del CRM.
- Prueba de recepción de mensaje desde WhatsApp.
- Prueba de recepción de mensaje desde Instagram.
- Prueba de recepción de mensaje desde Facebook Messenger.
- Prueba de recepción de formulario de cliente potencial desde Facebook o Instagram.
- Evidencia de asociación de conversación a lead o contacto.
- Evidencia de manejo de mensajes o eventos sin coincidencia.
- Evidencia de que no se duplican eventos reenviados.
- Evidencia de que no se exponen tokens o credenciales en logs.
