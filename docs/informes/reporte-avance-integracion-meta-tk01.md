# Reporte de avance - TK-01 Integracion de canales Meta

Fecha: 13 de agosto de 2026  
Proyecto: CRM JAM Construcciones  
Alcance: integracion y visualizacion de conversaciones provenientes de WhatsApp, Instagram y Facebook Messenger dentro del CRM.

## Objetivo del ticket

El TK-01 busca integrar los canales de comunicacion de Meta con el CRM para que los mensajes recibidos y enviados desde WhatsApp, Instagram y Facebook Messenger puedan visualizarse, gestionarse y mantenerse registrados directamente en el sistema.

El objetivo funcional es que las conversaciones de prospectos puedan formar parte del historial comercial del lead, evitando que la informacion quede dispersa en plataformas externas.

## Estado general

Estado actual: avance tecnico parcial implementado en ambiente dev.

Se logro dejar preparada la base tecnica para recibir eventos de Meta mediante webhooks, guardar mensajes en DynamoDB y diferenciar eventos de Instagram y Facebook Messenger. WhatsApp queda pendiente por restricciones de acceso y configuracion de la cuenta de WhatsApp Business/WABA.

## Avances realizados

### 1. Revision del alcance del TK-01

Se reviso el requerimiento original:

- Integracion de WhatsApp.
- Integracion de Instagram.
- Integracion de Facebook.
- Visualizacion de mensajes enviados y recibidos dentro del CRM.
- Registro de interacciones asociadas a contactos/leads.

Se identifico que el ticket original era demasiado general y que para implementarlo correctamente era necesario separar:

- conexion tecnica con Meta;
- permisos y revision de la app;
- recepcion de eventos por webhooks;
- almacenamiento interno de conversaciones;
- posterior asociacion de conversaciones con leads del CRM.

### 2. Acceso a Meta Developers y Business Suite

Se ingreso a Meta for Developers y se confirmo que existe una app creada para el proyecto:

- App: `JamConstrucciones_CRM`
- App ID: `1045809101757001`
- Entorno usado: Meta Developers / Business Suite

Tambien se reviso la configuracion del portafolio comercial de JAM Construcciones en Business Suite.

### 3. WhatsApp Business

Se revisaron las cuentas de WhatsApp Business disponibles dentro del Business Manager.

Hallazgos:

- Existian varias cuentas de WhatsApp con nombres similares.
- Se identifico una cuenta relacionada con `Jam Construcciones` conectada previamente con Kommo.
- Se identifico otra cuenta `jamconstruccionessrl` creada o usada desde Meta Developers.
- El mismo numero de WhatsApp no puede verificarse en dos cuentas WABA independientes al mismo tiempo.
- Meta mostro error indicando que el numero ya estaba registrado en otra cuenta de WhatsApp.

Conclusion:

WhatsApp queda pendiente hasta resolver correctamente el acceso al WABA/WhatsApp Manager y decidir si se migra o desconecta la integracion anterior con Kommo.

Estado actual de WhatsApp:

- Integracion directa deseada: WhatsApp Cloud API oficial de Meta.
- Numero correcto detectado: `+1 849 477 7000`.
- Bloqueo actual: acceso/configuracion del WhatsApp Business Account.
- No se recomienda continuar con WhatsApp hasta resolver la propiedad/acceso del WABA.

### 4. Instagram

Se configuro el caso de uso/API de Instagram dentro de Meta Developers.

Permisos agregados o considerados:

- `instagram_business_basic`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`

Cuentas de Instagram conectadas:

- `jamconstruccionessrl`
  - User ID: `17841451399457183`
  - ID de token/API validado: `28162289240102948`
- `caneyoriental`
  - User ID: `17841479714105082`
  - ID de token/API validado: `28079331565011509`

Se generaron tokens de acceso para ambas cuentas y se almacenaron como parametros seguros en AWS SSM.

Parametros SSM usados en dev:

- `/jam/dev/meta/instagram/jamconstruccionessrl/access-token`
- `/jam/dev/meta/instagram/caneyoriental/access-token`

Se valido por CLI que los tokens responden correctamente contra la API de Instagram:

- `jamconstruccionessrl` respondio con usuario e ID correcto.
- `caneyoriental` respondio con usuario e ID correcto.

Estado actual de Instagram:

- Cuenta conectada en Meta Developers.
- Tokens guardados en AWS SSM.
- Webhook configurado y validado.
- Pruebas simuladas funcionando.
- DMs reales aun no llegan al webhook por restricciones de permisos/revision/configuracion Meta.

### 5. Facebook Messenger

Se configuro el caso de uso Messenger from Meta.

Pagina identificada:

- Pagina: `Jam Construcciones`
- Page ID: `134590556407660`

Se avanzo en la configuracion de Messenger:

- Webhook configurado.
- Pagina conectada para generar tokens.
- Pruebas simuladas recibidas y guardadas correctamente.

Pendiente principal:

- Solicitar y aprobar el permiso `pages_messaging`.

Meta indica que para enviar y recibir mensajes reales en Messenger se debe completar el proceso de revision de la app y solicitar el permiso `pages_messaging`.

Estado actual de Messenger:

- Base tecnica lista.
- Webhook recibe eventos de prueba.
- Falta revision de app/permisos para trafico real de usuarios externos.

### 6. Verificacion del negocio en Meta

Durante la solicitud de permisos, Meta redirigio al flujo de verificacion del negocio en Business Suite.

Se identifico el registro publico:

- Nombre legal: `Jam Construcciones S.R.L.`
- RNC: `130922162`
- Direccion legal segun certificacion DGII:
  `Autopista Coronel Fernandez Dominguez, No. B-40, del sector Prado Oriental de la ciudad de Santo Domingo Este.`

Se recomendo usar la direccion del documento legal para evitar rechazos en la verificacion.

Opciones de verificacion mostradas por Meta:

- Correo electronico del dominio `@jamconstrucciones.com`
- Llamada telefonica
- SMS
- WhatsApp
- Verificacion del dominio

Recomendacion:

Usar correo electronico del dominio o verificacion de dominio, salvo que el cliente confirme acceso total al numero mostrado por Meta.

## Implementacion tecnica realizada

### 1. Lambda de webhooks Meta

Se creo un nuevo Lambda:

- Ruta local: `lambdas/jam-meta-webhooks/handler.py`
- Funcion AWS: `jam-meta-webhooks`
- Runtime: Python 3.12

Responsabilidades actuales:

- Verificar el webhook de Meta por GET.
- Recibir eventos POST de Meta.
- Identificar eventos de Instagram.
- Identificar eventos de Facebook Messenger.
- Normalizar eventos entrantes.
- Guardar mensajes/eventos en DynamoDB.
- Evitar duplicados mediante condicion de escritura.

### 2. Endpoint publico de Meta

Se agrego una ruta publica en API Gateway:

- `GET /webhooks/meta`
- `POST /webhooks/meta`

URL dev:

```text
https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/webhooks/meta/
```

Token de verificacion dev:

```text
jam-crm-meta-webhook-dev
```

La verificacion GET fue probada correctamente y respondio `200 OK`.

### 3. Tabla DynamoDB para conversaciones Meta

Se creo una tabla nueva:

- Tabla dev: `jam-meta-conversaciones`
- Definicion CDK: `JamMetaConversacionesTable`

Llaves:

- `pk`
- `sk`

Indices agregados:

- `gsi-external-event`
  - permite buscar eventos por ID externo de Meta y evitar duplicados.
- `gsi-channel-account`
  - permite listar mensajes por canal/cuenta.
- `gsi-contact`
  - permite consultar historial por contacto externo.

La tabla fue agregada al plan de backup diario del proyecto.

### 4. Datos guardados por mensaje/evento

Cada evento normalizado guarda informacion como:

- canal: `instagram` o `messenger`;
- cuenta origen;
- contacto externo;
- direccion del mensaje: `incoming`, `outgoing` o `unknown`;
- texto del mensaje;
- tipo de evento;
- ID externo del evento;
- timestamp del evento;
- resumen de adjuntos;
- fecha de creacion en el CRM.

Ejemplo conceptual de particion:

```text
CONVERSACION#instagram#jamconstruccionessrl#{contacto_externo}
```

### 5. Leads preliminares de Meta

Se agrego creacion y actualizacion automatica de leads preliminares de Meta.

Cuando entra un mensaje nuevo por Instagram o Messenger, el sistema:

- guarda el mensaje individual;
- crea un registro `META_LEAD` si el contacto externo no existia;
- actualiza el mismo `META_LEAD` si el contacto ya existia;
- mantiene estado inicial `nuevo`;
- registra fuente del lead, por ejemplo `Instagram` o `Facebook Messenger`;
- actualiza ultimo mensaje, fecha del ultimo mensaje y contadores.

Esto evita crear clientes definitivos sin informacion obligatoria como cedula, proyecto o inmobiliaria. El lead Meta queda como registro preliminar hasta que un asesor complete los datos y lo convierta en cliente/proceso comercial del CRM.

Ejemplo conceptual:

```text
META_LEAD#instagram#jamconstruccionessrl#{contacto_externo}
```

### 6. Consulta interna desde CRM

Se agrego lectura interna desde `jam-crm` reutilizando el endpoint existente `/admin/procesos`, para no aumentar recursos de API Gateway.

Consultas disponibles:

```text
GET /admin/procesos?tipo=meta-leads
GET /admin/procesos?tipo=meta-conversacion&lead_pk={META_LEAD_PK}
```

La primera lista leads Meta preliminares. La segunda devuelve el lead y sus mensajes asociados.

### 7. Vista interna de Leads Meta

Se agrego una vista interna en el frontend para usuarios internos:

```text
/meta-leads
```

La pantalla permite:

- listar leads preliminares de Meta;
- filtrar por canal y estado;
- ver totales de leads, nuevos y mensajes registrados;
- abrir un panel lateral con la conversacion del contacto;
- distinguir mensajes entrantes y salientes;
- cambiar el estado del lead;
- agregar notas internas de seguimiento;
- visualizar actividad registrada del lead.

La vista fue desplegada en dev:

```text
https://d12nm0khvt8zd9.cloudfront.net/meta-leads
```

## Pruebas realizadas

### Verificacion del webhook

Prueba:

- GET al endpoint de Meta con `hub.challenge`.

Resultado:

- `200 OK`
- respuesta correcta del challenge.

### Prueba simulada Instagram

Se envio un POST simulado con:

- `object: instagram`
- cuenta: `jamconstruccionessrl`
- mensaje de prueba.

Resultado:

- `stored_count: 1`
- mensaje guardado en DynamoDB.

Luego se envio el mismo evento nuevamente.

Resultado:

- `stored_count: 0`
- `duplicate_count: 1`

Esto confirma que la prevencion de duplicados funciona para eventos repetidos.

Luego se envio una nueva prueba simulada de Instagram con dos mensajes del mismo contacto.

Resultado:

- primer mensaje: se guardo `META_MENSAJE` y se creo `META_LEAD`;
- segundo mensaje: se guardo un nuevo `META_MENSAJE` y se actualizo el mismo `META_LEAD`;
- el contador `mensajes_totales` quedo en `2`;
- el campo `ultimo_mensaje_texto` quedo actualizado con el segundo mensaje.

Tambien se probo la lectura interna del CRM por invocacion Lambda simulando usuario admin:

- `GET /admin/procesos?tipo=meta-leads` devolvio el lead Meta;
- `GET /admin/procesos?tipo=meta-conversacion&lead_pk=...` devolvio el lead y sus mensajes asociados.

Tambien se compilo y desplego el frontend con la vista `/meta-leads`, verificando respuesta `200 OK` desde CloudFront dev.

### Prueba de gestion de lead Meta

Se probo la gestion interna de un `META_LEAD` mediante invocacion Lambda simulando usuario admin.

Resultado:

- se cambio estado de `nuevo` a `en_seguimiento`;
- se guardo una nota interna;
- se crearon actividades `META_ACTIVIDAD` para cambio de estado y nota;
- el lead quedo actualizado con `ultima_nota`, `ultima_nota_en` y `estado`.

### Prueba simulada Messenger

Se envio un POST simulado con:

- `object: page`
- pagina: `Jam Construcciones`
- mensaje de prueba.

Resultado:

- `stored_count: 1`
- mensaje guardado en DynamoDB.

### Prueba de DM real de Instagram

Se envio un DM real a la cuenta `jamconstruccionessrl`.

Resultado:

- No se recibio invocacion nueva en CloudWatch.
- No se guardo nuevo item en DynamoDB.

Conclusion:

El endpoint y backend funcionan, pero Meta aun no esta enviando DMs reales al webhook. Esto apunta a restricciones de app en desarrollo, permisos pendientes, revision de app o configuracion adicional de Instagram.

## Despliegue realizado

Se desplego el stack dev:

- Stack: `JamConstrucciones`
- Region: `us-east-1`
- Cuenta AWS: `479324457361`

Resultado del deploy:

- Deploy completado correctamente.
- Tabla `jam-meta-conversaciones` creada.
- Lambda `jam-meta-webhooks` actualizado.
- Permisos IAM aplicados.
- Backup selection actualizado.
- Pantalla `Leads Meta` publicada en CloudFront dev.
- Endpoint interno de gestion de leads Meta actualizado.

Advertencia:

El stack se encuentra cerca del limite de recursos de CloudFormation:

```text
485 recursos de 500
```

Esto debe considerarse para futuras ampliaciones.

## Archivos modificados o creados

Archivos de infraestructura:

- `infra/lib/jam-stack.ts`

Archivos de backend:

- `lambdas/jam-meta-webhooks/handler.py`
- `lambdas/jam-crm/routes/meta.py`
- `lambdas/jam-crm/handler.py`

Archivos de frontend:

- `front/src/pages/meta/MetaLeadsPage.tsx`
- `front/src/pages/meta/MetaCompliancePages.tsx`
- `front/src/services/meta.service.ts`
- `front/src/App.tsx`
- `front/src/components/layout/Sidebar.tsx`

Documentacion:

- `docs/informes/reporte-avance-integracion-meta-tk01.md`

## Pendientes

### Pendientes tecnicos

- Convertir un `META_LEAD` preliminar en cliente/proceso formal cuando el asesor complete datos obligatorios.
- Definir reglas automaticas de asignacion/reasignacion de leads Meta a vendedores o inmobiliarias.
- Agregar soporte futuro para adjuntos multimedia:
  - guardar metadata en DynamoDB;
  - guardar archivos en S3 si se decide descargar media desde Meta.

### Pendientes Meta

- Completar verificacion del negocio en Business Suite.
- Solicitar permiso `pages_messaging` para Messenger.
- Completar revision de app para permisos avanzados de Instagram.
- Revisar configuracion de mensajes/API en la cuenta profesional de Instagram.
- Publicar la app si Meta lo requiere para trafico real.

### Pendientes WhatsApp

- Resolver acceso al WhatsApp Business Manager/WABA.
- Confirmar si se desconecta/migra la integracion anterior con Kommo.
- Validar propiedad del numero `+1 849 477 7000`.
- Configurar WhatsApp Cloud API oficial.
- Configurar webhooks de WhatsApp.
- Guardar estados de mensaje cuando Meta lo permita:
  - enviado;
  - entregado;
  - leido;
  - fallido.

## Riesgos identificados

- Meta puede bloquear trafico real hasta aprobar permisos avanzados.
- La verificacion del negocio puede fallar si los datos ingresados no coinciden con documentos oficiales.
- WhatsApp no puede avanzar correctamente mientras el numero este asociado a otra cuenta/integracion.
- El stack AWS esta cerca del limite de 500 recursos de CloudFormation.
- Los mensajes reales aun no llegan desde Instagram, aunque las pruebas simuladas si funcionan.

## Proximos pasos recomendados

1. Completar verificacion del negocio con datos legales de JAM Construcciones S.R.L.
2. Solicitar permiso `pages_messaging` para Messenger.
3. Completar revision de app para Instagram Messaging.
4. Reintentar prueba con DM real luego de permisos/revision.
5. Implementar conversion de lead Meta preliminar a cliente/proceso formal del CRM.
6. Resolver acceso WABA para continuar WhatsApp.

## Avance adicional: gestion inicial de Leads Meta

Se agrego una pantalla interna `Leads Meta` para consultar y gestionar los leads preliminares creados desde eventos de Meta.

Funciones disponibles:

- listar leads preliminares recibidos desde Meta;
- filtrar por canal y estado;
- visualizar mensajes asociados a cada lead;
- cambiar estado del lead;
- agregar notas internas;
- asignar responsable interno;
- asignar inmobiliaria;
- convertir el lead preliminar en cliente formal del CRM;
- crear proceso en estado `captacion` cuando se selecciona una unidad;
- registrar historial de cambios, notas, asignaciones y conversiones.

Validacion realizada:

- Se invoco el endpoint interno de gestion sobre un lead de prueba.
- Se asigno un responsable y una inmobiliaria.
- Se agrego una nota interna.
- El API devolvio el lead actualizado correctamente.
- El historial devolvio actividades de nota, asignacion de responsable y asignacion de inmobiliaria.
- Se valido la conversion de lead Meta a cliente formal con datos de prueba.
- Se limpio la data dummy usada en la prueba y el lead quedo disponible para pruebas manuales.

Endpoint interno reutilizado:

```text
GET /admin/procesos?tipo=meta-leads
GET /admin/procesos?tipo=meta-conversacion&lead_pk=...
PUT /admin/procesos?tipo=meta-lead&lead_pk=...
PUT /admin/procesos?tipo=meta-lead&accion=convertir&lead_pk=...
```

## Resumen ejecutivo

Se avanzo significativamente en la base tecnica de la integracion Meta. El CRM ya cuenta en dev con un endpoint publico capaz de recibir webhooks, validar la conexion de Meta y guardar eventos de Instagram y Messenger en DynamoDB.

La parte tecnica bajo control del equipo quedo funcional para pruebas simuladas. Ademas, el CRM ya puede gestionar los leads preliminares recibidos desde Meta con estado, notas, responsable, inmobiliaria e historial. El bloqueo actual para trafico real no esta en el backend, sino en el proceso de permisos, revision de app y verificacion del negocio dentro de Meta.

WhatsApp queda pendiente por el conflicto de acceso/configuracion del numero y la cuenta WABA asociada anteriormente.
