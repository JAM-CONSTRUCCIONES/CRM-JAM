# Stack Config — React + Cognito + API Gateway + Lambda + DynamoDB

Stack serverless genérico con React en el frontend, autenticación con Cognito, API REST con API Gateway + Lambda (Python), y DynamoDB como base de datos.

---

## Stack Tecnológico

### Frontend
- React + Vite
- UI: Ant Design 5
- Routing: React Router DOM
- Auth + API: AWS Amplify v6 (`aws-amplify/auth`, `aws-amplify/api`)
- HTTP: Amplify REST API client (sin axios)
- Hosting: S3 + CloudFront

### Backend
- Runtime: Python 3.12 (Lambda)
- IaC: CDK TypeScript v2 (un solo stack)
- API: API Gateway REST
- Auth: Cognito Authorizer (valida ID token)

## Estructura de Lambdas

Cada Lambda sigue el mismo patrón:

```
lambdas/<nombre>/
├── handler.py      # solo enruta, sin lógica de negocio
├── routes/         # un archivo por entidad o sub-recurso
└── utils/          # helpers reutilizables (auth, response)
```

### Criterio de división de archivos en routes/

Un archivo por entidad. Cuando una entidad tiene sub-recursos con operaciones propias, cada sub-recurso tiene su propio archivo.

Límite intencional: cada archivo en `routes/` no debe superar ~200 líneas. Si se supera, es señal de que mezcla responsabilidades y hay que dividirlo en sub-recursos.

```
# Correcto — dividido por entidad y sub-recurso
routes/
  proyectos.py     # listar, detalle, crear, actualizar, eliminar proyecto
  etapas.py        # listar, crear, actualizar, eliminar etapa

# Incorrecto — dividido por método HTTP (mezcla entidades)
routes/
  gets.py
  posts.py

# Incorrecto — dividido por operación (fragmenta el contexto)
routes/
  proyectos_create.py
  proyectos_update.py
```

Excepción: operaciones con lógica de negocio compleja e independiente pueden merecer su propio archivo aunque pertenezcan a una entidad existente.

### Autenticación
- Amazon Cognito User Pool
- Auth flow: `USER_PASSWORD_AUTH`
- Token usado en API: ID token (no access token)
- Amplify configurado con `loginWith: { username: true }`
- Sin auto-registro (`selfSignUpEnabled: false`)
- Grupos de acceso definidos por proyecto (ej: `admin`, `viewer`)

### Base de Datos
- DynamoDB: Single Table Design por dominio
- Billing: `PAY_PER_REQUEST`

---

## Estructura del Repositorio

```
/
├── front/              # React + Vite
│   └── src/
│       ├── config/     # Amplify + variables de entorno
│       ├── constants/  # constantes compartidas (estados, colores, labels)
│       ├── context/    # AuthContext global
│       ├── hooks/      # useAuth + hooks de dominio
│       ├── services/   # api.ts (Amplify REST), servicios por dominio
│       ├── components/ # layout/, common/, inventario/, clientes/, bloqueos/
│       ├── pages/      # una carpeta por módulo — solo JSX de alto nivel
│       └── types/      # interfaces TypeScript
├── infra/              # CDK TypeScript
│   └── lib/
│       └── <proyecto>-stack.ts
├── lambdas/            # Lambdas Python por dominio
└── docs/               # Documentación del proyecto
```

---

## Arquitectura de componentes React

### Regla principal: separación de responsabilidades

Cada página (`pages/`) debe tener máximo ~100 líneas. Si supera eso, hay que extraer.

### Tres capas

**1. Custom hooks (`hooks/`)**
Contienen todo el estado y la lógica. La página solo los llama.

```
hooks/useInventario.ts   → estado y handlers de InventarioPage
hooks/useClientes.ts     → estado y handlers de ClientesPage
hooks/useBloqueos.ts     → estado y handlers de BloqueosPage
```

**2. Componentes (`components/<dominio>/`)**
Cada modal, drawer o sección compleja es su propio archivo.

```
components/inventario/
  ModalUnidad.tsx
  ModalBloqueo.tsx
  DrawerEtapas.tsx
  TablaUnidades.tsx

components/clientes/
  DrawerDetalleCedula.tsx
  ModalEditarCliente.tsx
  ModalAsignarUnidad.tsx

components/bloqueos/
  ModalAsignarCliente.tsx
```

**3. Constantes compartidas (`constants/`)**

```
constants/estados.ts     → ESTADO_COLOR, ESTADO_LABEL, ESTADO_CONFIG
```

### Criterio de extracción

Extraer a componente cuando:
- El bloque JSX supera ~40 líneas
- El mismo bloque aparece en más de un lugar
- Tiene su propio estado interno

