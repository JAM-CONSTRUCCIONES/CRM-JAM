# JAM Construcciones — CRM Inmobiliario

Sistema de gestión comercial e inventario para JAM Construcciones. Permite administrar proyectos inmobiliarios con múltiples inmobiliarias, controlar bloqueos de unidades en tiempo real, registrar clientes con exclusividad, automatizar notificaciones y generar métricas comerciales.

---

## ⚠️ ADVERTENCIA CRÍTICA: Bucket S3 de Assets

**NUNCA uses el flag `--delete` al sincronizar assets del frontend con S3.**

El bucket `jam-assets-479324457361` contiene:
- Assets del frontend (JS, CSS) en `assets/`
- **Imágenes de proyectos** en `assets/proyectos/` (subidas por usuarios)
- **Imágenes de inmobiliarias** en `assets/inmobiliarias/` (subidas por usuarios)

Si usas `aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ --delete`, **borrarás todas las imágenes de proyectos e inmobiliarias** porque no existen en `dist/assets/`.

✅ **Comando correcto:**
```bash
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ \
  --cache-control "public, max-age=31536000, immutable"
```

❌ **NUNCA uses:**
```bash
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ --delete  # ¡BORRA IMÁGENES!
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 8 + Ant Design 6 + TypeScript |
| Autenticación | Amazon Cognito + AWS Amplify 6 |
| API | API Gateway REST + Cognito Authorizer |
| Backend | Python 3.12 en AWS Lambda |
| Base de datos | DynamoDB (Single Table Design + GSIs) |
| Mensajería | SQS + EventBridge Scheduler |
| Email | AWS SES (`Venta@jamconstruccionesrl.com`) |
| Almacenamiento | S3 (frontend + assets) |
| CDN | CloudFront |
| Infraestructura | AWS CDK (TypeScript) |
| Asistente IA | Lambda URL (chatbot CRM) |

---

## Estructura del repositorio

```
/
├── front/                  # React + Vite (frontend)
│   ├── src/
│   │   ├── components/     # Componentes reutilizables y de layout
│   │   ├── pages/          # Páginas por módulo
│   │   ├── services/       # Clientes HTTP (Amplify API)
│   │   ├── hooks/          # Custom hooks (useAuth, useInventario)
│   │   ├── context/        # AuthContext
│   │   ├── types/          # Tipos TypeScript
│   │   └── constants/      # Estados, enums
│   └── .env                # Variables de entorno (Cognito, API URL)
│
├── lambdas/                # Funciones Lambda (Python 3.12)
│   ├── jam-auth/           # Login, MFA, gestión de usuarios e inmobiliarias
│   ├── jam-proyectos/      # Proyectos, etapas, unidades, inventario
│   ├── jam-bloqueos/       # Bloqueos 48h, liberación automática, historial
│   ├── jam-captacion/      # Registro de clientes, exclusividad, procesos
│   ├── jam-crm/            # Estatus comerciales, historial de cambios
│   ├── jam-notificaciones/ # Consumidor SQS → envío de emails vía SES
│   ├── jam-excel-parser/   # Carga masiva de inventario desde .xlsx
│   ├── jam-pre-auth/       # Trigger Cognito pre-autenticación
│   └── jam-captacion-inspect/ # Inspección de captaciones
│
├── infra/                  # AWS CDK (TypeScript)
│   └── lib/jam-stack.ts    # Stack principal con toda la infraestructura
│
└── docs/                   # Documentación del proyecto
    ├── tickets/            # Tickets de desarrollo (TK-00 al TK-18)
    ├── informes/           # Informes técnicos y de cambios
    └── Exels/              # Archivos de nomenclatura e inventario
