# JAM Construcciones

Sistema web para la gestión comercial y operativa de proyectos inmobiliarios de JAM Construcciones.

El sistema permite administrar proyectos y unidades, registrar clientes, controlar bloqueos, dar seguimiento a procesos comerciales, organizar usuarios e inmobiliarias y recibir contactos desde canales digitales. Esta guía explica qué hace el sistema, quién puede usar cada parte y cómo está organizado el código.

## Documentación relacionada

Esta documentación se elaboró revisando el código actual del proyecto y los flujos desplegados.

- [Documentación técnica final](DOCUMENTACION_FINAL.md): explicación orientada a mantenimiento y desarrollo.
- [Guía de usuario](GUIA_USUARIO_JAM_CONSTRUCCIONES.md): explicación paso a paso para usuarios no técnicos.

## 1. ¿Qué problema resuelve?

JAM Construcciones trabaja con proyectos inmobiliarios, unidades disponibles, clientes e inmobiliarias colaboradoras. Sin un sistema centralizado, la información puede quedar repartida entre hojas de cálculo, mensajes y registros manuales.

La aplicación reúne esa información en un solo lugar para que la empresa pueda:

1. Saber qué proyectos y unidades existen.
2. Ver si una unidad está disponible, bloqueada, separada o vendida.
3. Registrar clientes y conservar su historial.
4. Evitar que dos inmobiliarias trabajen al mismo cliente sin autorización.
5. Controlar bloqueos temporales de unidades.
6. Dar seguimiento al avance comercial de cada cliente.
7. Administrar usuarios, inmobiliarias, campañas y tareas.
8. Recibir leads y conversaciones provenientes de Meta.
9. Obtener reportes para apoyar decisiones comerciales.

## 2. Funcionalidades principales

### Proyectos e inventario

El sistema organiza el inventario inmobiliario por proyecto, etapa, edificio o torre y unidad. Una unidad puede tener información como nombre, tipo, precio, superficie, dormitorios, baños y estado comercial.

También existen herramientas para cargar o actualizar grandes cantidades de unidades mediante archivos Excel.

### Clientes

Los usuarios autorizados pueden buscar, registrar, editar y consultar clientes. El registro puede relacionarse con un proyecto, una inmobiliaria y un proceso comercial.

Desde el apartado de Administración, los usuarios internos pueden usar **Añadir cliente** para crear un cliente sin bloquear una unidad. Esto sirve cuando se quiere registrar el contacto antes de que exista una negociación concreta por una propiedad.

### Exclusividad

La exclusividad evita que varias inmobiliarias trabajen al mismo cliente dentro del mismo proyecto durante un periodo determinado. En el código actual, la exclusividad normal dura tres meses.

Si el cliente ya pertenece a otra inmobiliaria, el sistema muestra un aviso. Un usuario `admin` o `coordinador` puede confirmar una excepción cuando corresponda. La excepción no depende solamente del botón visible: el backend vuelve a revisar el rol antes de aceptarla.

### Bloqueos

Un bloqueo reserva temporalmente una unidad para una gestión comercial. Las inmobiliarias deben asociar el bloqueo a un cliente, mientras que los usuarios internos pueden crear bloqueos sin cliente cuando la operación lo requiere.

El sistema evita bloqueos simultáneos sobre la misma unidad. Después de liberar una unidad existe un periodo de espera de 24 horas antes de que pueda volver a bloquearse, según las reglas implementadas.

### Procesos comerciales

El seguimiento comercial permite registrar el avance de un cliente por etapas como captación, reserva, separación, pagos y venta. Cada cambio forma parte del historial del proceso y permite saber qué ocurrió y cuándo.

### Inmobiliarias y usuarios

Los usuarios internos pueden administrar inmobiliarias, usuarios, roles, estados de acceso y relaciones con proyectos. Los permisos se revisan tanto en la pantalla como en la API, para que una persona no pueda obtener permisos solamente modificando la interfaz.

### Campañas, tareas y notificaciones

La plataforma incluye campañas de correo, plantillas, tareas y recordatorios internos. Los envíos y notificaciones se procesan mediante servicios de AWS para que las operaciones pesadas no bloqueen la pantalla.

### Leads y Meta

El sistema puede recibir formularios, leads y conversaciones provenientes de Meta. Los webhooks reciben los eventos y los convierten en registros que pueden continuar dentro del flujo comercial.

