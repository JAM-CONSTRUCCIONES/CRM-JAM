# Informe de Borrado de Datos - Sistema JAM Construcciones
**Fecha:** Mayo 2026  
**Versión del Sistema:** 1.0  
**Clasificación:** Confidencial

---

## Resumen Ejecutivo

Este documento establece los procedimientos, políticas y consideraciones técnicas para el borrado de datos en el sistema de gestión comercial e inventario de JAM Construcciones. El sistema maneja información sensible de clientes, transacciones comerciales y datos operativos que requieren políticas claras de retención y eliminación.

### Objetivos
1. Definir procedimientos seguros para eliminación de datos
2. Garantizar cumplimiento con regulaciones de protección de datos
3. Preservar integridad referencial del sistema
4. Mantener trazabilidad de operaciones críticas
5. Establecer protocolos de respaldo antes de eliminaciones masivas

---

## 1. CLASIFICACIÓN DE DATOS

### 1.1 Datos Personales Sensibles
**Tabla:** `jam-clientes`

| Campo | Tipo | Sensibilidad | Retención Mínima |
|-------|------|--------------|------------------|
| Cédula / Pasaporte | Identificador | Alta | 5 años |
| Nombres y Apellidos | Personal | Alta | 5 años |
| Correo electrónico | Contacto | Media | 5 años |
| Teléfono | Contacto | Media | 5 años |
| Fecha de nacimiento | Personal | Alta | 5 años |
| Nacionalidad | Personal | Media | 5 años |
| País de residencia | Personal | Media | 5 años |
| Estado civil | Personal | Media | 5 años |

**Regulaciones aplicables:**
- Ley de Protección de Datos Personales (según jurisdicción)
- GDPR (si aplica para clientes europeos)
- Derecho al olvido (solicitud expresa del cliente)

### 1.2 Datos Transaccionales
**Tablas:** `jam-procesos`, `jam-historial-bloqueos`

| Tipo | Retención Mínima | Justificación |
|------|------------------|---------------|
| Procesos de venta | 7 años | Obligaciones fiscales y legales |
| Historial de bloqueos | 3 años | Auditoría operativa |
| Cambios de estatus | 7 años | Trazabilidad comercial |
| Transacciones financieras | 10 años | Regulación fiscal |

### 1.3 Datos Operativos
**Tablas:** `jam-inventario`, `jam-usuarios`

| Tipo | Política de Borrado |
|------|---------------------|
| Proyectos | Desactivación lógica (no eliminación física) |
| Unidades | Eliminación solo si no tiene historial |
| Usuarios internos | Desactivación, eliminación tras 2 años inactivo |
| Inmobiliarias | Desactivación, historial preservado indefinidamente |

---

## 2. POLÍTICAS DE BORRADO

### 2.1 Borrado Lógico vs Físico

#### Borrado Lógico (Recomendado)
**Implementación:** Campo `activo = false` o `eliminado = true`

**Ventajas:**
- Preserva integridad referencial
- Permite auditorías posteriores
- Recuperación rápida en caso de error
- Cumple con trazabilidad legal

**Aplica a:**
- Proyectos
- Inmobiliarias
- Usuarios del sistema
- Procesos de venta completados

#### Borrado Físico (Excepcional)
**Implementación:** `DELETE` en DynamoDB

**Requisitos:**
- Aprobación explícita del administrador
- Verificación de dependencias
- Backup completo previo
- Registro en auditoría

**Aplica a:**
- Datos de prueba en ambientes no productivos
- Solicitudes de derecho al olvido (con validación legal)
- Datos duplicados o erróneos sin historial

### 2.2 Protecciones Implementadas

#### Proyectos (`jam-proyectos`)
```python
# Validación antes de eliminar
if tiene_unidades(proyecto_id):
    return 409, "No se puede eliminar el proyecto porque tiene unidades registradas"
```

**Acción:** Desactivación lógica con `activo = false`

#### Etapas (`jam-proyectos`)
```python
# Validaciones
if tiene_unidades(etapa_id):
    return 400, "No se puede eliminar: la etapa tiene unidades asociadas"
if tiene_torres(etapa_id):
    return 400, "No se puede eliminar: la etapa tiene torres asociadas"
```

**Acción:** Eliminación física solo si no tiene dependencias

