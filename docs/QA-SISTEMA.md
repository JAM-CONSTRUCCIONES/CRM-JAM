# QA Sistema JAM Construcciones
> Basado en el código real del backend. Cada caso está atado a una función específica.

---

## 1. AUTENTICACIÓN (`jam-auth`)

### 1.1 Login y MFA
- [x] Login con usuario y contraseña correctos → responde con challenge MFA
- [x] Login con contraseña incorrecta → 401, mensaje "Usuario o contraseña incorrectos"
- [x] Login con usuario que nunca configuró MFA → flujo de setup: QR + clave manual visible
- [x] Escanear QR con Google Authenticator, ingresar código → sesión iniciada, redirige a dashboard
- [ x] Ingresar código MFA incorrecto → error "Código incorrecto o expirado"
- [ x] Ingresar código MFA vencido (>30s) → error
- [x ] Sesión activa: refrescar página → sigue autenticado (token válido 8h)
- [ x] Token expirado → redirige automáticamente al login sin pantalla en blanco

### 1.2 Recuperación de contraseña
- [ x] "Olvidé mi contraseña" → ingresar usuario → llega código al correo registrado en Cognito
- [ x] Ingresar código correcto + nueva contraseña válida → contraseña cambiada, puede hacer login
- [ x] Ingresar código incorrecto → error "Código incorrecto o contraseña inválida"
- [ x] Ingresar contraseña que no cumple política (min 8 chars, mayúscula, número) → error de Cognito

### 1.3 Control de acceso por rol
- [ ] Usuario `admin` → ve todas las secciones del sidebar
- [ ] Usuario `coordinador` → ve inventario, clientes, bloqueos, reportes. NO ve gestión de usuarios ni inmobiliarias
- [ ] Usuario `supervisor` → solo lectura. Botones de crear/editar/eliminar no aparecen
- [ ] Usuario `inmobiliaria` → solo ve proyectos asignados. No ve dashboard ni clientes de otras inmobiliarias
- [ ] Acceder a ruta protegida sin token → redirige a `/unauthorized`
- [ ] Token de inmobiliaria intentando llamar endpoint `/admin/*` → 403 Forbidden

---

## 2. GESTIÓN DE INMOBILIARIAS Y USUARIOS (`jam-auth`)

### 2.1 Inmobiliarias
- [ ] Crear inmobiliaria con nombre y correos → aparece en listado
- [ ] Crear inmobiliaria sin nombre → error 400
- [ ] Editar nombre e inmobiliaria → cambios reflejados inmediatamente
- [ ] Deshabilitar inmobiliaria → `activo = false` en DynamoDB, sus usuarios no pueden hacer login
- [ ] Habilitar inmobiliaria deshabilitada → acceso restaurado
- [ ] Eliminar inmobiliaria → desaparece del listado (verificar que historial de clientes y bloqueos se conserva)
- [ ] Asignar proyectos a inmobiliaria → inmobiliaria solo ve esos proyectos al hacer login

### 2.2 Usuarios de inmobiliaria
- [ ] Crear usuario con username alias (no correo) → puede hacer login
- [ ] Crear usuario sin username → error
- [ ] Deshabilitar usuario → no puede hacer login, historial preservado
- [ ] Habilitar usuario deshabilitado → acceso restaurado
- [ ] Eliminar usuario → desaparece del listado

### 2.3 Usuarios internos del sistema
- [ ] Admin crea usuario `coordinador` → puede gestionar inventario pero no usuarios
- [ ] Admin crea usuario `supervisor` → solo lectura, no puede crear ni editar nada
- [ ] Admin deshabilita usuario interno → no puede hacer login
- [ ] Admin elimina usuario interno → desaparece del listado

---

## 3. PROYECTOS (`jam-proyectos → proyectos.py`)

