# Entrega — Módulo de Autenticación y Acceso

**Proyecto:** JAM Construcciones — Sistema de Gestión Inmobiliaria
**Entrega:** Sprint 1 · TK-01
**Fecha:** Abril 2026

---

## ¿Qué se entregó?

Se implementó la base completa del sistema: infraestructura en la nube, autenticación segura con doble factor y control de acceso por roles. El sistema ya está desplegado y funcional.

---

## Acceso al sistema

El sistema cuenta con dos tipos de usuarios:

### Usuarios internos JAM

Son los usuarios del equipo de JAM Construcciones. Tienen acceso completo o parcial según su rol.

| Rol | Acceso |
|-----|--------|
| Administrador | Control total del sistema |
| Coordinador | Gestión de inventario y proyectos |
| Supervisor | Consulta de toda la información (solo lectura) |

### Usuarios de inmobiliarias

Acceso limitado únicamente a los proyectos que les fueron asignados. Pueden registrar clientes e interesados y bloquear unidades.

---

## Pantalla de inicio de sesión

Se diseñó una pantalla de login con identidad visual de JAM Construcciones:

- Logo de la empresa
- Imagen de referencia de construcción
- Formulario limpio y responsivo (funciona en celular y computador)

El flujo de ingreso varía según el tipo de usuario:

**Usuario de inmobiliaria (primer ingreso):**
1. Ingresa usuario y contraseña
2. El sistema muestra un código QR para configurar el autenticador (Google Authenticator o Authy)
3. Escanea el QR, ingresa el código generado → MFA activado, entra al sistema

**Usuario de inmobiliaria (ingresos siguientes):**
1. Ingresa usuario y contraseña
2. Ingresa el código de 6 dígitos del autenticador → entra al sistema

**Usuario interno JAM (primer ingreso):**
1. Ingresa usuario y contraseña
2. El sistema muestra un código QR para configurar el autenticador (Google Authenticator o Authy)
3. Escanea el QR, ingresa el código generado → MFA activado, entra al sistema

**Usuario interno JAM (ingresos siguientes):**
1. Ingresa usuario y contraseña
2. Ingresa el código de 6 dígitos del autenticador → entra al sistema

**Olvidé mi contraseña (todos los usuarios):**
1. Ingresa su usuario
2. Recibe un código en su correo registrado
3. Ingresa el código y su nueva contraseña → acceso restaurado

---

## Seguridad implementada

- **Doble factor de autenticación (MFA)** obligatorio para todos los usuarios, usando aplicaciones de autenticación estándar (Google Authenticator, Authy, Microsoft Authenticator)
- **Tokens seguros** — cada sesión usa tokens JWT firmados por AWS Cognito con expiración automática
- **Control de acceso por rol** — cada usuario solo puede ver y hacer lo que su rol permite. Intentar acceder a una ruta no autorizada redirige a una página de acceso denegado
- **Sesiones protegidas** — rutas privadas no son accesibles sin autenticación válida
- **Historial preservado** — deshabilitar un usuario no elimina su información ni su actividad histórica

---

## Infraestructura desplegada en AWS

Todo el sistema corre sobre servicios administrados de AWS, sin servidores que mantener:

| Servicio | Uso |
|----------|-----|
| Amazon Cognito | Autenticación, usuarios y grupos |
| API Gateway | Punto de entrada seguro a la API |
| AWS Lambda | Lógica del backend (Python) |
| DynamoDB | Base de datos principal |
| S3 + CloudFront | Hosting del frontend con CDN global |

La infraestructura está definida como código (AWS CDK), lo que permite reproducirla, versionarla y auditarla en cualquier momento.

---

## Permisos por módulo

| Módulo | Admin | Coordinador | Supervisor | Inmobiliaria |
|--------|:-----:|:-----------:|:----------:|:------------:|
| Gestión de usuarios | ✅ | — | — | — |
| Gestión de inmobiliarias | ✅ | — | — | — |
| Crear/editar proyectos | ✅ | ✅ | — | — |
| Crear/editar inventario | ✅ | ✅ | — | — |
| Ver inventario | ✅ | ✅ | ✅ | Solo asignados |
| Ver clientes | ✅ | ✅ | ✅ | Solo propios |
| Registrar clientes | ✅ | — | — | ✅ |
| Bloquear unidades | ✅ | — | — | ✅ |
| Liberar bloqueos | ✅ | — | — | — |
| Reportes | ✅ | ✅ | ✅ | — |

---

## Estado de la entrega

| Funcionalidad | Estado |
|---------------|--------|
| Login funcional para todos los roles | ✅ Completado |
| MFA obligatorio para todos los usuarios | ✅ Completado |
| Configuración de MFA en primer login (QR + clave manual) | ✅ Completado |
| Recuperación de contraseña para todos los usuarios | ✅ Completado |
| Rutas protegidas por autenticación y rol | ✅ Completado |
| Pantalla de login con identidad visual JAM | ✅ Completado |
| Layout responsivo (móvil y escritorio) | ✅ Completado |
| Infraestructura desplegada en AWS | ✅ Completado |
| Base lista para módulos siguientes | ✅ Completado |

---

## Próximos pasos

Con esta base lista, los siguientes módulos a desarrollar son:

- **TK-02** — Modelo de datos base (proyectos, etapas, torres, unidades)
- **TK-03** — Visualización de inventario
- **TK-04** — Bloqueo de unidades
- **TK-05** — Captación de clientes

---

*Documento de entrega generado para revisión del cliente. Para consultas técnicas o accesos, contactar al equipo de desarrollo.*
