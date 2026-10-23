# TK-01 - Configuración base del sistema y autenticación de usuarios

## Objetivo

Preparar la base técnica del sistema y habilitar el acceso autenticado para administración
e inmobiliarias, garantizando control de acceso desde el inicio.

---

## Roles del sistema

### Roles internos JAM

| Rol | Descripción | MFA |
|-----|-------------|-----|
| `admin` | Control total: usuarios, inmobiliarias, proyectos, inventario, reportes y configuración | TOTP obligatorio |
| `coordinador` | Gestiona inventario y proyectos (crear/editar unidades, etapas, torres), ve clientes y bloqueos. No gestiona usuarios ni inmobiliarias | TOTP obligatorio |
| `supervisor` | Solo lectura de todo: proyectos, inventario, clientes, reportes, bloqueos. No puede crear ni modificar nada | TOTP obligatorio |

### Rol externo

| Rol | Descripción | MFA |
|-----|-------------|-----|
| `inmobiliaria` | Acceso limitado a proyectos asignados. Puede registrar clientes y bloquear unidades | TOTP obligatorio |

### Matriz de permisos por módulo

| Módulo | admin | coordinador | supervisor | inmobiliaria |
|--------|-------|-------------|------------|--------------|
| Gestión de usuarios del sistema | ✔ | ✗ | ✗ | ✗ |
| Gestión de inmobiliarias | ✔ | ✗ | ✗ | ✗ |
| Proyectos (crear/editar/eliminar) | ✔ | ✔ | ✗ | ✗ |
| Inventario (crear/editar/eliminar unidades) | ✔ | ✔ | ✗ | ✗ |
| Ver inventario completo | ✔ | ✔ | ✔ | solo asignados |
| Ver clientes (todos) | ✔ | ✔ | ✔ | solo propios |
| Ver bloqueos activos | ✔ | ✔ | ✔ | solo propios |
| Liberar / extender bloqueos | ✔ | ✗ | ✗ | ✗ |
| Registrar clientes | ✔ | ✗ | ✗ | ✔ |
| Bloquear unidades | ✔ | ✗ | ✗ | ✔ |
| Reportes y analytics | ✔ | ✔ | ✔ | ✗ |

---

## Arquitectura
            ↓
        CloudFront
            ↓
      S3 - Frontend (React + Vite)
         ↓           ↓
   Amazon Cognito   API Gateway REST
   User Pool        + Cognito Authorizer (ID token)
                        ↓
                  Lambda jam-auth (Python)
                        ↓
                    DynamoDB jam-usuarios
```

---

## Lo implementado

### Infraestructura (CDK)
- Cognito User Pool `jam-user-pool` con grupos `admin`, `coordinador`, `supervisor` e `inmobiliaria`
- App Client con `USER_PASSWORD_AUTH` y `USER_SRP_AUTH`
- API Gateway REST `jam-api` con Cognito Authorizer
- Gateway Responses con headers CORS para errores 4XX y 5XX
- Lambda `jam-auth` con permisos mínimos (least privilege)
- Tabla DynamoDB `jam-usuarios` (Single Table Design)
- GSI `gsi-por-inmobiliaria` para listar usuarios por inmobiliaria
- S3 + CloudFront para el frontend

### Backend (Lambda Python)
- `POST /auth/login` → público, llama a Cognito `InitiateAuth`
- `GET /auth/me` → protegido, retorna perfil + rol + proyectos desde DynamoDB
- El rol se lee desde DynamoDB, los grupos de Cognito son la fuente de verdad de acceso

### Frontend (React + Vite)
- Amplify v6 configurado con Cognito (`USER_PASSWORD_AUTH`, `loginWith: username`)
- Amplify REST API client para todas las llamadas al API Gateway
- Token usado: ID token (no access token) — requerido por Cognito Authorizer
- `signOut` antes de `signIn` para evitar `UserAlreadyAuthenticatedException`
- `AuthContext` con estado global del usuario (rol, proyectos, nombre)
- `useAuth` hook para consumir el contexto
- `ProtectedRoute` con validación de rol
- Login page con flujo completo: credenciales → MFA code o MFA setup → dashboard
- Flujo MFA setup: `signIn` devuelve `CONTINUE_SIGN_IN_WITH_TOTP_SETUP` con `totpSetupDetails.sharedSecret` → QR generado en frontend → `confirmSignIn` activa MFA y completa login
- Flujo MFA code: `signIn` devuelve `CONFIRM_SIGN_IN_WITH_TOTP_CODE` → `confirmSignIn` con código
- Olvidé contraseña: `resetPassword` + `confirmResetPassword` directo a Cognito vía Amplify
- Proxy Vite en desarrollo para evitar CORS con API Gateway
- Página `/unauthorized` para accesos denegados
- Layout responsive: sidebar fijo en desktop, drawer en móvil
- Navbar con hamburguesa en móvil

---

## Modelo de datos

### Tabla: `jam-usuarios`

| pk | sk | tipo | atributos |
|----|----|------|-----------|
| `INMOBILIARIA#<id>` | `METADATA` | inmobiliaria | `nombre`, `correos[]`, `proyectos[]`, `activo` |
| `USUARIO#<cognito_sub>` | `METADATA` | usuario | `nombre`, `rol`, `inmobiliaria_id`, `activo`, `correo` |

