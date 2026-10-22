# JAM Construcciones

Sistema de gestión inmobiliaria para administrar proyectos, inventario, clientes, bloqueos, procesos comerciales, inmobiliarias, usuarios, tareas, campañas, reportes y conversaciones provenientes de Meta.

## Documentación

- [Documentación técnica final](DOCUMENTACION_FINAL.md)
- [Guía sencilla para usuarios](GUIA_USUARIO_JAM_CONSTRUCCIONES.md)

## Funcionalidades principales

- Administración de proyectos, etapas, edificios y unidades.
- Consulta y mantenimiento del inventario inmobiliario.
- Bloqueos temporales de unidades con liberación automática.
- Registro, búsqueda, edición, transferencia y eliminación de clientes.
- Control de exclusividad por cliente y proyecto.
- Procesos comerciales: captación, reserva, separación, pagos y venta.
- Migración masiva de inventario y clientes desde Excel.
- Reportes y analítica comercial.
- Gestión de inmobiliarias y usuarios.
- Campañas de correo y plantillas.
- Tareas y recordatorios internos.
- Leads, formularios y conversaciones de Meta.
- Páginas públicas de captura e inventario.

## Roles

| Rol | Alcance |
|---|---|
| `admin` | Administración completa del sistema y operaciones especiales. |
| `coordinador` | Administración operativa y seguimiento comercial. |
| `supervisor` | Supervisión de clientes, procesos, inventario, campañas y tareas. |
| `inmobiliaria` | Trabajo con sus proyectos, clientes, bloqueos y procesos. |

Los permisos se controlan en la interfaz y se vuelven a validar en el backend.

## Arquitectura

- Frontend: React, TypeScript, Vite y Ant Design.
- API: Amazon API Gateway.
- Autenticación: Amazon Cognito con MFA opcional.
- Backend: AWS Lambda con Python.
- Base de datos: Amazon DynamoDB.
- Archivos y frontend: Amazon S3.
- Distribución web: Amazon CloudFront.
- Notificaciones: Amazon SQS, SES y EventBridge Scheduler.
- Procesos largos: AWS Step Functions.
- Integraciones: Meta Graph API y Amazon Bedrock.

## Estructura del proyecto

```text
front/       Aplicación web React/Vite.
lambdas/     Funciones Lambda y lógica de negocio Python.
infra/       Infraestructura AWS definida con CDK.
scripts/     Scripts operativos y de mantenimiento.
```

### Lambdas principales

| Lambda | Función |
|---|---|
| `jam-auth` | Autenticación, MFA, usuarios e inmobiliarias. |
| `jam-proyectos` | Proyectos, etapas, torres, unidades y Excel. |
| `jam-captacion` | Clientes, captación y exclusividad. |
| `jam-bloqueos` | Bloqueos, liberaciones y su historial. |
| `jam-crm` | Procesos, estatus, historial, analítica y Meta CRM. |
| `jam-transferir-cliente` | Transferencias y cambio de cédula. |
| `jam-campanias` | Campañas, plantillas y envíos. |
| `jam-tareas` | Tareas, trabajadores y recordatorios. |
| `jam-meta-webhooks` | Webhooks y eventos de Meta. |
| `jam-notificaciones` | Correos enviados desde la cola de notificaciones. |

## Ambientes

| Ambiente | Stack CDK | Frontend | API |
|---|---|---|---|
| Dev | `JamConstrucciones` | https://d12nm0khvt8zd9.cloudfront.net | https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/ |
| Prod | `JamConstruccionesProd` | https://dcgjiswnwqab6.cloudfront.net | https://7lltvhwiu7.execute-api.us-east-1.amazonaws.com/api/ |

## Requisitos locales

- Node.js y npm.
- Dependencias instaladas en `front` e `infra`.
- AWS CLI configurado con permisos para el ambiente correspondiente.
- CDK instalado localmente como dependencia de `infra`.

Instalar dependencias:

