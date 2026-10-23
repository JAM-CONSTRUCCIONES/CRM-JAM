# Propuesta para Clientes

## Necesidad

Debido a que se quiere conocer que clientes no cuentan con una unidad asignada, se propone ajustar el apartado Clientes para que esta informacion sea visible y facil de consultar.

## Propuesta

El apartado Clientes se organizara por proyecto.

Al entrar, el usuario seleccionara un proyecto y luego vera los clientes relacionados con ese proyecto.

En esa vista se mostraran tanto los clientes que tienen unidad asignada como los clientes que aun no tienen unidad.

En la misma pantalla del proyecto se mostrara el boton para exportar clientes en Excel.

## Cambio visual en Clientes

La pantalla de Clientes mostrara una columna de estatus.

El estatus usara los valores que ya existen actualmente en el sistema. Ademas, cuando un cliente no tenga unidad asignada, se mostrara como:

- Sin unidad.

Esto permitira identificar rapidamente que clientes necesitan seguimiento comercial.

## Clientes con una o mas unidades

La lista se mostrara tomando en cuenta la relacion del cliente con sus unidades o procesos dentro del proyecto.

Reglas:

- Cliente sin unidad: se mostrara una vez con estatus "Sin unidad".
- Cliente con una unidad: se mostrara una vez con su unidad y estatus correspondiente.
- Cliente con varias unidades o procesos: se mostrara una fila por cada unidad o proceso.

Esto evita mezclar estatus distintos en una sola fila.

## Archivo Excel

Al usar el boton de exportar, se descargara un archivo Excel con los clientes del proyecto seleccionado.

El archivo incluira los datos principales del cliente y una referencia sencilla de la unidad, cuando exista.

Columnas propuestas:

- Cedula.
- Nombre.
- Apellido.
- Correo.
- Telefono.
- Nacionalidad.
- Pais de residencia.
- Proyecto.
- Inmobiliaria.
- Estatus.
- Unidad.

Si el cliente no tiene unidad asignada, se mostrara con estatus "Sin unidad" y la unidad quedara vacia.

## Beneficio

Con este cambio, el cliente podra:

- Ver los clientes de cada proyecto.
- Identificar cuales clientes no tienen unidad asignada.
- Dar seguimiento comercial a esos clientes.
- Exportar una lista clara sin mezclar clientes de todos los proyectos.

## Pendiente de aprobacion

Pendiente de aprobacion para realizar el cambio con el alcance descrito en este documento.
