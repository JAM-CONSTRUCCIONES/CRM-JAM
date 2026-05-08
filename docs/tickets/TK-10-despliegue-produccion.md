# TK-10 - Despliegue a producción y acompañamiento de salida

## Objetivo

Publicar el sistema en ambiente productivo con validación final operativa,
revisión de accesos y acompañamiento inicial posterior al despliegue.

---

## Alcance

- Configuración del ambiente `prod` en AWS
- Despliegue de infraestructura (CDK), backend (Lambdas) y frontend (S3 + CloudFront)
- Verificación de accesos y flujos principales en producción
- Soporte inicial controlado post-despliegue

---

## Orden de despliegue

```
1. Infraestructura base (CDK)
   └→ Cognito User Pool prod
   └→ DynamoDB tablas prod
   └→ SQS + DLQ prod
   └→ S3 buckets prod
   └→ EventBridge rules prod

2. Backend (Lambdas)
   └→ jam-auth
   └→ jam-proyectos
   └→ jam-captacion
   └→ jam-bloqueos
   └→ jam-crm
   └→ jam-reportes

3. API Gateway
   └→ Cognito Authorizer apuntando a User Pool prod
   └→ Variables de entorno por stage

4. Frontend
   └→ Build de producción (vite build)
   └→ Upload a S3 prod
   └→ Invalidación de caché en CloudFront
```

---

## Configuración de ambiente prod

### Variables de entorno por Lambda
| Variable | Descripción |
|----------|-------------|
| `STAGE` | `prod` |
| `DYNAMODB_TABLE_INVENTARIO` | `jam-inventario-prod` |
| `DYNAMODB_TABLE_CLIENTES` | `jam-clientes-prod` |
| `DYNAMODB_TABLE_USUARIOS` | `jam-usuarios-prod` |
| `DYNAMODB_TABLE_AUDITORIA` | `jam-auditoria-prod` |
| `SQS_NOTIFICACIONES_URL` | URL de la cola prod |
| `COGNITO_USER_POOL_ID` | ID del User Pool prod |
| `EMAIL_PROVIDER_API_KEY` | API key de Resend u otro |
| `KOMMO_API_KEY` | API key de Kommo prod |

### Frontend (`.env.production`)
| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del API Gateway prod |
| `VITE_COGNITO_USER_POOL_ID` | User Pool prod |
| `VITE_COGNITO_CLIENT_ID` | App Client prod |
| `VITE_REGION` | Región AWS |

---

## Usuarios iniciales de producción

| Tipo | Acción |
|------|--------|
| Admin JAM | Crear en Cognito prod, asignar grupo `admin` |
| Inmobiliarias piloto | Crear en `jam-inmobiliarias`, crear usuario Cognito, asignar proyectos |

---

## Verificación post-despliegue

### Accesos
- [ ] Admin puede iniciar sesión en producción
- [ ] Inmobiliaria piloto puede iniciar sesión
- [ ] Rutas protegidas no accesibles sin token
- [ ] Inmobiliaria solo ve proyectos asignados

### Flujos críticos (smoke test)
- [ ] Consulta de inventario carga correctamente
- [ ] Filtros por proyecto, etapa y estado funcionan
- [ ] Bloqueo de unidad exitoso
- [ ] Intento de doble bloqueo rechazado
- [ ] Registro de cliente captado
- [ ] Cambio de estatus con notificación
- [ ] Email de bloqueo recibido correctamente

### Infraestructura
- [ ] CloudFront sirve el frontend sin errores
- [ ] API Gateway responde en menos de 2s en endpoints principales
- [ ] DLQ vacía tras smoke test (sin mensajes fallidos)
- [ ] Logs de Lambda visibles en CloudWatch

---

## Plan de soporte inicial

| Período | Acción |
|---------|--------|
| Día 1 | Acompañamiento en tiempo real durante primeras operaciones |
| Días 2-3 | Revisión de logs y DLQ, atención a incidentes reportados |
| Semana 1 | Corrección de bugs críticos detectados en producción |

### Canal de reporte de incidentes
- Definir canal directo (WhatsApp, email o ticket) entre JAM y el equipo técnico
- Clasificar incidentes por severidad antes de escalar

---

## Rollback

Si se detecta un error crítico post-despliegue:

1. Revertir CloudFront al build anterior (S3 versioning)
2. Revertir Lambdas a versión anterior (CDK deploy con tag anterior)
3. Las tablas DynamoDB no se revierten (datos de producción se preservan)
4. Notificar a usuarios del incidente y tiempo estimado de resolución

---

## Criterios de aceptación

- [ ] Sistema accesible en producción desde URL de CloudFront
- [ ] Admin e inmobiliarias piloto pueden ingresar correctamente
- [ ] Smoke test de flujos principales completado sin errores bloqueantes
- [ ] Logs activos en CloudWatch para todas las Lambdas
- [ ] DLQ sin mensajes fallidos tras verificación inicial
- [ ] Salida documentada y validada por el equipo de JAM

---

## Notas técnicas

- Nunca usar las credenciales de `dev` en `prod`
- El build del frontend debe hacerse con `vite build --mode production`
- Invalidación de CloudFront obligatoria tras cada deploy de frontend: `aws cloudfront create-invalidation --paths "/*"`
- Depende de: TK-09 (QA completado y aprobado)
