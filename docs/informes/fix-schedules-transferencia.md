# Fix: Schedules y bloqueos durante transferencia de clientes

## Problema
Durante la transferencia de clientes entre inmobiliarias, los schedules de bloqueo (alerta y liberación) no se estaban creando cuando la unidad estaba bloqueada.

## Causa Raíz
La lógica original solo detectaba bloqueos si la unidad estaba bloqueada **por la misma inmobiliaria** que estaba transfiriendo el cliente:

```python
if (estado == 'bloqueada' and 
    bloqueado_por == inmo_origen and
    cliente_cedula == cedula):
```

Pero el requerimiento es: **Si la unidad está bloqueada (sin importar por quién), al transferir se debe crear un NUEVO bloqueo de 48h para la inmobiliaria destino**.

## Solución Implementada

### 1. Validación - Detectar TODAS las unidades bloqueadas
```python
# ANTES: Solo detectaba bloqueos de la inmobiliaria origen
if (estado == 'bloqueada' and bloqueado_por == inmo_origen and cliente_cedula == cedula):

# DESPUÉS: Detecta cualquier unidad bloqueada
if estado == 'bloqueada':
    bloqueos.append({...})
    print(f"[VALIDAR] ✓ Unidad bloqueada detectada: {unidad_id} (se creará nuevo bloqueo)")
```

### 2. Eliminación - Solo liberar bloqueos propios
```python
# Verificar si el bloqueo es de la inmobiliaria origen
es_bloqueo_propio = (
    bloqueado_por == f'INMOBILIARIA#{inmo_origen}' or 
    bloqueado_por == inmo_origen
)

if es_bloqueo_propio:
    # Eliminar schedules y liberar unidad
    ...
else:
    # No liberar, solo registrar que se detectó
    print(f"[ELIMINAR] Unidad {unidad_id} bloqueada por otra inmobiliaria, no se libera")
```

### 3. Creación - Crear NUEVO bloqueo de 48h
```python
# Crear NUEVO bloqueo para la inmobiliaria destino (sin importar quién tenía el bloqueo anterior)
bloqueado_por = inmo_destino  # Sin prefijo INMOBILIARIA#
inventario_table.update_item(
    Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
    UpdateExpression='SET estado = :estado, bloqueado_por = :bloqueado_por, ...',
    ExpressionAttributeValues={
        ':estado': 'bloqueada',
        ':bloqueado_por': bloqueado_por,
        ':cedula': cedula,
        ':fecha_bloqueo': ahora,
        ':fecha_liberacion': fecha_liberacion  # 48h desde ahora
    }
)

# Crear schedules (alerta a las 43h, liberación a las 48h)
crear_schedules_bloqueo(unidad_id, proyecto_id, fecha_lib, fecha_alerta)
```

## Flujo Completo

### Caso 1: Unidad bloqueada por la misma inmobiliaria
1. **Validar**: Detecta unidad bloqueada
2. **Eliminar**: Libera el bloqueo antiguo y elimina schedules viejos
3. **Crear**: Crea nuevo bloqueo de 48h con nuevos schedules

### Caso 2: Unidad bloqueada por OTRA inmobiliaria
1. **Validar**: Detecta unidad bloqueada
2. **Eliminar**: NO libera el bloqueo (lo deja como está)
3. **Crear**: Crea nuevo bloqueo de 48h para la inmobiliaria destino con schedules

### Caso 3: Unidad NO bloqueada
1. **Validar**: No detecta bloqueo
2. **Eliminar**: Solo elimina proceso
3. **Crear**: Crea proceso sin bloqueo

## Archivos Modificados
- `lambdas/jam-transferir-cliente/handler.py`

## Testing
Para verificar que funciona:

1. **Transferir cliente con unidad bloqueada por su inmobiliaria:**
   ```
   [VALIDAR] ✓ Unidad bloqueada detectada: XXX (se creará nuevo bloqueo)
   [ELIMINAR] Bloqueo liberado: XXX
   [CREAR] Nuevo bloqueo creado para unidad XXX
   [SCHEDULES] Iniciando creación de schedules...
   ✓ Schedule creado: bloqueo-XXX-alerta
   ✓ Schedule creado: bloqueo-XXX-liberacion
   ```

2. **Transferir cliente con unidad bloqueada por OTRA inmobiliaria:**
   ```
   [VALIDAR] ✓ Unidad bloqueada detectada: XXX (se creará nuevo bloqueo)
   [ELIMINAR] Unidad XXX bloqueada por otra inmobiliaria, no se libera
   [CREAR] Nuevo bloqueo creado para unidad XXX
   [SCHEDULES] Iniciando creación de schedules...
   ✓ Schedule creado: bloqueo-XXX-alerta
   ✓ Schedule creado: bloqueo-XXX-liberacion
   ```

3. Verificar en EventBridge Scheduler que existan los schedules con nombres:
   - `bloqueo-{unidad_id}-alerta` (43 horas)
   - `bloqueo-{unidad_id}-liberacion` (48 horas)

## Fecha
2026-05-07
