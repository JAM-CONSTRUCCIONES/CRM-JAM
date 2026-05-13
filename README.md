# JAM Construcciones — Sistema de Gestión Inmobiliaria

Stack serverless en AWS (CDK) con frontend React + Vite, Lambdas Python, DynamoDB, Cognito, SQS y CloudFront.

---

## Ambientes

| Ambiente | Stack CDK | API | CloudFront | Frontend Bucket |
|----------|-----------|-----|------------|-----------------|
| **Dev** | `JamConstrucciones` | `https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api` | `d12nm0khvt8zd9.cloudfront.net` | `jam-frontend-479324457361` |
| **Prod** | `JamConstruccionesProd` | `https://7lltvhwiu7.execute-api.us-east-1.amazonaws.com/api` | `dcgjiswnwqab6.cloudfront.net` | `jam-frontend-prod-479324457361` |

---

## Cambios recientes — Mayo 2026

### Nuevo stack de producción (`JamConstruccionesProd`)
Se creó un stack CDK independiente para producción. Todos los recursos tienen el sufijo `-prod` para coexistir con el stack de dev sin conflictos.

Recursos prod creados:
- **Cognito**: `jam-user-pool-prod` — User Pool ID: `us-east-1_LanuU6JeX`
- **DynamoDB**: `jam-usuarios-prod`, `jam-inventario-prod`, `jam-clientes-prod`, `jam-procesos-prod`, `jam-historial-bloqueos-prod`, `jam-historial-estatus-prod`
- **Lambdas**: `jam-auth-prod`, `jam-proyectos-prod`, `jam-bloqueos-prod`, `jam-captacion-prod`, `jam-crm-prod`, `jam-notificaciones-prod`, `jam-excel-parser-prod`, `jam-transferir-cliente-prod`, `jam-iniciar-transferencia-prod`
- **SQS**: `jam-notificaciones-queue-prod`, `jam-notificaciones-dlq-prod`
- **S3**: `jam-frontend-prod-479324457361`, `jam-assets-prod-479324457361`, `jam-archivos-prod-479324457361`
- **Backup**: `jam-backup-vault-prod`, `jam-backup-plan-prod`
- **Step Function**: `jam-transferir-cliente-workflow-prod`
- **IAM Role**: `jam-scheduler-role-prod`

### Correo de notificaciones actualizado
`ADMIN_EMAIL` y `FROM_EMAIL` cambiados a `Venta@jamconstruccionesrl.com` en la lambda `jam-notificaciones-prod`.

### Usuario admin prod creado
- **Username**: `jalvarez_methodica`
- **Rol**: `admin`
- **Cognito sub**: `c4d83478-7021-701a-f230-23e778091398`
- Registro creado en `jam-usuarios-prod` vía `scripts/admin-user.json`

---

## Cambiar entre ambientes

### Apuntar a Dev
`infra/bin/infra.ts`:
```typescript
new JamStack(app, 'JamConstrucciones', { ... })
```
`front/.env`:
```env
VITE_API_URL=https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api
VITE_COGNITO_USER_POOL_ID=us-east-1_eHBrqYp0h
VITE_COGNITO_CLIENT_ID=72bh2oh1cma6jgludq9eck6g4h
VITE_AWS_REGION=us-east-1
VITE_STAGE=dev
```

### Apuntar a Prod
`infra/bin/infra.ts`:
```typescript
new JamStack(app, 'JamConstruccionesProd', { ... })
```
`front/.env`:
```env
VITE_API_URL=https://7lltvhwiu7.execute-api.us-east-1.amazonaws.com/api
VITE_COGNITO_USER_POOL_ID=us-east-1_LanuU6JeX
VITE_COGNITO_CLIENT_ID=24jo1ts9lhflo9g449fdrb22k
VITE_AWS_REGION=us-east-1
VITE_STAGE=prod
```

---

## Deploy

### Infra
```bash
cd infra
cdk deploy
```

### Frontend
```bash
# 1. Build
cd front
npm run build

# 2. Subir index.html y archivos raíz (sin caché)
aws s3 sync dist/ s3://<FRONTEND_BUCKET>/ --exclude "assets/*" --cache-control "no-cache"

# 3. Subir assets (con caché larga)
aws s3 sync dist/assets/ s3://<ASSETS_BUCKET>/assets/ --cache-control "public, max-age=31536000, immutable"

# 4. Invalidar CloudFront
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

#### Buckets y distribuciones por ambiente

| Ambiente | Frontend Bucket | Assets Bucket | CloudFront ID |
|----------|----------------|---------------|---------------|
| Dev | `jam-frontend-479324457361` | `jam-assets-479324457361` | `E1WI58DFYF9AST` |
| Prod | `jam-frontend-prod-479324457361` | `jam-assets-prod-479324457361` | Ver con `aws cloudfront list-distributions` |

---

## Crear usuario admin (Cognito + DynamoDB)

```powershell
# 1. Crear en Cognito
aws cognito-idp admin-create-user --user-pool-id <USER_POOL_ID> --username <USERNAME> --temporary-password "Temp123!" --message-action SUPPRESS

# 2. Contraseña permanente
aws cognito-idp admin-set-user-password --user-pool-id <USER_POOL_ID> --username <USERNAME> --password "<PASSWORD>" --permanent

# 3. Agregar al grupo admin
aws cognito-idp admin-add-user-to-group --user-pool-id <USER_POOL_ID> --username <USERNAME> --group-name admin

# 4. Obtener sub
aws cognito-idp admin-get-user --user-pool-id <USER_POOL_ID> --username <USERNAME> --query "UserAttributes[?Name=='sub'].Value" --output text

# 5. Crear registro en DynamoDB (editar scripts/admin-user.json con el sub obtenido)
aws dynamodb put-item --table-name <USUARIOS_TABLE> --region us-east-1 --item file://C:/Users/Andre/Documents/GitHub/JAM-Construcciones/scripts/admin-user.json
```

> El registro en DynamoDB es obligatorio. El endpoint `/me` lo busca por `USUARIO#{sub}` y si no existe el frontend no deja pasar.
