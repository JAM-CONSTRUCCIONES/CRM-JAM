# JAM Construcciones — Documentación final

## 1. Propósito del sistema

JAM Construcciones es una plataforma web interna para administrar proyectos inmobiliarios, inventario de unidades, clientes, procesos comerciales, bloqueos, inmobiliarias, usuarios, campañas, tareas, reportes e integraciones de mensajería.

El sistema tiene una interfaz React/Vite y una arquitectura serverless en AWS. La lógica de negocio se ejecuta principalmente en funciones AWS Lambda escritas en Python, con datos persistidos en DynamoDB y acceso protegido mediante Amazon Cognito.

Esta documentación describe el comportamiento comprobado en el código actual de `front`, `lambdas` e `infra`.

## 2. Arquitectura general

```text
Usuario web
   │
   ▼
CloudFront ───────────────► S3 frontend
   │
   ▼
React + Vite
   │  JWT de Cognito
   ▼
API Gateway
   │
   ├── jam-auth
   ├── jam-proyectos
   ├── jam-captacion
   ├── jam-bloqueos
   ├── jam-crm
   ├── jam-campanias
   ├── jam-tareas
   └── jam-meta-webhooks
          │
          ├── DynamoDB
          ├── SQS + SES
          ├── EventBridge Scheduler
          ├── Step Functions
          ├── S3
          ├── Meta Graph API
          └── Amazon Bedrock
```

### Componentes principales

| Componente | Responsabilidad |
|---|---|
| React + Vite | Interfaz autenticada, formularios, tablas, filtros y flujos operativos. |
| Amazon Cognito | Usuarios, grupos, autenticación, recuperación de contraseña y MFA. |
| API Gateway | API REST `/api` y autorización mediante Cognito. |
| AWS Lambda | Lógica de autenticación, inventario, clientes, CRM, bloqueos, tareas, campañas y Meta. |
| DynamoDB | Persistencia de usuarios, proyectos, inventario, clientes, procesos, historial y conversaciones. |
| S3 | Frontend estático, imágenes, archivos de migración y medios. |
| CloudFront | Distribución HTTPS del frontend y de los assets públicos. |
| EventBridge Scheduler | Vencimientos de exclusividad, bloqueos, alertas comerciales y recordatorios. |
| SQS | Cola de notificaciones asíncronas y su DLQ. |
| SES | Envío de correos de notificación. |
| Step Functions | Operaciones largas de transferencia de clientes y eliminación de proyectos/cédulas. |
| Meta Graph API | Leads, formularios, Messenger, Instagram y WhatsApp. |
| Bedrock | Funcionalidades de IA relacionadas con procesamiento de datos/campañas. |

## 3. Roles y permisos

Los roles se representan mediante grupos de Cognito y también se validan en el backend.

| Rol | Alcance principal |
|---|---|
| `admin` | Administración completa del sistema, usuarios, inmobiliarias, proyectos, inventario y clientes. Puede ejecutar acciones administrativas especiales. |
| `coordinador` | Operación interna y administración operativa. Comparte varias capacidades administrativas con `admin`, incluyendo el bypass confirmado de exclusividad. |
| `supervisor` | Consulta y operación comercial supervisada. Tiene acceso a clientes, procesos, reportes, campañas, Meta y tareas según el módulo. |
| `inmobiliaria` | Consulta y operación de sus proyectos, clientes y procesos. No puede acceder a módulos internos de administración. |

La interfaz oculta opciones según el rol, pero las Lambdas vuelven a validar permisos. Las rutas bajo `/admin` requieren un rol interno. Las eliminaciones sensibles de clientes y ciertos recursos requieren específicamente `admin`.

## 4. Funcionalidades del frontend

### 4.1 Autenticación y seguridad

