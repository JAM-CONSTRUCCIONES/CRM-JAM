# TK-07 - Carga masiva de inventario desde Excel

## Objetivo

Permitir la carga masiva de unidades desde archivos Excel para el registro inicial
de proyectos nuevos, con asistencia de IA y revisión humana antes de persistir datos.

---

## Flujo completo

```
Admin selecciona proyecto nuevo (sin unidades)
        ↓
Admin sube archivo Excel (.xlsx)
        ↓
Frontend solicita URL prefirmada → GET /admin/inventario/upload-url
        ↓
Frontend sube el archivo directo a S3 (sin pasar por Lambda)
        ↓
S3 dispara evento → Lambda "parser"
        ↓
Lambda parsea y normaliza los datos
        ↓
Una sola llamada a Bedrock (Claude 3.5 Haiku) con todo el contexto:
  - Mapeo de columnas al schema esperado
  - Separación nombres/apellidos
  - Matching fuzzy de inmobiliarias contra jam-usuarios
        ↓
Resultado guardado como JSON en S3 (TTL 24h)
        ↓
Frontend muestra tabla editable (vista tipo Excel limpia)
  - Datos del Excel pre-llenados
  - Sugerencias de IA marcadas visualmente
  - Celdas vacías o con warnings resaltadas
  - Admin completa/corrige inline lo que falta
        ↓
Admin confirma
        ↓
Lambda "writer" → escribe en DynamoDB
  - jam-inventario (torres + unidades)
  - jam-usuarios (inmobiliarias nuevas si aplica)
  - jam-clientes + jam-procesos (solo si hay cédula)
  - jam-historial-bloqueos (solo si estado = bloqueada)
  SIN crear schedules de EventBridge (datos históricos)
  SIN programar exclusividad de clientes (datos históricos)
        ↓
Reporte final: unidades cargadas / advertencias / errores
```

---

## Restricción fundamental: solo proyectos nuevos

La migración solo está disponible para proyectos recién creados sin unidades.
Esto elimina toda lógica de duplicados y protege datos activos.

- El sistema valida antes de procesar que el proyecto no tenga unidades en DynamoDB
- Si tiene unidades → error, la migración no procede
- Duplicados dentro del mismo Excel (mismo `id_unidad`) → error rojo, bloquea confirmación

---

## Casos edge y comportamiento esperado

### Inmobiliaria no existe en el sistema
Se crea automáticamente un registro en `jam-usuarios` con:
- `pk`: `INMOBILIARIA#<uuid>`
- `nombre`: normalizado por IA
- `activo: true`
- `proyectos: [proyecto_id_del_excel]`
- `correos: []`
- `origen: 'migracion'` — para que el admin sepa que falta configurarla

Sin usuario Cognito. El admin crea el usuario después desde la UI de gestión de inmobiliarias.

### Inmobiliaria ya existe en el sistema
La IA hace matching contra `jam-usuarios`:
- Confianza ≥ 80% → se usa la existente, se agrega el proyecto a su `proyectos[]` si no lo tiene
- Confianza < 80% → celda amarilla para revisión manual del admin
- Sin match posible → se crea nueva como fantasma (caso anterior)

### Inmobiliaria con typo o variación de nombre
Ejemplos reales del Excel del cliente:
- `PS Inmobiliaira` → `PS Inmobiliaria`
- `East Home` / `EAST HOME` → misma entidad
- `Inmoniliaria Reservas` → `Inmobiliaria Reservas`

### Etapas
- Si el Excel tiene columna de etapa → la IA la detecta y mapea
- Si no tiene → campo manual en la tabla editable (opcional, no bloquea confirmación)

### Torre + unidad
- Si el Excel tiene columnas separadas (`Torre`, `Unidad`) → la IA las combina: `A-101`
- Si ya viene junto (`B-A-101`) → se usa directo
- Las torres se crean automáticamente en `jam-inventario` si no existen

### Cliente sin cédula
La cédula no existe en el Excel. Aparece como columna vacía en la tabla editable.
- Admin llena la cédula inline → se crea registro en `jam-clientes` y `jam-procesos`
- Cédula vacía → unidad se carga con `cliente_nombre_excel` como campo referencial, sin registro de cliente

### Schedules y exclusividad — NO aplican en migración
Los datos del Excel son históricos. El Lambda writer **no crea**:
- Schedules de liberación automática en EventBridge (aunque estado sea `bloqueada`)
- Schedules de alerta de vencimiento
- Schedules de exclusividad de cliente en EventBridge

Estos solo se crean en el flujo normal de bloqueo desde la UI.

### IDs generados por el writer
El writer genera UUIDs nuevos para cada entidad creada:
- `unidad_id` (UUID) — distinto del `id_unidad` legible del Excel
- `torre_id` (UUID) — por cada torre nueva
- `etapa_id` (UUID) — si se crea etapa nueva