```

---

## Módulos del sistema

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| Autenticación | Login, MFA TOTP, roles, sesión 8h | ✅ Activo |
| Gestión de usuarios | CRUD usuarios del sistema e inmobiliarias | ✅ Activo |
| Inventario | Proyectos, etapas, torres, unidades con filtros | ✅ Activo |
| Bloqueos | Bloqueo 48h, liberación automática, historial | ✅ Activo |
| Captación de clientes | Registro, exclusividad 3 meses por proyecto | ✅ Activo |
| Procesos de venta | Flujo captación → reserva → separación → inicial | ✅ Activo |
| Estatus CRM | Cambio de estatus con historial y notificaciones | ✅ Activo |
| Notificaciones email | SQS → Lambda → SES en eventos clave | ✅ Activo |
| Carga Excel | Importación masiva de inventario desde .xlsx | ✅ Activo |
| Dashboard | Métricas y KPIs comerciales con gráficas | ✅ Activo |
| Asistente IA | Chatbot integrado en sidebar del CRM | ✅ Activo |
| Enlace de captura | URL pública para registro de clientes por inmobiliaria | ✅ Activo |

---

## Roles de usuario

| Rol | Descripción |
|-----|-------------|
| `admin` | Control total: usuarios, proyectos, bloqueos, clientes, analytics |
| `coordinador` | Acceso operativo + migración Excel |
| `supervisor` | Acceso a inventario, clientes y reportes |
| `inmobiliaria` | Acceso limitado a proyectos asignados, registro de clientes y bloqueos |

Los usuarios de inmobiliaria usan alias (ej: "Vendedor1"), no correo personal. Cada inmobiliaria puede tener múltiples correos para notificaciones.

---

## Infraestructura AWS

```
CloudFront (E1WI58DFYF9AST)
    └── S3 jam-frontend-479324457361  (index.html, no-cache)
    └── S3 jam-assets-479324457361    (JS/CSS, cache 1 año)
              ↓
        API Gateway REST (jam-api)
        + Cognito Authorizer (jam-user-pool)
              ↓
    ┌─────────┬──────────┬───────────┬─────────┐
 jam-auth  jam-proy  jam-bloqueos  jam-cap  jam-crm
    │          │           │           │        │
    └──────────┴───────────┴───────────┴────────┘
                        DynamoDB
              ┌──────────────────────────────┐
              │ jam-usuarios                 │
              │ jam-inventario               │
              │ jam-clientes                 │
              │ jam-procesos                 │
              │ jam-historial-bloqueos       │
              │ jam-historial-estatus        │
              └──────────────────────────────┘
                           ↓
                    SQS jam-notificaciones-queue
                    (DLQ: jam-notificaciones-dlq)
                           ↓
                  Lambda jam-notificaciones
                           ↓
                       AWS SES
                  Venta@jamconstruccionesrl.com

              EventBridge Scheduler
              (liberación 48h, alerta 43h, vencimiento exclusividad)
```

---

## DynamoDB — Tablas y GSIs

| Tabla | GSIs |
|-------|------|
| `jam-usuarios` | `gsi-tipo`, `gsi-por-inmobiliaria` |
| `jam-inventario` | `gsi-tipo`, `gsi-estado`, `gsi-inmobiliaria`, `gsi-proyecto-id-unidad` |
| `jam-clientes` | `gsi-inmobiliaria-clientes`, `gsi-proyecto-clientes`, `gsi-cedula-proyecto` |
| `jam-procesos` | `gsi-cedula-procesos`, `gsi-proyecto-procesos`, `gsi-inmobiliaria-procesos` |
| `jam-historial-bloqueos` | — |
| `jam-historial-estatus` | — |

Todas las tablas usan `pk` + `sk` como clave compuesta y `BillingMode.PAY_PER_REQUEST`. Política de retención: `RETAIN` (no se eliminan al destruir el stack).

---

## API Gateway — Endpoints principales

| Método | Ruta | Lambda | Auth |
|--------|------|--------|------|
| POST | `/auth/login` | jam-auth | Pública |
| POST | `/auth/confirm-mfa` | jam-auth | Pública |
| GET | `/auth/me` | jam-auth | Cognito |
| POST | `/auth/mfa/setup` | jam-auth | Cognito |
| GET | `/proyectos` | jam-proyectos | Cognito |
| GET | `/proyectos/{id}/unidades` | jam-proyectos | Cognito |
| PUT | `/proyectos/{id}/unidades/{uid}/estado` | jam-proyectos | Cognito |
| POST | `/bloqueos` | jam-bloqueos | Cognito |
| GET | `/bloqueos/activos` | jam-bloqueos | Cognito |
| DELETE | `/admin/bloqueos/{unidad_id}` | jam-bloqueos | Cognito |
| POST | `/clientes` | jam-captacion | Cognito |
| GET | `/clientes` | jam-captacion | Cognito |
| GET | `/mis-procesos` | jam-captacion | Cognito |
| PUT | `/admin/clientes/{cedula}/proyecto/{pid}/estatus` | jam-crm | Cognito |
| GET | `/admin/inmobiliarias` | jam-auth | Cognito |
| POST | `/admin/inmobiliarias` | jam-auth | Cognito |
| GET | `/admin/sistema/usuarios` | jam-auth | Cognito |
| POST | `/admin/sistema/usuarios` | jam-auth | Cognito |

---

## Lógica de negocio clave

### Bloqueos
- Duración: **48 horas**, liberación automática vía EventBridge Scheduler
- No se permite doble bloqueo (ConditionExpression en DynamoDB)
- Una inmobiliaria no puede re-bloquear la misma unidad antes de **24h** de haberla liberado
- Concurrencia: gana el primer request por timestamp exacto
- Notificaciones: al bloquear y **5h antes** de vencer

### Exclusividad de clientes
- Exclusividad de **3 meses** por `cedula + proyecto_id`
- El mismo cliente puede registrarse en otro proyecto sin restricción
- Si otra inmobiliaria intenta registrar un cliente activo: error `409`
- Al vencer: cliente queda disponible, historial se conserva

### Estados de unidad
`disponible` → `bloqueada` → `no_disponible` → `vendida` / `desvinculada`

### Estados de proceso de venta
`captacion` → `reserva` → `separacion` → `inicial` → `desvinculado`

---

## Configuración del frontend

El frontend se configura mediante variables de entorno en `front/.env`:

```env
VITE_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_API_URL=https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/api
VITE_ASSETS_URL=https://XXXXXXXXXX.cloudfront.net
```

---

## Despliegue

### Frontend

```bash
cd front
npm run build

