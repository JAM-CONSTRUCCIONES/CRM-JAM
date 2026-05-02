# Fix: Bloqueos en Migración con Regla de 24 Horas

**Fecha:** 2026-05-01  
**Tipo:** Corrección de bug + Feature  
**Módulo:** Migración de inventario

## Problema Detectado

Durante la migración de inventario desde Excel, cuando se detectaba una unidad con estado `bloqueada`, el sistema estaba usando directamente las fechas del Excel (`fecha_bloqueo` y `fecha_liberacion`) sin aplicar las reglas de negocio estándar de bloqueos.

Esto causaba varios problemas:
- Las fechas del Excel eran históricas (pasadas), resultando en bloqueos ya vencidos
- No se creaban schedules de EventBridge para liberación automática
- No se enviaban notificaciones SQS
- Los bloqueos no funcionaban como bloqueos reales del sistema

## Solución Implementada

Se modificó el proceso de migración para que los bloqueos funcionen **exactamente igual** que un bloqueo normal del sistema:

### 1. **Fecha actual + 24 horas**
   - Ignora completamente las fechas del Excel para bloqueos
   - Usa el timestamp actual de la migración como `fecha_bloqueo`
   - Calcula `fecha_liberacion = ahora + 24 horas`

### 2. **Schedules de EventBridge**
   - Crea schedule de **alerta** a las 19 horas (5h antes del vencimiento)
   - Crea schedule de **liberación automática** a las 24 horas
   - Los schedules disparan el lambda de bloqueos con acciones `alerta_vencimiento` y `liberar_automatico`

### 3. **Notificaciones SQS**
   - Envía mensaje SQS con evento `bloqueo_registrado`
   - Incluye metadata completa del bloqueo
   - Marca el origen como `migracion` para trazabilidad

### 4. **Consistencia total**
   - Mismo comportamiento que `POST /bloqueos`
   - Misma duración (24h vs 48h de bloqueos normales)
   - Misma infraestructura de liberación automática

## Archivos Modificados

### 1. `lambdas/jam-proyectos/utils/excel_writer.py`

**Cambios:**
- Agregados imports: `json`, `scheduler`, `sqs`
- Agregadas constantes:
  - `HORAS_BLOQUEO_MIGRACION = 24`
  - `HORAS_ALERTA_MIGRACION = 19`
- Variables de entorno: `LAMBDA_ARN`, `SCHEDULER_ROLE_ARN`, `SQS_URL`
- Modificada función `_escribir_unidad()`:
  - **Ignora fechas del Excel** para bloqueos
  - Usa siempre timestamp actual
  - Calcula `fecha_liberacion = ahora + 24h`
  - Guarda fechas calculadas en la fila para uso posterior
- Modificada función `_escribir_historial()`:
  - Usa las fechas calculadas en `_escribir_unidad`
  - Mantiene consistencia entre unidad e historial
- Agregada función `_crear_schedules_bloqueo()`:
  - Crea schedules en EventBridge
  - Alerta a las 19h, liberación a las 24h
  - Maneja nombres seguros (sin `/` ni `#`)
- Agregada función `_enviar_notificacion_bloqueo()`:
  - Envía mensaje SQS con evento `bloqueo_registrado`
  - Incluye metadata completa
- Modificado flujo principal:
  - Llama a `_crear_schedules_bloqueo()` después del historial
  - Llama a `_enviar_notificacion_bloqueo()` después de schedules

### 2. `lambdas/jam-excel-parser/utils/utils/excel_writer.py`

**Cambios:**
- Mismas modificaciones que en el archivo anterior
- Mantiene consistencia entre ambos lambdas de migración

## Lógica de Cálculo

```python
# SIEMPRE usar fecha actual (ignorar Excel)
dt_bloqueo = datetime.now(timezone.utc)
fecha_bloqueo = dt_bloqueo.isoformat()

# Calcular liberación: +24 horas
dt_liberacion = dt_bloqueo + timedelta(hours=24)
fecha_liberacion = dt_liberacion.isoformat()

# Calcular alerta: +19 horas (5h antes de liberación)
dt_alerta = dt_bloqueo + timedelta(hours=19)

# Crear schedules
scheduler.create_schedule(
    Name=f"bloqueo-{unidad_id}-alerta",
    ScheduleExpression=f"at({dt_alerta})",
    Target={'Arn': LAMBDA_ARN, 'Input': {'accion': 'alerta_vencimiento'}}
)

scheduler.create_schedule(
    Name=f"bloqueo-{unidad_id}-liberacion",
    ScheduleExpression=f"at({dt_liberacion})",
    Target={'Arn': LAMBDA_ARN, 'Input': {'accion': 'liberar_automatico'}}
)

# Enviar notificación
sqs.send_message(
    QueueUrl=SQS_URL,
    MessageBody={'evento': 'bloqueo_registrado', ...}
)
```