- Inicio de sesión con usuario y contraseña.
- Recuperación y confirmación de contraseña.
- MFA opcional configurado mediante TOTP.
- Flujo de configuración inicial de MFA cuando la cuenta lo requiere.
- Persistencia de sesión mediante tokens de Cognito.
- Protección de rutas según usuario autenticado y rol.
- Página de acceso no autorizado.
- Foto de perfil mediante URL prefirmada de S3.

### 4.2 Dashboard

El dashboard presenta la entrada principal de la aplicación autenticada y concentra accesos a la operación del sistema. Las métricas comerciales detalladas se obtienen desde el módulo de analítica administrativa.

### 4.3 Proyectos e inventario

Los usuarios internos pueden administrar proyectos, etapas, torres/edificios y unidades inmobiliarias.

Funciones implementadas:

- Listar proyectos activos.
- Crear, editar y eliminar proyectos según permisos.
- Administrar etapas.
- Administrar torres o edificios.
- Crear, editar y eliminar unidades.
- Consultar estado de cada unidad.
- Filtrar por estado, unidad, tipo, manzana/bloque y piso.
- Consultar precios, metraje, habitaciones, baños, parqueos y datos comerciales.
- Subir imagen de proyecto mediante URL prefirmada.
- Exportar información del inventario.
- Consultar el inventario públicamente por proyecto.

Las unidades pueden tener estados como disponible, bloqueada, reservada, separada, inicial, pagos atrasados, contra entrega, vendida o estados equivalentes manejados por el CRM.

### 4.4 Bloqueos de unidades

El flujo de bloqueo permite reservar temporalmente una unidad y asociarla opcionalmente a un cliente.

Funciones principales:

- Crear bloqueo desde inventario.
- Crear bloqueo administrativo seleccionando inmobiliaria.
- Crear bloqueo temporal sin cliente para usuarios internos.
- Registrar o seleccionar un cliente durante el bloqueo.
- Mostrar tiempo restante y fecha de liberación.
- Liberar bloqueo manualmente.
- Extender la duración de un bloqueo desde el panel administrativo.
- Consultar historial de bloqueos.
- Asignar posteriormente un cliente a un bloqueo sin cliente.
- Enviar notificaciones al cliente, inmobiliaria y/o administración.

Reglas relevantes:

- Las inmobiliarias deben crear el bloqueo con cliente.
- Los usuarios internos pueden crear bloqueos sin cliente.
- Una escritura condicional evita que dos inmobiliarias bloqueen simultáneamente la misma unidad.
- Existe una restricción de re-bloqueo durante las 24 horas posteriores a una liberación, salvo excepciones administrativas.
- Los administradores y coordinadores pueden confirmar explícitamente un bypass cuando existe exclusividad activa en otra inmobiliaria.

### 4.5 Clientes

El módulo de clientes permite gestionar captaciones por proyecto e inmobiliaria.

Funciones implementadas:

- Listar clientes por proyecto.
- Listar clientes administrativos con filtros por proyecto e inmobiliaria.
- Buscar por nombre o cédula/pasaporte.
- Consultar todos los registros asociados a una cédula.
- Registrar clientes.
- Añadir clientes desde el panel Admin seleccionando proyecto e inmobiliaria.
- Editar datos personales.
- Cambiar cédula o pasaporte mediante Step Functions.
- Transferir un cliente a otra inmobiliaria.
- Eliminar un cliente y sus datos asociados según permisos.
- Exportar clientes a Excel.
- Visualizar exclusividad, fecha de captación y fecha de vencimiento.
- Consultar procesos comerciales asociados al cliente.

Datos básicos gestionados:

- Cédula o pasaporte.
- Nombres y apellidos.
- Correo.
- Teléfono.
- Fecha de nacimiento y edad calculada.
- Estado civil.
- Nacionalidad.
- País de residencia.
- Proyecto e inmobiliaria.
- Exclusividad activa y vencimiento.

### 4.6 Regla de exclusividad

La exclusividad se valida por la combinación de cliente, proyecto e inmobiliaria.

