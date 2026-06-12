# Propuesta: organizar Clientes por proyecto

## Idea principal

El apartado Clientes deberia organizarse primero por proyecto.

En lugar de mostrar todos los clientes juntos desde el inicio, el usuario primero seleccionara el proyecto que quiere revisar. Despues de elegir el proyecto, vera los clientes relacionados con ese proyecto.

Esto haria que la vista sea mas clara, mas ordenada y mas facil de usar.

## Como se veria el flujo

1. El usuario entra al apartado Clientes.
2. El sistema muestra los proyectos disponibles.
3. El usuario selecciona un proyecto.
4. El sistema muestra los clientes de ese proyecto.
5. Dentro del proyecto, el usuario puede filtrar los clientes.

## Filtros dentro del proyecto

Una vez seleccionado el proyecto, se podran usar filtros como:

- Inmobiliaria.
- Clientes con unidad.
- Clientes sin unidad.
- Estatus del proceso.
- Busqueda por nombre.
- Busqueda por cedula.

## Clientes con unidad y sin unidad

Es importante separar estos casos:

- Clientes con unidad: clientes que ya tienen una unidad o proceso asociado.
- Clientes sin unidad: clientes registrados o captados que todavia no tienen unidad asignada.

Esto ayudara a saber que clientes necesitan seguimiento comercial, porque ya estan registrados pero aun no avanzaron hacia una unidad.

## Por que se recomienda hacerlo por proyecto

Ventajas:

- Evita mostrar una lista gigante de clientes mezclados.
- Hace mas facil revisar clientes de un proyecto especifico.
- Reduce confusion cuando una inmobiliaria trabaja en varios proyectos.
- Permite ver mejor cuantos clientes tiene cada proyecto.
- Facilita encontrar clientes sin unidad.
- Prepara mejor el sistema para exportaciones y campanias de correo.

## Por que no empezar por inmobiliaria

No se recomienda que la primera seleccion sea por inmobiliaria, porque una inmobiliaria puede trabajar en varios proyectos.

Si se empieza por inmobiliaria, igual despues habria que separar los datos por proyecto.

Por eso se recomienda:

- Primero seleccionar proyecto.
- Luego filtrar por inmobiliaria si hace falta.

## Como aplicara para usuarios administrativos

El usuario administrativo vera los proyectos disponibles y podra entrar a cada uno para revisar sus clientes.

Dentro de un proyecto podra filtrar por inmobiliaria, por clientes con unidad, clientes sin unidad y estatus.

## Como aplicara para usuarios inmobiliaria

El usuario inmobiliaria vera solo los proyectos que tenga asignados.

Si tiene un solo proyecto, se podria entrar directamente a ese proyecto.

Si tiene varios proyectos, primero seleccionara el proyecto y luego vera sus clientes correspondientes.

## Exportacion de clientes

La exportacion de clientes tambien deberia seguir esta misma logica.

Antes de exportar, el usuario deberia estar dentro de un proyecto.

La exportacion saldra del proyecto seleccionado y podra respetar los filtros aplicados.

Ejemplos:

- Exportar todos los clientes del proyecto.
- Exportar solo clientes de una inmobiliaria dentro del proyecto.
- Exportar solo clientes sin unidad.
- Exportar solo clientes con unidad.
- Exportar clientes por estatus del proceso.

## Beneficio para exportacion

Esto evita crear un archivo demasiado grande con clientes de todos los proyectos mezclados.

Tambien hace que el archivo exportado sea mas util, porque cada exportacion tendra un contexto claro.

Ejemplo:

- Proyecto: Torre Norte.
- Filtro: clientes sin unidad.
- Resultado: archivo con clientes captados en Torre Norte que todavia no tienen unidad asignada.

## Recomendacion final

Se recomienda reorganizar el apartado Clientes para que funcione por proyecto, similar a como se revisan proyectos, inventario o procesos.

La estructura recomendada seria:

1. Seleccionar proyecto.
2. Ver clientes del proyecto.
3. Filtrar por inmobiliaria, unidad, estatus o busqueda.
4. Exportar clientes usando el proyecto y filtros seleccionados.

Esta forma mantiene el sistema mas ordenado y prepara mejor las funciones futuras de exportacion y campanias de correo.