### Páginas públicas

Existen rutas públicas para mostrar inventario y recibir datos de personas interesadas sin que esas personas necesiten entrar al panel privado.

## 3. Usuarios y permisos

| Usuario | ¿Qué puede hacer principalmente? |
|---|---|
| `admin` | Administrar el sistema completo, usuarios, inmobiliarias, proyectos, inventario y operaciones especiales. |
| `coordinador` | Gestionar la operación comercial, clientes, procesos, inventario y excepciones de exclusividad autorizadas. |
| `supervisor` | Supervisar clientes, procesos, inventario, campañas y tareas dentro del alcance asignado. |
| `inmobiliaria` | Trabajar con sus proyectos, clientes, bloqueos y procesos comerciales. |

### Regla importante de seguridad

Que un botón aparezca o no en la pantalla no es la única protección. Cada operación importante se valida nuevamente en el backend con el token de autenticación y el rol del usuario.

Por ejemplo, para forzar una exclusividad:

1. El usuario debe tener permiso para iniciar la operación.
2. El sistema identifica si el cliente ya está vinculado a otra inmobiliaria.
3. Se muestra un aviso indicando el conflicto.
4. El usuario debe confirmar expresamente que desea continuar.
5. El backend acepta el bypass únicamente para `admin` o `coordinador`.

Un usuario de tipo `supervisor` o `inmobiliaria` no puede saltarse esta regla aunque intente enviar directamente una petición a la API.

## 4. Flujo de “Añadir cliente”

Este es el flujo incorporado para usuarios internos desde Administración.

1. El usuario entra a **Administración > Clientes**.
2. Selecciona **Añadir cliente**.
3. Completa los datos básicos, como nombre, teléfono, correo, documento y proyecto.
4. El sistema valida que los datos obligatorios estén completos.
5. Se revisa si el cliente ya existe para ese proyecto.
6. Se revisa si tiene exclusividad activa con otra inmobiliaria.
7. Si no existe conflicto, se registra el cliente.
8. Si existe conflicto, se muestra el mensaje de que el usuario pertenece a otra inmobiliaria y que tiene exclusividad activa.
9. Un `admin` o `coordinador` puede confirmar el bypass cuando tenga autorización comercial.
10. El cliente queda registrado sin crear automáticamente un bloqueo, una separación o una venta.

La función de añadir cliente y la función de bloquear una unidad están relacionadas por la regla de exclusividad, pero no son la misma operación.

## 5. Reglas de negocio principales

- Una inmobiliaria debe asociar un cliente cuando crea un bloqueo.
- Los usuarios internos pueden crear bloqueos sin cliente en los casos permitidos por la operación.
- Una unidad no puede tener dos bloqueos activos al mismo tiempo.
- Una unidad liberada conserva una espera de 24 horas antes de aceptar otro bloqueo.
- La exclusividad se controla por cliente y proyecto.
- La exclusividad normal tiene una duración de tres meses.
- Si hay exclusividad activa con otra inmobiliaria, se informa el conflicto antes de continuar.
- Solo `admin` y `coordinador` pueden confirmar un bypass de exclusividad.
- El bypass requiere una confirmación visible y una validación adicional en el backend.
- Añadir un cliente desde Administración no bloquea una unidad.
- Añadir un cliente no crea automáticamente una venta ni una separación.
- Las operaciones de eliminación o modificación sensible requieren permisos específicos.
- Los datos de una inmobiliaria deben respetar el alcance de sus proyectos y clientes.
- Las rutas públicas no deben permitir operaciones privadas de administración.

## 6. ¿Cómo está hecho el sistema?

El proyecto está dividido en tres partes principales:

```text
front/       Pantalla web que utilizan los usuarios.
lambdas/     Código del servidor y reglas del negocio.
infra/       Definición de los servicios de AWS y sus permisos.
scripts/     Herramientas auxiliares de mantenimiento.
```

### Frontend

Está construido con React, TypeScript, Vite y Ant Design. Aquí se encuentran las pantallas, formularios, botones, tablas, validaciones visuales y llamadas a la API.

Archivos relevantes para clientes:

- `front/src/pages/clientes/ClientesPage.tsx`: pantalla de clientes y formulario de **Añadir cliente**.
- `front/src/services/clientes.service.ts`: funciones que envían las solicitudes de clientes al backend.
- `front/src/pages/`: pantallas agrupadas por módulo.
- `front/src/services/`: comunicación organizada con las APIs.