- Al registrar un cliente se crea una exclusividad activa por tres meses.
- Se programa un vencimiento automático con EventBridge Scheduler.
- Si el mismo cliente tiene exclusividad activa con otra inmobiliaria en el proyecto, la operación normal se rechaza.
- El mensaje informa que el cliente pertenece a otra inmobiliaria y muestra, cuando está disponible, el nombre de esa inmobiliaria.
- Los usuarios `admin` y `coordinador` pueden confirmar el bypass desde la interfaz.
- El bypass se envía mediante `forzar_admin` y el backend vuelve a verificar el rol antes de aceptarlo.
- El bypass no crea un bloqueo cuando se usa desde Añadir cliente: solo registra el cliente y su nueva exclusividad.
- La exclusividad vencida puede permitir una nueva captación según el flujo correspondiente.

### 4.7 Procesos comerciales / CRM

El módulo de procesos permite administrar el avance comercial de una unidad y su cliente.

Funciones implementadas:

- Listar procesos de todos los proyectos para usuarios internos.
- Listar procesos propios para inmobiliarias.
- Filtrar por proyecto, estado, inmobiliaria, cliente y unidad.
- Consultar detalle de proceso.
- Cambiar estatus comercial.
- Consultar historial de cambios.
- Registrar reserva y separación.
- Validar vencimientos de reserva y separación.
- Confirmar pagos iniciales.
- Marcar procesos vendidos o contra entrega.
- Traspasar un cliente/proceso a otra inmobiliaria.
- Recrear bloqueos y actualizar exclusividad durante transferencias cuando corresponde.

Los cambios de estatus pueden generar notificaciones y registrar trazabilidad del usuario que ejecutó la operación.

### 4.8 Inmobiliarias

Disponible para `admin` y `coordinador`.

- Crear inmobiliarias.
- Editar nombre, correos y proyectos asociados.
- Habilitar y deshabilitar inmobiliarias.
- Eliminar inmobiliarias según permisos.
- Subir imagen de inmobiliaria.
- Consultar usuarios asociados.
- Crear usuarios de inmobiliaria.
- Habilitar, deshabilitar y eliminar usuarios de inmobiliaria.

### 4.9 Usuarios internos

Disponible para `admin` y `coordinador`.

- Crear usuarios internos.
- Asignar rol interno.
- Habilitar y deshabilitar usuarios.
- Eliminar usuarios.
- Administrar usuarios de las inmobiliarias desde el módulo correspondiente.

### 4.10 Migración de inventario por Excel

El flujo de migración permite cargar información masiva del inventario.

1. Se solicita una URL prefirmada para el archivo.
2. El navegador sube el Excel directamente a S3.
3. Se genera una previsualización del contenido.
4. El usuario puede revisar y corregir filas.
5. Se confirma la migración.
6. El backend escribe proyectos, torres, etapas, unidades, clientes y procesos según los datos confirmados.
7. Se consulta el reporte final de la operación.

El frontend muestra advertencias de validación, datos faltantes y cantidad de registros creados o rechazados.

### 4.11 Reportes y analítica

Los usuarios internos pueden consultar reportes y analítica calculada a partir de los datos internos.

La analítica incluye, entre otros datos:

- Totales de unidades por estado.
- Clientes totales.
- Exclusividades activas y vencidas.
- Procesos por estatus.
- Conversión comercial.
- Velocidad de cierre.
- Cierres mensuales.
- Principales unidades y conversiones por inmobiliaria.
- Datos demográficos disponibles.

### 4.12 Campañas y correos

El módulo de campañas permite:

- Filtrar destinatarios por proyecto, inmobiliaria y condiciones comerciales.
- Previsualizar destinatarios.
- Enviar campañas de correo.
- Consultar historial de campañas.
- Gestionar plantillas.
- Subir imágenes de campaña a S3.

Los correos operativos también pueden enviarse de forma asíncrona mediante SQS y SES.

### 4.13 Tareas

