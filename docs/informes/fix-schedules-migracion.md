# Fix: Gestión de Schedules en Migraciones

**Fecha:** 6 de mayo de 2026  
**Prioridad:** 🔴 CRÍTICO

---

## Problema Identificado

### Descripción
Los schedules de EventBridge creados durante las migraciones de Excel presentan dos problemas críticos:

1. **No se crean schedules en migraciones nuevas**: Aunque el código existe en `excel_writer.py`, los schedules no se están creando correctamente
2. **Los schedules disparados no se eliminan**: Cuando un schedule se ejecuta (liberación automática o alerta), permanece en EventBridge en lugar de eliminarse

### Impacto
- **Acumulación de schedules**: Los schedules ejecutados se acumulan en EventBridge sin limpiarse
- **Costos innecesarios**: Schedules que ya se ejecutaron siguen consumiendo recursos
- **Confusión operativa**: No se puede distinguir entre schedules activos y ejecutados
- **Bloqueos no se liberan automáticamente**: Las unidades bloqueadas en migraciones no se liberan a las 24 horas

---

## Análisis Técnico

### Archivos Involucrados

1. **`lambdas/jam-proyectos/utils/excel_writer.py`**
   - Función `_crear_schedules_bloqueo()`: Crea schedules para bloqueos de migración (24h)
   - Función `_escribir_historial()`: Registra el historial de bloqueos
   - Función `_enviar_notificacion_bloqueo()`: Envía notificaciones SQS

2. **`lambdas/jam-bloqueos/utils/scheduler.py`**
   - Función `crear_schedules()`: Crea schedules para bloqueos normales (48h)
   - Función `eliminar_schedules()`: Elimina schedules al liberar manualmente
   - **Configuración**: `ActionAfterCompletion='DELETE'` ✅

3. **`lambdas/jam-bloqueos/routes/scheduler_handler.py`**
   - Función `_liberar()`: Libera unidad automáticamente
   - Función `_alertar()`: Envía alerta de vencimiento
   - **NO elimina el schedule después de ejecutarse** ❌

### Configuración Actual de Schedules

```python
# En excel_writer.py y scheduler.py
scheduler.create_schedule(
    Name=_schedule_name(unidad_id, suffix),
    ScheduleExpression=f"at({at_time})",
    ScheduleExpressionTimezone='UTC',
    FlexibleTimeWindow={'Mode': 'OFF'},
    Target={
        'Arn': LAMBDA_ARN,
        'RoleArn': SCHEDULER_ROLE_ARN,
        'Input': json.dumps({**payload_base, 'accion': accion}),
    },
    ActionAfterCompletion='DELETE',  # ✅ Configurado correctamente
)
```

### Problema Raíz

Aunque `ActionAfterCompletion='DELETE'` está configurado, EventBridge Scheduler **solo elimina automáticamente el schedule si la invocación de Lambda es exitosa**. Si hay algún error o excepción, el schedule permanece.

Además, necesitamos verificar que:
1. Los schedules se estén creando correctamente en migraciones
2. Los schedules se eliminen incluso si hay errores parciales
3. Exista un mecanismo de limpieza para schedules huérfanos

---

## Solución Propuesta

### 1. Verificar Creación de Schedules en Migraciones

**Problema**: Los schedules no se están creando en migraciones nuevas.

**Causa posible**:
- Variables de entorno `LAMBDA_ARN` o `SCHEDULER_ROLE_ARN` no configuradas
- Errores silenciosos en la creación de schedules
- Permisos IAM insuficientes

**Solución**:
- Agregar logging detallado
- Validar variables de entorno al inicio
- Capturar y reportar errores específicos

### 2. Eliminar Schedules Después de Ejecución

**Problema**: Los schedules ejecutados permanecen en EventBridge.

**Solución**: Agregar eliminación explícita en `scheduler_handler.py` después de ejecutar la acción:

```python
def _liberar(unidad_id, proyecto_id):
    # ... código existente de liberación ...
    
    # Eliminar schedules explícitamente después de ejecutar
    _eliminar_schedules_post_ejecucion(unidad_id)

def _alertar(unidad_id, proyecto_id):
    # ... código existente de alerta ...
    
    # NO eliminar schedule de alerta (solo se elimina con liberación)
    # El schedule de liberación se eliminará cuando se ejecute

def _eliminar_schedules_post_ejecucion(unidad_id):
    """Elimina schedules después de ejecutar la acción."""
    scheduler = boto3.client('scheduler')
    for suffix in ('alerta', 'liberacion'):
        try:
            name = _schedule_name(unidad_id, suffix)
            scheduler.delete_schedule(Name=name)
            print(f'Schedule eliminado post-ejecución: {name}')
        except scheduler.exceptions.ResourceNotFoundException:
            pass  # Ya fue eliminado
        except Exception as e:
            print(f'Error eliminando schedule {suffix}: {e}')
```

### 3. Script de Limpieza de Schedules Huérfanos

Crear un script para limpiar schedules que ya se ejecutaron o que corresponden a unidades que ya no están bloqueadas:

```python
# scripts/limpiar-schedules-huerfanos.py
import boto3
from datetime import datetime, timezone

scheduler = boto3.client('scheduler')
dynamodb = boto3.resource('dynamodb')
inventario = dynamodb.Table('jam-inventario')

def listar_schedules():
    """Lista todos los schedules de bloqueos."""
    schedules = []
    paginator = scheduler.get_paginator('list_schedules')
    
    for page in paginator.paginate():
        for schedule in page['Schedules']:
            if schedule['Name'].startswith('bloqueo-'):
                schedules.append(schedule)
    
    return schedules

def verificar_unidad_bloqueada(unidad_id, proyecto_id):
    """Verifica si la unidad sigue bloqueada."""
    try:
        result = inventario.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
        )
        item = result.get('Item')
        return item and item.get('estado') == 'bloqueada'
    except Exception:
        return False

def limpiar_schedules_huerfanos():
    """Elimina schedules de unidades que ya no están bloqueadas."""
    schedules = listar_schedules()
    eliminados = 0
    errores = 0
    
    for schedule in schedules:
        name = schedule['Name']
        # Extraer unidad_id del nombre: bloqueo-{unidad_id}-{suffix}
        parts = name.replace('bloqueo-', '').rsplit('-', 1)
        if len(parts) != 2:
            continue
        
        unidad_id = parts[0]
        
        # Obtener proyecto_id del target input
        try:
            schedule_detail = scheduler.get_schedule(Name=name)
            target_input = json.loads(schedule_detail['Target']['Input'])
            proyecto_id = target_input.get('proyecto_id')
            
            if not proyecto_id:
                continue
            
            # Verificar si la unidad sigue bloqueada
            if not verificar_unidad_bloqueada(unidad_id, proyecto_id):
                scheduler.delete_schedule(Name=name)
                print(f'✓ Eliminado: {name} (unidad ya no bloqueada)')
                eliminados += 1
        except scheduler.exceptions.ResourceNotFoundException:
            pass  # Ya fue eliminado
        except Exception as e:
            print(f'✗ Error procesando {name}: {e}')
            errores += 1
    
    print(f'\n=== Resumen ===')
    print(f'Schedules eliminados: {eliminados}')
    print(f'Errores: {errores}')
    print(f'Total procesados: {len(schedules)}')

if __name__ == '__main__':
    limpiar_schedules_huerfanos()
```

### 4. Endpoint de Administración

Agregar endpoint para que el admin pueda ver y limpiar schedules:

```python
# GET /admin/schedules
def listar_schedules_admin():
    """Lista todos los schedules activos con información de la unidad."""
    # Similar al script pero retorna JSON para el frontend

# DELETE /admin/schedules/{schedule_name}
def eliminar_schedule_admin(schedule_name):
    """Elimina un schedule específico manualmente."""
    # Permite al admin limpiar schedules problemáticos
```

---

## Plan de Implementación

### Fase 1: Diagnóstico (Inmediato)
1. ✅ Revisar logs de CloudWatch para ver si se están creando schedules
2. ✅ Listar schedules actuales en EventBridge
3. ✅ Verificar variables de entorno en Lambda de proyectos
4. ✅ Verificar permisos IAM

### Fase 2: Fix Crítico (Hoy)
1. Modificar `scheduler_handler.py` para eliminar schedules post-ejecución
2. Agregar logging detallado en `excel_writer.py`
3. Validar variables de entorno al inicio de la migración
4. Desplegar cambios

### Fase 3: Limpieza (Mañana)
1. Crear script de limpieza de schedules huérfanos
2. Ejecutar script para limpiar schedules actuales
3. Documentar proceso de limpieza

### Fase 4: Administración (Esta semana)
1. Crear endpoint `/admin/schedules`
2. Agregar interfaz en frontend para ver schedules
3. Permitir eliminación manual desde admin

---

## Comandos de Diagnóstico

### Listar schedules actuales
```bash
aws scheduler list-schedules --query 'Schedules[?starts_with(Name, `bloqueo-`)]' --output table
```

### Ver detalle de un schedule
```bash
aws scheduler get-schedule --name "bloqueo-{unidad_id}-liberacion"
```

### Eliminar schedule manualmente
```bash
aws scheduler delete-schedule --name "bloqueo-{unidad_id}-liberacion"
```

### Ver logs de Lambda
```bash
aws logs tail /aws/lambda/jam-bloqueos --follow
aws logs tail /aws/lambda/jam-proyectos --follow
```

---

## Verificación Post-Fix

### Checklist
- [ ] Los schedules se crean correctamente en migraciones nuevas
- [ ] Los schedules se eliminan automáticamente después de ejecutarse
- [ ] No hay schedules huérfanos en EventBridge
- [ ] Los bloqueos de migración se liberan a las 24 horas
- [ ] Las alertas se envían 5 horas antes del vencimiento
- [ ] El admin puede ver schedules activos desde el frontend
- [ ] El admin puede eliminar schedules manualmente si es necesario

### Pruebas
1. Crear migración con unidades bloqueadas
2. Verificar que se crean 2 schedules por unidad (alerta + liberación)
3. Esperar a que se dispare la alerta
4. Verificar que el schedule de alerta se elimina
5. Esperar a que se dispare la liberación
6. Verificar que el schedule de liberación se elimina
7. Verificar que la unidad queda disponible

---

## Notas Adicionales

### Diferencias entre Bloqueos Normales y Migraciones

| Aspecto | Bloqueos Normales | Bloqueos Migración |
|---------|-------------------|-------------------|
| Duración | 48 horas | 24 horas |
| Alerta | 43 horas (5h antes) | 19 horas (5h antes) |
| Origen | Usuario/Inmobiliaria | Migración Excel |
| Fecha bloqueo | Fecha actual | Fecha actual (ignora Excel) |
| Schedules | Siempre se crean | Depende de estado |

### Consideraciones
- Los schedules usan `ActionAfterCompletion='DELETE'` pero esto solo funciona si Lambda retorna éxito
- Es importante tener eliminación explícita como respaldo
- Los schedules tienen límite de 1 millón por cuenta AWS (no es problema para este caso)
- EventBridge Scheduler cobra por schedule activo ($1.00 por millón de invocaciones)

---

**Preparado por:** Equipo de Desarrollo  
**Última actualización:** 6 de mayo de 2026