### 3.1 CRUD
- [ ] Crear proyecto con nombre → aparece en listado con `activo = true`
- [ ] Crear proyecto sin nombre → error 400 "nombre requerido"
- [ ] Editar nombre y descripción → cambios reflejados
- [ ] Subir imagen de portada → aparece en la card del proyecto
- [ ] Editar proyecto con `proyecto_id` inexistente → 404

### 3.2 Eliminación con protección
- [ ] Intentar eliminar proyecto **con unidades** → error 409 "No se puede eliminar el proyecto porque tiene unidades registradas. Elimina primero todas las unidades."
- [ ] Eliminar proyecto **sin unidades** → `activo = false`, desaparece del listado
- [ ] Eliminar proyecto con `proyecto_id` inexistente → 404
- [ ] Proyecto desactivado no aparece en `GET /proyectos`
- [ ] Proyecto desactivado: intentar crear unidad en él → error 400 "No se pueden agregar unidades a un proyecto desactivado"

---

## 4. ETAPAS (`jam-proyectos → etapas.py`)

- [ ] Crear etapa en proyecto activo → aparece en listado ordenada por `orden`
- [ ] Crear etapa en proyecto **desactivado** → error 400 "No se pueden agregar etapas a un proyecto desactivado"
- [ ] Crear etapa en proyecto inexistente → 404
- [ ] Editar nombre y orden de etapa → cambios reflejados
- [ ] Editar etapa inexistente → 404
- [ ] Eliminar etapa **con unidades asociadas** → error 400 "No se puede eliminar: la etapa tiene unidades asociadas"
- [ ] Eliminar etapa **con torres asociadas** → error 400 "No se puede eliminar: la etapa tiene torres asociadas"
- [ ] Eliminar etapa sin dependencias → eliminada correctamente

---

## 5. UNIDADES (`jam-proyectos → unidades.py`)

### 5.1 Creación y validaciones
- [ ] Crear unidad con campos requeridos (id_unidad, etapa_id, metraje, precio) → creada con `estado = disponible`
- [ ] Crear unidad sin `id_unidad` → error 400
- [ ] Crear unidad con `id_unidad` duplicado en el mismo proyecto → error 400 "Ya existe una unidad con el nombre..."
- [ ] Crear unidad con `metraje` no numérico → error 400
- [ ] Crear unidad con `precio` no numérico → error 400
- [ ] Crear unidad en proyecto desactivado → error 400
- [ ] Crear unidad en proyecto inexistente → 404
- [ ] Campos opcionales (tipo, manzana, piso, parqueos, num_cuartos, num_banos, metraje_terraza, metraje_patio, precios adicionales) → se guardan correctamente

### 5.2 Edición
- [ ] Editar `id_unidad` a uno ya existente en el mismo proyecto → error 400
- [ ] Editar `id_unidad` al mismo valor que ya tiene → no da error (excluye la propia unidad del check)
- [ ] Editar campos numéricos con valor no numérico → error 400
- [ ] Editar unidad inexistente → 404

### 5.3 Eliminación con protección
- [ ] Eliminar unidad en estado `disponible` **sin procesos activos** → eliminada
- [ ] Eliminar unidad en estado `disponible` **con proceso en `captacion`** → error 409 "No se puede eliminar: la unidad tiene un proceso de venta activo en estado captacion"
- [ ] Eliminar unidad en estado `disponible` **con proceso en `reserva`** → error 409
- [ ] Eliminar unidad en estado `bloqueada` → error 400 "No se puede eliminar: la unidad está en estado bloqueada"
- [ ] Eliminar unidad en estado `no_disponible` → error 400
- [ ] Eliminar unidad inexistente → 404

### 5.4 Visibilidad por rol
- [ ] Rol `inmobiliaria`: solo ve unidades en estado `disponible` y `bloqueada`
- [ ] Rol `inmobiliaria`: NO ve campos `bloqueado_por`, `cliente_cedula`, `comentario`
- [ ] Rol `admin`/`coordinador`: ve todos los estados y todos los campos
- [ ] Unidad bloqueada: campo `tiempo_restante` calculado correctamente en segundos desde `fecha_liberacion`
- [ ] Unidad bloqueada con `fecha_liberacion` en el pasado → `tiempo_restante = 0`

