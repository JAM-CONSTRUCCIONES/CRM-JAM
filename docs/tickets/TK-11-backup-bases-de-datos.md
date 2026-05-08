# TK-11 - Backup de bases de datos

## Objetivo

Recuperación ante desastres — falla de región AWS, tabla eliminada a nivel de infraestructura, o corrupción total de datos. No cubre errores de usuario (borrado desde la app es responsabilidad del operador).

---

## Implementación

### AWS Backup — snapshots diarios a S3

Snapshot completo de cada tabla cada día a las **12:00am hora RD (4:00am UTC)**. Los snapshots se almacenan en `jam-backup-vault` con retención de **30 días**. Los datos van a S3 con redundancia multi-AZ, completamente independiente de DynamoDB.

`RemovalPolicy.RETAIN` en todas las tablas — si se hace `cdk destroy`, las tablas no se eliminan.

### Tablas protegidas

| Tabla | Snapshot diario | RemovalPolicy |
|-------|----------------|---------------|
| `jam-usuarios` | ✅ | RETAIN |
| `jam-inventario` | ✅ | RETAIN |
| `jam-clientes` | ✅ | RETAIN |
| `jam-procesos` | ✅ | RETAIN |
| `jam-historial-estatus` | ✅ | RETAIN |
| `jam-historial-bloqueos` | ✅ | RETAIN |

---

## Proceso de restauración ante desastre

1. Ir a consola AWS → **AWS Backup** → Backup vaults → `jam-backup-vault`
2. Seleccionar el recovery point del día deseado (hay uno por día, últimos 30)
3. Click "Restore" → asignar nombre a la tabla destino, ej: `jam-clientes-restored`
4. Esperar la restauración (minutos según tamaño)
5. Verificar los datos en la tabla restaurada
6. Actualizar la variable de entorno de cada lambda afectada para apuntar a la tabla restaurada

### Lambdas a actualizar por tabla

| Tabla restaurada | Lambdas a actualizar |
|-----------------|---------------------|
| `jam-usuarios` | `jam-auth`, `jam-bloqueos`, `jam-captacion` |
| `jam-inventario` | `jam-proyectos`, `jam-bloqueos`, `jam-crm`, `jam-captacion` |
| `jam-clientes` | `jam-captacion`, `jam-bloqueos`, `jam-crm` |
| `jam-procesos` | `jam-captacion`, `jam-crm` |
| `jam-historial-bloqueos` | `jam-bloqueos` |
| `jam-historial-estatus` | (reservada) |

> AWS siempre crea una tabla nueva al restaurar — nunca sobreescribe la original. Las lambdas deben apuntarse manualmente a la tabla restaurada o hacer `cdk deploy` con el nombre actualizado.

---

## Costos estimados

Con ~500 MB de datos totales:

| Concepto | Costo estimado/mes |
|----------|-------------------|
| AWS Backup (30 snapshots × 500MB) | ~$1.50 |

---

## Criterios de aceptación

- [x] AWS Backup plan diario a las 12am RD (4am UTC) con retención 30 días
- [x] Vault `jam-backup-vault` con `RemovalPolicy.RETAIN`
- [x] `RemovalPolicy.RETAIN` en todas las tablas
- [x] Proceso de restauración documentado
- [ ] Hacer `cdk deploy` para aplicar los cambios en AWS
- [ ] Verificar que el primer backup se ejecuta correctamente
