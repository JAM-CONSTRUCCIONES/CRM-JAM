# Entrega TK-03 — Visualización de inventario con filtros y mejoras frontend

**Fecha de entrega:** Abril 2026
**Estado:** Completado (timer de bloqueo pendiente de TK-04)

---

## Resumen

En esta entrega se mejoró la experiencia visual y funcional del módulo de inventario. El objetivo era pasar de una interfaz funcional pero básica a una interfaz más clara, estructurada y diferenciada por rol. Se trabajó principalmente en el frontend, con un ajuste menor en el backend para el control de visibilidad de campos sensibles.

Adicionalmente se rediseñó el layout general de la aplicación (sidebar, navegación) y se mejoró la página de inmobiliarias.

---

## Qué se construyó

### Rediseño del layout general

Se eliminó la barra de navegación superior y se consolidó toda la navegación en el sidebar lateral, siguiendo un estilo más moderno y limpio.

- Logo de JAM Construcciones centrado en la parte superior del sidebar
- Menú con secciones agrupadas: navegación principal y administración
- Item activo resaltado en azul sólido con hover suave
- Perfil del usuario (nombre y rol) fijo en la parte inferior
- Botón de cerrar sesión con hover rojo
- Sidebar fijo de 250px, con drawer en móvil

### Mejoras en la vista de proyectos

Las tarjetas de proyecto fueron rediseñadas con un estilo tipo portada inmobiliaria:

- Imagen de portada configurable por proyecto (con gradiente de color único como fallback)
- Subida de imagen directa desde el formulario de edición, almacenada en S3 y servida por CloudFront
- Botones de editar y eliminar flotando sobre la imagen
- Título y descripción en la parte inferior de la card

### Infraestructura para imágenes (S3 + CloudFront)

Se agregó un bucket S3 `jam-assets` con un behavior adicional en CloudFront para servir imágenes públicamente bajo `/assets/*`. El flujo de subida es:

1. El admin solicita una presigned URL al backend (`POST /admin/proyectos/{id}/imagen`)
2. El frontend sube la imagen directamente a S3 con un `PUT` a esa URL
3. El backend guarda la URL pública de CloudFront en DynamoDB

### Mejoras en la vista de edificios

Los edificios ahora se agrupan visualmente por etapa, con una barra de color lateral que identifica cada etapa. Cada card de edificio tiene:

- Banda de color en la parte superior según su etapa
- Ícono con fondo suave del color de la etapa
- Nombre del edificio y etapa a la que pertenece
- Hover con borde del color de la etapa

### Mejoras en la vista de unidades

**Estadísticas en tiempo real:** fila de 4 tarjetas en la parte superior mostrando total, disponibles, bloqueadas y vendidas, actualizadas con cada cambio de filtro.

**Filtros en cascada:** los filtros de etapa y torre se cargan en cascada. Al seleccionar una etapa, la lista de torres se filtra automáticamente. Incluye botón para limpiar todos los filtros.

**Tabla mejorada:**
- Colores de fila diferenciados por estado (verde, amarillo, naranja, gris, rojo)
- Columna de etapa visible en la vista de todas las unidades
- Columna de edificio en la vista de todas las unidades
- Columnas `Bloqueado por` y `Fecha de bloqueo` visibles solo para admin
- Mensaje de vacío con contexto e ícono

**Acceso desde la vista de edificios:** se agregó el botón "Ver todas las unidades" en la vista de edificios para ir directamente a la tabla completa sin tener que entrar a un edificio específico.

**Gestión desde la vista de unidades:** el admin puede crear etapas y edificios directamente desde la vista de todas las unidades, sin necesidad de volver a la vista de edificios.

### Mejoras en la página de inmobiliarias

- Cards rediseñadas con banda de color, avatar con inicial y color único por inmobiliaria
- Hover con borde del color de la inmobiliaria
- Drawer de usuarios completamente rediseñado: header con avatar, nombre, contador de usuarios y correos de notificación
- Lista de usuarios con avatar, nombre y acciones inline (sin tabla)

---

## Control de visibilidad por rol

| Campo en inventario | Admin | Inmobiliaria |
|--------------------|-------|--------------|
| ID unidad, metraje, precio, estado | ✔ | ✔ |
| Etapa y edificio | ✔ | ✔ |
| Filtros en cascada | ✔ | ✔ |
| Bloqueado por | ✔ | ✗ |
| Fecha de bloqueo | ✔ | ✗ |
| Timer de bloqueo | ✔ (TK-04) | ✔ (TK-04) |

---

## Estados y colores

| Estado | Color de fila | Tag |
|--------|--------------|-----|
| Disponible | Verde suave | Verde |
| Bloqueada | Amarillo suave | Amarillo |
| No disponible | Naranja suave | Naranja |
| Vendida | Gris suave | Gris |
| Desvinculada | Rojo suave | Rojo |

---

## Archivos modificados

| Archivo | Tipo |
|---------|------|
| `front/src/pages/inventario/InventarioPage.tsx` | Modificado |
| `front/src/pages/inmobiliarias/InmobiliariasPage.tsx` | Modificado |
| `front/src/components/layout/Sidebar.tsx` | Modificado |
| `front/src/components/layout/AppLayout.tsx` | Modificado |
| `front/src/components/layout/Navbar.tsx` | Eliminado |
| `front/src/services/proyectos.service.ts` | Modificado |
| `front/src/types/index.ts` | Modificado |
| `front/src/index.css` | Modificado |
| `lambdas/jam-proyectos/routes/proyectos.py` | Modificado |
| `lambdas/jam-proyectos/handler.py` | Modificado |
| `infra/lib/jam-stack.ts` | Modificado |

---

## Pendiente (depende de TK-04)

| Item | Descripción |
|------|-------------|
| Timer de bloqueo | Countdown en tiempo real para unidades `bloqueada`, con alerta visual a ≤5h |
| Cambio visual automático | Al llegar a 0 la unidad cambia visualmente a `disponible` sin recargar |

---

## Próximas entregas

| Ticket | Descripción |
|--------|-------------|
| TK-04 | Bloqueo de unidades por inmobiliaria con liberación automática a las 48h |
| TK-05 | Registro y gestión de clientes vinculados a unidades |
| TK-06 | Cambio de estados comerciales (reserva, separación, venta, desvinculación) |
| TK-07 | Carga masiva de unidades desde archivo Excel |