### 5.5 Filtros
- [ ] Filtrar por `etapa_id` → solo unidades de esa etapa
- [ ] Filtrar por `estado` → solo unidades con ese estado
- [ ] Filtrar por `tipo` → solo unidades con ese tipo
- [ ] Filtrar por `manzana` → solo unidades de esa manzana
- [ ] Filtrar por `piso` → solo unidades de ese piso (comparación como string)
- [ ] Combinar múltiples filtros → intersección correcta

---

## 6. BLOQUEOS (`jam-bloqueos → bloqueos.py`)

### 6.1 Flujo normal
- [ ] Bloquear unidad disponible → estado cambia a `bloqueada`, `bloqueado_por = inmobiliaria_id`, `fecha_liberacion = ahora + 48h`
- [ ] Bloquear unidad disponible → se crean 2 schedules en EventBridge: `bloqueo-{id}-alerta` (43h) y `bloqueo-{id}-liberacion` (48h)
- [ ] Bloquear unidad disponible → registro creado en `jam-historial-bloqueos`
- [ ] Bloquear unidad disponible → mensaje publicado en SQS con evento `bloqueo_registrado`
- [ ] Bloquear unidad con datos de cliente → cliente creado en `jam-clientes`, proceso creado en `jam-procesos` con estado `captacion`
- [ ] Bloquear unidad sin datos de cliente → bloqueo registrado, sin cliente ni proceso

### 6.2 Concurrencia y restricciones
- [ ] Bloquear unidad ya bloqueada por otra inmobiliaria → 409 "La unidad ya fue bloqueada por otra inmobiliaria o no está disponible para bloquear"
- [ ] Bloquear unidad ya bloqueada por la **misma** inmobiliaria → actualiza `cliente_cedula` si viene cliente, no crea nuevo historial ni schedules
- [ ] Intentar bloquear la misma unidad que se liberó hace menos de 24h → 429 "No puedes re-bloquear la unidad antes de 24 horas"
- [ ] Bloquear unidad liberada hace más de 24h → permitido

### 6.3 Cliente con exclusividad
- [ ] Bloquear con cliente que tiene exclusividad activa con **otra** inmobiliaria en el mismo proyecto → 409 "Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto"
- [ ] Bloquear con cliente que tiene exclusividad activa con la **misma** inmobiliaria → actualiza datos del cliente
- [ ] Bloquear con cliente cuya exclusividad venció → crea nuevo registro con nueva exclusividad

### 6.4 Liberación automática (EventBridge)
- [ ] A las 48h: unidad vuelve a `disponible`, se limpian `bloqueado_por`, `fecha_bloqueo`, `fecha_liberacion`, `cliente_cedula`
- [ ] A las 48h con cliente en `captacion`: proceso marcado como `desvinculado`, historial actualizado, flag `alerta_separacion_vencida` removido
- [ ] A las 48h con cliente en `reserva` o superior: proceso también marcado como `desvinculado` (no se respeta el estado avanzado — esto es intencional por liberación automática)
- [ ] A las 43h: mensaje publicado en SQS con evento `alerta_vencimiento`

### 6.5 Liberación manual por admin (`admin_bloqueos.py`)
- [ ] Admin libera bloqueo con proceso en `captacion` → liberado sin advertencia, proceso desvinculado
- [ ] Admin libera bloqueo con proceso en `reserva` → error 409 "El proceso de venta está en estado reserva. Usa ?forzar=true para liberar de todas formas."
- [ ] Admin libera con `?forzar=true` y proceso en `reserva` → liberado, proceso desvinculado
- [ ] Admin libera bloqueo → schedules de EventBridge cancelados
- [ ] Admin libera bloqueo → historial actualizado con `motivo_liberacion = manual` y nombre del admin
- [ ] Admin libera bloqueo → mensaje SQS con evento `liberacion_manual`
- [ ] Admin intenta liberar unidad que no está bloqueada → 404