# Subir HTML (sin caché)
aws s3 cp dist/index.html s3://jam-frontend-479324457361/ \
  --content-type "text/html" --cache-control "no-cache"

# Subir assets del frontend (caché 1 año)
# IMPORTANTE: NO usar --delete porque borraría las imágenes de proyectos/inmobiliarias
# que están en assets/proyectos/ y assets/inmobiliarias/
aws s3 sync dist/assets/ s3://jam-assets-479324457361/assets/ \
  --cache-control "public, max-age=31536000, immutable"

# Si necesitas limpiar assets antiguos del frontend, hazlo manualmente:
# aws s3 rm s3://jam-assets-479324457361/assets/ --recursive --exclude "proyectos/*" --exclude "inmobiliarias/*"

# Invalidar CloudFront
aws cloudfront create-invalidation \
  --distribution-id E1WI58DFYF9AST --paths "/*"
```

### Infraestructura CDK

```bash
cd infra
npm install
npx cdk diff       # Ver cambios antes de aplicar
npx cdk deploy     # Desplegar stack completo
```

### Lambdas (actualización directa)

```bash
# Ejemplo: actualizar jam-crm
cd lambdas/jam-crm
zip -r ../jam-crm-deploy.zip .
aws lambda update-function-code \
  --function-name jam-crm \
  --zip-file fileb://../jam-crm-deploy.zip
```

---

## Cognito — Configuración de sesión

| Token | Duración |
|-------|----------|
| Access token | 8 horas |
| ID token | 8 horas |
| Refresh token | 30 días |

MFA: TOTP opcional (Google Authenticator / Authy). Los usuarios admin pueden configurarlo desde el panel.

---

## Email — AWS SES

- **Remitente:** `Venta@jamconstruccionesrl.com`
- **Dominio:** `jamconstruccionesrl.com` (requiere registros DKIM/SPF en DNS del proveedor)
- **MAIL FROM custom:** configurado para evitar el "via amazonses.com" en Outlook
- **Eventos que disparan email:** bloqueo de unidad, alerta 5h antes de vencer, cambios de estatus en proceso de venta

---

## Tickets de desarrollo

| ID | Título | Estado |
|----|--------|--------|
| [TK-01](docs/tickets/TK-01-autenticacion-base.md) | Autenticación base y roles | ✅ Completado |
| [TK-02](docs/tickets/TK-02-modelo-datos-base.md) | Modelo de datos base | ✅ Completado |
| [TK-03](docs/tickets/TK-03-visualizacion-inventario.md) | Visualización de inventario con filtros | ✅ Completado |
| [TK-04](docs/tickets/TK-04-bloqueo-unidades.md) | Bloqueo de unidades y concurrencia | ✅ Completado |
| [TK-05](docs/tickets/TK-05-captacion-clientes.md) | Captación de clientes y exclusividad | ✅ Completado |
| [TK-06](docs/tickets/TK-06-estatus-comerciales-kommo.md) | Estatus comerciales y CRM | ✅ Completado |
| [TK-07](docs/tickets/TK-07-carga-inventario-excel.md) | Carga masiva de inventario Excel | ✅ Completado |
| [TK-08](docs/tickets/TK-08-notificaciones-trazabilidad.md) | Notificaciones y trazabilidad | ✅ Completado |
| [TK-09](docs/tickets/TK-09-qa-estabilizacion.md) | QA funcional y estabilización | ✅ Completado |
| [TK-10](docs/tickets/TK-10-despliegue-produccion.md) | Despliegue a producción | ✅ Completado |
| [TK-11](docs/tickets/TK-11-backup-bases-de-datos.md) | Backup de bases de datos | ✅ Completado |
| [TK-12](docs/tickets/TK-12-integracion-kommo.md) | Integración Kommo CRM | ✅ Completado |
| [TK-13](docs/tickets/TK-13-boton-refresco-inventario.md) | Botón de refresco de inventario | ✅ Completado |
| [TK-14](docs/tickets/TK-14-limpiar-datos-prueba-historial.md) | Limpieza de datos de prueba | ✅ Completado |
| [TK-15](docs/tickets/TK-15-enlace-captura-externa-clientes.md) | Enlace de captura externa de clientes | ✅ Completado |
| [TK-16](docs/tickets/TK-16-cedula-unicidad-clientes.md) | Unicidad de cédula en clientes | ✅ Completado |
| [TK-17](docs/tickets/TK-17-despliegue-demo.md) | Despliegue demo | 🔄 Pendiente |
| [TK-18](docs/tickets/TK-18-actualizar-esquema-inventario.md) | Actualizar esquema de inventario | 🔄 Pendiente |

---

## Documentación adicional

- [Arquitectura del sistema](docs/arquitectura-sistema.md)
- [Requerimientos funcionales](docs/requerimientos-funcionales.md)
- [Infraestructura](docs/infraestructura.md)
- [QA del sistema](docs/QA-SISTEMA.md)
- [Configuración base](docs/config.md)
