# Analisis: migracion, Fecha Bloqueo y exclusividad

## Objetivo revisado

Se debe soportar en migracion de Excel:

- Fecha de nacimiento.
- Pais de residencia.
- Pais de nacionalidad.
- Fecha Bloqueo.

Ademas, la columna "Fecha Bloqueo" debe servir como fecha historica para calcular la exclusividad del cliente cuando el cliente viene importado desde Excel.

Si durante la importacion se crea un bloqueo operativo nuevo, el tiempo activo del bloqueo debe seguir la regla actual desde el momento de la importacion, no desde la fecha historica del Excel.

## Que tenemos actualmente

### Migracion de Excel

La migracion ya tiene flujo completo:

1. Se sube el archivo Excel.
2. Se genera un preview en S3.
3. El usuario revisa y corrige filas en pantalla.
4. Se confirma la migracion.
5. Se crean unidades, inmobiliarias, clientes, procesos e historial.

Archivos principales:

- `lambdas/jam-proyectos/utils/excel_parser.py`
- `lambdas/jam-proyectos/utils/excel_writer.py`
- `lambdas/jam-proyectos/routes/excel.py`
- `front/src/components/inventario/MigracionExcel.tsx`
- `front/src/services/migracion.service.ts`

### Fecha Bloqueo

La columna "Fecha Bloqueo" ya se reconoce en el parser.

Actualmente se acepta con estos nombres:

- `FECHA BLOQUEO`
- `Fecha Bloqueo`
- `FECHA_BLOQUEO`
- `FECHA INICIO`

Tambien existe `fecha_bloqueo` en el tipo del frontend para el preview.

### Bloqueo operativo en migracion

Cuando una unidad entra como `bloqueada`, el sistema no usa la fecha del Excel para el bloqueo activo. Usa la fecha actual de importacion.

Eso coincide con la idea de no calcular el bloqueo activo desde la fecha historica.

Pero hay un punto a corregir: el codigo actual de migracion usa `24 horas` para el bloqueo creado por migracion, mientras el pendiente aprobado habla de mantener la regla actual de `48 horas`.

### Clientes creados por migracion

Cuando se crea un cliente desde migracion, actualmente se guardan estos campos demograficos vacios:

- `nacionalidad`: vacio.
- `pais_residencia`: vacio.
- `fecha_nacimiento`: vacio.
- `edad`: `None`.

Esto significa que aunque el Excel traiga esos datos, hoy no se estan cargando realmente al cliente desde la migracion.

### Exclusividad

La exclusividad en captacion y bloqueos directos ya existe y dura tres meses.

En esos flujos:

- Se guarda `fecha_captacion`.
- Se guarda `fecha_vencimiento`.
- Se crea un schedule para vencer la exclusividad.

En migracion, actualmente:

- El cliente se crea con `exclusividad_activa = True`.
- `fecha_captacion` se guarda con la fecha actual de importacion.
- `fecha_vencimiento` queda vacia.
- No se crea schedule de vencimiento de exclusividad.
- El proceso puede usar `fecha_bloqueo` como `fecha_inicio`, pero eso no queda aplicado correctamente al calculo real de exclusividad.

## Que esta mal o incompleto

### 1. Fecha Bloqueo se reconoce, pero no se usa completo para exclusividad

La fecha se lee del Excel, pero no se usa para guardar:

- `fecha_captacion` historica.
- `fecha_vencimiento` a tres meses.
- schedule de vencimiento de exclusividad.

### 2. Falta cargar datos demograficos desde Excel

La migracion no esta cargando:

- Fecha de nacimiento.
- Pais de residencia.
- Pais de nacionalidad.

Esos campos tampoco aparecen como columnas editables en la pantalla de revision de migracion.

### 3. Regla de horas del bloqueo operativo no coincide con el texto pendiente

El codigo dice bloqueo de migracion por 24 horas.

El pendiente dice que si se crea bloqueo operativo nuevo debe mantenerse la regla actual de 48 horas desde la importacion.

