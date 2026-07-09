# Deploy dev/prod

## Ramas

- `master`: rama actual de trabajo.
- `DESORROLLO`: rama remota/local usada como referencia de desarrollo.
- `PRODUCCION`: rama remota/local usada como referencia de produccion.

El repositorio no tiene un pipeline automatico detectado. El deploy se hace manualmente con CDK, S3 y CloudFront.

## Ambientes

| Ambiente | Stack CDK | Frontend bucket | Assets bucket | CloudFront | CloudFront ID |
| --- | --- | --- | --- | --- | --- |
| Dev | `JamConstrucciones` | `jam-frontend-479324457361` | `jam-assets-479324457361` | `d12nm0khvt8zd9.cloudfront.net` | `E1WI58DFYF9AST` |
| Prod | `JamConstruccionesProd` | `jam-frontend-prod-479324457361` | `jam-assets-prod-479324457361` | `dcgjiswnwqab6.cloudfront.net` | `EQD4J2QTY0PV8` |

## Frontend env

Dev:

```env
VITE_API_URL=https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api
VITE_COGNITO_USER_POOL_ID=us-east-1_eHBrqYp0h
VITE_COGNITO_CLIENT_ID=72bh2oh1cma6jgludq9eck6g4h
VITE_AWS_REGION=us-east-1
VITE_STAGE=dev
```

Prod:

```env
VITE_API_URL=https://7lltvhwiu7.execute-api.us-east-1.amazonaws.com/api
VITE_COGNITO_USER_POOL_ID=us-east-1_LanuU6JeX
VITE_COGNITO_CLIENT_ID=24jo1ts9lhflo9g449fdrb22k
VITE_AWS_REGION=us-east-1
VITE_STAGE=prod
```

## Deploy backend/infra

Dev:

```powershell
cd infra
$env:CDK_DEFAULT_ACCOUNT='479324457361'
$env:CDK_DEFAULT_REGION='us-east-1'
npm.cmd run cdk -- deploy JamConstrucciones -c stage=dev --require-approval never
```

Prod:

```powershell
cd infra
$env:CDK_DEFAULT_ACCOUNT='479324457361'
$env:CDK_DEFAULT_REGION='us-east-1'
npm.cmd run cdk -- deploy JamConstruccionesProd -c stage=prod --require-approval never
```

## Deploy frontend

Dev:

```powershell
cd front
npm.cmd run build
aws s3 sync dist/ s3://jam-frontend-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id E1WI58DFYF9AST --paths "/*"
```

Prod:

```powershell
cd front
npm.cmd run build
aws s3 sync dist/ s3://jam-frontend-prod-479324457361/ --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets/ s3://jam-assets-prod-479324457361/assets/ --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id EQD4J2QTY0PV8 --paths "/*"
```

## Nota

CloudFront sirve `/assets/*` desde el bucket de assets. Por eso `dist/` y `dist/assets/` se sincronizan por separado con politicas de cache distintas.
