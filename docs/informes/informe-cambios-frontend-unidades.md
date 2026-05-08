# Informe de Cambios — Frontend y Backend: TK-03

**Fecha:** Abril 2026
**Área:** Frontend · Backend · Infraestructura
**Tickets cubiertos:** TK-03 (visualización de inventario), mejoras de layout e inmobiliarias

---

## Resumen

Se completó el TK-03 con mejoras visuales y funcionales en el módulo de inventario, rediseño del layout general de la aplicación, y mejoras en la página de inmobiliarias. Se agregó infraestructura para subida de imágenes de proyectos (S3 + CloudFront) y un nuevo endpoint de presigned URL en el backend.

---

## Cambios por área

### Layout general

- Eliminado el Navbar superior. Toda la navegación consolidada en el sidebar.
- Sidebar rediseñado: logo centrado, secciones agrupadas, item activo en azul, perfil de usuario fijo abajo, logout con hover rojo.
- Fondo general cambiado a `#f5f7fa`.
- Sidebar fijo de 250px en desktop, drawer en móvil.

### Módulo de inventario — Proyectos

- Cards rediseñadas con imagen de portada (o gradiente único por proyecto como fallback).
- Subida de imagen desde el formulario de edición, almacenada en S3 y servida por CloudFront.
- Botones de acción flotando sobre la imagen.

### Módulo de inventario — Edificios

- Edificios agrupados por etapa con separador visual y barra de color lateral.
- Cards con banda de color superior según etapa, ícono con fondo suave, hover con borde de color.
- Botón "Ver todas las unidades" agregado en la vista de edificios.
- Botones de etapas y nuevo edificio disponibles también desde la vista de todas las unidades.

### Módulo de inventario — Unidades

- Fila de estadísticas (total, disponibles, bloqueadas, vendidas) encima de la tabla.
- Filtros en cascada: etapa → torre → estado, con botón de limpiar filtros.
- Colores de fila diferenciados por estado en la tabla.
- Columnas de etapa y edificio visibles en la vista de todas las unidades.
- Columnas `Bloqueado por` y `Fecha de bloqueo` visibles solo para admin.
- Mensaje de vacío con ícono y contexto.

### Inmobiliarias

- Cards rediseñadas con banda de color, avatar con inicial, color único por inmobiliaria.
- Hover con borde del color de la inmobiliaria.
- Drawer de usuarios rediseñado: header con avatar, nombre, contador y correos.
- Lista de usuarios con avatar y acciones inline.

### Backend (`jam-proyectos`)

- Nuevo endpoint `POST /admin/proyectos/{id}/imagen` que genera presigned URL para subida directa a S3.
- `actualizar()` acepta el campo `imagen_url`.
- Tipo `Proyecto` actualizado con `imagen_url?: string`.

### Infraestructura (CDK)

- Nuevo bucket S3 `jam-assets-{account}` con CORS configurado para PUT/GET.
- Behavior adicional en CloudFront para `/assets/*` apuntando al bucket de assets.
- Permisos de lectura/escritura en S3 otorgados a la lambda `jam-proyectos`.
- Variables de entorno `ASSETS_BUCKET` y `CLOUDFRONT_URL` inyectadas en la lambda.
- Nuevo endpoint en API Gateway: `POST /admin/proyectos/{id}/imagen`.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `front/src/pages/inventario/InventarioPage.tsx` | Rediseño completo de las 3 vistas |
| `front/src/pages/inmobiliarias/InmobiliariasPage.tsx` | Rediseño de cards y drawer |
| `front/src/components/layout/Sidebar.tsx` | Rediseño completo |
| `front/src/components/layout/AppLayout.tsx` | Eliminado Navbar, sidebar fijo |
| `front/src/components/layout/Navbar.tsx` | Eliminado |
| `front/src/services/proyectos.service.ts` | `getPresignedImagenProyecto`, `actualizarProyecto` con `imagen_url` |
| `front/src/types/index.ts` | `imagen_url` en `Proyecto` |
| `front/src/index.css` | Colores de fila por estado |
| `lambdas/jam-proyectos/routes/proyectos.py` | `presigned_imagen()`, `imagen_url` en `actualizar()` |
| `lambdas/jam-proyectos/handler.py` | Ruta `/imagen` registrada |
| `infra/lib/jam-stack.ts` | Bucket assets, behavior CloudFront, endpoint imagen |

---

## Pendiente

- Timer de bloqueo en tiempo real (depende de TK-04: requiere `fecha_liberacion` en el response de unidades).

---

