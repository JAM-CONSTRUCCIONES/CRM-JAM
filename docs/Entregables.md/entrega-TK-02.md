# Entrega TK-02 — Módulo de Inventario

**Fecha de entrega:** Abril 2026
**Estado:** Completado

---

## Resumen

En esta entrega se construyó el módulo de inventario desde cero: la base de datos en la nube, todos los servicios del backend y la interfaz visual completa. El objetivo era reemplazar el manejo manual en Excel por un sistema centralizado, estructurado y con control de acceso por rol.

El módulo permite a JAM Construcciones organizar su inventario en una jerarquía clara de cuatro niveles: **Proyecto → Etapa → Edificio → Unidad**, y expone esa información de forma diferenciada según quién esté conectado.

---

## Qué se construyó

### Base de datos (AWS DynamoDB)

Se creó la tabla `jam-inventario` usando Single Table Design, lo que significa que proyectos, etapas, edificios y unidades conviven en una sola tabla optimizada para consultas rápidas y de bajo costo.

Cada registro se identifica por una combinación de claves que permite traer toda la información de un proyecto con una sola consulta, sin joins ni múltiples llamadas a la base de datos.

Se configuraron dos índices secundarios (GSI) para consultas cruzadas:
- Por edificio: permite listar todas las unidades de un edificio específico
- Por estado: permite listar todas las unidades disponibles, bloqueadas, vendidas, etc. en cualquier proyecto

### Backend (AWS Lambda — Python)

Se implementaron 14 endpoints organizados en dos grupos:

**Consulta (disponible para todos los usuarios autenticados):**
- Listar y consultar proyectos
- Listar etapas de un proyecto
- Listar edificios de un proyecto
- Listar unidades con filtros por edificio, etapa y estado
- Consultar el detalle de una unidad específica

**Administración (exclusivo para admin de JAM):**
- Crear, editar y desactivar proyectos
- Crear, editar y eliminar etapas
- Crear, editar y eliminar edificios
- Crear, editar y eliminar unidades

Todos los endpoints de administración están protegidos: si un usuario sin permisos intenta acceder, el sistema lo rechaza automáticamente.

### Frontend (React)

Se construyó la interfaz visual completa con un flujo de navegación de tres pasos:

**Proyectos → Edificios → Unidades**

En todo momento aparece un breadcrumb en la parte superior que muestra en qué nivel se está y permite volver atrás con un clic, sin perder el contexto.

---

## Cómo funciona paso a paso

### Paso 1 — Proyectos

Al ingresar al módulo desde el menú lateral, se muestran todos los proyectos como tarjetas visuales. Cada tarjeta muestra el nombre y la descripción del proyecto.

- El admin ve todos los proyectos del sistema.
- Las inmobiliarias solo ven los proyectos que el admin les haya asignado previamente. Si no tienen ninguno asignado, la pantalla aparece vacía.
- El admin puede crear un nuevo proyecto con nombre y descripción, editarlo en cualquier momento, o desactivarlo (el proyecto no se borra, queda inactivo y deja de ser visible para las inmobiliarias).

### Paso 2 — Edificios

Al hacer clic en un proyecto se accede a la vista de edificios, también en tarjetas. Cada tarjeta muestra el nombre del edificio y la etapa a la que pertenece, destacada con un color para identificarla de un vistazo.

Desde esta vista el admin tiene dos acciones disponibles en la parte superior:

- **Etapas:** abre un panel lateral para crear, editar y eliminar las etapas del proyecto. Las etapas son las fases de construcción (Etapa 1, Etapa 2, etc.) y sirven para agrupar los edificios.
- **Nuevo edificio:** abre un formulario para crear un edificio, asignándole un nombre y la etapa a la que pertenece. Los edificios existentes también se pueden editar o eliminar directamente desde su tarjeta.

> Si se intenta eliminar una etapa o edificio que tiene unidades activas asociadas, el sistema lo impide y muestra un mensaje de error.

### Paso 3 — Unidades

Al hacer clic en un edificio se accede a la tabla de unidades de ese edificio. La tabla muestra:

| Campo | Descripción |
|-------|-------------|
| ID de unidad | Identificador legible (ej: A-101) |
| Metraje | Superficie en m² |
| Precio | Valor de la unidad |
| Estado | Estado actual con indicador de color |

Se puede filtrar la tabla por estado para ver, por ejemplo, solo las unidades disponibles o solo las vendidas.

El admin puede crear nuevas unidades, editarlas o eliminarlas. Al crear una unidad dentro de un edificio, el sistema asigna automáticamente el edificio y la etapa correspondiente, por lo que solo hay que ingresar el ID, metraje y precio.

---

## Estados de una unidad

Cada unidad tiene un estado que refleja su situación comercial. En esta entrega el campo existe y se muestra visualmente. La lógica que cambia los estados de forma automática se implementará en las próximas entregas.

| Estado | Significado | Cuándo aplica |
|--------|-------------|---------------|
| Disponible | Lista para ser ofrecida | Estado inicial de toda unidad |
| Bloqueada | Reservada temporalmente por una inmobiliaria | Se implementa en TK-04 |
| No disponible | En proceso de venta activo | Se implementa en TK-06 |
| Vendida | Venta cerrada | Se implementa en TK-06 |
| Desvinculada | Proceso cancelado, unidad liberada | Se implementa en TK-06 |

---

## Control de acceso por rol

El sistema diferencia lo que puede ver y hacer cada tipo de usuario:

| Acción | Admin JAM | Inmobiliaria |
|--------|-----------|--------------|
| Ver todos los proyectos | ✔ | ✗ |
| Ver proyectos asignados | ✔ | ✔ |
| Ver edificios y unidades | ✔ | ✔ |
| Filtrar unidades por estado | ✔ | ✔ |
| Crear / editar proyectos | ✔ | ✗ |
| Crear / editar etapas y edificios | ✔ | ✗ |
| Crear / editar / eliminar unidades | ✔ | ✗ |

Esta separación se aplica tanto en el frontend (los botones de acción no aparecen para inmobiliarias) como en el backend (los endpoints de administración rechazan tokens sin permisos).

---

## Consideraciones técnicas relevantes

- La base de datos usa Single Table Design en DynamoDB, lo que minimiza costos y latencia al evitar múltiples tablas y joins.
- Los proyectos no se borran físicamente: se desactivan con `activo=false`, preservando el historial.
- Las etapas, edificios y unidades sí se eliminan físicamente, pero con validación previa.
- Todos los IDs son UUID v4 generados en el backend.
- La estructura de datos está diseñada para ser extensible: los campos de bloqueos, clientes y fechas ya existen en el modelo y se activarán en los próximos tickets sin necesidad de cambios en la base de datos.

---

## Próximas entregas

| Ticket | Descripción |
|--------|-------------|
| TK-04 | Bloqueo de unidades por inmobiliaria con liberación automática a las 48h |
| TK-05 | Registro y gestión de clientes vinculados a unidades |
| TK-06 | Cambio de estados comerciales (reserva, separación, venta, desvinculación) |
| TK-07 | Carga masiva de unidades desde archivo Excel |