GSI: `gsi-por-inmobiliaria` → pk: `inmobiliaria_id`, sk: `pk`

> El campo `correo` se agrega al modelo de usuario para soportar recuperación de contraseña de todos los usuarios.

---

## Lógica de acceso

- `admin`: acceso total, ve todos los proyectos y datos, gestiona usuarios e inmobiliarias
- `coordinador`: gestiona inventario y proyectos, ve clientes y bloqueos, sin acceso a gestión de usuarios
- `supervisor`: solo lectura de todo, sin capacidad de modificar nada
- `inmobiliaria`: acceso solo a proyectos asignados en su registro de DynamoDB
- Roles internos JAM (`admin`, `coordinador`, `supervisor`): nombre de usuario alias, MFA TOTP obligatorio
- Inmobiliarias: nombre de usuario alias, MFA TOTP obligatorio
- Deshabilitar: `activo = false` en DynamoDB + deshabilitar en Cognito (historial preservado)
- Múltiples correos por inmobiliaria: campo `correos[]` en `INMOBILIARIA#METADATA`

---

## MFA

### Todos los usuarios (admin, coordinador, supervisor, inmobiliaria)
- MFA obligatorio con TOTP (Google Authenticator / Authy)
- Al primer login, el sistema muestra el QR para configurar el autenticador y la clave secreta en texto para ingreso manual
- Sin MFA configurado, el usuario no puede acceder al sistema
- Flujo: `InitiateAuth` → Cognito responde `SOFTWARE_TOKEN_MFA` → frontend solicita código → `RespondToAuthChallenge`

### Flujo de login con MFA (todos los usuarios)
```
login(username, password)
  ↓
¿Respuesta es CONTINUE_SIGN_IN_WITH_TOTP_SETUP?
  → mostrar QR + clave manual para configurar autenticador
        ↓
confirmSignIn({ challengeResponse: código })
  → MFA activado, sesión iniciada (primer login)
  ↓
¿Respuesta es CONFIRM_SIGN_IN_WITH_TOTP_CODE?
  → mostrar campo "Código de autenticador"
        ↓
confirmSignIn({ challengeResponse: código })
  → Sesión iniciada
```

---

## Recuperación de contraseña

### Todos los usuarios (admin, coordinador, supervisor, inmobiliaria)
- Self-service vía Cognito: "Olvidé mi contraseña"
- Cognito envía código de verificación al correo registrado
- Amplify: `resetPassword({ username })` → `confirmResetPassword({ username, confirmationCode, newPassword })`
- Requiere `accountRecovery: EMAIL_ONLY` (ya configurado)
- El correo debe estar registrado en el atributo `email` del usuario en Cognito

---