### Formato de `unidad_nombre` en procesos
Para consistencia con la UI, el writer construye `unidad_nombre` como:
`"Torre A · B-101"` — igual que hace `jam-bloqueos` en el flujo normal.

### `inmobiliaria_id` sin prefijo
El writer usa el `inmobiliaria_id` limpio sin prefijo `INMOBILIARIA#`,
igual que `jam-captacion`. La pk de `jam-clientes` queda: `CLIENTE#{cedula}#{inmobiliaria_id}`.

---

## Formato del Excel (basado en archivo real del cliente)

El sistema acepta el formato actual. Los datos empiezan en fila 7 (las primeras 6 son encabezados/espacios).
El archivo se abre con `data_only=True` para resolver fórmulas automáticamente.

| Columna Excel | Ejemplo | Notas |
|---------------|---------|-------|
| `unidad` | `B-A-101` | Formato `Bloque-Torre-Número` |
| `Area` | `76.34+22.29 PATIO` | Se parsea solo el primer número float |
| `No Cuartos` | `3` | |
| `No. baños` | `2` | |
| `Tipo` | `D` | |
| `Piso` | `1` | |
| `Parqueos` | `1` | |
| `NOMBRE CLIENTE` | `JOSE MIGUEL BARRERA GALICIA` | IA separa nombres/apellidos |
| `Precios US$` | `75958.3` | |
| `ESTATUS` | `CONTRATO FIRMADO` | Mapeo a estados internos |
| `INMOBILIARIA` | `Plusval` | Matching fuzzy contra jam-usuarios |
| `FECHA BLOQUEO` | `2026-02-21` | |
| `FECHA FIN BLOQUEO` | `2026-03-21` | |
| `COMENTARIO` | texto libre | Opcional |

---

## Mapeo de columnas → DynamoDB

### jam-inventario (todas las filas)

| Campo Excel | Campo DynamoDB | Transformación |
|-------------|---------------|----------------|
| `unidad` | `id_unidad` | Directo |
| `Area` | `metraje` | Primer número float antes de `+` o espacio |
| `No Cuartos` | `num_cuartos` | Entero |
| `No. baños` | `num_banos` | Entero |
| `Tipo` | `tipo` | String |
| `Piso` | `piso` | Entero |
| `Parqueos` | `parqueos` | Entero |
| `Precios US$` | `precio` | Float |
| `ESTATUS` | `estado` | Mapeo (ver tabla abajo) |
| `FECHA BLOQUEO` | `fecha_bloqueo` | ISO 8601 |
| `FECHA FIN BLOQUEO` | `fecha_liberacion` | ISO 8601 |
| `NOMBRE CLIENTE` | `cliente_nombre_excel` | Campo referencial, no es clave |

### Mapeo ESTATUS → estados internos

| Excel | Estado unidad | Estado proceso |
|-------|--------------|----------------|
| `DISPONIBLE` | `disponible` | — |
| `BLOQUEADO` | `bloqueada` | `captacion` |
| `NO DISPONIBLE` | `no_disponible` | `reserva` |
| `SEPARACIÓN` | `no_disponible` | `separacion` |
| `CONTRATO FIRMADO` | `no_disponible` | `inicial` |

### jam-clientes + jam-procesos (solo si hay nombre y cédula)

- `pk`: `CLIENTE#{cedula}#{inmobiliaria_id}`
- `sk`: `PROYECTO#{proyecto_id}`
- `exclusividad_activa: true` — sin schedule de vencimiento
- Proceso con estado según tabla de mapeo arriba

### jam-historial-bloqueos (solo si ESTATUS = BLOQUEADO)

Registro histórico con fechas del Excel. Sin schedules de EventBridge.

---

## IA con Amazon Bedrock — Claude 3.5 Haiku

**Una sola llamada** con todo el contexto del Excel para minimizar latencia y costo.

El prompt incluye:
1. Headers del Excel → devuelve mapeo al schema esperado
2. Lista de nombres completos → devuelve `nombres` / `apellidos` por cada uno
3. Lista de inmobiliarias del Excel + inmobiliarias existentes en el sistema → devuelve match con confianza

**Costo estimado por migración:**
- ~4,000 tokens entrada × $0.001/1K = $0.004
- ~2,000 tokens salida × $0.005/1K = $0.010
- **Total: ~$0.014 por migración** — prácticamente gratis

**Indicador visual en la tabla:**
Celdas con sugerencia de IA muestran ícono distinto. El admin acepta o corrige antes de confirmar.

---

## Tabla editable en el frontend

