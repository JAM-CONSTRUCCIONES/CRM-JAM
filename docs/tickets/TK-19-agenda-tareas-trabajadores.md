# TK-19 - Agenda y asignacion de tareas a trabajadores JAM

**Responsable:** Andres Alvarez  
**Prioridad:** Media-Alta  
**Estado sugerido:** Implementado en dev  
**Estimacion:** 16 a 24 horas  

---

## Objetivo

Crear un modulo interno de agenda para que usuarios `admin` y `coordinador` puedan asignar tareas a trabajadores JAM con fecha, hora, minuto y duracion estimada, permitiendo organizar el trabajo operativo diario por persona.

El modulo debe servir como base para planificar actividades internas de construccion, seguimiento comercial, visitas, mantenimiento, soporte o cualquier tarea operativa asociada a proyectos, unidades o procesos.

---

## Roles y permisos

| Rol | Permiso |
|-----|---------|
| `admin` | Puede crear, editar, eliminar, reasignar y completar tareas. Puede crear/editar trabajadores. |
| `coordinador` | Puede crear, editar, reasignar y completar tareas. Puede ver trabajadores activos. |
| `supervisor` | Opcional: solo lectura de agenda y tareas. |
| `inmobiliaria` | Sin acceso al modulo. |

Regla principal: solo `admin` y `coordinador` pueden asignar tareas a trabajadores JAM.

---

## Alcance funcional

- Crear una vista nueva de agenda/tareas dentro del frontend.
- Permitir crear tareas con fecha, hora y minuto exacto.
- Permitir asignar una tarea a un trabajador JAM.
- Permitir listar tareas por dia, trabajador, estado y prioridad.
- Permitir cambiar el estado de una tarea.
- Permitir editar fecha, hora, duracion, responsable, prioridad y descripcion.
- Permitir cancelar tareas segun permisos.
- Permitir registrar trabajadores JAM activos/inactivos.
- Preparar el modelo para agregar notificaciones en una fase posterior.

---

## Lo implementado

### Infraestructura

- Tabla DynamoDB `jam-tareas`.
- Indices `gsi-fecha`, `gsi-trabajador` y `gsi-estado`.
- Lambda `jam-tareas`.
- Ruta protegida `/admin/tareas` con metodo `ANY` para minimizar recursos de API Gateway.
- Tabla incluida en AWS Backup.

### Backend

- `GET /admin/tareas` lista tareas con filtros por fecha, trabajador, estado y prioridad.
- `POST /admin/tareas` crea tareas.
- `PUT /admin/tareas` actualiza tareas y permite cambio de estado.
- `DELETE /admin/tareas?tarea_id=<id>` marca tareas como `cancelada`.
- `GET /admin/tareas?tipo=trabajadores` lista trabajadores.
- `POST /admin/tareas` con `tipo=trabajador` crea trabajadores.
- `PUT /admin/tareas` con `tipo=trabajador` actualiza trabajadores.

### Frontend

- Nueva pagina `Agenda / Tareas` en `/tareas`.
- Nuevo servicio `tareas.service.ts`.
- Acceso protegido para `admin`, `coordinador` y `supervisor`.
- `admin` y `coordinador` pueden crear/editar tareas.
- `admin` puede crear/editar trabajadores.
- Vista responsive con filtros, resumen y acciones rapidas.

---

## Estados de tarea

| Estado | Descripcion |
|--------|-------------|
| `pendiente` | Tarea creada, aun no iniciada. |
| `en_progreso` | El trabajador o coordinador marco que la tarea esta en ejecucion. |
| `completada` | Tarea finalizada. |
| `cancelada` | Tarea anulada, preservando historial. |

---

## Prioridades

| Prioridad | Uso |
|-----------|-----|
| `baja` | Actividad sin urgencia. |
| `media` | Tarea normal del dia. |
| `alta` | Tarea importante o urgente. |

---

## Modelo de datos propuesto

### Tabla: `jam-tareas`

| pk | sk | tipo | Uso |
|----|----|------|-----|
| `TAREA#<tarea_id>` | `METADATA` | `tarea` | Registro principal de una tarea. |
| `TRABAJADOR#<trabajador_id>` | `METADATA` | `trabajador` | Registro principal de un trabajador JAM. |

### Item: tarea

```json
{
  "pk": "TAREA#<tarea_id>",
  "sk": "METADATA",
  "tipo": "tarea",
  "tarea_id": "<uuid>",
  "titulo": "Revisar avance de obra",
  "descripcion": "Validar avance y reportar novedades.",
  "trabajador_id": "<uuid>",
  "trabajador_nombre": "Juan Perez",
  "fecha": "2026-07-13",
  "hora": "14:30",
  "fecha_hora_inicio": "2026-07-13T14:30:00-04:00",
  "duracion_minutos": 60,
  "estado": "pendiente",
  "prioridad": "media",
  "proyecto_id": "<opcional>",
  "proyecto_nombre": "<opcional>",
  "unidad_id": "<opcional>",
  "creado_por": "<cognito_sub>",
  "creado_por_nombre": "Admin JAM",
  "creado_en": "2026-07-13T18:30:00Z",
  "actualizado_en": "2026-07-13T18:30:00Z"
}
```

### Item: trabajador

