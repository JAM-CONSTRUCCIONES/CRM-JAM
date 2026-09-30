# Permisos de usuarios

Documento de referencia de permisos segun la implementacion actual del CRM.

## Como se determina el rol

El backend toma el rol desde el token de Cognito, especificamente desde:

```txt
requestContext.authorizer.claims["cognito:groups"]
```

Roles reconocidos:

- `admin`
- `coordinador`
- `supervisor`
- `inmobiliaria`

Si el token no pertenece a `admin`, `coordinador` o `supervisor`, el sistema lo trata como `inmobiliaria`.

Nota importante: en varias lambdas existe una funcion llamada `require_admin`, pero en la practica significa "usuario interno", porque permite `admin`, `coordinador` y `supervisor`.

## Regla general

| Rol | Acceso general | Puede eliminar |
| --- | --- | --- |
| Admin | Acceso completo | Si |
| Coordinador | Acceso operativo interno | No |
| Supervisor | Acceso interno de consulta/gestion limitada | No |
| Inmobiliaria | Acceso limitado a sus proyectos, clientes y procesos | No |

La regla actual para eliminaciones es:

- Solo `admin` puede eliminar.
- `coordinador` puede gestionar y operar, pero no eliminar.
- `supervisor` no elimina.
- `inmobiliaria` no elimina.

## Modulos visibles por rol

| Modulo | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Dashboard | Si | Si | Si | Si |
| Proyectos / Inventario | Si | Si | Si | Si, limitado |
| Clientes | Si | Si | Si | Si, limitado |
| Inmobiliarias | Si | Si | No | No |
| Procesos | Si | Si | Si | Si, limitado |
| Migracion Excel | Si | Si | No | No |
| Agenda / Tareas | Si | Si | Si | No |
| Usuarios del sistema | Si | Si | No | No |
| Notificaciones / Configuracion | Si | Si | No | No |
| Inbox Meta | Si | Si | Si | No |
| Leads Meta | Si | Si | Si | No |
| Campanas de correo | Si | Si | Si | No |

## Permisos por modulo

### Proyectos / Inventario

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Ver proyectos | Si | Si | Si | Si, solo asignados |
| Ver unidades | Si | Si | Si | Si, limitado |
| Crear proyecto | Si | Si | No | No |
| Editar proyecto | Si | Si | No | No |
| Eliminar proyecto | Si | No | No | No |
| Crear etapa | Si | Si | No | No |
| Editar etapa | Si | Si | No | No |
| Eliminar etapa | Si | No | No | No |
| Crear unidad | Si | Si | No | No |
| Editar unidad | Si | Si | No | No |
| Eliminar unidad | Si | No | No | No |
| Exportar inventario | Si | Si | Si | Segun acceso al proyecto |
| Migracion Excel | Si | Si | No | No |

Para inmobiliaria, las unidades se filtran y se ocultan campos internos. Normalmente ve unidades disponibles/bloqueadas relacionadas a su acceso.

### Bloqueos

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Bloquear unidad disponible | Si | Si | No | Si |
| Crear bloqueo manual para una inmobiliaria | Si | Si | No | No |
| Ver bloqueos activos propios | Si | Si | Si | Si |
| Ver historial/admin de bloqueos | Si | Si | Si | No |
| Extender bloqueo | Si | Si | Si | No |
| Liberar bloqueo | Si | Si | Si | No |

Nota: liberar bloqueo actualmente se maneja como una accion operativa sobre bloqueos, no como eliminacion general de datos.

### Clientes

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Ver clientes | Si | Si | Si | Si, solo propios |
| Ver detalle de cliente | Si | Si | Si | Si, limitado |
| Actualizar datos de cliente/proceso | Si | Si | Si | Segun flujo permitido |
| Cambiar estatus de proceso | Si | Si | Si | Segun flujo permitido |
| Ver historial | Si | Si | Si | Segun acceso |
| Transferir cliente entre inmobiliarias | Si | Si | Si | No |
| Eliminar cliente / proceso | Si | No | No | No |

### Inmobiliarias

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Ver inmobiliarias | Si | Si | No | No |
| Crear inmobiliaria | Si | Si | No | No |
| Editar inmobiliaria | Si | Si | No | No |
| Habilitar/deshabilitar inmobiliaria | Si | Si | No | No |
| Eliminar inmobiliaria | Si | No | No | No |
| Gestionar usuarios de inmobiliaria | Si | Si | No | No |
| Eliminar usuarios de inmobiliaria | Si | No | No | No |

### Usuarios del sistema

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Ver usuarios internos | Si | Si | No | No |
| Crear usuario interno | Si | Si | No | No |
| Editar nombre de usuario | Si | Si | No | No |
| Cambiar rol de usuario | Si | No | No | No |
| Habilitar/deshabilitar usuario | Si | No | No | No |
| Eliminar usuario | Si | No | No | No |

### Agenda / Tareas

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Ver tareas | Si | Si | Si | No |
| Crear/asignar tareas | Si | Si | No | No |
| Editar tareas | Si | Si | No | No |
| Cancelar/eliminar tareas | Si | No | No | No |
| Ver trabajadores | Si | Si | Si | No |
| Crear/editar trabajadores | Si | No | No | No |

### Meta: Inbox y Leads

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Ver Inbox Meta | Si | Si | Si | No |
| Ver Leads Meta | Si | Si | Si | No |
| Enviar mensajes desde CRM | Si | Si | Si | No |
| Gestionar estado/responsable de lead | Si | Si | Si | No |
| Asociar lead con cliente existente | Si | Si | Si | No |
| Convertir lead | Si | Si | Si | No |

### Campanas de correo

| Accion | Admin | Coordinador | Supervisor | Inmobiliaria |
| --- | --- | --- | --- | --- |
| Ver campanas/historial | Si | Si | Si | No |
| Crear/enviar campanas | Si | Si | No | No |

## Seguridad backend aplicada

Ademas de ocultar botones en frontend, el backend valida eliminaciones.

Rutas protegidas para que solo `admin` pueda eliminar:

- Proyectos
- Etapas
- Unidades
- Usuarios internos
- Inmobiliarias
- Usuarios de inmobiliaria
- Eliminaciones del CRM
- Cancelacion/eliminacion de tareas

Respuesta esperada cuando un rol no autorizado intenta eliminar:

```json
{
  "message": "Solo administrador puede eliminar"
}
```

## Resumen ejecutivo

El `coordinador` queda como usuario operativo interno: puede acceder a los modulos administrativos necesarios, gestionar inventario, clientes, procesos, bloqueos, tareas, Meta y campanas, pero no puede eliminar informacion del sistema.

El `admin` conserva el control completo, incluyendo eliminaciones y cambios sensibles como cambio de rol.

El `supervisor` funciona como usuario interno de visibilidad y seguimiento, con gestion limitada.

La `inmobiliaria` opera solo sobre su propio alcance comercial.
