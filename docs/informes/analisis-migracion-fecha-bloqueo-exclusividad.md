# Analisis: migracion Excel, datos de cliente y exclusividad

## Objetivo

Dejar documentado como funciona actualmente la migracion de Excel, que ya se corrigio y que puntos quedan pendientes de revisar o ajustar.

Este documento sirve como base para seguir cambiando migraciones sin mezclarlo con QA ni con otros modulos.

## Flujo actual de migracion

La migracion de inventario funciona asi:

1. El usuario sube un archivo Excel desde el proyecto.
2. La IA ayuda a leer el archivo, detectar columnas y proponer valores cuando el Excel no viene perfectamente ordenado.
3. El sistema genera un preview con los datos interpretados.
4. En el preview se pueden corregir datos antes de confirmar.
5. Si hay errores, no se permite confirmar.
6. Al confirmar, se crean unidades, inmobiliarias nuevas cuando corresponda, clientes, procesos e historial.

Archivos principales:

- `front/src/components/inventario/MigracionExcel.tsx`
- `front/src/services/migracion.service.ts`
- `lambdas/jam-proyectos/routes/excel.py`
- `lambdas/jam-proyectos/utils/excel_parser.py`
- `lambdas/jam-proyectos/utils/excel_writer.py`

Nota: tambien existen copias dentro de `lambdas/jam-proyectos/package/`. Esas copias pueden estar desactualizadas y no deben usarse como referencia principal para nuevos cambios, salvo que se confirme que el empaquetado las necesita.

## Columnas que se reconocen actualmente

La migracion ya reconoce datos de unidad, precios, estado, inmobiliaria y cliente.

Para cliente ya se reconocen:

- Nombre cliente.
- Cedula.
- Telefono.
- Correo.
- Fecha de nacimiento.
- Pais de residencia.
- Nacionalidad.
- Fecha Bloqueo.

`Fecha Bloqueo` se reconoce con variantes como:

- `FECHA BLOQUEO`
- `Fecha Bloqueo`
- `FECHA_BLOQUEO`
- `FECHA INICIO`

## Cambios ya aplicados

### Datos de cliente

La migracion no debe crear documentos temporales ni valores inventados.

Reglas actuales:

- Si hay datos de cliente, el documento de identidad es obligatorio.
- El campo de documento seguira siendo el mismo campo usado actualmente para cedula/pasaporte.
- El documento solo aceptara letras y numeros.
- El documento no aceptara guiones, espacios, puntos ni otros simbolos.
- Las letras del documento se guardaran en mayuscula.
- Nombres y apellidos son obligatorios cuando hay cliente.
- Nombres y apellidos se guardan en mayuscula.
- Nombres y apellidos permiten espacios para personas con dos nombres o dos apellidos.
- Nombres y apellidos no aceptan numeros ni simbolos.
- Telefono solo acepta numeros.
- Correo debe tener formato valido y dominio con punto.
- Pais de residencia y nacionalidad se seleccionan desde el catalogo del sistema.

Estas reglas se aplican en tres momentos:

- En el preview editable del frontend.
- En la validacion backend antes de confirmar.
- En la escritura final del cliente.

### Datos demograficos

Cuando la migracion crea un cliente, ya guarda:

- Fecha de nacimiento.
- Edad calculada desde la fecha de nacimiento.
- Pais de residencia.
- Nacionalidad.

### Exclusividad

La exclusividad del cliente importado se calcula por tres meses.

Reglas actuales:

- Si el Excel trae `Fecha Bloqueo`, se usa como fecha inicial de exclusividad.
- Si no trae `Fecha Bloqueo`, se usa la fecha de importacion.
- Se calcula `fecha_vencimiento` tres meses despues.
- Si la fecha de vencimiento ya paso, el cliente se importa sin exclusividad activa.
- Si la exclusividad queda activa, se crea el schedule de vencimiento.

### Fecha Bloqueo como dato historico

Si el Excel trae `Fecha Bloqueo`, se guarda como dato historico en:

- Cliente.
- Proceso.
- Historial, cuando aplica.

Esta fecha historica no debe cambiar la duracion del bloqueo operativo activo.

### Bloqueo operativo

Si la unidad se importa como bloqueada, el bloqueo operativo se crea con la regla actual del sistema:

- 48 horas desde el momento de importacion.

Esto es independiente de la `Fecha Bloqueo` historica del Excel.

## Lo que todavia debemos revisar

### 1. Campos obligatorios por estatus

Actualmente la migracion valida cliente cuando hay datos de cliente, pero falta confirmar si algunos estatus deben exigir fechas especificas.

Ejemplo:

- Si una unidad viene como bloqueada, confirmar si `Fecha Bloqueo` debe ser obligatoria o si puede usarse la fecha de importacion.
- Si una unidad viene en separacion o contrato firmado, confirmar si debe exigirse algun dato adicional.

Recomendacion: no hacer obligatorio `Fecha Bloqueo` para todos los casos hasta que JAM confirme la regla.

### 2. Documento de identidad

El cliente ya confirmo que el mismo campo debe servir para cedula o pasaporte.

Regla definida:

- Se mantiene un solo campo de documento.
- Puede contener letras y numeros.
- No puede contener guiones, espacios ni simbolos.
- Las letras se guardan en mayuscula.

Ya aplicado en migraciones:

- El preview permite documento con letras y numeros.
- El preview no permite guiones, espacios ni simbolos.
- El backend valida lo mismo antes de confirmar.
- La escritura final guarda las letras del documento en mayuscula.

Pendiente de implementar despues:

- Aplicar esta misma regla en todos los lugares donde se crea o edita cliente.
- Ajustar mensajes visibles para que no diga solamente "cedula" cuando tambien puede ser pasaporte.

### 3. Catalogos de pais y nacionalidad

Pais de residencia y nacionalidad deben usar el catalogo estatico propio del sistema, el mismo que ya se usa en los formularios de clientes/captacion.

Regla definida:

- La IA puede ayudar a interpretar el valor que viene en el Excel.
- La IA debe intentar relacionar nombres comunes o variaciones con el catalogo del sistema.
- El resultado final siempre debe ser un valor existente en el catalogo estatico.
- En el preview de migracion deben mostrarse como listado seleccionable.
- Si el Excel trae un valor reconocido, se mostrara seleccionado.
- Si el Excel trae un valor que no coincide con el catalogo, se debe corregir desde el listado antes de confirmar.
- No se debe guardar texto libre para pais de residencia ni nacionalidad.

Pendiente de revisar:

- Afinar el mapeo de IA para casos comunes escritos diferente, por ejemplo `USA` a `Estados Unidos`.
- Si la IA no puede reconocer el valor con seguridad, el campo quedara pendiente para corregirse manualmente en el preview.

### 4. Copias `package/`

Hay archivos duplicados dentro de `lambdas/jam-proyectos/package/` que muestran reglas antiguas.

Pendiente:

- Confirmar si se generan automaticamente.
- Confirmar si se deben limpiar del repo o mantener actualizados.

Recomendacion: no editar esas copias manualmente hasta confirmar el flujo de empaquetado/deploy.

### 5. Prueba con Excel real

Falta probar con un Excel que incluya combinaciones reales:

- Cliente con dos nombres y dos apellidos.
- Cliente sin cedula.
- Cedula con letras o guiones.
- Telefono con letras o simbolos.
- Correo sin dominio valido.
- Pais de residencia valido.
- Nacionalidad valida.
- Pais o nacionalidad escrito fuera del catalogo.
- Fecha de nacimiento valida.
- Fecha Bloqueo reciente.
- Fecha Bloqueo antigua.
- Unidad disponible.
- Unidad bloqueada.
- Unidad no disponible.

## Casos esperados

### Cliente valido

Si el Excel trae:

- Nombres y apellidos correctos.
- Documento de identidad con letras y/o numeros, sin simbolos.
- Telefono numerico.
- Correo valido.
- Pais y nacionalidad del catalogo.

Entonces debe permitir confirmar y guardar el cliente normalizado.

### Cliente sin documento

Si el Excel trae cliente pero no trae documento de identidad:

- Debe aparecer error en preview.
- No debe permitir confirmar.
- No debe existir boton para generar documento temporal.

### Nombre con espacios

Si el cliente tiene dos nombres o dos apellidos:

- Debe permitir espacios.
- Debe guardar en mayuscula.

### Nombre con numeros o simbolos

Si nombres o apellidos tienen numeros o simbolos:

- Debe mostrar error.
- No debe permitir confirmar.

### Bloqueo historico

Si viene `Fecha Bloqueo`:

- Se guarda como historico.
- Sirve para calcular exclusividad.
- No cambia las 48 horas del bloqueo operativo creado al importar.

## Resumen

La migracion ya tiene la base completa y se reforzaron las reglas de datos de cliente.

Lo mas importante que queda por decidir antes de nuevos cambios es:

- Si `Fecha Bloqueo` sera obligatoria para algun estatus.
- Como se nombrara visualmente el campo de cedula/pasaporte para que sea claro.
- Si se hara mapeo automatico de paises/nacionalidades escritos distinto al catalogo.
- Que hacer con las copias antiguas dentro de `package/`.