- Componente tipo spreadsheet (AG Grid o similar)
- Columnas: unidad, metraje, cuartos, baños, tipo, piso, parqueos, precio, estado, inmobiliaria, nombre cliente, cédula (vacía), etapa, fecha bloqueo, comentario
- Colores:
  - Verde: dato limpio del Excel
  - Amarillo: sugerencia de IA (editable)
  - Rojo: campo requerido vacío o error de validación
  - Gris: campo no aplica (ej: fecha bloqueo en unidad disponible)
- Edición inline en todas las celdas
- Botón "Confirmar carga" solo habilitado si no hay celdas en rojo
- Contador: X listas / Y con advertencias / Z con errores

### Campos obligatorios (rojo si vacíos)

| Campo | Por qué |
|-------|---------|
| `id_unidad` | PK legible de la unidad |
| `precio` | Requerido en el modelo |
| `metraje` | Requerido en el modelo |
| `estado` | Debe mapear a estado válido |

Opcionales sin bloquear: etapa, cédula, inmobiliaria, comentario, fechas de bloqueo.

---

## Infraestructura

- S3 bucket: `jam-archivos-{stage}` con prefijo `inventario/uploads/`
- URL prefirmada con expiración de 5 minutos
- Lambda parser: `openpyxl` + Bedrock (Claude 3.5 Haiku), timeout 2 min
- Lambda writer: inserts en DynamoDB, timeout 5 min
- JSON intermedio en S3 con TTL 24h

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/admin/inventario/upload-url` | admin/coordinador | URL prefirmada para subir a S3 |
| `GET` | `/admin/inventario/preview/{job_id}` | admin/coordinador | JSON parseado para mostrar tabla |
| `POST` | `/admin/inventario/confirmar/{job_id}` | admin/coordinador | Confirmar y escribir en DynamoDB |
| `GET` | `/admin/inventario/reportes/{job_id}` | admin/coordinador | Reporte final de la importación |

---

## Validaciones

| Validación | Comportamiento |
|------------|---------------|
| Archivo no es .xlsx | Rechazar antes de subir |
| Proyecto ya tiene unidades | Error, migración no procede |
| Columnas requeridas faltantes | IA intenta mapear, si no puede → error crítico |
| `id_unidad` duplicado en el Excel | Error rojo, bloquea confirmación |
| Precio o metraje no numérico | Celda roja, bloquea confirmación |
| Inmobiliaria no reconocida | Sugerencia IA o celda vacía |
| Cédula vacía | Permitido — unidad sin cliente |

---

## Reporte final

```json
{
  "job_id": "uuid",
  "archivo": "NOMENCLATURA_CANEY ORIENTAL.xlsx",
  "proyecto_id": "xxx",
  "total_filas": 176,
  "unidades_cargadas": 170,
  "clientes_creados": 145,
  "inmobiliarias_creadas": 2,
  "advertencias": 8,
  "errores": 3,
  "detalle": [
    { "fila": 14, "id_unidad": "B-A-402", "tipo": "advertencia", "motivo": "Cédula no ingresada, unidad cargada sin cliente" },
    { "fila": 17, "id_unidad": "B-B-201", "tipo": "advertencia", "motivo": "Inmobiliaria sugerida por IA, revisar" },
    { "fila": 22, "id_unidad": "B-B-402", "tipo": "info", "motivo": "Inmobiliaria 'Plusval' creada como nueva (origen: migracion)" }
  ]
}
```

---

## Dependencias

- TK-01 (auth)
- TK-02 (modelo de datos base)
- TK-18 (nuevos campos: num_cuartos, num_banos, tipo, piso, parqueos)
- Amazon Bedrock habilitado en la cuenta — modelo: `anthropic.claude-3-5-haiku-20241022-v1:0`

---

## Criterios de aceptación

- [ ] Solo disponible para proyectos sin unidades
- [ ] Admin sube .xlsx y ve tabla editable antes de confirmar
- [ ] IA mapea columnas aunque tengan nombres distintos al esperado
- [ ] IA separa nombres y apellidos correctamente
- [ ] IA hace matching de inmobiliarias con typos y variaciones
- [ ] Sugerencias de IA visualmente distinguibles de datos directos
- [ ] Admin puede editar cualquier celda inline
- [ ] Cédula se puede ingresar inline por unidad
- [ ] Unidades sin cédula se cargan sin registro de cliente
- [ ] Inmobiliarias nuevas se crean con `origen: 'migracion'` y proyecto asignado
- [ ] Inmobiliarias existentes reciben el proyecto en su lista si no lo tenían
- [ ] NO se crean schedules de EventBridge en ningún caso
- [ ] NO se programa exclusividad de clientes
- [ ] `unidad_nombre` en procesos sigue el formato `"Torre A · B-101"`
- [ ] `inmobiliaria_id` se guarda sin prefijo `INMOBILIARIA#`
- [ ] Botón confirmar solo habilitado sin errores críticos
- [ ] Reporte final generado y descargable