#### Unidades (`jam-proyectos`)
```python
# Validaciones múltiples
if estado in ['bloqueada', 'no_disponible', 'vendida']:
    return 400, f"No se puede eliminar: la unidad está en estado {estado}"
if tiene_proceso_activo(unidad_id):
    return 409, "No se puede eliminar: la unidad tiene un proceso de venta activo"
```

**Acción:** Eliminación física solo si está disponible y sin procesos

#### Clientes (`jam-clientes`)
**Política:** NO se permite eliminación directa

**Alternativas:**
1. Desvinculación del proceso (cliente queda sin unidad asignada)
2. Anonimización (reemplazar datos personales por valores genéricos)
3. Solicitud formal de derecho al olvido (proceso manual con validación legal)

---

## 3. PROCEDIMIENTOS DE BORRADO

### 3.1 Borrado de Datos de Prueba

**Contexto:** Limpieza de ambiente de desarrollo o staging

**Procedimiento:**
```bash
# 1. Identificar datos de prueba
GET /admin/clientes?proyecto_id=PROYECTO_PRUEBA

# 2. Backup preventivo
aws dynamodb create-backup \
  --table-name jam-clientes \
  --backup-name backup-limpieza-$(date +%Y%m%d)

# 3. Eliminar procesos asociados
DELETE /admin/procesos/{cedula}/{proyecto_id}/{unidad_id}

# 4. Eliminar clientes de prueba
DELETE /admin/clientes/{cedula}?inmobiliaria_id={id}

# 5. Liberar unidades bloqueadas
POST /admin/bloqueos/liberar?unidad_id={id}&forzar=true

# 6. Eliminar unidades sin historial
DELETE /admin/unidades/{unidad_id}

# 7. Desactivar proyecto de prueba
PATCH /admin/proyectos/{proyecto_id} { "activo": false }
```

**Validaciones post-borrado:**
- [ ] Unidades vuelven a estado `disponible`
- [ ] No quedan procesos huérfanos
- [ ] Historial de bloqueos preservado (para auditoría)
- [ ] Schedules de EventBridge cancelados

### 3.2 Borrado por Solicitud de Derecho al Olvido

**Requisitos legales:**
1. Solicitud formal del cliente (email o documento firmado)
2. Validación de identidad (cédula/pasaporte)
3. Verificación de que no existen obligaciones legales pendientes
4. Aprobación del departamento legal

**Procedimiento:**
```python
# Script de anonimización (preferido sobre eliminación)
def anonimizar_cliente(cedula, inmobiliaria_id, proyecto_id):
    cliente = obtener_cliente(cedula, inmobiliaria_id, proyecto_id)
    
    # Preservar estructura, eliminar datos personales
    cliente_anonimizado = {
        'cedula': f'ANONIMO_{hash(cedula)[:8]}',
        'nombres': 'ANONIMIZADO',
        'apellidos': 'ANONIMIZADO',
        'correo': None,
        'telefono': None,
        'fecha_nacimiento': None,
        'nacionalidad': None,
        'pais_residencia': None,
        'estado_civil': None,
        # Preservar datos operativos
        'proyecto_id': cliente['proyecto_id'],
        'inmobiliaria_id': cliente['inmobiliaria_id'],
        'fecha_registro': cliente['fecha_registro'],
        'exclusividad_activa': False,
        'anonimizado': True,
        'fecha_anonimizacion': datetime.now().isoformat()
    }
    
    actualizar_cliente(cliente_anonimizado)
    registrar_auditoria('ANONIMIZACION', cedula, 'Derecho al olvido')
```

**Ventajas de anonimización:**
- Preserva integridad de reportes históricos
- Cumple con derecho al olvido
- Mantiene métricas comerciales válidas
- No rompe referencias en procesos

### 3.3 Limpieza de Datos Históricos

**Política de retención automática:**

| Tipo de Dato | Retención | Acción Automática |
|--------------|-----------|-------------------|
| Bloqueos liberados | 3 años | Archivar en S3 Glacier |
| Procesos desvinculados | 5 años | Archivar en S3 Glacier |
| Clientes con exclusividad vencida | 5 años | Mantener en DynamoDB |
| Logs de auditoría | 7 años | CloudWatch Logs → S3 → Glacier |
| Schedules completados | 90 días | Eliminación automática (EventBridge) |

