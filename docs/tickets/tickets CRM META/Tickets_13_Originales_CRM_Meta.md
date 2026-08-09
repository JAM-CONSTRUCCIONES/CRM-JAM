# TICKETS ORIGINALES - CRM + META
## Versión ordenada según los 13 puntos recibidos para Microsoft Planner

**Proyecto:** JAM Construcciones - CRM  
**Fecha:** 6 de agosto de 2026  
**Objetivo:** Mantener los 13 tickets originales en el mismo orden recibido, agregando alcance, aclaraciones y criterios de aceptación para que puedan cargarse en Microsoft Planner.

---

# Nota de contexto

Estos son los 13 tickets originales recibidos para el proyecto.

El archivo `Backlog_Detallado_Gestion_Leads_CRM_Punto_4.md` funciona como detalle ampliado de los puntos 2 al 11. Los puntos 1, 12 y 13 se mantienen como tickets propios.

El punto 1 debe mantenerse primero porque cubre la integración de canales. En este proyecto, esa integración incluye dos frentes que conviene aclarar desde el inicio:

- Captación de leads desde Meta/Facebook/Instagram cuando aplique.
- Visualización y gestión de conversaciones desde WhatsApp, Instagram y Facebook dentro del CRM.

---

## TK-01 - Integración de canales de comunicación

**Origen:** Punto 1  
**Prioridad:** Alta  

### Descripción
Se requiere la integración y visualización dentro del CRM de las conversaciones e interacciones provenientes de WhatsApp, Instagram y Facebook.

El objetivo es que los mensajes recibidos y enviados a través de estas plataformas puedan visualizarse, gestionarse y mantenerse registrados directamente dentro del CRM.

### Aclaración importante
Este ticket debe considerar que Meta puede intervenir de dos formas:

- Como canal de captación de leads mediante Facebook e Instagram.
- Como canal de conversación mediante Facebook Messenger e Instagram.

WhatsApp debe tratarse como canal de comunicación y seguimiento, no como único canal principal del proyecto.

### Alcance
- Integrar WhatsApp como canal de comunicación.
- Integrar Instagram como canal de interacción/conversación.
- Integrar Facebook como canal de interacción/conversación.
- Visualizar mensajes recibidos y enviados dentro del CRM.
- Asociar conversaciones al lead correcto.
- Registrar interacciones dentro del historial del lead.
- Manejar conversaciones que no puedan asociarse automáticamente.

### Criterios de aceptación
- El CRM permite visualizar interacciones de WhatsApp, Instagram y Facebook.
- Los mensajes asociados a un lead aparecen dentro de su ficha.
- Las conversaciones sin coincidencia quedan pendientes de revisión.
- Las interacciones se registran con canal, fecha y origen.
- La integración respeta permisos de usuarios, vendedores e inmobiliarias.

---

## TK-02 - Flujo completo de gestión de leads

**Origen:** Punto 2  
**Prioridad:** Alta  

### Descripción
Se deberá definir el proceso completo de cada lead, desde su captación inicial hasta su conversión en cliente, estableciendo claramente los diferentes estados y etapas del proceso comercial.

### Alcance
- Definir qué es un lead para JAM Construcciones.
- Definir cuándo nace un lead.
- Definir diferencia entre lead, contacto, cliente, oportunidad, reserva y venta.
- Definir estados comerciales.
- Definir etapas del proceso comercial.
- Definir cuándo un lead se convierte en cliente.
- Definir motivos de pérdida o descarte.

### Criterios de aceptación
- Existe una definición aprobada de lead.
- El flujo comercial está documentado.
- Los estados y transiciones están definidos.
- Se define claramente el punto de conversión a cliente.
- Los estados de cierre tienen motivos definidos.

---

## TK-03 - Prevención de leads duplicados

**Origen:** Punto 3  
**Prioridad:** Alta  

### Descripción
El sistema deberá validar la información antes de crear un nuevo lead para evitar la creación de registros duplicados dentro del CRM.

### Alcance
- Validar por número de teléfono.
- Validar por correo electrónico.
- Validar por documento de identidad.
- Validar por identificador externo de Meta cuando exista.
- Normalizar datos antes de comparar.
- Diferenciar duplicado exacto y posible coincidencia.
- Aplicar validación a Meta, WhatsApp, web, carga manual e importaciones.

### Criterios de aceptación
- El sistema valida duplicados antes de crear un lead.
- Un mismo lead no se crea dos veces por teléfono, correo o documento.
- Un mismo evento externo no se procesa dos veces cuando exista identificador.
- Las coincidencias dudosas pueden enviarse a revisión.
- La decisión tomada queda registrada.

---

## TK-04 - Historial completo del lead