Antes de implementar hay que alinear esto a 48 horas si esa es la regla final aprobada.

### 4. Falta separar claramente dos fechas

Para evitar confusiones, conviene manejar dos conceptos:

- Fecha historica de bloqueo del Excel: sirve para historial y exclusividad.
- Fecha operativa de bloqueo creado al importar: sirve para liberar automaticamente el bloqueo activo.

Hoy el codigo ya calcula una fecha operativa actual, pero no conserva de forma clara la fecha historica como dato separado para todos los usos necesarios.

## Que se debe implementar despues

### Backend: parser de Excel

Agregar reconocimiento de columnas:

- `FECHA NACIMIENTO`
- `Fecha de nacimiento`
- `NACIMIENTO`
- `PAIS RESIDENCIA`
- `Pais de residencia`
- `PAIS DE RESIDENCIA`
- `NACIONALIDAD`
- `Pais de nacionalidad`
- `PAIS NACIONALIDAD`

El preview debe incluir:

- `fecha_nacimiento`
- `pais_residencia`
- `nacionalidad`
- `fecha_bloqueo`

### Frontend: pantalla de revision de migracion

Agregar columnas editables en el preview:

- Fecha de nacimiento.
- Pais de residencia.
- Nacionalidad.
- Fecha Bloqueo.

Si una fecha obligatoria falta, debe poder corregirse antes de confirmar o debe bloquear la confirmacion con error claro.

### Backend: confirmacion de migracion

Al confirmar:

- Guardar `fecha_nacimiento`, `pais_residencia` y `nacionalidad` en el cliente.
- Calcular `edad` desde `fecha_nacimiento`.
- Usar `Fecha Bloqueo` del Excel como fecha historica para la exclusividad cuando exista.
- Calcular `fecha_vencimiento` como tres meses despues de esa fecha historica.
- Crear o ajustar el schedule de vencimiento de exclusividad usando `fecha_vencimiento`.
- Si no viene `Fecha Bloqueo` y es obligatoria para ese caso, devolver error antes de completar la migracion.

### Backend: bloqueo operativo

Cuando la unidad importada venga como bloqueada:

- Crear el bloqueo activo desde la fecha de importacion.
- Calcular liberacion con la regla aprobada de 48 horas desde la importacion.
- No usar la fecha historica del Excel para liberar el bloqueo activo.
- Guardar la fecha historica del Excel como dato separado o en el historial, para consulta y calculo de exclusividad.

## Recomendacion de implementacion

Implementar en este orden:

1. Ajustar parser y tipos del frontend para que los nuevos campos viajen en el preview.
2. Agregar columnas editables en la pantalla de revision de migracion.
3. Ajustar writer para guardar datos demograficos y calcular edad.
4. Ajustar exclusividad de migracion para usar `Fecha Bloqueo` como origen historico.
5. Cambiar duracion del bloqueo operativo de migracion de 24 a 48 horas, si esa es la regla aprobada.
6. Agregar validaciones antes de confirmar.
7. Probar con un Excel que tenga clientes con y sin `Fecha Bloqueo`.

## Casos de prueba necesarios

- Cliente importado con `Fecha Bloqueo`.
- Cliente importado sin `Fecha Bloqueo`.
- Unidad importada como disponible.
- Unidad importada como bloqueada.
- Cliente con fecha de nacimiento valida.
- Cliente sin fecha de nacimiento.
- Pais de residencia y nacionalidad cargados desde Excel.
- Bloqueo operativo creado al importar con vencimiento desde la importacion.
- Exclusividad calculada desde la fecha historica del Excel.

## Resumen

La base existe, pero el cambio no esta completo.

Ya se reconoce `Fecha Bloqueo`, pero falta usarla correctamente para exclusividad y falta cargar los nuevos datos demograficos desde Excel. Tambien hay que corregir o confirmar la diferencia entre las 24 horas actuales de migracion y la regla pendiente de 48 horas para bloqueos operativos nuevos.