**Implementación sugerida:**
```python
# Lambda ejecutada mensualmente
def archivar_datos_antiguos():
    fecha_limite = datetime.now() - timedelta(days=1095)  # 3 años
    
    # Consultar bloqueos antiguos
    bloqueos_antiguos = scan_historial_bloqueos(
        filter_expression='fecha_liberacion < :limite',
        expression_values={':limite': fecha_limite}
    )
    
    # Exportar a S3
    s3_client.put_object(
        Bucket='jam-archivo-historico',
        Key=f'bloqueos/{datetime.now().year}/{datetime.now().month}/export.json',
        Body=json.dumps(bloqueos_antiguos),
        StorageClass='GLACIER'
    )
    
    # Eliminar de DynamoDB
    for bloqueo in bloqueos_antiguos:
        dynamodb.delete_item(
            TableName='jam-historial-bloqueos',
            Key={'pk': bloqueo['pk'], 'sk': bloqueo['sk']}
        )
```

---

## 4. CASOS ESPECIALES

### 4.1 Eliminación de Inmobiliaria

**Escenario:** Inmobiliaria termina contrato con JAM Construcciones

**Procedimiento:**
1. **Desactivar acceso inmediato**
   ```python
   PATCH /admin/inmobiliarias/{id} { "activo": false }
   ```

2. **Liberar bloqueos activos**
   ```python
   # Obtener todas las unidades bloqueadas por la inmobiliaria
   bloqueos_activos = obtener_bloqueos(inmobiliaria_id)
   for bloqueo in bloqueos_activos:
       liberar_bloqueo_admin(bloqueo['unidad_id'], forzar=True)
   ```

3. **Preservar historial**
   - NO eliminar clientes captados (pertenecen a JAM)
   - NO eliminar procesos de venta (trazabilidad legal)
   - Mantener historial de bloqueos (auditoría)

4. **Reasignar clientes activos** (opcional)
   ```python
   # Si JAM decide reasignar leads activos a otra inmobiliaria
   reasignar_clientes(
       inmobiliaria_origen=id_desactivada,
       inmobiliaria_destino=id_nueva,
       solo_exclusividad_activa=True
   )
   ```

**Resultado:** Inmobiliaria desactivada, historial preservado, acceso revocado

### 4.2 Migración de Datos Erróneos

**Escenario:** Carga masiva de Excel con errores detectados post-migración

**Procedimiento de rollback:**
```python
def rollback_migracion(proyecto_id, fecha_migracion):
    # 1. Identificar registros de la migración
    unidades_migradas = scan_unidades(
        filter_expression='proyecto_id = :pid AND fecha_creacion >= :fecha',
        expression_values={
            ':pid': proyecto_id,
            ':fecha': fecha_migracion
        }
    )
    
    # 2. Validar que no tengan procesos activos
    for unidad in unidades_migradas:
        if tiene_proceso_activo(unidad['id']):
            raise Exception(f"Unidad {unidad['id']} tiene proceso activo, no se puede eliminar")
    
    # 3. Backup preventivo
    crear_backup_tabla('jam-inventario')
    
    # 4. Eliminar en orden inverso de dependencias
    for unidad in unidades_migradas:
        eliminar_unidad(unidad['id'])
    
    # 5. Registrar en auditoría
    registrar_auditoria('ROLLBACK_MIGRACION', proyecto_id, f'{len(unidades_migradas)} unidades eliminadas')
```

### 4.3 Borrado de Ambiente Completo (Dev/Staging)

**Contexto:** Reset completo de ambiente de pruebas