### 6.6 Extensión de bloqueo
- [ ] Admin extiende bloqueo con `horas_restantes` y `justificacion` → `fecha_liberacion` actualizada
- [ ] Admin extiende sin `justificacion` → error 400
- [ ] Admin extiende con `horas_restantes < 0.02` → error 400
- [ ] Admin extiende → schedules anteriores cancelados, nuevos schedules creados
- [ ] Admin extiende → extensión registrada en historial del bloqueo
- [ ] Admin extiende con `horas_restantes <= 5` → alerta programada en 1 minuto (no 5h antes)
- [ ] Admin intenta extender unidad no bloqueada → 404

### 6.7 Historial de bloqueos
- [ ] `GET /admin/bloqueos/historial` sin filtros → lista paginada de todos los bloqueos
- [ ] `GET /admin/bloqueos/historial?unidad_id=xxx` → solo bloqueos de esa unidad
- [ ] `GET /admin/bloqueos/historial?proyecto_id=xxx` → solo bloqueos de ese proyecto
- [ ] Paginación con `next_token` → página siguiente correcta

---

## 7. CAPTACIÓN DE CLIENTES (`jam-captacion → clientes.py`)

### 7.1 Registro normal
- [ ] Registrar cliente con campos requeridos (cedula, proyecto_id, nombres, apellidos) → creado con `exclusividad_activa = true`
- [ ] Registrar cliente sin cédula → error 400
- [ ] Registrar cliente sin nombres → error 400
- [ ] Registrar cliente con `fecha_nacimiento` → campo `edad` calculado automáticamente
- [ ] Registrar cliente → schedule de vencimiento creado en EventBridge a 3 meses
- [ ] Registrar cliente → evento `cliente_captado` publicado en SQS

### 7.2 Exclusividad
- [ ] Registrar cliente que ya existe con exclusividad activa en la **misma** inmobiliaria → actualiza datos, mantiene exclusividad
- [ ] Registrar cliente con exclusividad vencida en la **misma** inmobiliaria → re-captación: nueva fecha, nueva exclusividad, schedule anterior cancelado y nuevo creado
- [ ] Registrar cliente con exclusividad activa en **otra** inmobiliaria → 409 "Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto. Contacta a JAM Construcciones."
- [ ] Registrar cliente con exclusividad activa en **otra** inmobiliaria → evento `intento_duplicado` publicado en SQS
- [ ] Mismo cliente en **otro proyecto** → permitido sin restricción
- [ ] Vencimiento automático a los 3 meses → `exclusividad_activa = false`, cliente disponible para cualquier inmobiliaria

### 7.3 Listado y búsqueda
- [ ] `GET /clientes` (inmobiliaria) → solo sus propios clientes
- [ ] `GET /clientes?proyecto_id=xxx` → filtrado por proyecto
- [ ] `GET /admin/clientes` → todos los clientes paginados (50 por página)
- [ ] `GET /admin/clientes?proyecto_id=xxx` → filtrado por proyecto
- [ ] `GET /admin/clientes?inmobiliaria_id=xxx` → filtrado por inmobiliaria (normaliza prefijo `INMOBILIARIA#`)
- [ ] `GET /admin/clientes?proyecto_id=xxx&inmobiliaria_id=yyy` → filtrado por ambos
- [ ] `GET /admin/clientes/buscar?cedula=xxx` → todos los registros de esa cédula con sus procesos enriquecidos
- [ ] Paginación con `next_token` → página siguiente correcta

### 7.4 Edición admin
- [ ] Admin edita datos del cliente (nombres, correo, teléfono, etc.) → cambios guardados
- [ ] Admin edita `fecha_nacimiento` → `edad` recalculada automáticamente
- [ ] Admin edita cliente inexistente → 404
- [ ] Admin edita sin `inmobiliaria_id` en query param → error 400