El módulo de tareas permite gestionar trabajadores y pendientes internos.

- Crear trabajadores.
- Activar o desactivar trabajadores.
- Crear tareas.
- Asignar tareas.
- Establecer fecha límite y recordatorio.
- Actualizar tareas.
- Cancelar tareas.
- Programar recordatorios con EventBridge Scheduler.

### 4.14 Integración con Meta

La aplicación integra funcionalidades de Meta para captación y mensajería.

- Recepción de leads de Meta Lead Ads.
- Gestión de formularios y envíos.
- Conversión de lead a cliente.
- Asociación de lead con cliente existente.
- Bandeja de conversaciones.
- Mensajes de WhatsApp, Messenger e Instagram según configuración.
- Envío de mensajes de texto y medios.
- Descarga y publicación de archivos mediante S3/CloudFront.
- Renombrado de contactos.
- Gestión de actividades y línea de tiempo.
- Webhooks para eventos entrantes y salientes.
- Flujos OAuth y callbacks de Facebook/Messenger.

### 4.15 Captura pública

Existen páginas públicas sin sesión para:

- Captura de clientes.
- Captura global.
- Consulta pública del inventario de un proyecto.
- Consulta de proyectos e inmobiliarias disponibles para captación.

Las rutas públicas no deben confundirse con las rutas administrativas: el backend aplica validaciones específicas y la captación pública usa la inmobiliaria recibida en el flujo público.

## 5. Backend por Lambda

| Lambda | Responsabilidad comprobada |
|---|---|
| `jam-auth` | Login, Cognito, MFA, usuarios internos, inmobiliarias, configuración, fotos y permisos administrativos. |
| `jam-proyectos` | Proyectos, etapas, torres, unidades, inventario, Excel, imágenes y exportaciones. |
| `jam-captacion` | Clientes, captación pública, clientes administrativos y vencimiento de exclusividad. |
| `jam-bloqueos` | Creación, liberación, extensión, historial y schedules de bloqueos. |
| `jam-crm` | Procesos, estatus, historial, analítica, traspasos iniciados y Meta CRM. |
| `jam-transferir-cliente` | Ejecución de transferencias y cambio de cédula mediante Step Functions. |
| `jam-campanias` | Previsualización, envío, plantillas e imágenes de campañas. |
| `jam-tareas` | Trabajadores, tareas, recordatorios y estados de tareas. |
| `jam-meta-webhooks` | Recepción de webhooks y sincronización de mensajes/eventos de Meta. |
| `jam-notificaciones` | Consumidor SQS para enviar correos mediante SES. |
| `jam-pre-auth` | Triggers previos de autenticación de Cognito. |
| `jam-excel-parser` | Procesamiento especializado de archivos Excel. |
| `jam-captacion-inspect` | Variante auxiliar de captación/inspección presente en el repositorio. |

## 6. Persistencia y datos

Las tablas DynamoDB se crean en `infra/lib/jam-stack.ts`. En producción reciben sufijo `-prod`; en desarrollo usan el nombre base.

| Tabla lógica | Uso |
|---|---|
| `jam-usuarios` | Usuarios internos, usuarios de inmobiliaria e inmobiliarias. |
| `jam-inventario` | Proyectos, etapas, torres y unidades. |
| `jam-clientes` | Clientes por proyecto e inmobiliaria y exclusividad. |
| `jam-historial-estatus` | Historial de cambios de estatus de procesos. |
| `jam-procesos` | Procesos de venta por cliente y unidad. |
| `jam-historial-bloqueos` | Historial de bloqueos y liberaciones. |
| `jam-campanias` | Campañas, plantillas y registros de envío. |
| `jam-meta-conversaciones` | Leads, conversaciones, mensajes y datos de Meta. |
| `jam-tareas` | Trabajadores, tareas y recordatorios. |

Índices importantes:

- `gsi-tipo` para entidades por tipo.
- `gsi-estado` para unidades por estado.
- `gsi-inmobiliaria-clientes` para clientes por inmobiliaria.
- `gsi-proyecto-clientes` para clientes por proyecto.
- `gsi-cedula-proyecto` para validar exclusividad por cédula y proyecto.
- `gsi-inmobiliaria` y `gsi-proyecto-id-unidad` para búsquedas de inventario.

## 7. API principal

La API se publica bajo `/api` y se autoriza con Cognito salvo las rutas públicas y webhooks definidos en la infraestructura.

### Autenticación

- `POST /auth/login`
- `POST /auth/confirm-mfa`
- `GET /auth/me`
- `POST /auth/mfa/setup`
- `POST /auth/mfa/verify`
- Gestión de foto de perfil.

### Proyectos e inventario

- `GET /proyectos`
- `GET /proyectos/{proyecto_id}`
- `GET /proyectos/{proyecto_id}/etapas`
- `GET /proyectos/{proyecto_id}/unidades`
- `GET /proyectos/{proyecto_id}/unidades/{unidad_id}`
- Operaciones administrativas para proyectos, etapas, torres, unidades, cargas Excel e imágenes.

### Bloqueos

- `POST /bloqueos`
- `GET /bloqueos/activos`
- `GET /admin/bloqueos/historial`
- `DELETE /admin/bloqueos/{unidad_id}`
- `PUT /admin/bloqueos/{unidad_id}/extender`

### Clientes

- `POST /clientes` para inmobiliarias y también para el flujo interno de Añadir cliente, identificado por rol.
- `GET /clientes`
- `GET /clientes/{cedula}`
- `GET /admin/clientes`
- `GET /admin/clientes/buscar`
- `GET /admin/clientes/{cedula}/proyecto/{proyecto_id}`
- `PUT /admin/clientes/{cedula}/proyecto/{proyecto_id}`
- Operaciones administrativas de eliminación, transferencia y cambio de cédula.

### CRM y Meta

- Procesos, estatus e historial bajo `/admin/clientes`.
- Analítica bajo `/admin/analytics`.
- Leads, formularios, conversaciones, mensajes, conversiones y OAuth bajo las rutas `/admin/meta-*` y `/webhooks/meta`.

### Campañas, tareas y configuración

- `/admin/campanias`
- `/admin/tareas`
- `/admin/config`
- `/admin/sistema/usuarios`
- `/admin/inmobiliarias`

## 8. Automatizaciones y notificaciones

### Exclusividad

1. Se crea el registro del cliente con `exclusividad_activa = true`.
2. Se guarda `fecha_captacion` y `fecha_vencimiento`.
3. Se programa un schedule único.
4. Al vencer, la Lambda de captación marca la exclusividad como inactiva y publica el evento correspondiente.

### Bloqueos

1. Se actualiza la unidad mediante escritura condicional.
2. Se registra el bloqueo en el historial.
3. Se crean schedules de alerta y liberación.
4. La alerta y la liberación publican notificaciones.
5. Los schedules se eliminan al liberar manualmente o después de ejecutarse.

### Procesos comerciales

Los cambios de reserva, separación y pagos pueden crear o cancelar schedules de alerta, actualizar el proceso y publicar mensajes para la cola de notificaciones.

### Notificaciones

Las Lambdas publican eventos en SQS. `jam-notificaciones` consume la cola, resuelve datos de cliente/inmobiliaria y envía correos mediante SES. Existe una DLQ para mensajes fallidos.

## 9. Despliegue

### Backend e infraestructura

Desde `JAM-Construcciones/infra`:

```powershell
$env:CDK_DEFAULT_ACCOUNT='479324457361'
$env:CDK_DEFAULT_REGION='us-east-1'
npm.cmd run cdk -- deploy JamConstrucciones -c stage=dev --require-approval never
npm.cmd run cdk -- deploy JamConstruccionesProd -c stage=prod --require-approval never
```

### Frontend

