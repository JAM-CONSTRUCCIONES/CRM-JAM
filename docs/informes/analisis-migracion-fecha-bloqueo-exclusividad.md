# Analisis: migracion Excel y exclusividad de clientes

## Objetivo

Revisar como esta hoy la migracion de Excel y definir la forma correcta de implementar el pendiente:

- Cargar fecha de nacimiento.
- Cargar pais de residencia.
- Cargar pais de nacionalidad.
- Cargar Fecha Bloqueo.
- Usar Fecha Bloqueo como dato historico cuando venga desde Excel.
- Corregir el calculo de exclusividad de clientes importados.
- Mantener separado el bloqueo operativo activo de la fecha historica importada.

## Que tenemos actualmente

### Flujo de migracion

La migracion ya tiene un flujo completo:

1. Se sube el Excel.
2. Se genera un preview.
3. El usuario revisa y corrige filas.
4. Se confirma la migracion.
5. Se crean unidades, clientes, procesos e historial.

Archivos relevantes revisados:

- `lambdas/jam-proyectos/utils/excel_parser.py`
- `lambdas/jam-proyectos/utils/excel_writer.py`
- `lambdas/jam-proyectos/routes/excel.py`
- `lambdas/jam-excel-parser/utils/excel_parser.py`
- `lambdas/jam-excel-parser/utils/excel_writer.py`
- `front/src/components/inventario/MigracionExcel.tsx`
- `front/src/services/migracion.service.ts`

Nota importante: existen archivos parecidos en mas de una lambda. Antes de implementar hay que confirmar cual ruta esta usando el endpoint actual de migracion en dev. La recomendacion es corregir la ruta activa y mantener alineados los archivos duplicados si tambien se empaquetan o despliegan.

## Hallazgos

### 1. Fecha Bloqueo ya se reconoce

El parser ya reconoce `Fecha Bloqueo` y variantes como:

- `FECHA BLOQUEO`
- `Fecha Bloqueo`
- `FECHA_BLOQUEO`
- `FECHA INICIO`

El dato llega como `fecha_bloqueo` al preview.

Lo incompleto es que esa fecha no se usa correctamente para calcular la exclusividad del cliente importado.

### 2. Datos demograficos no se guardan desde Excel

Actualmente, cuando la migracion crea clientes, guarda estos campos vacios:

- `fecha_nacimiento`
- `nacionalidad`
- `pais_residencia`
- `edad`

Aunque el Excel traiga estos datos, hoy no se estan cargando realmente al cliente desde la migracion.

### 3. Exclusividad de migracion queda incompleta

En captacion y bloqueo normal, la exclusividad ya funciona con tres meses:

- Se guarda `fecha_captacion`.
- Se calcula `fecha_vencimiento`.
- Se crea un schedule para vencer la exclusividad.

En migracion, actualmente:

- El cliente se crea con `exclusividad_activa = true`.
- `fecha_captacion` usa la fecha de importacion.
- `fecha_vencimiento` queda vacia.
- No se crea schedule de vencimiento.

Esto puede dejar clientes importados con exclusividad activa, pero sin vencimiento automatico real.

### 4. Bloqueo operativo de migracion usa 24 horas

La regla normal de bloqueo del sistema es 48 horas.

En la migracion revisada, cuando una unidad entra como bloqueada, el bloqueo operativo se crea desde la fecha actual de importacion, pero usa 24 horas.

Esto no coincide con el pendiente, que indica que el bloqueo activo debe usar la regla actual de 48 horas desde el momento de la importacion.

### 5. Hay que separar dos fechas

Para evitar errores, deben manejarse dos conceptos separados:

- Fecha historica del Excel: viene de `Fecha Bloqueo` y sirve para historial y exclusividad.
- Fecha operativa del bloqueo activo: se crea al importar y sirve para liberar automaticamente la unidad.

La fecha historica no debe usarse para liberar el bloqueo activo, porque podria venir de meses anteriores.

## Recomendacion

Implementar esto como un solo cambio de migracion y exclusividad, no como tareas separadas.

### Regla propuesta

- Si el Excel trae `Fecha Bloqueo`, esa fecha se guarda como fecha historica.
- Para clientes importados, `Fecha Bloqueo` sera la fecha inicial de la exclusividad.
- `fecha_vencimiento` se calculara tres meses despues de esa fecha.
- Si no viene `Fecha Bloqueo`, se usara la fecha de importacion como fecha inicial, salvo que JAM confirme que debe ser obligatoria para ciertos estatus.
- Si el vencimiento calculado ya queda en el pasado, el cliente debe importarse sin exclusividad activa.
- Si al importar se crea un bloqueo operativo nuevo, ese bloqueo debe durar 48 horas desde la importacion.
- La fecha historica del Excel no debe alterar la duracion del bloqueo operativo activo.

## Que se debe implementar despues

### Backend: parser

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
- `PAIS DE NACIONALIDAD`

El preview debe incluir:

- `fecha_nacimiento`
- `pais_residencia`
- `nacionalidad`
- `fecha_bloqueo`

### Frontend: revision de migracion

Agregar columnas editables en el preview:

- Fecha de nacimiento.
- Pais de residencia.
- Nacionalidad.
- Fecha Bloqueo.

Si una fecha obligatoria falta, debe poder corregirse antes de confirmar o debe mostrarse error claro.

### Backend: confirmacion

Al confirmar la migracion:

- Guardar `fecha_nacimiento`, `pais_residencia` y `nacionalidad` en el cliente.
- Calcular `edad` desde `fecha_nacimiento`.
- Guardar `Fecha Bloqueo` como dato historico cuando exista.
- Usar `Fecha Bloqueo` como fecha inicial de exclusividad cuando exista.
- Calcular `fecha_vencimiento` a tres meses.
- Crear schedule de vencimiento cuando la exclusividad quede activa.
- No crear schedule si la exclusividad ya esta vencida al momento de importar.
- Cambiar el bloqueo operativo de migracion a 48 horas desde la importacion.

## Orden recomendado

1. Confirmar la ruta activa del endpoint de migracion en dev.
2. Ajustar parser para leer las nuevas columnas.
3. Ajustar tipos y preview del frontend.
4. Agregar columnas editables en revision de migracion.
5. Ajustar writer para guardar datos demograficos y calcular edad.
6. Ajustar exclusividad de migracion con Fecha Bloqueo.
7. Cambiar bloqueo operativo de migracion de 24 a 48 horas.
8. Validar errores antes de confirmar.
9. Probar con Excel de ejemplo.

## Casos de prueba necesarios

- Cliente importado con Fecha Bloqueo reciente.
- Cliente importado con Fecha Bloqueo antigua y exclusividad ya vencida.
- Cliente importado sin Fecha Bloqueo.
- Unidad importada como disponible.
- Unidad importada como bloqueada.
- Cliente con fecha de nacimiento valida.
- Cliente sin fecha de nacimiento.
- Pais de residencia cargado desde Excel.
- Nacionalidad cargada desde Excel.
- Bloqueo operativo creado desde migracion con vencimiento a 48 horas desde la importacion.
- Exclusividad calculada desde Fecha Bloqueo.

## Resumen

La base de migracion existe, pero este cambio no esta completo.

Ya se reconoce `Fecha Bloqueo`, pero falta usarla correctamente para exclusividad. Tambien falta cargar fecha de nacimiento, pais de residencia y nacionalidad desde Excel.

La recomendacion es resolverlo como una sola mejora de migracion: cargar los nuevos campos, calcular la exclusividad desde la fecha historica cuando exista y mantener el bloqueo operativo separado con 48 horas desde la importacion.