```powershell
cd front
npm.cmd install

cd ..\infra
npm.cmd install
```

## Ejecutar el frontend localmente

```powershell
cd front
npm.cmd run dev
```

La configuración de API, Cognito, región y ambiente se obtiene de los archivos `.env` y `.env.production`.

## Validar el proyecto

Frontend de desarrollo:

```powershell
cd front
npm.cmd run build
```

Frontend de producción:

```powershell
cd front
npm.cmd run build:prod
```

Infraestructura:

```powershell
cd infra
npm.cmd run build
```

## Desplegar infraestructura

### Dev

```powershell
cd infra
$env:CDK_DEFAULT_ACCOUNT='479324457361'
$env:CDK_DEFAULT_REGION='us-east-1'
npm.cmd run cdk -- deploy JamConstrucciones -c stage=dev --require-approval never
```

### Prod

```powershell
cd infra
$env:CDK_DEFAULT_ACCOUNT='479324457361'
$env:CDK_DEFAULT_REGION='us-east-1'
npm.cmd run cdk -- deploy JamConstruccionesProd -c stage=prod --require-approval never
```

## Publicar el frontend

El frontend se publica separando los archivos principales de los assets porque CloudFront sirve `/assets/*` desde un bucket diferente.

### Dev

```powershell
cd front
npm.cmd run build
aws s3 sync dist/ s3://jam-frontend-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id E1WI58DFYF9AST --paths "/*"
```

### Prod

```powershell
cd front
npm.cmd run build:prod
aws s3 sync dist/ s3://jam-frontend-prod-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-prod-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id EQD4J2QTY0PV8 --paths "/*"
```

### Buckets

| Ambiente | Frontend | Assets |
|---|---|---|
| Dev | `jam-frontend-479324457361` | `jam-assets-479324457361` |
| Prod | `jam-frontend-prod-479324457361` | `jam-assets-prod-479324457361` |

No se debe subir `dist/` completo al bucket principal sin excluir `assets/*`.

## Reglas de negocio importantes

- Las inmobiliarias deben crear bloqueos con cliente.
- Los usuarios internos pueden crear bloqueos temporales sin cliente.
- Una unidad no puede ser bloqueada simultáneamente por dos inmobiliarias.
- Después de liberar una unidad existe una espera de 24 horas antes de volver a bloquearla.
- La exclusividad se aplica por cliente y proyecto durante tres meses.
- `admin` y `coordinador` pueden confirmar un bypass de exclusividad.
- El bypass siempre requiere confirmación en la interfaz y validación del rol en el backend.
- Añadir un cliente desde Administración no bloquea una unidad ni crea automáticamente una venta.
- Las operaciones destructivas requieren permisos específicos.

## API principal

La API se publica bajo `/api` y utiliza tokens de Cognito.

Familias principales de rutas:

- `/auth`
- `/proyectos`
- `/clientes`
- `/bloqueos`
- `/mis-procesos`
- `/admin/clientes`
- `/admin/proyectos`
- `/admin/inventario`
- `/admin/inmobiliarias`
- `/admin/sistema/usuarios`
- `/admin/campanias`
- `/admin/tareas`
- `/admin/analytics`
- `/admin/meta-*`
- `/webhooks/meta`
- `/publico/*`

## Consideraciones operativas

- El frontend no se publica automáticamente mediante CDK.
- Siempre se debe invalidar CloudFront después de publicar cambios del frontend.
- La infraestructura está cerca del límite de recursos de CloudFormation.
- Se debe verificar el ambiente antes de ejecutar comandos de despliegue.
- No guardar contraseñas, tokens ni secretos en el repositorio.
- Revisar cuidadosamente los comandos que modifiquen o eliminen datos.

## Estado actual

La versión actual se encuentra desplegada en dev y prod, incluyendo el flujo de **Añadir cliente** desde Administración, la confirmación de exclusividad y el bypass autorizado para usuarios `admin` y `coordinador`.