### Backend

Está construido con funciones AWS Lambda en Python. El backend recibe solicitudes, identifica al usuario, valida permisos, ejecuta las reglas del negocio y devuelve una respuesta al frontend.

Archivos relevantes para clientes:

- `lambdas/jam-captacion/handler.py`: punto de entrada que dirige cada solicitud a la operación correspondiente.
- `lambdas/jam-captacion/routes/clientes.py`: validaciones y operaciones de clientes, exclusividad y registro administrativo.

### Infraestructura

Está definida con AWS CDK en TypeScript. La infraestructura crea y conecta los recursos de AWS, como APIs, funciones, tablas, buckets, colas y distribución web.

- `infra/lib/jam-stack.ts`: definición principal del stack de JAM Construcciones.
- La infraestructura usa Amazon API Gateway, Lambda, DynamoDB, S3, CloudFront, Cognito, SQS, SES, EventBridge Scheduler y Step Functions.

## 7. Lambdas principales

| Lambda | Responsabilidad |
|---|---|
| `jam-auth` | Inicio de sesión, MFA, usuarios e inmobiliarias. |
| `jam-proyectos` | Proyectos, etapas, torres, unidades e importación de Excel. |
| `jam-captacion` | Clientes, captación y exclusividad. |
| `jam-bloqueos` | Creación, liberación e historial de bloqueos. |
| `jam-crm` | Procesos comerciales, estados, historial, analítica y CRM de Meta. |
| `jam-transferir-cliente` | Transferencias y cambios de documento del cliente. |
| `jam-campanias` | Campañas, plantillas y envíos. |
| `jam-tareas` | Tareas, trabajadores y recordatorios. |
| `jam-meta-webhooks` | Recepción de eventos de Meta. |
| `jam-notificaciones` | Procesamiento de correos y notificaciones. |

## 8. Servicios de AWS utilizados

- **Amazon Cognito:** inicio de sesión, tokens y control de identidad.
- **Amazon API Gateway:** entrada pública de la API.
- **AWS Lambda:** ejecución del backend sin mantener servidores propios.
- **Amazon DynamoDB:** almacenamiento de clientes, proyectos, unidades, procesos y configuraciones.
- **Amazon S3:** archivos del frontend y archivos cargados por los usuarios.
- **Amazon CloudFront:** entrega rápida del frontend.
- **Amazon SQS:** cola para notificaciones y tareas que pueden ejecutarse después.
- **Amazon SES:** envío de correos.
- **EventBridge Scheduler:** ejecuciones programadas, como liberaciones o recordatorios.
- **AWS Step Functions:** procesos largos o divididos en varios pasos.
- **Meta Graph API:** integración con formularios, leads y conversaciones.
- **Amazon Bedrock:** funcionalidades de inteligencia artificial integradas al sistema.

## 9. API y rutas principales

La API se publica bajo `/api` y requiere un token de Cognito para las operaciones privadas.

| Grupo | Uso |
|---|---|
| `/auth` | Autenticación y operaciones de acceso. |
| `/proyectos` | Consulta y gestión de proyectos e inventario. |
| `/clientes` | Operaciones de clientes. |
| `/bloqueos` | Bloqueos y liberaciones de unidades. |
| `/mis-procesos` | Procesos comerciales del usuario. |
| `/admin/clientes` | Administración interna de clientes. |
| `/admin/proyectos` | Administración interna de proyectos. |
| `/admin/inventario` | Gestión interna de unidades. |
| `/admin/inmobiliarias` | Gestión de inmobiliarias. |
| `/admin/sistema/usuarios` | Gestión de usuarios y roles. |
| `/admin/campanias` | Campañas y plantillas. |
| `/admin/tareas` | Tareas y recordatorios. |
| `/admin/analytics` | Reportes y analítica. |
| `/webhooks/meta` | Recepción de eventos externos de Meta. |
| `/publico/*` | Formularios y consultas públicas. |

## 10. Ambientes publicados

| Ambiente | Stack CDK | Frontend | API |
|---|---|---|---|
| Dev | `JamConstrucciones` | https://d12nm0khvt8zd9.cloudfront.net | https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/ |
| Prod | `JamConstruccionesProd` | https://dcgjiswnwqab6.cloudfront.net | https://7lltvhwiu7.execute-api.us-east-1.amazonaws.com/api/ |