**Origen:** Punto 4  
**Prioridad:** Alta  

### Descripción
Cada lead deberá contar con un historial centralizado que incluya cambios de estado, llamadas realizadas, mensajes enviados y recibidos, notas, tareas, actividades y seguimientos realizados.

### Alcance
- Cambios de estado.
- Llamadas realizadas.
- Mensajes enviados y recibidos.
- Notas.
- Tareas.
- Actividades comerciales.
- Seguimientos.
- Asignaciones y reasignaciones.
- Eventos provenientes de integraciones.

### Criterios de aceptación
- La ficha del lead muestra una línea de tiempo centralizada.
- Cada evento muestra fecha, usuario o servicio origen.
- Los mensajes de canales integrados aparecen en el historial.
- El historial se conserva aunque el lead sea reasignado, cerrado o convertido.
- Los eventos duplicados de integraciones no se muestran repetidos.

---

## TK-05 - Registro de la fuente de origen

**Origen:** Punto 5  
**Prioridad:** Alta  

### Descripción
El CRM deberá identificar y almacenar el origen de cada lead, incluyendo campañas publicitarias, formularios, Facebook, Instagram, página web y otros canales de captación.

### Alcance
- Registrar fuente principal.
- Registrar canal de origen.
- Registrar campaña publicitaria.
- Registrar formulario.
- Registrar Facebook o Instagram cuando aplique.
- Registrar página web u otros canales.
- Registrar anuncio e identificadores externos cuando estén disponibles.

### Criterios de aceptación
- Todo lead tiene fuente de origen.
- Los leads provenientes de Meta conservan canal, campaña, formulario e identificador externo cuando existan.
- La fuente original no se pierde por reasignaciones o cambios de estado.
- La fuente puede usarse en filtros, reportes y dashboards.

---

## TK-06 - Asignación y reasignación de leads

**Origen:** Punto 6  
**Prioridad:** Alta  

### Descripción
El sistema deberá permitir asignar y reasignar leads entre vendedores o inmobiliarias, conservando un historial de cada cambio realizado.

### Alcance
- Asignar lead a vendedor.
- Asignar lead a inmobiliaria.
- Reasignar lead a otro vendedor.
- Reasignar lead a otra inmobiliaria.
- Registrar responsable anterior y nuevo.
- Registrar usuario, fecha y motivo cuando aplique.

### Criterios de aceptación
- Un lead puede asignarse a vendedor o inmobiliaria.
- Las reasignaciones quedan registradas.
- El historial muestra cada cambio de responsable.
- Los permisos se respetan por vendedor e inmobiliaria.
- Los leads sin responsable quedan identificados.

---

## TK-07 - Tareas y recordatorios automáticos

**Origen:** Punto 7  
**Prioridad:** Alta  

### Descripción
Se deberán configurar tareas y recordatorios automáticos para facilitar el seguimiento de los prospectos y evitar que existan oportunidades comerciales sin atender.

### Alcance
- Crear tareas asociadas a leads.
- Asignar tareas a usuarios.
- Definir fechas de vencimiento.
- Crear recordatorios automáticos.
- Alertar leads sin seguimiento.
- Notificar llegada de nuevos leads cuando aplique.

### Criterios de aceptación
- Un lead puede tener tareas asociadas.
- Las tareas tienen responsable, fecha y estado.
- El sistema alerta tareas vencidas.
- El sistema alerta leads sin atención según regla definida.
- Las tareas y recordatorios aparecen en el historial.

---

## TK-08 - Integración de WhatsApp

**Origen:** Punto 8  
**Prioridad:** Alta  

### Descripción
Los mensajes de WhatsApp deberán quedar registrados dentro del CRM, incluyendo, cuando la plataforma lo permita, el estado de cada mensaje: Enviado, Entregado, Leído y Fallido.

### Alcance
- Recibir mensajes de WhatsApp.
- Enviar mensajes desde el CRM si el proveedor lo permite.
- Asociar mensajes al lead correcto.
- Registrar conversación dentro del CRM.
- Registrar estado Enviado.
- Registrar estado Entregado.
- Registrar estado Leído.
- Registrar estado Fallido.
- Mostrar causa de fallo cuando exista.

### Criterios de aceptación
- Los mensajes de WhatsApp quedan registrados en el CRM.
- Los mensajes se asocian al lead correcto.
- Los estados se actualizan cuando la plataforma lo permite.
- Los mensajes fallidos muestran causa o estado comprensible.
- Los mensajes sin coincidencia quedan pendientes de revisión.

---

## TK-09 - Filtros, reportes y dashboards

**Origen:** Punto 9  
**Prioridad:** Media-Alta  

