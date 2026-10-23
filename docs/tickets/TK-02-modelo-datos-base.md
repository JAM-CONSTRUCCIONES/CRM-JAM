# TK-02 - Modelo de datos base: proyectos, etapas, edificios y unidades

## Objetivo

Construir la estructura base de datos para soportar proyectos, inventario, edificios,
etapas y unidades con sus atributos fundamentales.

---

## Entidades principales

### Proyecto
Representa un desarrollo inmobiliario completo.

### Etapa
Una fase dentro de un proyecto (ej: Etapa 1, Etapa 2).

### Edificio (Torre / Bloque)
Agrupación de unidades dentro de una etapa (ej: Edificio A, Edificio B).
> Nota: en backend y base de datos se mantiene el término `torre` / `TORRE`. El término "Edificio" es solo visual en el frontend.

### Unidad
Unidad individual en venta (apartamento, local, etc.).

---

## Modelo DynamoDB (Single Table Design)

### Tabla: `jam-inventario`

| pk | sk | Entidad |
|----|-----|---------|
| `PROYECTO#<id>` | `METADATA` | Proyecto |
| `PROYECTO#<id>` | `ETAPA#<id>` | Etapa dentro del proyecto |
| `PROYECTO#<id>` | `TORRE#<id>` | Edificio dentro del proyecto |
| `PROYECTO#<id>` | `UNIDAD#<id>` | Unidad dentro del proyecto |

#### Atributos: Proyecto
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `METADATA` |
| proyecto_id | String | UUID v4 |
| nombre | String | Nombre del proyecto |
| descripcion | String | Descripción opcional |
| activo | Boolean | Proyecto habilitado |
| creado_en | String | ISO timestamp |

#### Atributos: Etapa
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `ETAPA#<id>` |
| etapa_id | String | UUID v4 |
| nombre | String | Nombre de la etapa |
| orden | Number | Orden de visualización |
| activo | Boolean | Etapa habilitada |
| creado_en | String | ISO timestamp |

#### Atributos: Edificio (Torre)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `TORRE#<id>` |
| torre_id | String | UUID v4 |
| nombre | String | Nombre del edificio (ej: Edificio A) |
| etapa_id | String | Referencia a la etapa |
| orden | Number | Orden de visualización |
| activo | Boolean | Edificio habilitado |
| creado_en | String | ISO timestamp |

#### Atributos: Unidad
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `UNIDAD#<id>` |
| unidad_id | String | UUID v4 |
| id_unidad | String | Identificador legible (ej: A-101) |
| etapa_id | String | Referencia a la etapa |
| torre_id | String | Referencia al edificio |
| metraje | Number | m² |
| precio | Number | Valor de la unidad |
| estado | String | Estado actual (default: `disponible`) |
| bloqueado_por | String | inmobiliaria_id que bloqueó (TK-04) |
| cliente_id | String | Referencia al cliente asociado (TK-05) |
| fecha_bloqueo | String | ISO timestamp inicio bloqueo (TK-04) |
| fecha_liberacion | String | ISO timestamp fin bloqueo (TK-04) |
| creado_en | String | ISO timestamp |
| actualizado_en | String | ISO timestamp |

---

## Estados de unidad

Los estados existen como campo en el modelo de datos y se muestran visualmente en el frontend. La lógica de negocio que cambia estos estados se implementa en tickets posteriores.

| Estado | Descripción | Implementado en |
|--------|-------------|-----------------|
| `disponible` | Unidad disponible en inventario | TK-02 (campo base) |
| `bloqueada` | Bloqueada por inmobiliaria por 48h | TK-04 |
| `no_disponible` | Reservada / en proceso de venta | TK-06 |
| `vendida` | Venta cerrada | TK-06 |
| `desvinculada` | Proceso cancelado, unidad liberada | TK-06 |

> El cambio manual de estado por admin (sin flujo de negocio) se definirá junto con TK-04 o TK-06 según prioridad.

---

## Índices secundarios (GSI)

| GSI | pk | sk | Uso |
|-----|----|----|-----|
| `gsi-torre` | `torre_id` | `sk` | Consultar unidades por edificio |
| `gsi-estado` | `estado` | `creado_en` | Consultar unidades por estado |

Nota: GSI adicionales como `gsi-inmobiliaria` se agregarán en TK-04.

---

