# Propuesta: link publico de inventario por inmobiliaria

Se propone crear un link publico permanente para cada inmobiliaria, de solo lectura, para que pueda compartir su inventario disponible con vendedores externos sin crearles usuarios en el sistema.

El link sera por inmobiliaria. Al abrirlo, primero se mostraran los proyectos asignados a esa inmobiliaria. Luego de seleccionar un proyecto, se mostraran solamente las unidades disponibles de ese proyecto.

El vendedor externo no podra editar, bloquear, cambiar estatus ni acceder al sistema administrativo.

## Informacion que se mostrara

La vista publica mostrara exactamente la misma estructura de inventario que actualmente ve una inmobiliaria, pero sin acciones.

Antes de ver unidades, el vendedor seleccionara un proyecto. Luego se mostrara la tabla de unidades disponibles con las mismas columnas que ve la inmobiliaria:

- ID Unidad.
- Etapa.
- Tipo.
- Bloque.
- Piso.
- Metraje, mostrando metraje de apartamento, terraza y patio en el mismo campo.
- Parqueos.
- Habitaciones / Banos.
- Precio, mostrando el precio principal y el desglose comercial de reserva, separacion, inicial, cuota, meses de cuota y contra entrega.
- Estado.

La unica diferencia sera que no se mostrara el boton de bloquear ni ninguna otra accion.

## Filtros disponibles

Luego de seleccionar el proyecto, el vendedor podra filtrar las unidades disponibles por:

- Etapa.
- Estado.
- Unidad.
- Tipo.
- Bloque o manzana.
- Piso.

Estos seran los mismos filtros visibles del inventario de inmobiliaria. En el link publico los filtros seran solo de consulta y no permitiran modificar, bloquear ni cambiar estatus de unidades.

## Informacion que no se mostrara

El link publico no mostrara informacion interna ni sensible:

- Clientes.
- Cedulas.
- Correos.
- Telefonos.
- Comentarios internos.
- Historial.
- Quien bloqueo una unidad.
- Fechas internas de bloqueo.
- Acciones para bloquear, editar, eliminar o cambiar estatus.
- Inventario de otras inmobiliarias.
- Botones de accion.

## Reglas del link

- El link funcionara mientras la inmobiliaria exista y este activa.
- Si la inmobiliaria esta inactiva, no se mostrara inventario.
- Si un proyecto deja de estar asignado a la inmobiliaria, dejara de aparecer en el link.
- Si una unidad deja de estar disponible, dejara de aparecer en el link.
- La seguridad se aplicara desde el sistema, no solo desde la pantalla.

## Donde se podra copiar el link

El link se podra ver o copiar desde dos lugares:

- En el apartado de Inmobiliarias del usuario JAM, para que administracion pueda abrir o copiar el link de cualquier inmobiliaria.
- En el acceso del usuario inmobiliaria, para que la propia inmobiliaria pueda copiar su enlace y compartirlo con sus vendedores externos.

Opciones sugeridas:

- "Ver link publico".
- "Copiar link de inventario".

Con esta aprobacion se procederia a crear la vista publica de inventario por inmobiliaria, manteniendo el acceso como solo lectura y mostrando unicamente las unidades disponibles permitidas para esa inmobiliaria.
