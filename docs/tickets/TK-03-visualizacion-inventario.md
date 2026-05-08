# TK-03 - Visualización de inventario con filtros y mejoras frontend

## Objetivo

Panel principal de inventario para que administración e inmobiliarias consulten
unidades de forma rápida, clara y con información controlada por rol.
Incluye mejoras visuales, filtros en cascada y experiencia de usuario optimizada.

---

## Alcance

### Backend (`jam-proyectos`)
- ✅ Endpoint `GET /proyectos/{id}/unidades` con soporte de query params para filtros
- ✅ Filtros disponibles: `etapa_id`, `torre_id`, `estado`
- ✅ La respuesta varía según el rol del token (admin vs inmobiliaria)
- ✅ Inmobiliaria NO ve: `cliente_id`, `bloqueado_por`
- ✅ `fecha_liberacion` y `tiempo_restante` incluidos para unidades bloqueadas (completado en TK-04)

### Frontend (React + Vite)
- ✅ Navegación proyecto → edificio → unidades con breadcrumb
- ✅ Filtros en cascada: etapa → torre → estado con botón limpiar
- ✅ Inmobiliarias solo ven proyectos asignados
- ✅ Tabla de unidades con columnas base (ID, metraje, precio, estado)
- ✅ Columna de edificio y etapa visibles en vista "todas las unidades del proyecto"
- ✅ Colores de estado diferenciados para todos los estados
- ✅ Columnas admin: `bloqueado_por`, `fecha_bloqueo` visibles solo para admin
- ✅ Colores de fila por estado en la tabla
- ✅ Cards de estadísticas (total, disponibles, bloqueadas, vendidas)
- ✅ Timer de bloqueo con tiempo restante (completado en TK-04)

| Campo | Admin | Inmobiliaria |
|-------|-------|--------------|
| ID unidad | ✔ | ✔ |
| Torre / Etapa | ✔ | ✔ |
| Metraje | ✔ | ✔ |
| Precio | ✔ | ✔ |
| Estado | ✔ | ✔ |
| Tiempo restante (bloqueo) | ✔ | ✔ |
| Cliente asociado | ✔ | ✗ |
| Inmobiliaria que bloqueó | ✔ | ✗ |
| Fecha de bloqueo | ✔ | ✗ |

---

## Filtros

| Filtro | Estado | Descripción |
|--------|--------|-------------|
| Proyecto | ✅ | Lista de proyectos asignados al usuario |
| Etapa | ✅ | Etapas del proyecto, filtra torres en cascada |
| Torre | ✅ | Torres filtradas por etapa seleccionada |
| Estado | ✅ | disponible, bloqueada, no_disponible, vendida, desvinculada |

---
## Filtros

| Filtro | Estado | Descripción |
|--------|--------|-------------|
| Proyecto | ✅ | Lista de proyectos asignados al usuario |
| Etapa | ✅ | Etapas del proyecto, filtra torres en cascada |
| Torre | ✅ | Torres filtradas por etapa seleccionada |
| Estado | ✅ | disponible, bloqueada, no_disponible, vendida, desvinculada |

---

## Timer de bloqueo

## Estados y visualización

| Estado | Color | Estado impl. |
|--------|-------|--------------|
| `disponible` | Verde | ✅ |
| `bloqueada` | Amarillo | ✅ |
| `no_disponible` | Naranja | ✅ |
| `vendida` | Gris | ✅ |
| `desvinculada` | Rojo claro | ✅ |

---

## Timer de bloqueo

- ✅ Se muestra solo cuando `estado = bloqueada`
- ✅ Tiempo restante calculado desde `fecha_liberacion` (provisto por TK-04)
- ✅ Color verde si quedan más de 5h, amarillo si quedan menos de 5h
- ✅ Visible para admin e inmobiliaria
## Estado

**Completado** — Abril 2026
## Criterios de aceptación

- ✅ El usuario puede filtrar unidades por proyecto, torre y estado
- ✅ Las inmobiliarias no ven `cliente_id` ni `bloqueado_por`
- ✅ Admin ve todos los campos incluyendo cliente e inmobiliaria bloqueadora
- ✅ Inmobiliarias solo ven proyectos que tienen asignados
- ✅ Filtro por etapa con cascada etapa → torre
- ✅ Cada estado tiene un color visual diferenciado
- ✅ La columna de etapa es visible en la tabla
- ✅ Las columnas admin (`bloqueado_por`, `fecha_bloqueo`) solo aparecen para admin
- ✅ Inmobiliaria no ve `fecha_bloqueo` ni `fecha_liberacion`
- ✅ Timer de bloqueo en tiempo real con color según proximidad al vencimiento

---

## Notas técnicas

- El backend filtra los campos de respuesta según el grupo Cognito del token
- El timer corre en el cliente calculado desde `fecha_liberacion` — no requiere polling
- `fecha_liberacion` y `tiempo_restante` son provistos por `jam-proyectos` tras el ajuste de TK-04
- Depende de: TK-01 (auth), TK-02 (modelo de datos), TK-04 (timer de bloqueo)

---

## Estado

**Completado** — Abril 2026