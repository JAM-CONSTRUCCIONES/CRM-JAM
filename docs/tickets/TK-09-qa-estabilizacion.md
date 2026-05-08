# TK-09 - QA funcional integral, pruebas de concurrencia y estabilización

## Objetivo

Validar de extremo a extremo los flujos críticos del sistema antes de producción,
corrigiendo defectos funcionales, visuales y de concurrencia.

---

## Alcance

- Pruebas funcionales de todos los flujos críticos
- Prueba de concurrencia en bloqueo de unidades
- Revisión de navegación en desktop y móvil
- Corrección de hallazgos críticos y medianos
- Checklist de salida a producción

---

## Flujos a validar

### Autenticación (TK-01)
- [ ] Login con usuario admin
- [ ] Login con usuario inmobiliaria
- [ ] Acceso a ruta protegida sin token → redirige a login
- [ ] Token expirado → redirige a login automáticamente
- [ ] Inmobiliaria no ve proyectos no asignados

### Inventario y visualización (TK-02, TK-03)
- [ ] Carga correcta de unidades por proyecto
- [ ] Filtros por etapa, torre y estado funcionan en cascada
- [ ] Admin ve todos los campos (cliente, inmobiliaria, fecha bloqueo)
- [ ] Inmobiliaria no ve cliente ni inmobiliaria que bloqueó
- [ ] Timer de bloqueo se actualiza en tiempo real
- [ ] Timer se resalta al llegar a 5h restantes

### Bloqueo y concurrencia (TK-04)
- [ ] Bloqueo exitoso cambia estado de unidad a `bloqueada`
- [ ] Intento de bloqueo sobre unidad ya bloqueada → rechazado (409)
- [ ] Misma inmobiliaria no puede re-bloquear antes de 24h → rechazado (429)
- [ ] Liberación automática a las 48h cambia estado a `disponible`
- [ ] Admin puede liberar manualmente con trazabilidad
- [ ] Admin puede extender bloqueo con justificación
- [ ] Emails de bloqueo y alerta de vencimiento se envían correctamente

### Prueba de concurrencia
- [ ] Dos requests simultáneos de bloqueo sobre la misma unidad
- [ ] Solo uno recibe 200, el otro recibe 409
- [ ] El ganador queda registrado con timestamp correcto
- [ ] No quedan estados inconsistentes en DynamoDB

### Captación de clientes (TK-05)
- [ ] Registro de cliente con todos los campos
- [ ] Edad calculada automáticamente desde fecha de nacimiento
- [ ] Inmobiliaria asignada automáticamente desde sesión
- [ ] Intento de duplicado en mismo proyecto → alerta y rechazo
- [ ] Mismo cliente en otro proyecto → permitido
- [ ] Exclusividad vence a los 3 meses (validar con fecha simulada)
- [ ] Historial del cliente se conserva tras vencimiento

### Estatus comerciales y Kommo (TK-06)
- [ ] Cambio de estatus de captacion → reserva actualiza unidad a `no_disponible`
- [ ] Cambio a `desvinculado` libera la unidad
- [ ] Modal de notificación aparece en cada cambio de estatus
- [ ] Historial de estatus registra fecha y usuario
- [ ] Evento llega a Kommo vía SQS (validar en logs de Lambda)
- [ ] Fallo de Kommo no revierte el cambio de estatus

### Carga de inventario (TK-07)
- [ ] Archivo válido carga todas las unidades correctamente
- [ ] Torres ordenadas alfabéticamente tras la carga
- [ ] Unidades existentes no son sobreescritas
- [ ] Filas con errores se reportan sin detener la carga
- [ ] Reporte de resultado disponible para el admin

### Notificaciones y auditoría (TK-08)
- [ ] Todos los eventos críticos generan registro en `jam-auditoria`
- [ ] Mensajes fallidos van a DLQ sin afectar la operación
- [ ] Admin puede consultar auditoría filtrada

---

## Prueba de concurrencia - detalle

Herramienta sugerida: `artillery` o scripts con `asyncio` en Python

```
Escenario:
- Unidad A-101 en estado disponible
- 2 usuarios de distintas inmobiliarias envían POST /bloqueos al mismo tiempo
- Validar: exactamente 1 respuesta 200 y 1 respuesta 409
- Validar: estado final de A-101 = bloqueada con un solo bloqueado_por
- Repetir 10 veces para confirmar consistencia
```

---

## Revisión visual desktop / móvil

| Pantalla | Desktop | Móvil |
|----------|---------|-------|
| Login | [ ] | [ ] |
| Inventario con filtros | [ ] | [ ] |
| Detalle de unidad | [ ] | [ ] |
| Formulario de captación | [ ] | [ ] |
| Vista de cliente | [ ] | [ ] |
| Cambio de estatus | [ ] | [ ] |
| Carga de Excel | [ ] | [ ] |

---

## Clasificación de hallazgos

| Severidad | Descripción | Acción |
|-----------|-------------|--------|
| Crítico | Bloquea un flujo principal | Corregir antes de producción |
| Mediano | Afecta experiencia pero tiene workaround | Corregir antes de producción |
| Menor | Visual o cosmético | Puede ir en siguiente iteración |

---

## Checklist de salida a producción

### Funcional
- [ ] Todos los flujos críticos validados sin errores bloqueantes
- [ ] Prueba de concurrencia con resultado consistente
- [ ] Corrección de hallazgos críticos y medianos

### Infraestructura
- [ ] Variables de entorno configuradas en stage `prod`
- [ ] Cognito User Pool de producción creado
- [ ] DLQ configurada y monitoreada
- [ ] Permisos IAM revisados (least privilege)
- [ ] CloudFront apuntando al bucket S3 de producción

### Operativo
- [ ] Usuario admin de producción creado
- [ ] Al menos una inmobiliaria de prueba creada y validada
- [ ] Guía básica de uso entregada al equipo de JAM

---

## Criterios de aceptación

- [ ] Flujos críticos funcionan sin errores bloqueantes
- [ ] Concurrencia en bloqueo validada con resultado consistente en 10 intentos
- [ ] Defectos críticos y medianos corregidos
- [ ] Checklist de producción completado y firmado
- [ ] Evidencia de pruebas documentada (capturas o reporte)

---

## Notas técnicas

- Las pruebas de concurrencia deben ejecutarse contra el ambiente `dev` en AWS, no local
- Simular vencimiento de exclusividad ajustando `fecha_vencimiento` directamente en DynamoDB
- Depende de: TK-01 al TK-08 completados