## Gestión de usuarios del sistema

### Crear usuario interno JAM (admin, coordinador, supervisor)
1. Admin crea usuario en Cognito con nombre alias
2. Admin asigna el usuario al grupo correspondiente (`admin`, `coordinador` o `supervisor`)
3. Admin crea registro en DynamoDB: `USUARIO#<sub>` con `nombre`, `rol`, `activo: true`
4. En el primer login el usuario configura su MFA TOTP

### Deshabilitar usuario interno
- `activo = false` en DynamoDB + deshabilitar en Cognito
- Historial preservado íntegro

---

## Gestión de inmobiliarias

### Crear inmobiliaria
1. Admin crea registro en DynamoDB: `INMOBILIARIA#<id>` con `nombre`, `correos[]`, `proyectos[]`, `activo: true`
2. Admin crea usuario en Cognito con nombre alias + atributo `email` verificado
3. Admin asigna el usuario al grupo `inmobiliaria` en Cognito
4. Admin vincula el `cognito_sub` al registro de la inmobiliaria en DynamoDB
5. El correo queda guardado también en DynamoDB (`correo` en `USUARIO#METADATA`) para referencia interna

### Deshabilitar inmobiliaria
- `activo = false` en DynamoDB → bloquea acceso lógico
- Deshabilitar usuario en Cognito → bloquea autenticación
- Historial, clientes y bloqueos se conservan íntegros

---

## Nuevos endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/auth/forgot-password` | público | Inicia recuperación de contraseña (todos los usuarios) |
| `POST` | `/auth/confirm-forgot-password` | público | Confirma código y nueva contraseña |

> Manejados directamente desde Amplify sin pasar por Lambda, ya que Cognito los expone nativamente.

---

## Cambios en infraestructura (CDK)

- Cognito User Pool: grupos `coordinador` y `supervisor` nuevos además de `admin` e `inmobiliaria`
- MFA TOTP habilitado con `mfa: cognito.Mfa.OPTIONAL` + `mfaSecondFactor: { otp: true, sms: false }`
- `accountRecovery: EMAIL_ONLY` (ya configurado)
- Permisos Lambda: `cognito-idp:SetUserMFAPreference`, `cognito-idp:AssociateSoftwareToken`, `cognito-idp:VerifySoftwareToken`, `cognito-idp:RespondToAuthChallenge`

---

## Criterios de aceptación

- [x] Login funcional para todos los roles
- [x] Rutas protegidas no accesibles sin token válido
- [x] El sistema diferencia correctamente `admin`, `coordinador`, `supervisor` e `inmobiliaria`
- [x] El sistema soporta roles `coordinador` y `supervisor` con sus permisos correspondientes
- [x] Admin puede crear usuarios internos JAM con rol `coordinador` o `supervisor`
- [x] Admin puede deshabilitar usuarios internos sin perder su historial
- [x] Token expirado redirige al login automáticamente
- [x] Layout responsive (desktop y móvil)
- [x] Base técnica lista para continuar con TK-02 y TK-03
- [x] Admin puede crear inmobiliarias con múltiples correos de notificación
- [x] Admin puede crear usuarios con nombre alias (no correo)
- [x] Admin puede deshabilitar una inmobiliaria sin perder su historial
- [x] Inmobiliarias solo ven los proyectos que les fueron asignados explícitamente
- [x] Todos los usuarios tienen MFA obligatorio con TOTP al iniciar sesión
- [x] Primer login muestra QR para configurar autenticador y clave manual
- [x] Todos los usuarios pueden recuperar contraseña con código al correo

---

## Notas técnicas

- El Cognito Authorizer valida el ID token, no el access token
- Amplify v6 usa `session.tokens.idToken` para el header `Authorization`
- Un solo stack CDK sin sufijo de stage (`JamConstrucciones`)
- Todos los recursos con `RemovalPolicy.RETAIN` para proteger datos en producción
- MFA TOTP para todos los usuarios se gestiona con `AssociateSoftwareToken` + `VerifySoftwareToken` en el primer login