**Script automatizado:**
```bash
#!/bin/bash
# reset-ambiente.sh

AMBIENTE=$1  # dev o staging

if [ "$AMBIENTE" != "dev" ] && [ "$AMBIENTE" != "staging" ]; then
    echo "Error: Solo se permite dev o staging"
    exit 1
fi

# Confirmación manual
read -p "¿Confirmas el borrado COMPLETO del ambiente $AMBIENTE? (escribe 'CONFIRMO'): " confirmacion
if [ "$confirmacion" != "CONFIRMO" ]; then
    echo "Operación cancelada"
    exit 0
fi

# Backup completo
echo "Creando backup..."
aws dynamodb create-backup --table-name jam-inventario-$AMBIENTE --backup-name backup-reset-$(date +%Y%m%d-%H%M%S)
aws dynamodb create-backup --table-name jam-clientes-$AMBIENTE --backup-name backup-reset-$(date +%Y%m%d-%H%M%S)
aws dynamodb create-backup --table-name jam-procesos-$AMBIENTE --backup-name backup-reset-$(date +%Y%m%d-%H%M%S)

# Cancelar todos los schedules
echo "Cancelando schedules de EventBridge..."
aws scheduler list-schedules --group-name jam-$AMBIENTE --query 'Schedules[].Name' --output text | \
xargs -I {} aws scheduler delete-schedule --name {} --group-name jam-$AMBIENTE

# Purgar cola SQS
echo "Purgando cola SQS..."
aws sqs purge-queue --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/jam-notificaciones-$AMBIENTE

# Vaciar tablas DynamoDB
echo "Vaciando tablas..."
python3 scripts/vaciar-tabla.py jam-inventario-$AMBIENTE
python3 scripts/vaciar-tabla.py jam-clientes-$AMBIENTE
python3 scripts/vaciar-tabla.py jam-procesos-$AMBIENTE
python3 scripts/vaciar-tabla.py jam-historial-bloqueos-$AMBIENTE

# Eliminar usuarios de Cognito (excepto admin)
echo "Limpiando usuarios de Cognito..."
aws cognito-idp list-users --user-pool-id $USER_POOL_ID --query 'Users[?Username!=`admin`].Username' --output text | \
xargs -I {} aws cognito-idp admin-delete-user --user-pool-id $USER_POOL_ID --username {}

echo "Reset completado. Backups disponibles en DynamoDB Backups."
```

---

## 5. CONSIDERACIONES TÉCNICAS

### 5.1 Impacto en EventBridge Scheduler

**Problema:** Schedules huérfanos tras eliminación de registros

**Solución implementada:**
```python
def cancelar_schedules_asociados(unidad_id, cedula=None):
    schedules_a_cancelar = []
    
    # Schedules de bloqueo
    schedules_a_cancelar.append(f'bloqueo-{unidad_id}-alerta')
    schedules_a_cancelar.append(f'bloqueo-{unidad_id}-liberacion')
    
    # Schedules de exclusividad (si aplica)
    if cedula:
        schedules_a_cancelar.append(f'exclusividad-{cedula}-{unidad_id}')
    
    for schedule_name in schedules_a_cancelar:
        try:
            scheduler_client.delete_schedule(Name=schedule_name)
        except scheduler_client.exceptions.ResourceNotFoundException:
            pass  # Ya fue eliminado
```

**Llamar siempre antes de:**
- Liberar bloqueo manualmente
- Eliminar unidad
- Desvincular proceso
- Eliminar cliente

### 5.2 Integridad Referencial

**Dependencias críticas:**
```
Proyecto
  └── Etapa
       └── Torre
            └── Unidad
                 └── Proceso
                      └── Cliente
```

**Orden de eliminación seguro:**
1. Cancelar schedules
2. Desvincular procesos
3. Liberar bloqueos
4. Eliminar unidades
5. Eliminar torres
6. Eliminar etapas
7. Desactivar proyecto

**Validaciones automáticas:**
- Proyecto: verificar que no tenga unidades
- Etapa: verificar que no tenga unidades ni torres
- Unidad: verificar estado y procesos activos
- Cliente: NO permitir eliminación directa

### 5.3 Transacciones y Rollback

**Limitación de DynamoDB:** No soporta transacciones multi-tabla

**Estrategia de compensación:**
```python
def eliminar_con_rollback(unidad_id):
    backup_unidad = obtener_unidad(unidad_id)
    backup_procesos = obtener_procesos_unidad(unidad_id)
    
    try:
        # Operaciones de eliminación
        eliminar_procesos(unidad_id)
        eliminar_unidad(unidad_id)
        cancelar_schedules(unidad_id)
        
    except Exception as e:
        # Rollback manual
        restaurar_unidad(backup_unidad)
        restaurar_procesos(backup_procesos)
        raise e
```

---

## 6. AUDITORÍA Y TRAZABILIDAD

