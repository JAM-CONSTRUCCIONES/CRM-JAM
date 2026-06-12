# Propuesta para exportacion de clientes

## Propuesta

Se propone que la exportacion de clientes sea por proyecto.

El usuario seleccionara un proyecto y el sistema generara un archivo Excel con los clientes de ese proyecto.

La exportacion sera simple. No se agregara una exportacion general de todos los proyectos juntos.

## Estatus

El archivo usara los estatus que ya existen actualmente en el sistema.

Ademas, se agregara el estatus "Sin unidad" para identificar a los clientes registrados que todavia no tienen una unidad asignada.

No se separara en dos grupos diferentes. Los clientes con unidad y sin unidad saldran en el mismo Excel, pero se podran reconocer por el estatus.

Ejemplo:

- Cliente con proceso: mantiene su estatus actual.
- Cliente sin unidad asignada: saldra con estatus "Sin unidad".

## Datos del archivo

El Excel incluira los datos necesarios del cliente y solo una referencia sencilla de la unidad.

Columnas propuestas:

- Cedula.
- Nombre.
- Apellido.
- Correo.
- Telefono.
- Proyecto.
- Inmobiliaria.
- Estatus.
- Unidad.

La columna Unidad solo mostrara la unidad relacionada al cliente. No se incluiran muchos datos de la unidad para mantener el archivo simple.

Si el cliente no tiene unidad, la columna Unidad quedara vacia y el estatus sera "Sin unidad".

## Beneficio

Esta forma permite obtener una lista clara de clientes por proyecto, incluyendo tanto clientes con unidad como clientes sin unidad.

Tambien evita generar un Excel demasiado grande o con informacion innecesaria.

## Pendiente de aprobacion

Confirmar si el cliente aprueba que la exportacion sea por proyecto y que el archivo incluya el estatus "Sin unidad" para los clientes que aun no tienen unidad asignada.