```json
{
  "pk": "TRABAJADOR#<trabajador_id>",
  "sk": "METADATA",
  "tipo": "trabajador",
  "trabajador_id": "<uuid>",
  "nombre": "Juan Perez",
  "telefono": "<opcional>",
  "correo": "<opcional>",
  "cargo": "Obrero",
  "activo": true,
  "creado_en": "2026-07-13T18:30:00Z",
  "actualizado_en": "2026-07-13T18:30:00Z"
}
```

---

## Indices recomendados

| Indice | Partition key | Sort key | Uso |
|--------|---------------|----------|-----|
| `gsi-tipo` | `tipo` | `creado_en` | Listar trabajadores o tareas por tipo. |
| `gsi-fecha` | `fecha` | `fecha_hora_inicio` | Ver agenda diaria ordenada por hora. |
| `gsi-trabajador` | `trabajador_id` | `fecha_hora_inicio` | Ver agenda de un trabajador. |
| `gsi-estado` | `estado` | `fecha_hora_inicio` | Filtrar tareas pendientes, completadas o canceladas. |

---

## Backend propuesto

Crear nueva lambda:

```txt
lambdas/jam-tareas
```

Variables de entorno:

```txt
TAREAS_TABLE=jam-tareas
USUARIOS_TABLE=jam-usuarios
INVENTARIO_TABLE=jam-inventario
```

Endpoints sugeridos:

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| `GET` | `/admin/tareas` | `admin`, `coordinador`, `supervisor` | Lista tareas con filtros. |
| `POST` | `/admin/tareas` | `admin`, `coordinador` | Crea una tarea. |
| `GET` | `/admin/tareas/{tarea_id}` | `admin`, `coordinador`, `supervisor` | Obtiene detalle de tarea. |
| `PUT` | `/admin/tareas/{tarea_id}` | `admin`, `coordinador` | Edita una tarea. |
| `DELETE` | `/admin/tareas/{tarea_id}` | `admin` | Elimina o cancela una tarea. |
| `GET` | `/admin/trabajadores` | `admin`, `coordinador`, `supervisor` | Lista trabajadores. |
| `POST` | `/admin/trabajadores` | `admin` | Crea un trabajador. |
| `PUT` | `/admin/trabajadores/{trabajador_id}` | `admin` | Edita o desactiva trabajador. |

Nota: si API Gateway esta cerca del limite de recursos, se puede usar una ruta compacta como `/admin/tareas` con acciones internas por metodo, query params o body.

---

## Frontend propuesto

Agregar nueva ruta:

```txt
/tareas
```

Agregar item en sidebar para usuarios internos autorizados:

```txt
Agenda / Tareas
```

Componentes sugeridos:

- `front/src/pages/tareas/TareasPage.tsx`
- `front/src/services/tareas.service.ts`

La pantalla debe incluir:

- Vista de tareas del dia.
- Filtro por fecha.
- Filtro por trabajador.
- Filtro por estado.
- Filtro por prioridad.
- Boton para crear nueva tarea.
- Modal de crear/editar tarea.
- Acciones rapidas para marcar como `en_progreso`, `completada` o `cancelada`.

---

## Validaciones

- `titulo` obligatorio.
- `trabajador_id` obligatorio.
- `fecha` obligatoria.
- `hora` obligatoria en formato `HH:mm`.
- `fecha_hora_inicio` debe construirse de forma consistente desde fecha y hora.
- `duracion_minutos` debe ser mayor a 0 si se envia.
- `estado` debe ser uno de los estados permitidos.
- `prioridad` debe ser una de las prioridades permitidas.
- No permitir asignar tareas a trabajadores inactivos.
- No permitir acceso a `inmobiliaria`.

---

## Criterios de aceptacion

- [x] Existe un modulo visible como `Agenda / Tareas`.
- [x] Solo `admin` y `coordinador` pueden crear o asignar tareas.
- [x] `inmobiliaria` no puede acceder al modulo.
- [x] Se puede crear una tarea con dia, hora y minuto especifico.
- [x] Se puede asignar la tarea a un trabajador JAM activo.
- [x] Se pueden listar tareas por fecha.
- [x] Se pueden filtrar tareas por trabajador, estado y prioridad.
- [x] Se puede editar una tarea existente.
- [x] Se puede cambiar el estado de una tarea.
- [x] Se puede registrar y desactivar trabajadores JAM.
- [x] La informacion queda persistida en DynamoDB.
- [x] El modulo respeta el estilo visual y flujo de autenticacion actual.

---

## Fuera de alcance inicial

- Notificaciones automaticas por correo o WhatsApp.
- Login individual para trabajadores.
- Confirmacion desde celular del trabajador.
- Reglas complejas de disponibilidad o calendario laboral.
- Integracion con calendarios externos como Google Calendar.

Estas funciones pueden agregarse en una segunda fase.

---

## Notas tecnicas

- Mantener timestamps en ISO 8601.
- Usar UUID v4 para `tarea_id` y `trabajador_id`.
- Preservar historial mediante `estado = cancelada` antes de eliminar fisicamente, salvo que se requiera borrado real.
- Reutilizar helpers de autenticacion y respuesta de lambdas existentes.
- Reutilizar `ProtectedRoute` en frontend para limitar acceso por rol.
- Depende de TK-01 para autenticacion y control de roles.