## Casos de Uso

### Caso 1: Migración con unidades bloqueadas
```
Excel (2026-05-01 14:00):
- ESTATUS: BLOQUEADO
- FECHA BLOQUEO: 2026-02-21 (ignorada)
- INMOBILIARIA: Plusval
- CLIENTE: Juan Pérez

Resultado:
- fecha_bloqueo: 2026-05-01T14:00:00+00:00 (ahora)
- fecha_liberacion: 2026-05-02T14:00:00+00:00 (+24h)
- Schedule alerta: 2026-05-02T09:00:00 (+19h)
- Schedule liberación: 2026-05-02T14:00:00 (+24h)
- Notificación SQS enviada
- Cliente y proceso creados
```

### Caso 2: Liberación automática
```
A las 24 horas:
- EventBridge dispara lambda con accion='liberar_automatico'
- Unidad vuelve a estado 'disponible'
- Proceso marcado como 'desvinculado'
- Historial actualizado
```

### Caso 3: Estado no bloqueado
```
Excel:
- ESTATUS: DISPONIBLE o NO DISPONIBLE

Resultado:
- Fechas del Excel se mantienen (si existen)
- No se crean schedules
- No se envían notificaciones
```

## Beneficios

1. **Bloqueos funcionales:** Los bloqueos de migración funcionan como bloqueos reales
2. **Liberación automática:** Se liberan automáticamente a las 24h
3. **Alertas:** Notificaciones 5h antes del vencimiento
4. **Consistencia:** Mismo comportamiento que el endpoint `/bloqueos`
5. **Trazabilidad:** Campo `origen: 'migracion'` permite identificarlos
6. **Sin conflictos:** No hay bloqueos vencidos ni fechas pasadas

## Diferencias con Bloqueos Normales

| Aspecto | Bloqueo Normal | Bloqueo Migración |
|---------|---------------|-------------------|
| Duración | 48 horas | 24 horas |
| Alerta | 43 horas | 19 horas |
| Origen | `null` | `'migracion'` |
| Schedules | ✅ Sí | ✅ Sí |
| Notificaciones | ✅ Sí | ✅ Sí |
| Liberación auto | ✅ Sí | ✅ Sí |

## Variables de Entorno Requeridas

Los lambdas de migración ahora requieren estas variables:
- `BLOQUEOS_LAMBDA_ARN`: ARN del lambda de bloqueos (para schedules)
- `SCHEDULER_ROLE_ARN`: ARN del rol de EventBridge Scheduler
- `SQS_URL`: URL de la cola SQS para notificaciones

Si no están configuradas, se omiten schedules y notificaciones (con logs de advertencia).

## Testing Recomendado

1. ✅ Migrar Excel con unidades bloqueadas
2. ✅ Verificar que `fecha_liberacion` sea exactamente 24h después de `fecha_bloqueo`
3. ✅ Verificar que se crearon 2 schedules en EventBridge
4. ✅ Verificar que se envió mensaje SQS
5. ✅ Esperar 24h y confirmar liberación automática
6. ✅ Verificar que estados no bloqueados no se vean afectados
7. ✅ Verificar logs de CloudWatch para errores

## Impacto

- **Riesgo:** Bajo - Solo afecta nuevas migraciones
- **Retroactividad:** No afecta migraciones ya realizadas
- **Compatibilidad:** Mantiene compatibilidad con el formato actual del Excel
- **Infraestructura:** Requiere permisos de EventBridge Scheduler y SQS

## Notas Técnicas

- Los schedules se crean con `ActionAfterCompletion='DELETE'` (se auto-eliminan)
- Los nombres de schedules sanitizan `/` y `#` por `-`
- Si falla la creación de schedules, se registra en logs pero no falla la migración
- Las notificaciones SQS son best-effort (no bloquean la migración si fallan)
- El campo `origen: 'migracion'` permite filtrar estos bloqueos en reportes