El frontend no se publica automáticamente mediante CDK. Se compila y se sube manualmente a dos buckets porque CloudFront usa un behavior separado para `/assets/*`.

Desarrollo:

```powershell
cd front
npm.cmd run build
aws s3 sync dist/ s3://jam-frontend-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id E1WI58DFYF9AST --paths "/*"
```

Producción:

```powershell
cd front
npm.cmd run build:prod
aws s3 sync dist/ s3://jam-frontend-prod-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-prod-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id EQD4J2QTY0PV8 --paths "/*"
```

### Ambientes publicados

| Ambiente | Frontend | API |
|---|---|---|
| Dev | `https://d12nm0khvt8zd9.cloudfront.net` | `https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/` |
| Prod | `https://dcgjiswnwqab6.cloudfront.net` | `https://7lltvhwiu7.execute-api.us-east-1.amazonaws.com/api/` |

## 10. Configuración del frontend

La aplicación obtiene la configuración de API, Cognito, región y ambiente mediante variables Vite. Se mantienen archivos `.env` y `.env.production` en `front`; no deben incluirse secretos privados en el frontend.

El frontend usa `JamApi` como nombre lógico de API en AWS Amplify y envía el token ID de Cognito como `Authorization: Bearer ...`.

## 11. Validaciones de datos

El frontend normaliza y valida datos antes de enviarlos, pero el backend aplica una segunda validación defensiva.

Validaciones relevantes:

- Cédula/pasaporte: letras y números, sin símbolos.
- Nombres y apellidos: letras y espacios.
- Correo: formato con dominio válido.
- Teléfono: solo números.
- Catálogos de nacionalidad y país de residencia.
- Campos obligatorios según operación.
- Proyecto e inmobiliaria activos para altas administrativas.

## 12. Pruebas y estado técnico

Comprobaciones realizadas durante la documentación y el último cambio:

- `npm.cmd run build` del frontend: correcto.
- `npm.cmd run build:prod` del frontend: correcto.
- `npm.cmd run build` de infraestructura: correcto.
- Despliegue dev realizado correctamente.
- Despliegue prod realizado correctamente.
- Publicación de frontend en S3 y invalidación de CloudFront realizadas en dev y prod.

Advertencias conocidas:

- Vite informa que el bundle principal supera 500 kB.
- Vite informa una importación dinámica/estática simultánea de configuración.
- La infraestructura se encuentra cerca del límite de 500 recursos de CloudFormation; el stack sintetiza 499 recursos.
- El repositorio no contiene un pipeline automático para el frontend; la publicación requiere los comandos de S3 y CloudFront.
- La compilación local de Python no pudo validarse en el entorno de desarrollo utilizado porque Python no estaba instalado/disponible; CDK sí empaqueta y despliega las Lambdas.

## 13. Límites y consideraciones operativas

- No agregar rutas API innecesarias: el stack está cerca del límite de recursos de CloudFormation.
- Mantener separados el bucket del frontend y el bucket de assets.
- Invalidar CloudFront después de cada publicación del frontend.
- No usar `--delete` contra buckets sin revisar previamente el destino.
- Verificar siempre que el ambiente y las variables Vite correspondan a dev o prod.
- No guardar secretos en el repositorio ni en el bundle del frontend.
- Las operaciones destructivas sobre clientes, proyectos o unidades deben ejecutarse solo con los permisos previstos y después de confirmar el alcance.

## 14. Fuentes de implementación

La información de este documento fue verificada principalmente en:

- `front/src/App.tsx`
- `front/src/pages/`
- `front/src/services/`
- `front/src/types/`
- `lambdas/*/handler.py`
- `lambdas/*/routes/`
- `lambdas/*/utils/`
- `infra/lib/jam-stack.ts`
- `infra/bin/infra.ts`
- `front/package.json`
- `infra/package.json`

Los documentos previos del repositorio no se utilizaron como fuente de verdad para describir funcionalidades.