### 7.5 Registro público (sin auth)
- [ ] `POST /publico/clientes` con `inmobiliaria_id` válida → cliente registrado
- [ ] `POST /publico/clientes` con inmobiliaria deshabilitada → error 400 "Inmobiliaria no válida"
- [ ] `POST /publico/clientes` con inmobiliaria inexistente → error 400
- [ ] `GET /publico/proyectos?inmobiliaria_id=xxx` → lista proyectos activos asignados a esa inmobiliaria
- [ ] `GET /publico/proyectos` con inmobiliaria deshabilitada → error 400

---

## 8. ESTATUS COMERCIALES (`jam-crm → estatus.py`)

### 8.1 Transiciones válidas
- [ ] `captacion → reserva` → permitido
- [ ] `captacion → desvinculado` → permitido
- [ ] `reserva → separacion` → permitido
- [ ] `reserva → desvinculado` → permitido
- [ ] `separacion → inicial` → permitido
- [ ] `separacion → pagos_atrasados` → permitido
- [ ] `separacion → desvinculado` → permitido
- [ ] `inicial → pagos_atrasados` → permitido
- [ ] `inicial → contra_entrega` → permitido
- [ ] `inicial → desvinculado` → permitido
- [ ] `pagos_atrasados → inicial` → permitido
- [ ] `pagos_atrasados → contra_entrega` → permitido
- [ ] `contra_entrega → vendida` → permitido
- [ ] `contra_entrega → desvinculado` → permitido
- [ ] `vendida → cualquier_cosa` → error 409 "Transición no permitida"
- [ ] `captacion → separacion` (saltando reserva) → error 409
- [ ] `reserva → inicial` (saltando separacion) → error 409

### 8.2 Efectos sobre la unidad en inventario
- [ ] `captacion → reserva` → unidad pasa a `no_disponible`, schedules de bloqueo cancelados
- [ ] `captacion → reserva` con unidad ya en `no_disponible` o `vendida` → error 409 "La unidad no está disponible para reservar"
- [ ] `captacion → reserva` con unidad bloqueada por **otra** inmobiliaria → error 409 "La unidad está bloqueada por otra inmobiliaria y no puede ser reservada"
- [ ] `cualquier_estado → desvinculado` → unidad vuelve a `disponible`
- [ ] `contra_entrega → vendida` → unidad pasa a `vendida`
- [ ] `reserva → separacion` → unidad permanece `no_disponible`
- [ ] `separacion → inicial` → unidad permanece `no_disponible`

### 8.3 Efectos sobre schedulers
- [ ] `captacion → reserva` → schedules de bloqueo (`bloqueo-{id}-alerta` y `bloqueo-{id}-liberacion`) cancelados
- [ ] `reserva → separacion` → schedule de alerta creado en EventBridge a 30 días (`sep-{cedula}-{unidad}`)
- [ ] `separacion → inicial` → schedule de alerta de separación cancelado, `pago_confirmado = true`
- [ ] `cualquier_estado → desvinculado` desde `separacion`/`pagos_atrasados`/`contra_entrega` → schedule de alerta cancelado

### 8.4 Historial
- [ ] Cada cambio de estatus → entrada agregada al historial embebido en el proceso con `estatus_anterior`, `estatus_nuevo`, `ejecutado_por_nombre`, `timestamp`
- [ ] `GET /admin/clientes/{cedula}/proyecto/{id}/unidad/{uid}/historial` → historial en orden inverso (más reciente primero)
- [ ] Historial sin `inmobiliaria_id` en query param → error 400

### 8.5 Notificaciones
- [ ] Cambio de estatus con `notificar: true` → mensaje SQS con `notificar: true`, correo y teléfono del cliente incluidos
- [ ] Cambio de estatus con `notificar: false` → mensaje SQS con `notificar: false`
- [ ] Proceso inexistente → 404
- [ ] Sin `inmobiliaria_id` en body → error 400
- [ ] Sin `estatus` en body → error 400