### 6.1 Registro de Eliminaciones

**Tabla sugerida:** `jam-auditoria-eliminaciones`

```python
{
    'pk': 'ELIMINACION#{timestamp}',
    'sk': 'TIPO#{tipo_entidad}',
    'entidad_id': 'UNIDAD#A-101',
    'tipo': 'UNIDAD',
    'ejecutado_por': 'admin@jamconstrucciones.com',
    'fecha': '2026-05-03T14:30:00Z',
    'motivo': 'Datos de prueba',
    'datos_eliminados': {
        # Snapshot del registro eliminado
    },
    'reversible': True,
    'backup_location': 's3://jam-backups/2026/05/03/unidad-A-101.json'
}
```

### 6.2 Logs de CloudWatch

**Configuración recomendada:**
```python
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def eliminar_unidad_con_log(unidad_id, ejecutado_por):
    logger.info(f'INICIO_ELIMINACION: unidad={unidad_id}, usuario={ejecutado_por}')
    
    try:
        # Validaciones
        unidad = obtener_unidad(unidad_id)
        logger.info(f'VALIDACION: estado={unidad["estado"]}, tiene_procesos={tiene_procesos(unidad_id)}')
        
        # Eliminación
        eliminar_unidad(unidad_id)
        logger.info(f'ELIMINACION_EXITOSA: unidad={unidad_id}')
        
    except Exception as e:
        logger.error(f'ERROR_ELIMINACION: unidad={unidad_id}, error={str(e)}')
        raise
```

**Retención de logs:** 7 años (cumplimiento legal)

---

## 7. CHECKLIST DE BORRADO SEGURO

### Antes de Eliminar
- [ ] Verificar que no existen dependencias activas
- [ ] Crear backup de la tabla afectada
- [ ] Validar permisos del usuario ejecutor
- [ ] Documentar motivo de la eliminación
- [ ] Obtener aprobación si es dato productivo

### Durante la Eliminación
- [ ] Cancelar schedules de EventBridge asociados
- [ ] Liberar bloqueos activos
- [ ] Desvincular procesos relacionados
- [ ] Registrar operación en auditoría
- [ ] Capturar snapshot del dato eliminado

### Después de Eliminar
- [ ] Verificar que no quedaron registros huérfanos
- [ ] Confirmar que schedules fueron cancelados
- [ ] Validar integridad de datos relacionados
- [ ] Documentar resultado de la operación
- [ ] Archivar backup en ubicación segura

---

## 8. SCRIPTS DE UTILIDAD

### 8.1 Verificar Dependencias

```python
# verificar_dependencias.py
def verificar_dependencias_proyecto(proyecto_id):
    """Verifica todas las dependencias antes de eliminar un proyecto"""
    
    reporte = {
        'proyecto_id': proyecto_id,
        'puede_eliminar': True,
        'advertencias': [],
        'bloqueantes': []
    }
    
    # Verificar unidades
    unidades = contar_unidades(proyecto_id)
    if unidades > 0:
        reporte['puede_eliminar'] = False
        reporte['bloqueantes'].append(f'{unidades} unidades registradas')
    
    # Verificar clientes
    clientes = contar_clientes(proyecto_id)
    if clientes > 0:
        reporte['advertencias'].append(f'{clientes} clientes captados (se preservarán)')
    
    # Verificar procesos activos
    procesos_activos = contar_procesos_activos(proyecto_id)
    if procesos_activos > 0:
        reporte['puede_eliminar'] = False
        reporte['bloqueantes'].append(f'{procesos_activos} procesos de venta activos')
    
    # Verificar bloqueos activos
    bloqueos_activos = contar_bloqueos_activos(proyecto_id)
    if bloqueos_activos > 0:
        reporte['puede_eliminar'] = False
        reporte['bloqueantes'].append(f'{bloqueos_activos} unidades bloqueadas')
    
    return reporte
```

### 8.2 Backup Selectivo

