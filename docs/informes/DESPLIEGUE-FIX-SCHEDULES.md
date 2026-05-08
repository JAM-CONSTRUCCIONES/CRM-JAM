# Instrucciones de Despliegue: Fix Schedules

**Fecha:** 6 de mayo de 2026  
**Ticket:** Fix gestión de schedules en migraciones

---

## Problema Identificado

Los schedules de EventBridge NO se estaban creando en las migraciones porque:

1. ❌ La lambda `jam-proyectos` **NO tenía configuradas** las variables de entorno necesarias:
   - `BLOQUEOS_LAMBDA_ARN`
   - `SCHEDULER_ROLE_ARN`
   - `SQS_URL`
   - `HISTORIAL_TABLE`
   - `CLIENTES_TABLE`

2. ❌ La lambda `jam-proyectos` **NO tenía permisos** para:
   - Crear schedules (`scheduler:CreateSchedule`)
   - Eliminar schedules (`scheduler:DeleteSchedule`)
   - PassRole al scheduler role (`iam:PassRole`)

3. ⚠️ Los schedules ejecutados no se eliminaban automáticamente

---

## Cambios Implementados

### 1. Infraestructura (CDK) ✅

**Archivo:** `infra/lib/jam-stack.ts`

**Cambios:**
- Agregadas variables de entorno a `jam-proyectos`:
  - `HISTORIAL_TABLE`
  - `CLIENTES_TABLE`
  - `SCHEDULER_ROLE_ARN`
  - `BLOQUEOS_LAMBDA_ARN`
  - `SQS_URL`
- Agregados permisos IAM:
  - `scheduler:CreateSchedule`
  - `scheduler:DeleteSchedule`
  - `iam:PassRole` para scheduler role
- Agregados permisos DynamoDB:
  - `historialTable.grantReadWriteData(proyectosLambda)`
  - `clientesTable.grantReadWriteData(proyectosLambda)`
- Agregado permiso SQS:
  - `notificacionesQueue.grantSendMessages(proyectosLambda)`

### 2. Eliminación Automática de Schedules Post-Ejecución ✅

**Archivos modificados:**
- `lambdas/jam-bloqueos/routes/scheduler_handler.py`
- `lambdas/jam-captacion/routes/scheduler_handler.py`

**Cambios:**
- Los schedules ahora se eliminan explícitamente después de ejecutarse
- Logging mejorado con símbolos visuales (✓, ⚠, ✗)
- Manejo de errores más robusto

### 3. Logging Mejorado en Creación de Schedules ✅

**Archivos modificados:**
- `lambdas/jam-bloqueos/utils/scheduler.py`
- `lambdas/jam-captacion/utils/scheduler.py`
- `lambdas/jam-proyectos/utils/excel_writer.py`

**Cambios:**
- Logging detallado de variables de entorno al inicio
- Contador de schedules creados exitosamente
- Mensajes claros de éxito/advertencia/error
- Información de debugging en caso de fallo

---

## Pasos de Despliegue

### 1. Desplegar Infraestructura (CDK)

```bash
cd infra

# Verificar cambios
cdk diff

# Desplegar
cdk deploy

# Confirmar cuando pregunte
```

**Salida esperada:**
```
✅ jam-proyectos: Variables de entorno actualizadas
✅ jam-proyectos: Permisos IAM agregados
✅ Stack desplegado exitosamente
```

### 2. Verificar Variables de Entorno

```bash
# Verificar que las variables estén configuradas
aws lambda get-function-configuration \
  --function-name jam-proyectos \
  --query 'Environment.Variables' \
  --output json
```

**Debe incluir:**
```json
{
  "INVENTARIO_TABLE": "jam-inventario",
  "USUARIOS_TABLE": "jam-usuarios",
  "HISTORIAL_TABLE": "jam-historial-bloqueos",
  "CLIENTES_TABLE": "jam-clientes",
  "PROCESOS_TABLE": "jam-procesos",
  "ARCHIVOS_BUCKET": "jam-archivos-{account}",
  "SQS_URL": "https://sqs.us-east-1.amazonaws.com/{account}/jam-notificaciones-queue",
  "SCHEDULER_ROLE_ARN": "arn:aws:iam::{account}:role/jam-scheduler-role",
  "BLOQUEOS_LAMBDA_ARN": "arn:aws:lambda:us-east-1:{account}:function:jam-bloqueos"
}
```

### 3. Empaquetar y Desplegar Lambdas