**Dev** se utiliza para comprobar cambios antes de llevarlos al ambiente real. **Prod** es el ambiente utilizado por la operación final, por lo que cualquier despliegue allí debe revisarse con más cuidado.

## 11. Requisitos para trabajar localmente

- Node.js y npm.
- Dependencias instaladas en `front` e `infra`.
- AWS CLI configurado.
- Permisos de AWS para el ambiente que se quiere consultar o desplegar.
- Variables de configuración en los archivos `.env` correspondientes.

Instalación inicial:

```powershell
cd front
npm.cmd install

cd ..\infra
npm.cmd install
```

## 12. Ejecutar y validar el frontend

Para levantar el frontend localmente:

```powershell
cd front
npm.cmd run dev
```

Para generar una compilación de desarrollo:

```powershell
cd front
npm.cmd run build
```

Para generar una compilación de producción:

```powershell
cd front
npm.cmd run build:prod
```

Para validar la infraestructura:

```powershell
cd infra
npm.cmd run build
```

Los archivos `.env` y `.env.production` indican al frontend a qué API, Cognito y ambiente debe conectarse. No deben contener secretos que se quieran guardar en el repositorio.

## 13. Despliegue de infraestructura

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

Antes de ejecutar un despliegue se debe confirmar el ambiente, revisar el cambio y validar que las variables apunten a la cuenta correcta.

## 14. Publicar el frontend

El frontend se publica en dos ubicaciones: una para los archivos principales y otra para `/assets/*`. Por eso no se debe subir todo `dist/` al bucket principal sin excluir la carpeta de assets.

### Publicar en Dev

```powershell
cd front
npm.cmd run build
aws s3 sync dist/ s3://jam-frontend-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id E1WI58DFYF9AST --paths "/*"
```

### Publicar en Prod

```powershell
cd front
npm.cmd run build:prod
aws s3 sync dist/ s3://jam-frontend-prod-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-prod-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id EQD4J2QTY0PV8 --paths "/*"
```

### Buckets

| Ambiente | Archivos principales | Assets |
|---|---|---|
| Dev | `jam-frontend-479324457361` | `jam-assets-479324457361` |
| Prod | `jam-frontend-prod-479324457361` | `jam-assets-prod-479324457361` |

La invalidación de CloudFront permite que el navegador empiece a recibir la versión nueva. Si se omite, algunos usuarios podrían seguir viendo archivos antiguos durante un tiempo.

## 15. Recomendaciones de operación

- Probar los cambios en Dev antes de publicar en Prod.
- Confirmar que se está usando la cuenta y el stack correctos.
- Revisar el rol del usuario cuando se prueben permisos o exclusividad.
- Probar tanto un caso normal como un caso con cliente perteneciente a otra inmobiliaria.
- No guardar contraseñas, tokens ni claves privadas en el repositorio.
- No eliminar datos directamente sin verificar el proyecto, cliente o unidad afectada.
- Revisar los logs de Lambda y API Gateway si una operación no termina correctamente.
- Invalidar CloudFront después de publicar cambios del frontend.
- Tener presente que la infraestructura está cerca del límite de recursos de CloudFormation.

## 16. Casos de prueba recomendados

Para comprobar el flujo de clientes y exclusividad se recomienda probar:

1. Crear un cliente nuevo desde Administración.
2. Intentar crear el mismo cliente dos veces en el mismo proyecto.
3. Crear un cliente que no tenga exclusividad activa.
4. Crear un cliente que pertenezca a otra inmobiliaria y verificar el aviso.
5. Confirmar el bypass con un usuario `admin`.
6. Confirmar el bypass con un usuario `coordinador`.
7. Intentar el bypass con un usuario `supervisor` o `inmobiliaria` y confirmar que sea rechazado.
8. Verificar que añadir cliente no cree un bloqueo ni una venta.
9. Crear un bloqueo y comprobar que una segunda inmobiliaria no pueda bloquear la misma unidad.
10. Liberar una unidad y comprobar la espera de 24 horas.

## Estado actual

La versión documentada incluye el flujo de **Añadir cliente** desde Administración, el control de exclusividad con aviso de conflicto, el bypass autorizado para `admin` y `coordinador`, la guía de usuario y la documentación técnica final. El frontend y la infraestructura se encuentran publicados en los ambientes Dev y Prod indicados arriba.
