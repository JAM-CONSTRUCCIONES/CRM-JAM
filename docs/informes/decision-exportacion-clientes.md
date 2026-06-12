# Decision pendiente: exportacion de clientes

## Objetivo

Definir como debe funcionar la exportacion de clientes desde el apartado Clientes, evitando generar un archivo demasiado grande o dificil de usar.

La exportacion servira para seguimiento comercial y para preparar bases de contacto. No envia correos por si sola.

## Opciones de exportacion

### Opcion A: Exportar por proyecto

El usuario selecciona un proyecto y exporta los clientes relacionados con ese proyecto.

Ejemplo:

- Proyecto: `Torre Norte`
- Resultado: archivo con clientes captados o vinculados a unidades/procesos de `Torre Norte`.

Ventajas:

- Es la opcion mas ordenada para seguimiento comercial por proyecto.
- Evita archivos gigantes.
- Permite revisar mejor unidades, procesos y estatus dentro de un proyecto.
- Es mas facil validar si un cliente pertenece o no al archivo.
- Reduce riesgo de mezclar clientes de distintos proyectos.

Desventajas:

- Si se necesita una base general, hay que exportar varios proyectos por separado.
- Un cliente que esta en varios proyectos puede salir en varios archivos.

Recomendacion:

- Recomendada para la primera version.

### Opcion B: Exportar por inmobiliaria

El usuario selecciona una inmobiliaria y exporta todos los clientes asociados a esa inmobiliaria, sin importar el proyecto.

Ejemplo:

- Inmobiliaria: `Plusval`
- Resultado: archivo con clientes de `Plusval` en todos sus proyectos asignados.

Ventajas:

- Util para revisar el trabajo o cartera de una inmobiliaria.
- Sirve para seguimiento comercial por equipo o vendedor/inmobiliaria.
- Evita exportar clientes de inmobiliarias que no interesan.

Desventajas:

- Puede mezclar proyectos diferentes en el mismo archivo.
- Si una inmobiliaria maneja muchos proyectos, el archivo puede crecer bastante.
- Requiere que la columna Proyecto sea obligatoria para entender cada fila.

Recomendacion:

- Buena como segunda opcion o filtro adicional.

### Opcion C: Exportar por proyecto + inmobiliaria

El usuario selecciona un proyecto y opcionalmente una inmobiliaria.

Ejemplo:

- Proyecto: `Torre Norte`
- Inmobiliaria: `Plusval`
- Resultado: clientes de `Plusval` dentro de `Torre Norte`.

Ventajas:

- Es la opcion mas precisa.
- Genera archivos pequenos y faciles de revisar.
- Sirve para seguimiento por proyecto y por inmobiliaria al mismo tiempo.
- Reduce duplicados y mezcla de datos.

Desventajas:

- Requiere elegir mas filtros antes de exportar.
- Si se quiere una vista amplia, hay que hacer varias exportaciones.

Recomendacion:

- Mejor equilibrio entre control y utilidad.

### Opcion D: Exportar todo

Exporta todos los clientes disponibles para el rol del usuario.

Ejemplo:

- Admin exporta todos los clientes de todos los proyectos e inmobiliarias.

Ventajas:

- Sirve para respaldo general o analisis masivo.
- No requiere elegir filtros.

Desventajas:

- Puede generar un Excel gigante.
- Es mas dificil de revisar.
- Mayor riesgo de duplicados o confusion.
- Puede incluir datos que no se necesitan para la accion comercial puntual.
- Puede tardar mas y ser mas pesado para descargar.

Recomendacion:

- No recomendada como accion principal.
- Si se implementa, deberia ser una opcion secundaria solo para admin.

## Recomendacion final

Implementar primero exportacion por proyecto, con filtro opcional por inmobiliaria.

Flujo recomendado:

1. El usuario entra a Clientes.
2. Selecciona un Proyecto obligatorio.
3. Opcionalmente selecciona una Inmobiliaria.
4. Presiona `Exportar clientes`.
5. El sistema genera un Excel solo con esos clientes.

Esto evita crear un Excel gigante y mantiene la exportacion facil de revisar.

## Preguntas para el cliente

1. La exportacion debe ser obligatoriamente por proyecto?
2. Se debe permitir filtrar tambien por inmobiliaria dentro del proyecto?
3. El administrador necesita una opcion especial para exportar todo?
4. La inmobiliaria podra exportar clientes o solo administracion/coordinacion?
5. El archivo debe incluir una fila por cliente o una fila por cliente-unidad/proceso?

## Columnas sugeridas

Columnas minimas:

- Cedula.
- Nombres.
- Apellidos.
- Correo.
- Telefono.
- Proyecto.
- Inmobiliaria.
- Unidad.
- Estado del proceso.
- Fecha de captacion.

Columnas opcionales:

- Estado de exclusividad.
- Fecha de vencimiento de exclusividad.
- Fecha de nacimiento.
- Edad.
- Estado civil.
- Nacionalidad.
- Pais de residencia.

## Decision pendiente

Antes de implementar, el cliente debe confirmar una de estas opciones:

- `Proyecto obligatorio`.
- `Proyecto obligatorio + inmobiliaria opcional`.
- `Inmobiliaria obligatoria`.
- `Exportar todo solo para admin`.

Recomendacion tecnica: `Proyecto obligatorio + inmobiliaria opcional`.
