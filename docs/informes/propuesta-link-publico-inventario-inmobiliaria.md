# Propuesta: link publico de inventario por proyecto

Se propone crear un link publico permanente de solo lectura para compartir el inventario disponible de un proyecto con vendedores externos, sin crearles usuarios en el sistema.

El link sera por proyecto. Se copiara desde el proyecto correspondiente y, al abrirlo, mostrara automaticamente el inventario disponible de ese proyecto.

El vendedor externo solo podra consultar las unidades disponibles. No podra editar, bloquear, cambiar estatus ni acceder al sistema administrativo.

## Informacion que se mostrara

La vista publica mostrara exactamente la misma estructura de inventario del proyecto, pero sin acciones.

Al abrir el link se mostrara la tabla de unidades disponibles del proyecto, con las mismas columnas que ve la inmobiliaria:

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

Las unidades bloqueadas, separadas, vendidas o no disponibles no se visualizaran. Solo se mostraran unidades disponibles.

## Filtros disponibles

El vendedor podra filtrar las unidades disponibles por:

- Etapa.
- Estado.
- Unidad.
- Tipo.
- Bloque o manzana.
- Piso.

Estos seran los mismos filtros visibles del inventario. En el link publico los filtros seran solo de consulta y no permitiran modificar, bloquear ni cambiar estatus de unidades.

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
- Inventario de otros proyectos.
- Botones de accion.

## Reglas del link

- El link funcionara mientras el proyecto exista y este activo.
- Si el proyecto esta inactivo, no se mostrara inventario.
- Si una unidad deja de estar disponible, dejara de aparecer en el link.
- El sistema validara que el link corresponda a un proyecto existente y activo antes de mostrar informacion.

## Donde se podra copiar el link

El link se podra copiar desde el proyecto correspondiente:

- En el usuario JAM.
- En el acceso del usuario inmobiliaria.

El boton se llamara "Copiar link de inventario".

Con esta aprobacion se procederia a crear la vista publica de inventario por proyecto, manteniendo el acceso como solo lectura y mostrando unicamente las unidades disponibles de ese proyecto.

Con relacion a la entrega del sistema con los cambios solicitados, debido a la incorporacion de nuevos modulos como campañas de correos y enlace publico, se estima completar la entrega hasta el viernes 19/06. Mientras tanto, el trabajo continua en paralelo y el sistema puede seguir siendo utilizado con las funcionalidades que ya fueron implementadas previamente.
