# JAM Construcciones - Infraestructura AWS

Documento de referencia para diagrama en draw.io.

---

## Visión general

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIOS                                 │
│              Admin JAM          Inmobiliarias                   │
└──────────────────┬──────────────────────┬───────────────────────┘
                   │                      │
                   └──────────┬───────────┘
                              ↓
                    ┌─────────────────┐
                    │   CloudFront    │  CDN + HTTPS + Caché
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │  S3 - Frontend  │  React + Vite (estáticos)
                    └────────┬────────┘
                             │
               ┌─────────────┴──────────────┐
               ↓                            ↓
   ┌───────────────────┐       ┌────────────────────────┐
   │   Amazon Cognito  │       │   API Gateway REST     │
   │   User Pool       │◄──────│   + Cognito Authorizer │
   │  grupos:          │  JWT  │   (todos los endpoints │
   │  - admin          │       │    privados protegidos)│
   │  - inmobiliaria   │       └────────────┬───────────┘
   └───────────────────┘                    │
                                            ↓
   ┌────────────────────────────────────────────────────────────┐
   │                    LAMBDAS (Python)                        │
   │                                                            │
   │  ┌─────────────┐  rutas: /auth/*                          │
   │  │  jam-auth   │  login, sesión, perfil                   │
   │  └─────────────┘                                          │
   │                                                            │
   │  ┌─────────────────┐  rutas: /proyectos/*, /admin/proy/*  │
   │  │  jam-proyectos  │  inventario, unidades, carga Excel   │
   │  └─────────────────┘                                      │
   │                                                            │
   │  ┌─────────────────┐  rutas: /clientes/*                  │
   │  │  jam-captacion  │  registro y consulta de clientes     │
   │  └─────────────────┘                                      │
   │                                                            │
   │  ┌─────────────────┐  rutas: /bloqueos/*, /admin/bloq/*   │
   │  │  jam-bloqueos   │  bloqueo, liberación, extensión      │
   │  └─────────────────┘                                      │
   │                                                            │
   │  ┌──────────┐  rutas: /crm/*, /notificaciones/*           │
   │  │  jam-crm │  estatus comerciales, notificaciones, Kommo │
   │  └──────────┘                                             │
   │                                                            │
   │  ┌────────────────┐  rutas: /analytics/*, /reportes/*     │
   │  │  jam-reportes  │  dashboard y KPIs (Fase 3)            │
   │  └────────────────┘                                       │
   └───────────┬──────────────────┬──────────────┬─────────────┘
               │                  │              │
               ↓                  ↓              ↓
   ┌───────────────────┐  ┌──────────────┐  ┌──────────────────────┐
   │     DynamoDB      │  │     SQS      │  │ EventBridge Scheduler│
   │                   │  │              │  │                      │
   │ jam-inventario    │  │ jam-notif-   │  │ Tareas one-time:     │
   │ jam-clientes      │  │ queue        │  │ - liberación 48h     │
   │ jam-usuarios      │  │              │  │   (jam-bloqueos)     │
   │ jam-auditoria     │  │ jam-notif-   │  │ - alerta 43h         │
   │ jam-hist-bloqueos │  │ dlq (fallos) │  │   (jam-bloqueos)     │
   │ jam-hist-estatus  │  │              │  │ - vencimiento 3 meses│
   └───────────────────┘  └──────┬───────┘  │   (jam-captacion)   │
                                 │          └──────────┬───────────┘
                                 ↓                     │
                          ┌──────────┐                 │
                          │  jam-crm │◄────────────────┘
                          │ (consume │
                          │  la cola)│
                          └────┬─────┘
                               │
               ┌───────────────┴────────────────┐
               ↓                                ↓
   ┌─────────────────────┐          ┌───────────────────┐
   │   Email - Resend    │          │     Kommo CRM     │
   │                     │          │                   │
   │ - bloqueo registrado│          │ sincronización    │
   │ - alerta vencimiento│          │ unidireccional    │
   │ - liberación        │          │ JAM → Kommo       │
   │ - cambio de estatus │          │                   │
   │ - carga Excel       │          │ (Fase 3:          │
   │                     │          │  WhatsApp API)    │
   └─────────────────────┘          └───────────────────┘


   FLUJO ESPECIAL: Carga de inventario Excel
   ─────────────────────────────────────────
   Admin → CloudFront → S3 Frontend
       → GET /admin/inventario/upload-url → jam-proyectos
       → URL prefirmada S3
       → Upload directo Admin → S3 jam-archivos (sin pasar por API Gateway)
       → S3 Event (ObjectCreated) → jam-proyectos (procesar_excel)
       → DynamoDB jam-inventario
       → Reporte JSON → S3 jam-archivos
```

---

## Componentes por capa

### Capa de acceso
| Componente | Tipo | Descripción |
|------------|------|-------------|
| CloudFront | CDN | Distribución del frontend, HTTPS, caché |
| S3 Frontend | Bucket | Archivos estáticos del frontend React |
| Cognito User Pool | Auth | Gestión de usuarios y grupos (admin / inmobiliaria) |
| API Gateway REST | API | Punto de entrada al backend, Cognito Authorizer |

### Capa de cómputo (Lambdas)
| Lambda | Rutas | Descripción |
|--------|-------|-------------|
| `jam-auth` | `/auth/*` | Login, sesión, perfil |
| `jam-proyectos` | `/proyectos/*`, `/admin/proyectos/*` | Inventario, unidades, carga Excel |
| `jam-captacion` | `/clientes/*` | Registro y consulta de clientes |
| `jam-bloqueos` | `/bloqueos/*`, `/admin/bloqueos/*` | Bloqueo, liberación, extensión |
| `jam-crm` | `/crm/*`, `/notificaciones/*` | Estatus comerciales, notificaciones, Kommo |
| `jam-reportes` | `/analytics/*`, `/reportes/*` | Dashboard y KPIs (Fase 3) |

### Capa de datos
| Componente | Tipo | Descripción |
|------------|------|-------------|
| `jam-inventario` | DynamoDB | Proyectos, etapas, torres, unidades |
| `jam-clientes` | DynamoDB | Clientes y exclusividades |
| `jam-usuarios` | DynamoDB | Usuarios e inmobiliarias |
| `jam-auditoria` | DynamoDB | Historial de eventos del sistema |
| `jam-historial-bloqueos` | DynamoDB | Trazabilidad de bloqueos |
| `jam-historial-estatus` | DynamoDB | Trazabilidad de cambios de estatus |
| S3 Archivos | Bucket | Excel de inventario, reportes generados |

### Capa de mensajería y eventos
| Componente | Tipo | Descripción |
|------------|------|-------------|
| `jam-notificaciones-queue` | SQS | Cola central de eventos y notificaciones |
| `jam-notificaciones-dlq` | SQS DLQ | Mensajes fallidos para revisión |
| EventBridge Scheduler | Scheduler | Tareas programadas one-time por bloqueo y exclusividad |

### Integraciones externas
| Servicio | Uso |
|----------|-----|
| Resend (u otro) | Envío de emails operativos |
| Kommo CRM | Sincronización de estatus comerciales |
| WhatsApp API (Fase 3) | Notificaciones al cliente |

---

## Flujos principales para el diagrama

### Flujo 1: Login
```
Usuario → CloudFront → S3 (frontend) → Cognito (auth) → token JWT
token JWT → API Gateway (Cognito Authorizer) → Lambda jam-auth
```

### Flujo 2: Consulta de inventario
```
Usuario → CloudFront → S3 → API Gateway → jam-proyectos → DynamoDB jam-inventario
```

### Flujo 3: Bloqueo de unidad
```
Inmobiliaria → API Gateway → jam-bloqueos
  → DynamoDB (ConditionExpression)
  → EventBridge Scheduler (48h liberación, 43h alerta)
  → SQS jam-notificaciones-queue
  → jam-crm → Email (Resend)
```

### Flujo 4: Cambio de estatus
```
Admin → API Gateway → jam-crm
  → DynamoDB jam-clientes + jam-historial-estatus
  → SQS jam-notificaciones-queue
  → jam-crm → Email + Kommo API
```

### Flujo 5: Carga de inventario Excel
```
Admin → CloudFront → S3 (upload directo con URL prefirmada)
  → S3 Event → jam-proyectos (procesar_excel)
  → DynamoDB jam-inventario
  → S3 (reporte resultado)
```

### Flujo 6: Liberación automática de bloqueo
```
EventBridge Scheduler (48h) → jam-bloqueos
  → DynamoDB (estado → disponible)
  → SQS → jam-crm → Email inmobiliaria
```

---

## Ambientes

| Recurso | Dev | Prod |
|---------|-----|------|
| Cognito User Pool | `jam-dev` | `jam-prod` |
| DynamoDB tablas | sufijo `-dev` | sufijo `-prod` |
| S3 buckets | sufijo `-dev` | sufijo `-prod` |
| SQS colas | sufijo `-dev` | sufijo `-prod` |
| CloudFront | distribución dev | distribución prod |

---

## Notas para draw.io

- Agrupar por capas: Acceso / Cómputo / Datos / Mensajería / Externas
- Las Lambdas pueden agruparse en un bloque "Lambda Layer"
- DynamoDB mostrar como un bloque con las tablas listadas dentro
- SQS con flecha hacia DLQ para indicar el flujo de fallos
- EventBridge Scheduler con flechas hacia jam-bloqueos y jam-captacion
- Integraciones externas en un bloque separado fuera del VPC