## Endpoints implementados (Lambda Python)

### Lectura (autenticados)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/proyectos` | Listar proyectos activos |
| `GET` | `/proyectos/{id}` | Detalle de un proyecto |
| `GET` | `/proyectos/{id}/etapas` | Listar etapas de un proyecto |
| `GET` | `/proyectos/{id}/torres` | Listar edificios de un proyecto |
| `GET` | `/proyectos/{id}/unidades` | Listar unidades (filtros: `estado`, `torre_id`, `etapa_id`) |
| `GET` | `/proyectos/{id}/unidades/{unidad_id}` | Detalle de una unidad |

### Administración (solo admin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/admin/proyectos` | Crear proyecto |
| `PUT` | `/admin/proyectos/{id}` | Editar proyecto |
| `DELETE` | `/admin/proyectos/{id}` | Soft delete (`activo=false`) |
| `POST` | `/admin/proyectos/{id}/etapas` | Crear etapa |
| `PUT` | `/admin/proyectos/{id}/etapas/{etapa_id}` | Editar etapa |
| `DELETE` | `/admin/proyectos/{id}/etapas/{etapa_id}` | Eliminar etapa |
| `POST` | `/admin/proyectos/{id}/torres` | Crear edificio |
| `PUT` | `/admin/proyectos/{id}/torres/{torre_id}` | Editar edificio |
| `DELETE` | `/admin/proyectos/{id}/torres/{torre_id}` | Eliminar edificio |
| `POST` | `/admin/proyectos/{id}/unidades` | Crear unidad |
| `PUT` | `/admin/proyectos/{id}/unidades/{unidad_id}` | Editar unidad |
| `DELETE` | `/admin/proyectos/{id}/unidades/{unidad_id}` | Eliminar unidad |

---

## Navegación frontend implementada

Flujo de 3 niveles con cards:

```
Proyectos (cards) → Edificios (cards) → Unidades (tabla)
```

- Vista Proyectos: cards seleccionables con nombre y descripción
- Vista Edificios: cards con nombre del edificio y etapa visible como tag de color
  - Botón "Etapas" → drawer para gestionar etapas
  - Botón "Nuevo edificio" → modal para crear/editar edificios
- Vista Unidades: tabla con filtro por estado
  - Breadcrumb de navegación en todos los niveles
- Inmobiliarias solo ven proyectos que admin les asignó

---

## Criterios de aceptación

- [x] La tabla `jam-inventario` está creada en DynamoDB con la estructura definida
- [x] Se pueden crear, editar y eliminar proyectos
- [x] Se pueden crear, editar y eliminar etapas asociadas a un proyecto
- [x] Se pueden crear, editar y eliminar edificios asociados a un proyecto y etapa
- [x] Se pueden crear, editar y eliminar unidades con todos sus atributos
- [x] Los endpoints de lectura permiten listar y consultar proyectos, etapas, edificios y unidades
- [x] Los filtros por `estado` y `torre_id` funcionan en el listado de unidades
- [x] Los GSI `gsi-torre` y `gsi-estado` están definidos en infraestructura (verificar en AWS que estén activos)
- [x] Todas las unidades se crean con estado `disponible` por defecto
- [ ] Cambio de estado por lógica de negocio → ver TK-04 (bloqueos) y TK-06 (estatus comerciales)
- [x] El eliminado de proyectos es soft delete (`activo=false`)
- [x] Los endpoints de admin están protegidos por autenticación (TK-01)
- [x] El frontend muestra proyectos como tarjetas seleccionables
- [x] El frontend muestra edificios como tarjetas con etapa visible
- [x] El frontend permite gestionar etapas y edificios desde la vista de inventario
- [x] El frontend permite crear, editar y eliminar unidades desde la vista de inventario
- [x] Inmobiliarias solo ven proyectos asignados por admin

---

## Notas técnicas

- Single Table Design en DynamoDB para minimizar costos y latencia
- Todos los timestamps en ISO 8601 UTC
- El campo `estado` inicia siempre en `disponible`
- La estructura es extensible: campos adicionales se agregan sin migraciones
- Los IDs se generan con UUID v4
- Eliminado de proyectos es soft delete; etapas, edificios y unidades se eliminan físicamente
- Al eliminar una etapa o edificio, se valida que no tenga unidades activas asociadas
- Depende de: TK-01 (autenticación y autorización)