### 8.6 Alerta de separación vencida (EventBridge)
- [ ] A los 30 días en `separacion` sin `pago_confirmado` → `alerta_separacion_vencida = true` en el proceso
- [ ] A los 30 días en `separacion` sin `pago_confirmado` → mensaje SQS con evento `alerta_separacion_vencida`
- [ ] A los 30 días pero proceso ya avanzó a `inicial` → no hace nada (guard por estado)
- [ ] A los 30 días pero `pago_confirmado = true` → no hace nada

---

## 9. ANALYTICS / DASHBOARD (`jam-crm → analytics.py`)

- [ ] `GET /admin/analytics?proyecto_id=xxx` → responde con todas las métricas
- [ ] `GET /admin/analytics` sin `proyecto_id` → error 400
- [ ] `unidad_stats`: conteos correctos de disponible, bloqueada, no_disponible, vendida, desvinculada, total
- [ ] `proceso_stats`: conteos correctos de captacion, reserva, separacion, inicial, desvinculado, total
- [ ] `cliente_stats`: total, exclusividad_activa, exclusividad_vencida correctos
- [ ] `kpis.pct_conversion`: (reserva + separacion + inicial) / total_procesos × 100
- [ ] `kpis.tasa_abandono`: desvinculado / total_procesos × 100
- [ ] `kpis.pct_bloqueos_a_venta`: calculado correctamente
- [ ] `cierres_mensuales`: solo últimos 6 meses, ordenados por mes
- [ ] `top_unidades`: top 10 por número de procesos
- [ ] `conversion_por_inmobiliaria`: pct_conversion correcto por inmobiliaria
- [ ] `ventas_por_piso`: solo procesos en `separacion` o `inicial`, cruzados con campo `piso` real de la unidad
- [ ] `ventas_por_metraje`: solo procesos en `separacion` o `inicial`, cruzados con campo `metraje` real de la unidad
- [ ] Proyecto sin procesos → todos los conteos en 0, listas vacías, sin error
- [ ] Proyecto con muchos procesos (>100) → paginación automática en `_scan_all`, no se pierden datos

---

## 10. FLUJOS COMPLETOS END-TO-END

### 10.1 Flujo completo de venta
1. [ ] Admin crea proyecto → crea etapa → crea unidad
2. [ ] Inmobiliaria hace login → ve el proyecto asignado → ve la unidad disponible
3. [ ] Inmobiliaria bloquea la unidad con datos del cliente → unidad pasa a `bloqueada`, cliente en `captacion`
4. [ ] Admin ve el bloqueo en la lista de bloqueos activos con nombre del cliente
5. [ ] Admin cambia estatus a `reserva` → unidad pasa a `no_disponible`, schedules de bloqueo cancelados
6. [ ] Admin cambia estatus a `separacion` → schedule de alerta a 30 días creado
7. [ ] Admin cambia estatus a `inicial` → `pago_confirmado = true`, alerta cancelada
8. [ ] Admin cambia estatus a `contra_entrega` → sin cambio en unidad
9. [ ] Admin cambia estatus a `vendida` → unidad pasa a `vendida`
10. [ ] Dashboard muestra la unidad como vendida y el proceso en analytics

### 10.2 Flujo de desvinculación
1. [ ] Cliente en `reserva` → admin cambia a `desvinculado` → unidad vuelve a `disponible`
2. [ ] Historial del proceso muestra la desvinculación con timestamp y nombre del admin
3. [ ] La unidad puede ser bloqueada nuevamente por otra inmobiliaria

### 10.3 Flujo de liberación automática
1. [ ] Inmobiliaria bloquea unidad con cliente
2. [ ] A las 43h → alerta enviada a SQS
3. [ ] A las 48h → unidad vuelve a `disponible`, proceso marcado como `desvinculado`
4. [ ] La misma inmobiliaria no puede re-bloquear antes de 24h → 429
5. [ ] Pasadas 24h → puede bloquear nuevamente