Extraer a hook cuando:
- Hay más de 5 `useState` en un componente
- Las funciones de manejo superan ~30 líneas en total

### Límite de tamaño

| Archivo | Límite sugerido |
|---------|----------------|
| `pages/*.tsx` | ~100 líneas |
| `components/**/*.tsx` | ~150 líneas |
| `hooks/*.ts` | ~200 líneas |
| `services/*.ts` | ~80 líneas |

---

## Variables de entorno (frontend)

Archivo: `front/.env` (no se commitea, usar `front/.env.example` como plantilla)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del API Gateway |
| `VITE_COGNITO_USER_POOL_ID` | ID del User Pool |
| `VITE_COGNITO_CLIENT_ID` | ID del App Client |
| `VITE_AWS_REGION` | Región AWS |
| `VITE_STAGE` | Ambiente actual (`dev`, `prod`) |

---

## Convenciones de nombres

Reemplaza `<proyecto>` con el prefijo corto de tu proyecto (ej: `jam`, `crm`, `ops`).

| Recurso | Patrón | Ejemplo |
|---------|--------|---------|
| Lambda | `<proyecto>-<dominio>` | `jam-auth` |
| Tabla DynamoDB | `<proyecto>-<entidad>` | `jam-usuarios` |
| Cognito User Pool | `<proyecto>-user-pool` | `jam-user-pool` |
| API Gateway | `<proyecto>-api` | `jam-api` |
| S3 Frontend | `<proyecto>-frontend-<account_id>` | `jam-frontend-123456789` |
| Stack CDK | PascalCase del proyecto | `JamConstrucciones` |

---

## Seguridad
- API Gateway con Cognito Authorizer en todos los endpoints privados
- IAM roles mínimos por Lambda (least privilege)
- Todos los recursos en `RETAIN` para no perder datos en re-deploys

---

## Buenas prácticas de acceso a datos

### Filtrado por rol: siempre en el backend
El filtrado de datos sensibles debe ocurrir en la Lambda, nunca en el frontend.
Aunque el frontend no muestre ciertos datos, si los recibe en la respuesta son visibles en el network tab del navegador.

Regla: si un usuario no debe ver un dato, el backend no debe enviarlo.

### Scan vs Query en DynamoDB
DynamoDB cobra por KB leído, no por filas devueltas.

| Operación | Comportamiento | Recomendación |
|-----------|---------------|---------------|
| `Query` | Lee solo los items del `pk` especificado | Usar siempre que sea posible |
| `Scan` | Lee toda la tabla, luego filtra | Evitar en producción con tablas grandes |
| `Scan` + `FilterExpression` | Filtra en memoria después de leer todo | No reduce el costo del scan |

Esto aplica igual para admin que para cualquier rol. El rol no cambia el costo de la operación.

### GSI (Global Secondary Index)
Un GSI es una tabla secundaria que DynamoDB mantiene automáticamente. Permite hacer `Query` eficientes sobre atributos que no son el pk/sk de la tabla principal.

Patrón usado en este proyecto: campo `tipo` como pk del GSI.

```
# Sin GSI → Scan de toda la tabla
table.scan(FilterExpression='sk = METADATA AND pk starts_with PROYECTO#')
# Lee TODOS los items de la tabla

# Con GSI → Query directo
table.query(IndexName='gsi-tipo', KeyConditionExpression=Key('tipo').eq('PROYECTO'))
# Lee SOLO los proyectos
```

GSIs definidos:

| Tabla | GSI | pk | sk | Uso |
|-------|-----|----|----|-----|
| `jam-inventario` | `gsi-tipo` | `tipo` | `creado_en` | Listar proyectos |
| `jam-inventario` | `gsi-estado` | `estado` | `fecha_bloqueo` | Unidades por estado |
| `jam-inventario` | `gsi-torre` | `torre_id` | `sk` | Unidades por torre |
| `jam-usuarios` | `gsi-tipo` | `tipo` | `creado_en` | Listar inmobiliarias |
| `jam-usuarios` | `gsi-por-inmobiliaria` | `inmobiliaria_id` | `pk` | Usuarios por inmobiliaria |

Valores del campo `tipo` por entidad:

| Entidad | tipo |
|---------|------|
| Proyecto | `PROYECTO` |
| Inmobiliaria | `INMOBILIARIA` |
| Usuario | `USUARIO` |

### Paginación
Para listas que pueden crecer (unidades, clientes), implementar paginación con `Limit` + `ExclusiveStartKey` en DynamoDB y devolver `nextToken` al frontend.

---

## Infraestructura base (CDK)

Recursos mínimos que define el stack:

- Cognito User Pool + App Client
- API Gateway REST + Cognito Authorizer
- Lambda(s) por dominio con sus permisos
- DynamoDB table(s) por entidad
- S3 bucket + CloudFront distribution para el frontend