## Corrección — MFA por rol (Abril 2026)

**Problema detectado:** El MFA dejó de pedirse al hacer login. Se confirmó vía CloudTrail que los deploys de CDK (`AWSCloudFormation`) estaban sobreescribiendo la configuración de MFA del User Pool, ya que el CDK tenía `mfa: OPTIONAL` pero no incluía `mfaConfiguration` en el `UpdateUserPool`, lo que hacía que Cognito lo reseteara.

**Solución implementada:** En lugar de forzar MFA a nivel de Cognito para todos los usuarios, se implementó la lógica en el frontend para exigir MFA solo a usuarios internos (`admin`, `coordinador`, `supervisor`), dejando a las inmobiliarias sin ese requisito.

### Cambios

| Archivo | Cambio |
|---------|--------|
| `infra/lib/jam-stack.ts` | `mfa` vuelve a `OPTIONAL` (controlado por lógica de frontend) |
| `front/src/services/auth.service.ts` | Nueva función `getRolFromSession()` que lee `cognito:groups` del token JWT. Nuevo tipo `ok_inmobiliaria` en `LoginResult` |
| `front/src/pages/auth/LoginPage.tsx` | Caso `ok`: si es inmobiliaria entra directo, si es interno redirige a `/mfa-setup` obligatorio |

### Flujo resultante

| Rol | Comportamiento al login |
|-----|------------------------|
| `admin`, `coordinador`, `supervisor` con MFA | Challenge TOTP normal |
| `admin`, `coordinador`, `supervisor` sin MFA | Redirige a `/mfa-setup` obligatorio |
| `inmobiliaria` | Entra directo al dashboard sin MFA |

---

## TK-04 — Bloqueo de unidades (Abril 2026)

**Área:** Backend · Frontend · Infraestructura

### Resumen

Se implementó el flujo completo de bloqueo de unidades. Nueva lambda `jam-bloqueos`, tabla `jam-historial-bloqueos`, cola SQS `jam-notificaciones-queue`, IAM role para EventBridge Scheduler, y frontend completo con botón de bloqueo, timer visual e historial.

### Backend

- Nueva lambda `jam-bloqueos` con endpoints: `POST /bloqueos`, `GET /bloqueos/activos`, `GET /admin/bloqueos/historial`, `DELETE /admin/bloqueos/{id}`, `PUT /admin/bloqueos/{id}/extender`
- Control de concurrencia con `ConditionExpression` en DynamoDB
- Restricción de re-bloqueo 24h consultando historial
- EventBridge Scheduler: 2 schedules one-time por bloqueo (48h liberación, 43h alerta)
- Notificaciones vía SQS en cada evento del ciclo de vida
- Historial guarda nombre de inmobiliaria y nombre del admin que liberó
- `jam-proyectos/routes/unidades.py` modificado para incluir `fecha_liberacion` y `tiempo_restante` en unidades bloqueadas

### Frontend

- Botón "Bloquear" en tabla de unidades para rol `inmobiliaria` (solo unidades disponibles)
- Retry automático en cold start de Lambda
- Timer de tiempo restante en columna Estado (verde/amarillo)
- Nueva página `/bloqueos` con dos pestañas: Activos e Historial
- Item "Bloqueos" agregado al sidebar en sección Administración

### Infraestructura

- Tabla DynamoDB `jam-historial-bloqueos`
- Cola SQS `jam-notificaciones-queue`
- IAM Role `jam-scheduler-role` para EventBridge
- Lambda `jam-bloqueos` con permisos: inventario, historial, usuarios (read), SQS, Scheduler, PassRole
- Rutas API Gateway: `/bloqueos`, `/bloqueos/activos`, `/admin/bloqueos/historial`, `/admin/bloqueos/{id}`, `/admin/bloqueos/{id}/extender`

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `lambdas/jam-bloqueos/*` | Creado completo |
| `lambdas/jam-proyectos/routes/unidades.py` | `fecha_liberacion` + `tiempo_restante` |
| `front/src/pages/inventario/InventarioPage.tsx` | Botón bloquear + timer |
| `front/src/pages/bloqueos/BloqueosPage.tsx` | Creado |
| `front/src/services/bloqueos.service.ts` | Creado |
| `front/src/types/index.ts` | `Bloqueo`, `HistorialBloqueo` |
| `front/src/App.tsx` | Ruta `/bloqueos` |
| `front/src/components/layout/Sidebar.tsx` | Item Bloqueos |
| `infra/lib/jam-stack.ts` | Todos los recursos nuevos |