### 10.4 Flujo de exclusividad
1. [ ] Inmobiliaria A registra cliente C en proyecto P → exclusividad activa
2. [ ] Inmobiliaria B intenta registrar cliente C en proyecto P → 409
3. [ ] Inmobiliaria B registra cliente C en **otro proyecto** → permitido
4. [ ] A los 3 meses → exclusividad de A vence automáticamente
5. [ ] Inmobiliaria B puede registrar cliente C en proyecto P → permitido

### 10.5 Flujo de migración Excel
1. [ ] Admin sube .xlsx a proyecto sin unidades → tabla editable con datos pre-llenados
2. [ ] IA mapea columnas, separa nombres/apellidos, hace matching de inmobiliarias
3. [ ] Admin corrige celdas con advertencias (amarillo), llena cédulas faltantes
4. [ ] Botón confirmar deshabilitado si hay celdas en rojo
5. [ ] Admin confirma → unidades, clientes y procesos creados en DynamoDB
6. [ ] NO se crean schedules de EventBridge (datos históricos)
7. [ ] Reporte final muestra unidades cargadas, advertencias y errores
8. [ ] Unidad con estado `bloqueada` en Excel → `fecha_liberacion` calculada automáticamente como `fecha_bloqueo + 24 horas`
9. [ ] Unidad bloqueada sin `fecha_bloqueo` en Excel → usa timestamp de migración y calcula +24h
10. [ ] Unidad bloqueada con `fecha_liberacion` en Excel → se ignora y se recalcula con regla de 24h
11. [ ] Historial de bloqueo creado con las mismas fechas calculadas (24h)

### 10.6 Concurrencia en bloqueos
1. [ ] Dos inmobiliarias intentan bloquear la misma unidad simultáneamente
2. [ ] La primera en escribir gana (ConditionExpression en DynamoDB)
3. [ ] La segunda recibe 409 inmediatamente
4. [ ] Solo un historial de bloqueo creado, solo un par de schedules en EventBridge

---

## 11. CASOS EDGE Y REGRESIÓN

- [ ] Proyecto con ID que contiene caracteres especiales → no rompe las claves DynamoDB
- [ ] Cédula con `/` o `#` → schedule de exclusividad se crea con nombre sanitizado (reemplaza por `-`)
- [ ] Unidad con `piso = 0` → aparece en filtro por piso correctamente (comparación como string "0")
- [ ] Cliente registrado con prefijo legacy `INMOBILIARIA#` en pk → filtro por inmobiliaria lo encuentra (fallback en `listar_admin`)
- [ ] Extender bloqueo con `horas_restantes = 0.01` (menos de 1 minuto) → error 400
- [ ] Extender bloqueo con `horas_restantes = 4` (menos de 5h) → alerta programada en 1 minuto, no en negativo
- [ ] Analytics con proyecto que tiene unidades sin campo `piso` → `ventas_por_piso` no incluye esa unidad (no rompe)
- [ ] Analytics con proyecto que tiene unidades sin campo `metraje` → `ventas_por_metraje` no incluye esa unidad
- [ ] Liberar bloqueo admin con `?forzar=true` y proceso en `vendida` → proceso NO se desvincula (guard por estado `vendida`)
- [ ] Cambiar estatus de proceso inexistente → 404 claro
- [ ] Historial de bloqueo: `next_token` inválido (no es JSON válido) → error 400 "next_token inválido"
- [ ] `GET /admin/clientes` con `next_token` corrupto → se ignora silenciosamente, devuelve primera página
- [ ] Crear unidad con `precio = 0` → permitido (0 es válido como Decimal)
- [ ] Crear unidad con `metraje = "abc"` → error 400 "metraje y precio deben ser numéricos"