```python
# backup_selectivo.py
def backup_entidad(tipo, entidad_id):
    """Crea backup de una entidad específica con todas sus relaciones"""
    
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = {
        'metadata': {
            'tipo': tipo,
            'entidad_id': entidad_id,
            'fecha_backup': timestamp,
            'version_sistema': '1.0'
        },
        'datos': {}
    }
    
    if tipo == 'PROYECTO':
        backup['datos']['proyecto'] = obtener_proyecto(entidad_id)
        backup['datos']['etapas'] = obtener_etapas(entidad_id)
        backup['datos']['unidades'] = obtener_unidades(entidad_id)
        backup['datos']['clientes'] = obtener_clientes_proyecto(entidad_id)
        backup['datos']['procesos'] = obtener_procesos_proyecto(entidad_id)
    
    elif tipo == 'UNIDAD':
        backup['datos']['unidad'] = obtener_unidad(entidad_id)
        backup['datos']['procesos'] = obtener_procesos_unidad(entidad_id)
        backup['datos']['historial_bloqueos'] = obtener_historial_bloqueos(entidad_id)
    
    # Guardar en S3
    s3_key = f'backups/{tipo}/{entidad_id}/{timestamp}.json'
    s3_client.put_object(
        Bucket='jam-backups',
        Key=s3_key,
        Body=json.dumps(backup, indent=2, default=str)
    )
    
    return s3_key
```

### 8.3 Restauración desde Backup

```python
# restaurar_backup.py
def restaurar_desde_backup(s3_key):
    """Restaura una entidad desde un backup en S3"""
    
    # Descargar backup
    response = s3_client.get_object(Bucket='jam-backups', Key=s3_key)
    backup = json.loads(response['Body'].read())
    
    tipo = backup['metadata']['tipo']
    
    if tipo == 'PROYECTO':
        # Restaurar en orden de dependencias
        restaurar_proyecto(backup['datos']['proyecto'])
        for etapa in backup['datos']['etapas']:
            restaurar_etapa(etapa)
        for unidad in backup['datos']['unidades']:
            restaurar_unidad(unidad)
        for cliente in backup['datos']['clientes']:
            restaurar_cliente(cliente)
        for proceso in backup['datos']['procesos']:
            restaurar_proceso(proceso)
    
    elif tipo == 'UNIDAD':
        restaurar_unidad(backup['datos']['unidad'])
        for proceso in backup['datos']['procesos']:
            restaurar_proceso(proceso)
    
    registrar_auditoria('RESTAURACION', backup['metadata']['entidad_id'], f'Desde backup {s3_key}')
```

---

## 9. RECOMENDACIONES FINALES

### 9.1 Políticas Organizacionales

1. **Principio de mínimo privilegio**
   - Solo usuarios con rol `admin` pueden eliminar datos
   - Operaciones de borrado requieren doble confirmación
   - Eliminaciones masivas requieren aprobación de gerencia

2. **Documentación obligatoria**
   - Toda eliminación debe tener motivo documentado
   - Backups deben conservarse mínimo 90 días
   - Auditorías trimestrales de datos eliminados

3. **Automatización con supervisión**
   - Archivar datos antiguos automáticamente
   - Alertas para eliminaciones inusuales
   - Dashboard de métricas de borrado

### 9.2 Mejoras Futuras

1. **Implementar soft-delete universal**
   - Agregar campo `deleted_at` a todas las tablas
   - Filtrar registros eliminados en queries
   - Proceso de purga definitiva tras período de gracia

2. **Sistema de papelera**
   - Tabla `jam-papelera` con TTL de 30 días
   - Mover registros eliminados a papelera
   - Restauración con un clic desde interfaz

3. **Anonimización automática**
   - Lambda programada para anonimizar clientes antiguos
   - Preservar datos operativos, eliminar PII
   - Cumplimiento proactivo con regulaciones

---

## 10. CONTACTOS Y RESPONSABLES

| Rol | Responsable | Contacto |
|-----|-------------|----------|
| Administrador de Datos | [Nombre] | [Email] |
| Oficial de Cumplimiento | [Nombre] | [Email] |
| Arquitecto de Sistemas | [Nombre] | [Email] |
| Soporte Técnico | [Nombre] | [Email] |

---

## 11. HISTORIAL DE CAMBIOS

| Versión | Fecha | Cambios | Autor |
|---------|-------|---------|-------|
| 1.0 | 2026-05-03 | Documento inicial | Equipo de Desarrollo |

---

**Clasificación:** Confidencial  
**Próxima revisión:** 2026-11-03  
**Aprobado por:** [Pendiente]