```bash
# Lambda jam-bloqueos
cd lambdas/jam-bloqueos
zip -r ../jam-bloqueos-deploy.zip . -x "*.pyc" -x "__pycache__/*"
cd ../..

aws lambda update-function-code \
  --function-name jam-bloqueos \
  --zip-file fileb://lambdas/jam-bloqueos-deploy.zip \
  --region us-east-1

# Lambda jam-captacion
cd lambdas/jam-captacion
zip -r ../jam-captacion-deploy.zip . -x "*.pyc" -x "__pycache__/*"
cd ../..

aws lambda update-function-code \
  --function-name jam-captacion \
  --zip-file fileb://lambdas/jam-captacion-deploy.zip \
  --region us-east-1

# Lambda jam-proyectos
cd lambdas/jam-proyectos
zip -r ../jam-proyectos-deploy.zip . -x "*.pyc" -x "__pycache__/*"
cd ../..

aws lambda update-function-code \
  --function-name jam-proyectos \
  --zip-file fileb://lambdas/jam-proyectos-deploy.zip \
  --region us-east-1
```

---

## Pruebas Post-Despliegue

### 1. Probar Migración con Unidades Bloqueadas

```bash
# Realizar una migración con unidades bloqueadas desde el frontend
# Verificar en CloudWatch Logs:
aws logs tail /aws/lambda/jam-proyectos --follow
```

**Salida esperada:**
```
=== INICIO MIGRACIÓN ===
Proyecto: PROYECTO#xxx
Total filas: 10
LAMBDA_ARN: arn:aws:lambda:us-east-1:xxx:function:jam-bloqueos
SCHEDULER_ROLE_ARN: arn:aws:iam::xxx:role/jam-scheduler-role
SQS_URL: https://sqs.us-east-1.amazonaws.com/xxx/jam-notificaciones-queue

Procesando bloqueo para unidad A-101 (fila 1)
✓ Schedule creado: bloqueo-xxx-alerta at 2026-05-06T19:00:00 (accion: alerta_vencimiento)
✓ Schedule creado: bloqueo-xxx-liberacion at 2026-05-07T00:00:00 (accion: liberar_automatico)
✓ Ambos schedules creados exitosamente para unidad xxx
✓ Notificación SQS enviada para bloqueo de unidad A-101

=== FIN MIGRACIÓN ===
Unidades cargadas: 10
Clientes creados: 8
```

### 2. Verificar Schedules Creados

```bash
# Listar schedules activos
aws scheduler list-schedules \
  --query 'Schedules[?starts_with(Name, `bloqueo-`)].[Name,State,ScheduleExpression]' \
  --output table
```

**Debe mostrar:**
```
|  bloqueo-xxx-alerta      |  ENABLED  |  at(2026-05-06T19:00:00)  |
|  bloqueo-xxx-liberacion  |  ENABLED  |  at(2026-05-07T00:00:00)  |
```

### 3. Verificar Eliminación de Schedules

```bash
# Esperar a que se ejecute un schedule o liberar manualmente
# Verificar en CloudWatch Logs:
aws logs tail /aws/lambda/jam-bloqueos --follow --filter-pattern "✓ Schedule eliminado"
```

**Salida esperada:**
```
✓ Schedule eliminado post-ejecución: bloqueo-xxx-alerta
✓ Schedule eliminado post-ejecución: bloqueo-xxx-liberacion
```

---

## Verificación de Errores

### Si NO se crean schedules:

```bash
# Ver logs de jam-proyectos
aws logs tail /aws/lambda/jam-proyectos --follow --filter-pattern "⚠"
```

**Posibles causas:**
1. Variables de entorno no configuradas → Verificar paso 2
2. Permisos IAM faltantes → Verificar políticas de la lambda
3. Scheduler role ARN incorrecto → Verificar en variables de entorno

### Si schedules NO se eliminan:

```bash
# Ver logs de jam-bloqueos
aws logs tail /aws/lambda/jam-bloqueos --follow --filter-pattern "✗"
```

**Posibles causas:**
1. Permisos para `scheduler:DeleteSchedule` faltantes
2. Nombre de schedule incorrecto
3. Schedule ya fue eliminado por AWS

---

## Rollback (Si es necesario)

### Revertir Infraestructura:

```bash
cd infra
git checkout HEAD~1 lib/jam-stack.ts
cdk deploy
```

### Revertir Lambdas:

```bash
# Usar versiones anteriores de los zips
aws lambda update-function-code \
  --function-name jam-proyectos \
  --zip-file fileb://lambdas/jam-proyectos-backup.zip
```

---

## Checklist de Despliegue

- [ ] Infraestructura desplegada con CDK
- [ ] Variables de entorno verificadas en jam-proyectos
- [ ] Permisos IAM verificados
- [ ] Lambda jam-bloqueos desplegada
- [ ] Lambda jam-captacion desplegada
- [ ] Lambda jam-proyectos desplegada
- [ ] Prueba de migración exitosa
- [ ] Schedules se crean correctamente
- [ ] Schedules se eliminan correctamente
- [ ] Logs revisados sin errores críticos
- [ ] Equipo notificado del despliegue

---

**Preparado por:** Equipo de Desarrollo  
**Última actualización:** 6 de mayo de 2026