### Descripción
El CRM deberá disponer de filtros, indicadores y dashboards para medir leads captados, tasa de conversión, ventas generadas, rendimiento por fuente, vendedor, inmobiliaria, campaña y estado general del proceso comercial.

### Alcance
- Leads captados.
- Tasa de conversión.
- Ventas generadas.
- Rendimiento por fuente.
- Rendimiento por vendedor.
- Rendimiento por inmobiliaria.
- Resultados por campaña.
- Estado general del proceso comercial.
- Resultados por formulario cuando aplique.

### Criterios de aceptación
- El dashboard muestra indicadores aprobados.
- Se puede filtrar por fuente, campaña, vendedor, inmobiliaria, estado y fecha.
- Los resultados de Meta distinguen Facebook, Instagram, campaña y formulario cuando exista dato.
- Los duplicados no inflan los reportes.
- Los datos respetan permisos.

---

## TK-10 - Registro de auditoría

**Origen:** Punto 10  
**Prioridad:** Alta  

### Descripción
El sistema deberá mantener un registro de auditoría que permita identificar qué usuario realizó cada modificación, así como la fecha y hora de la acción.

### Alcance
- Registrar creación de leads.
- Registrar cambios de estado.
- Registrar asignaciones y reasignaciones.
- Registrar cambios de datos relevantes.
- Registrar eventos de integración.
- Registrar exportaciones.
- Registrar acciones automáticas.

### Criterios de aceptación
- Cada acción crítica registra usuario o servicio, fecha, entidad y acción.
- La auditoría distingue acciones manuales, automáticas e integraciones.
- No se guardan tokens, credenciales ni secretos.
- Solo usuarios autorizados pueden consultar auditoría.

---

## TK-11 - Exportación de información

**Origen:** Punto 11  
**Prioridad:** Media  

### Descripción
La información almacenada en el CRM deberá poder exportarse a Excel para fines de análisis, presentación de reportes y respaldo de datos.

### Alcance
- Exportar listados de leads.
- Exportar información filtrada.
- Exportar reportes.
- Respetar permisos del usuario.
- Registrar auditoría de exportaciones.
- Proteger campos sensibles.

### Criterios de aceptación
- El archivo exportado contiene solo datos autorizados.
- Los filtros aplicados coinciden con la exportación.
- La exportación queda registrada en auditoría.
- Fechas, teléfonos y encabezados se abren correctamente en Excel.

---

## TK-12 - Configuración del dominio

**Origen:** Punto 12  
**Prioridad:** Alta  

### Descripción
Para realizar la conexión del CRM con el dominio `jamconstrucciones.com`, se necesitará acceso a la cuenta de GoDaddy para crear el subdominio `crm.jamconstrucciones.com`.

### Alcance
- Solicitar acceso a GoDaddy.
- Crear subdominio `crm.jamconstrucciones.com`.
- Apuntar el subdominio al ambiente del CRM.
- Configurar HTTPS/SSL.
- Validar acceso final.

### Criterios de aceptación
- Se obtiene acceso a GoDaddy.
- El subdominio queda creado.
- El CRM carga desde `crm.jamconstrucciones.com`.
- HTTPS queda activo.
- La configuración queda documentada.

---

## TK-13 - Referencia funcional y visual

**Origen:** Punto 13  
**Prioridad:** Media  

### Descripción
Se tomará Salesforce como referencia para evaluar funcionalidades, organización de módulos, gestión comercial, seguimiento de clientes, reportes y experiencia general de uso.

### Alcance
- Analizar módulos principales de Salesforce.
- Revisar ficha de lead.
- Revisar gestión comercial.
- Revisar seguimiento de clientes.
- Revisar dashboards y reportes.
- Definir patrones aplicables al CRM de JAM Construcciones.
- Definir qué elementos no aplican.

### Criterios de aceptación
- Existe análisis funcional y visual de referencia.
- Se identifican patrones útiles.
- Se documenta qué se tomará como referencia.
- Se documenta qué no aplica.
- La referencia no reemplaza los requerimientos propios de JAM Construcciones.

---

# Relación con el backlog detallado existente

El archivo `Backlog_Detallado_Gestion_Leads_CRM_Punto_4.md` puede usarse como detalle técnico/funcional de los tickets TK-02 a TK-11.

Los tickets TK-01, TK-12 y TK-13 deben mantenerse aparte porque no están desarrollados con el mismo nivel de detalle en ese documento.

---

# Comentario de implementación

Aunque el orden de Planner respeta los 13 puntos originales, durante desarrollo conviene prestar atención temprana a Meta dentro de TK-01 y TK-05, porque si los leads entran desde Facebook o Instagram, la integración, la fuente de origen y la prevención de duplicados condicionan todo lo demás.
