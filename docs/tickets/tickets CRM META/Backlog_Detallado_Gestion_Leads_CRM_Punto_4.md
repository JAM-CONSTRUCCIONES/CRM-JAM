# BACKLOG FUNCIONAL Y TÉCNICO
## Módulo de Gestión Integral de Leads (CRM)
**Punto #4 - Captación, conversión, seguimiento, WhatsApp, analítica y auditoría**
Épica                                  CRM-LEADS-EPIC-04

Versión                                1.0

Fecha                                  4 de agosto de 2026

Audiencia                              Product Owner, desarrolladores, QA, analistas y responsables
comerciales
### Propósito del documento
Transformar los diez requerimientos del punto #4 en tickets independientes, refinables y verificables, listos para
ser creados en Microsoft Planner o en la herramienta de gestión de proyectos seleccionada. Cada ticket incluye
alcance, reglas, criterios de aceptación, dependencias y evidencias de cierre.
### Alcance general de la épica
Administrar el ciclo completo del lead desde su captación hasta su conversión, pérdida o descarte.
Conservar trazabilidad comercial, operativa y de auditoría en todos los canales y acciones relevantes.
Reducir duplicidad, pérdida de seguimiento y ausencia de información para toma de decisiones.
Habilitar capacidades de integración, medición y exportación sin comprometer seguridad ni permisos.
### Supuestos para refinamiento
El catálogo definitivo de estados, motivos, roles y permisos debe validarse con el responsable comercial antes del desarrollo.
La integración de WhatsApp dependerá de credenciales, número habilitado, proveedor oficial y aprobación de plantillas cuando
aplique.
Las estimaciones indicadas son tamaños relativos iniciales; deben recalcularse después de revisar arquitectura, diseño UX y APIs
disponibles.
# 1. Resumen del backlog
Los tickets se organizan para que el equipo pueda implementar primero la base de datos y trazabilidad, luego la operación
comercial y finalmente integraciones y analítica. Las prioridades pueden ajustarse durante el refinamiento, pero las
dependencias deben conservarse.
Código                                       Ticket                                   Prioridad    Tam.       Dep.

CRM-LEAD-001       Ciclo de vida y estados del lead                                          Alta       L         Base

CRM-LEAD-002       Prevención y gestión de duplicados                                        Alta       L         001

CRM-LEAD-003       Historial 360° y línea de tiempo                                          Alta       L       001, 009

CRM-LEAD-004       Fuente, campaña y atribución                                              Alta       M         001

CRM-LEAD-005       Asignación y reasignación                                                 Alta       M       001, 009

CRM-LEAD-006       Tareas y recordatorios                                                    Alta       L       001, 005

CRM-LEAD-007       Integración de WhatsApp                                                   Alta       XL    003, 005, 009

CRM-LEAD-008       Filtros, indicadores y dashboards                                      Media-Alta    XL      001-007

CRM-LEAD-009       Registro de auditoría                                                     Alta       L     Transversal

CRM-LEAD-010       Exportación segura a Excel                                               Media       M       008, 009
### Orden recomendado de implementación
Fase 1: auditoría, estados, duplicados, historial, origen y asignación. Fase 2: tareas, recordatorios y WhatsApp.
Fase 3: dashboards, filtros y exportación. Este orden reduce retrabajo porque los reportes y las integraciones
dependen de datos confiables y trazables.
### Convención de tamaño
- M: desarrollo acotado con impacto en uno o pocos componentes.
- L: cambio transversal con backend, interfaz, pruebas y migraciones.
- XL: integración o analítica compleja que requiere dividirse en subtareas y posiblemente en más de un sprint.
## CRM-LEAD-001
Definir y controlar el ciclo de vida completo del lead
Prioridad        Alta                                             Tamaño             L

Tipo           Historia funcional                           Dependencias           Base de la épica
### Historia de usuario
Como responsable comercial, necesito que cada lead avance por estados definidos y controlados, para conocer su situación
real, exigir la información necesaria en cada etapa y medir correctamente la conversión.
### Objetivo y resultado esperado
Implementar un flujo de estados que cubra desde la captación hasta la conversión, pérdida o descarte, registrando quién
realizó cada cambio, cuándo ocurrió y por qué.
### Alcance funcional incluido
- Crear un catálogo de estados activo/inactivo y ordenado. Catálogo inicial propuesto: Nuevo, Contactado, Calificado, En seguimiento,
Visita agendada, Propuesta enviada, Negociación, Convertido/Ganado, Perdido y Descartado.
- Definir transiciones permitidas entre estados para evitar saltos incoherentes. El catálogo y las transiciones deben quedar
configurables por un perfil autorizado.
- Mostrar el estado actual del lead en la ficha, listados, filtros, dashboards y exportaciones.
- Registrar fecha de entrada y salida de cada estado para calcular tiempo de permanencia y velocidad comercial.
- Permitir reabrir un lead cerrado solo a usuarios autorizados y dejando motivo y trazabilidad.
- Al convertir un lead, vincularlo con el registro de cliente, oportunidad, reserva o venta definido por el proceso comercial.
### Reglas de negocio
- Todo lead nuevo debe iniciar automáticamente en el estado Nuevo, salvo que la fuente de integración envíe un estado inicial
permitido.
- Los estados Perdido y Descartado requieren un motivo obligatorio; el comentario adicional podrá ser requerido según el motivo
seleccionado.
- El estado Convertido/Ganado requiere identificar el cliente generado y la operación asociada cuando exista.
- Un lead cerrado no debe recibir modificaciones comerciales ordinarias, excepto reactivación autorizada, notas o actividades
permitidas.
- Los cambios masivos de estado, si se habilitan, deben respetar las mismas validaciones que los cambios individuales.
### Datos y trazabilidad mínima
- Estado actual, fecha del último cambio, usuario que cambió el estado y motivo de cierre cuando corresponda.
- Historial de estados con estado anterior, estado nuevo, fecha/hora, usuario, canal de cambio y observación.
- Fecha de conversión, fecha de pérdida, duración total del ciclo y tiempo acumulado por estado.
### Consideraciones técnicas
- Centralizar las reglas de transición en backend para que sean aplicadas por interfaz, API, importaciones e integraciones.
- Exponer un catálogo de estados y motivos mediante API o servicio equivalente, evitando valores escritos directamente en la interfaz.
- Evitar actualizaciones concurrentes silenciosas mediante control de versión, marca de modificación o estrategia equivalente.
### Criterios de aceptación
AC-01. Al crear un lead, el sistema asigna automáticamente el estado inicial configurado y registra el evento en el historial.
AC-02. El usuario solo puede seleccionar estados permitidos desde el estado actual y según sus permisos.
AC-03. Al seleccionar Perdido o Descartado, el sistema exige un motivo antes de guardar.
AC-04. Cada cambio registra estado anterior, estado nuevo, usuario, fecha/hora y observación disponible en la línea de tiempo.
AC-05. Al convertir un lead, el sistema conserva el vínculo con el cliente u operación creada y evita duplicar la conversión.
AC-06. Los filtros y reportes muestran los estados vigentes y las métricas utilizan las fechas correctas del historial.
AC-07. La reactivación de un lead cerrado exige permiso especial y motivo, sin eliminar el cierre anterior.
### Checklist sugerido para Microsoft Planner
- Validar catálogo de estados, motivos de pérdida y transiciones con el negocio.
- Diseñar modelo de datos y migración de estados existentes.
- Implementar endpoints/servicios de consulta y cambio de estado.
- Construir componente visual del flujo y validaciones de interfaz.
- Agregar eventos de historial y auditoría.
- Crear pruebas unitarias, de integración y de permisos.
- Preparar casos UAT: conversión, pérdida, descarte y reactivación.
### Dependencias y decisiones pendientes
- Definición del objeto final que representa una conversión: cliente, oportunidad, reserva, contrato o venta.
- Matriz de roles y permisos para cambiar, cerrar y reabrir leads.
- Ticket CRM-LEAD-009 para auditoría transversal.
### Evidencias requeridas para cierre
- Capturas o video de cada transición principal y validación de estados cerrados.
- Pruebas automatizadas de transiciones permitidas y bloqueadas.
- Consulta de historial demostrando que ningún cambio sobrescribe el evento anterior.
## CRM-LEAD-002
Evitar y gestionar la creación de leads duplicados
Prioridad        Alta                                             Tamaño             L

Tipo           Historia funcional                           Dependencias           CRM-LEAD-001, 009
### Historia de usuario
Como vendedor o administrador, necesito que el CRM detecte leads repetidos por teléfono, correo o documento, para evitar
gestiones paralelas, información fragmentada y métricas incorrectas.
### Objetivo y resultado esperado
Implementar validaciones consistentes en todos los puntos de entrada, diferenciar coincidencias exactas de posibles
duplicados y ofrecer un proceso controlado para continuar, vincular o fusionar registros.
### Alcance funcional incluido
- Validar duplicidad al crear o actualizar leads manualmente, por formulario web, campañas, redes sociales, API, importación y
WhatsApp.
- Normalizar teléfonos antes de comparar, eliminando espacios y símbolos y aplicando código de país según la configuración.
- Normalizar correos en minúsculas, sin espacios externos y con validación de formato.
- Normalizar documentos de identidad eliminando guiones o caracteres de presentación, conservando el valor original para mostrarlo.
- Distinguir duplicado exacto de posible coincidencia. El documento exacto debe considerarse señal fuerte; teléfono y correo pueden
mostrar advertencia y coincidencias existentes.
- Mostrar al usuario los leads coincidentes permitidos por sus permisos, indicando responsable, estado, fecha de creación y última
actividad.
- Incluir una acción controlada de fusión o vinculación cuando el negocio determine que dos registros pertenecen a la misma persona.
### Reglas de negocio
- La validación no puede depender únicamente de la interfaz; debe ejecutarse en backend para todas las fuentes.
- No se debe eliminar automáticamente un lead potencialmente duplicado ni sobrescribir información sin confirmación autorizada.
- Cuando una integración reenvíe el mismo evento, el sistema debe reconocerlo mediante un identificador externo o clave de
idempotencia cuando esté disponible.
- La fusión debe conservar historial, fuentes, mensajes, tareas, archivos y asignaciones, marcando claramente el registro absorbido.
- Los usuarios sin permiso para ver otro lead deben recibir una alerta de existencia sin revelar datos sensibles no autorizados.
### Datos y trazabilidad mínima
- Campos normalizados para teléfono, correo y documento, además de los valores originales de presentación.
- Indicador de duplicado, tipo de coincidencia, puntaje o reglas aplicadas y decisión tomada por el usuario.
- Referencia al registro principal cuando un lead sea fusionado o marcado como duplicado.
### Consideraciones técnicas
- Aplicar índices o restricciones de unicidad donde el negocio lo permita, especialmente para documentos válidos.
- Diseñar la comparación para evitar condiciones de carrera cuando dos solicitudes crean el mismo lead simultáneamente.
- Registrar métricas de duplicados detectados, bloqueados, fusionados y aceptados como registros distintos.
### Criterios de aceptación
AC-01. La creación por cualquier canal ejecuta las mismas reglas de normalización y búsqueda de coincidencias.
AC-02. Un documento exacto ya registrado bloquea la creación o exige una excepción autorizada, según la regla aprobada.
AC-03. Una coincidencia de teléfono o correo muestra los leads relacionados y permite abrir el registro existente cuando el usuario
tiene permiso.
AC-04. Dos solicitudes simultáneas no generan duplicados exactos cuando existe una restricción definida.
AC-05. La fusión conserva todas las actividades e identifica claramente el lead principal y el absorbido.
AC-06. Cada alerta, excepción o fusión queda registrada en el historial y la auditoría.
AC-07. Las importaciones generan un reporte de filas creadas, actualizadas, omitidas y marcadas como duplicadas.
### Checklist sugerido para Microsoft Planner
- Definir reglas de coincidencia exacta y potencial con el negocio.
- Implementar funciones de normalización reutilizables.
- Crear búsqueda previa y validaciones transaccionales.
- Diseñar modal o pantalla de coincidencias y acción recomendada.
- Implementar flujo de fusión con respaldo y trazabilidad.
- Cubrir creación manual, API, formulario e importación en pruebas.
- Crear reporte de excepciones y duplicados para supervisión.
### Dependencias y decisiones pendientes
- Definir si el documento es obligatorio y qué tipos de documento se admitirán.
- Aprobar permisos para visualizar coincidencias y fusionar registros.
- Alinear el tratamiento de contactos que comparten teléfono o correo.
### Evidencias requeridas para cierre
- Matriz de pruebas con diferentes formatos del mismo teléfono, correo y documento.
- Prueba de concurrencia o idempotencia.
- Demostración de fusión conservando historial y relaciones.
## CRM-LEAD-003
Mantener un historial completo y una línea de tiempo 360° del lead
Prioridad        Alta                                              Tamaño             L

Tipo          Historia funcional                            Dependencias           CRM-LEAD-001, 005, 006, 007, 009
### Historia de usuario
Como vendedor, supervisor o auditor, necesito consultar en una sola línea de tiempo todo lo ocurrido con el lead, para
entender el contexto, continuar el seguimiento y verificar la gestión realizada.
### Objetivo y resultado esperado
Crear un historial cronológico, consistente y consultable que reúna cambios de estado, llamadas, mensajes, notas, tareas,
asignaciones y demás actividades sin perder el origen de cada evento.
### Alcance funcional incluido
- Mostrar una línea de tiempo ordenada desde el evento más reciente al más antiguo, con paginación o carga progresiva.
- Incluir eventos de creación, cambios de estado, asignación y reasignación, llamadas, mensajes, notas, tareas
creadas/completadas/vencidas, reuniones, visitas, conversiones y cierres.
- Diferenciar visualmente eventos automáticos del sistema, eventos de integraciones y acciones manuales del usuario.
- Permitir filtrar la línea de tiempo por tipo de actividad, rango de fechas, usuario y canal.
- Permitir agregar notas internas con fecha, autor y nivel de visibilidad definido por permisos.
- Mostrar enlaces a la entidad relacionada: tarea, conversación, llamada, venta, archivo o usuario responsable.
- Conservar el historial aun cuando cambie el vendedor, la inmobiliaria o el estado actual.
### Reglas de negocio
- Los eventos automáticos no deben editarse ni eliminarse desde la interfaz ordinaria.
- Las notas editables deben conservar versiones o registrar la edición en auditoría; una eliminación autorizada debe dejar evidencia.
- La fecha del evento debe distinguir la fecha real de ocurrencia y la fecha de registro cuando lleguen eventos atrasados por
integración.
- Los usuarios solo visualizan eventos y datos permitidos por su rol, organización e inmobiliaria.
### Datos y trazabilidad mínima
- Tipo de evento, descripción, entidad relacionada, identificador externo, usuario/servicio origen y fecha/hora.
- Canal, resultado de la actividad, duración cuando aplique y metadatos mínimos necesarios para reconstruir el contexto.
- Indicador de evento automático, manual o importado; fecha real y fecha de recepción.
### Consideraciones técnicas
- Usar una estructura extensible de eventos para agregar nuevos tipos sin modificar toda la interfaz.
- Evitar almacenar secretos, tokens o contenido técnico sensible dentro de la descripción visible.
- Garantizar idempotencia para webhooks o integraciones que puedan reenviar el mismo evento.
### Criterios de aceptación
AC-01. Al abrir un lead, la línea de tiempo presenta todos los eventos autorizados en orden correcto.
AC-02. Cada cambio de estado y asignación aparece con usuario, fecha/hora, valor anterior y valor nuevo.
AC-03. Los mensajes de WhatsApp aparecen con dirección, estado de entrega y acceso al contenido permitido.

AC-04. Una nota nueva queda asociada al autor y una edición posterior deja evidencia en auditoría.
AC-05. Los filtros reducen los resultados sin ocultar permanentemente eventos ni alterar el historial.
AC-06. Los eventos repetidos de una integración no se duplican cuando comparten el mismo identificador externo.
AC-07. El historial se mantiene después de convertir, perder, fusionar o reasignar el lead.
### Checklist sugerido para Microsoft Planner
- Definir catálogo de tipos de eventos y diseño de línea de tiempo.
- Crear modelo y servicio de eventos unificados.
- Integrar publicación de eventos desde estados, asignaciones, tareas y WhatsApp.
- Construir filtros, paginación y enlaces de detalle.
- Implementar notas y reglas de edición/visibilidad.
- Agregar pruebas de permisos, orden cronológico e idempotencia.
- Validar rendimiento con leads de alto volumen de actividades.
### Dependencias y decisiones pendientes
- Eventos emitidos por los tickets de estados, asignación, tareas y WhatsApp.
- Definición de retención de mensajes, notas y archivos.
- Matriz de visibilidad entre vendedores, supervisores e inmobiliarias.
### Evidencias requeridas para cierre
- Línea de tiempo de prueba con todos los tipos de eventos.
- Prueba de webhook duplicado sin duplicación visual.
- Validación de permisos con al menos tres roles diferentes.
## CRM-LEAD-004
Registrar la fuente, campaña y contexto de origen del lead
Prioridad        Alta                                              Tamaño             M

Tipo          Historia funcional                            Dependencias           CRM-LEAD-001, 003, 009
### Historia de usuario
Como responsable de mercadeo y ventas, necesito conocer de dónde proviene cada lead, para atribuir resultados, comparar
campañas y decidir dónde invertir recursos.
### Objetivo y resultado esperado
Capturar, normalizar y conservar la fuente de origen del lead desde el primer contacto, incluyendo campaña, formulario,
Facebook, Instagram, página web y otros canales configurables.
### Alcance funcional incluido
- Crear catálogos de fuente, canal, campaña y formulario con estado activo/inactivo.
- Registrar como mínimo: fuente principal, canal, campaña, formulario, fecha de captación e identificador externo cuando exista.
- Capturar parámetros de atribución disponibles, por ejemplo UTM source, medium, campaign, content y term, sin hacerlos
obligatorios para todos los canales.
- Conservar atribución de primer contacto y, si el negocio lo aprueba, atribución del último contacto antes de la conversión.
- Permitir selección manual de fuente en creación interna y asignar Sin identificar cuando el canal no entregue información suficiente.
- Relacionar los datos de origen con filtros, dashboards, exportaciones y ficha del lead.
- Registrar cualquier corrección manual de fuente en historial y auditoría.
### Reglas de negocio
- La fuente original no debe sobrescribirse silenciosamente por interacciones posteriores.
- Las integraciones deben mapear sus valores externos a catálogos internos para evitar variantes como Facebook, FB o Meta.
- Una campaña inactiva debe mantenerse para reportes históricos, pero no debe aparecer como opción nueva salvo permiso especial.
- Los cambios manuales requieren permiso y motivo cuando afecten reportes ya consolidados.
### Datos y trazabilidad mínima
- Fuente, canal, campaña, formulario, identificador del anuncio o conjunto de anuncios cuando esté disponible.
- Parámetros UTM, URL de aterrizaje, referencia y fecha/hora de captación.
- Valor original recibido por la integración y valor interno normalizado.
### Consideraciones técnicas
- Definir contratos de mapeo para cada formulario, red social o integración.
- Evitar que valores libres generen miles de campañas duplicadas; utilizar catálogos y reglas de normalización.
- Preparar los datos para agregación por fuente, campaña, vendedor e inmobiliaria.
### Criterios de aceptación
AC-01. Cada lead creado queda asociado a una fuente válida o a Sin identificar.
AC-02. Los formularios y campañas configurados envían y almacenan el identificador externo correspondiente.
AC-03. La ficha del lead muestra origen y campaña sin alterar el primer contacto cuando llegan nuevas interacciones.
AC-04. Una corrección manual deja registro del valor anterior, valor nuevo, usuario y motivo.

AC-05. Los filtros y dashboards pueden agrupar leads y conversiones por fuente, canal, campaña y formulario.
AC-06. Una campaña desactivada conserva sus datos históricos y no rompe reportes existentes.
### Checklist sugerido para Microsoft Planner
- Definir catálogos y responsables de mantenimiento.
- Mapear campos de cada canal actual: web, Facebook, Instagram y formularios.
- Implementar persistencia de primer contacto y parámetros UTM.
- Agregar edición controlada y evento de historial.
- Incorporar filtros en listados y datos para dashboards.
- Probar fuentes conocidas, desconocidas e inactivas.
### Dependencias y decisiones pendientes
- Inventario de formularios, campañas y cuentas actuales.
- Definición de modelo de atribución: primer contacto, último contacto o ambos.
- Acceso a identificadores entregados por cada canal.
### Evidencias requeridas para cierre
- Matriz de mapeo canal externo -> catálogo interno.
- Prueba de creación desde web, Facebook e Instagram.
- Reporte que compare captación y conversión por fuente.
## CRM-LEAD-005
Asignar y reasignar leads entre vendedores e inmobiliarias
Prioridad         Alta                                              Tamaño             M

Tipo           Historia funcional                            Dependencias           CRM-LEAD-001, 003, 009
### Historia de usuario
Como supervisor comercial, necesito asignar o reasignar leads a vendedores e inmobiliarias manteniendo el historial, para
equilibrar cargas y asegurar responsabilidad clara sobre cada prospecto.
### Objetivo y resultado esperado
Permitir asignaciones individuales o controladas, registrar cada cambio y aplicar reglas de permisos, disponibilidad y
pertenencia organizacional.
### Alcance funcional incluido
- Mostrar en la ficha y listados el vendedor responsable y la inmobiliaria responsable actuales.
- Permitir asignar un lead sin responsable, reasignarlo a otro vendedor, moverlo a otra inmobiliaria o dejarlo en una cola sin asignar,
según permisos.
- Exigir motivo en toda reasignación manual y registrar responsable anterior, responsable nuevo, usuario que ejecuta el cambio y
fecha/hora.
- Mantener el historial completo de asignaciones sin borrar responsables anteriores.
- Notificar al nuevo responsable y retirar recordatorios pendientes del anterior solo cuando la regla de negocio lo indique.
- Permitir filtros por vendedor, inmobiliaria, equipo, estado de asignación y fecha de asignación.
- Preparar soporte para asignación automática futura por reglas, capacidad o distribución rotativa, aunque no se active en esta
primera entrega.
### Reglas de negocio
- Un usuario solo puede asignar a vendedores e inmobiliarias visibles para su organización y rol.
- No se puede asignar a un usuario inactivo, bloqueado o fuera de la inmobiliaria seleccionada.
- La reasignación no cambia el estado del lead ni elimina tareas, mensajes o historial.
- Las tareas abiertas deben transferirse, cerrarse o conservarse con el responsable anterior según una decisión explícita del usuario o
regla configurada.
- La asignación masiva, si se habilita, debe mostrar cantidad afectada, exigir confirmación y generar auditoría por lote y por lead.
### Datos y trazabilidad mínima
- Responsable actual, inmobiliaria actual, fecha de asignación, tipo de asignación y usuario asignador.
- Historial con responsable/inmobiliaria anterior y nuevo, motivo, fecha/hora y canal.
- Indicador de asignación manual, automática o proveniente de integración.
### Consideraciones técnicas
- Validar pertenencia, estado activo y permisos en backend.
- Publicar eventos para notificaciones, historial, auditoría y dashboards.
- Evitar que dos reasignaciones simultáneas oculten una de las decisiones.
### Criterios de aceptación
AC-01. Un supervisor autorizado puede asignar un lead sin responsable a un vendedor válido.
AC-02. Una reasignación exige motivo y muestra el cambio en la línea de tiempo.
AC-03. Un usuario sin permiso no puede asignar fuera de su inmobiliaria o equipo.
AC-04. El sistema bloquea la selección de usuarios inactivos o incompatibles con la inmobiliaria.
AC-05. La ficha, listados, filtros y dashboards reflejan inmediatamente el responsable actual.
AC-06. El historial conserva todas las asignaciones anteriores y sus fechas.
AC-07. Las reglas aprobadas para tareas pendientes se ejecutan de manera consistente al reasignar.
### Checklist sugerido para Microsoft Planner
- Definir matriz de permisos y jerarquías comerciales.
- Diseñar modelo de asignación actual e historial.
- Implementar selector de vendedor/inmobiliaria con validaciones.
- Agregar motivo obligatorio y confirmación de reasignación.
- Integrar notificaciones y tratamiento de tareas abiertas.
- Crear filtros y métricas de asignación.
- Probar cambios simultáneos, usuarios inactivos y asignación masiva si aplica.
### Dependencias y decisiones pendientes
- Catálogo de usuarios, equipos, inmobiliarias y relaciones entre ellos.
- Decisión sobre transferencia de tareas abiertas.
- Canales de notificación disponibles.
### Evidencias requeridas para cierre
- Pruebas por rol y organización.
- Historial con múltiples reasignaciones consecutivas.
- Demostración del comportamiento de tareas y notificaciones.
## CRM-LEAD-006
Crear tareas y recordatorios automáticos para seguimiento
Prioridad         Alta                                              Tamaño             L

Tipo           Historia funcional                            Dependencias           CRM-LEAD-001, 003, 005, 009
### Historia de usuario
Como vendedor, necesito recibir tareas y recordatorios oportunos asociados a mis leads, para no perder seguimientos y
cumplir los próximos pasos acordados.
### Objetivo y resultado esperado
Implementar tareas manuales y automáticas con vencimiento, prioridad, responsable, recordatorios, estado y reglas de
escalamiento, vinculadas directamente al lead.
### Alcance funcional incluido
- Permitir crear tareas de llamada, WhatsApp, correo, reunión, visita, envío de propuesta, seguimiento y otros tipos configurables.
- Campos mínimos: título, tipo, lead, responsable, fecha/hora de vencimiento, prioridad, descripción, estado y recordatorio.
- Estados propuestos: Pendiente, En progreso, Completada, Cancelada y Vencida.
- Permitir marcar una tarea como completada registrando fecha, usuario y resultado de la actividad.
- Generar tareas automáticas por eventos configurados, por ejemplo nuevo lead sin contacto, cambio a Propuesta enviada o ausencia
de actividad durante un periodo.
- Enviar recordatorios mediante notificación interna y otros canales aprobados, evitando duplicados.
- Mostrar agenda o listado de tareas del usuario, tareas del equipo para supervisores y tareas vencidas por prioridad.
- Crear una próxima tarea desde la ficha o al completar la tarea actual.
### Reglas de negocio
- Una tarea debe pertenecer a un lead y tener responsable y fecha de vencimiento válidos.
- Una tarea completada no puede volver a Pendiente sin permiso y motivo de reapertura.
- Las reglas automáticas no deben crear tareas duplicadas para el mismo evento y periodo.
- La reasignación del lead debe aplicar la regla aprobada para transferir, conservar o cerrar tareas abiertas.
- Los recordatorios deben considerar zona horaria, horario laboral y preferencias configuradas.
- Las tareas vencidas deben permanecer visibles hasta completar, cancelar o reasignar.
### Datos y trazabilidad mínima
- Fecha de creación, creador, responsable, fecha de vencimiento, fecha de finalización y resultado.
- Origen manual o automático, regla que generó la tarea e identificador del evento origen.
- Historial de cambios de responsable, vencimiento, estado y prioridad.
### Consideraciones técnicas
- Usar un proceso programado o cola confiable para generar recordatorios y detectar vencimientos.
- Aplicar idempotencia para reglas automáticas y reintentos de notificación.
- Registrar fallos de entrega de notificaciones sin marcar la tarea como completada.
### Criterios de aceptación
AC-01. El usuario puede crear una tarea asociada a un lead con todos los campos obligatorios.

AC-02. La tarea aparece en la ficha del lead, agenda del responsable y línea de tiempo.
AC-03. Al cumplirse una regla automática, se genera una única tarea con el responsable correcto.
AC-04. El recordatorio se envía en el momento configurado y su resultado queda registrado.
AC-05. Una tarea vencida cambia o se identifica como vencida sin perder su fecha original.
AC-06. Al completar una tarea se solicita el resultado cuando el tipo lo requiera y se registra en historial.
AC-07. Los supervisores pueden filtrar tareas por responsable, equipo, estado, prioridad y vencimiento.
### Checklist sugerido para Microsoft Planner
- Validar tipos, estados, prioridades y resultados de tareas.
- Diseñar modelo de tareas, cambios y reglas automáticas.
- Construir formularios, agenda y filtros.
- Implementar motor de reglas o programador de tareas.
- Integrar notificaciones y preferencias.
- Conectar eventos con historial y dashboards.
- Probar zona horaria, duplicados, vencimientos y reasignaciones.
### Dependencias y decisiones pendientes
- Definir reglas automáticas, tiempos de seguimiento y escalamiento.
- Confirmar canales de notificación disponibles.
- Aprobar comportamiento de tareas al reasignar un lead.
### Evidencias requeridas para cierre
- Prueba de una tarea manual y una automática.
- Registro de recordatorio enviado, fallido y reintentado.
- Vista de supervisor con tareas vencidas por vendedor.
## CRM-LEAD-007
Integrar WhatsApp y registrar mensajes con su estado de entrega
Prioridad         Alta                                              Tamaño             XL

Tipo           Historia funcional                            Dependencias           CRM-LEAD-003, 005, 009
### Historia de usuario
Como vendedor, necesito comunicarme con el lead por WhatsApp desde el CRM y consultar el estado de cada mensaje, para
mantener la conversación centralizada y conocer si fue enviado, entregado, leído o falló.
### Objetivo y resultado esperado
Integrar un proveedor oficial de WhatsApp, registrar mensajes entrantes y salientes, procesar estados mediante webhooks y
presentar la conversación dentro de la ficha del lead con trazabilidad completa.
### Alcance funcional incluido
- Enviar mensajes de texto y, si el proveedor lo permite, archivos o medios aprobados desde la ficha del lead.
- Recibir mensajes entrantes y asociarlos automáticamente al lead mediante número normalizado y contexto de conversación.
- Registrar dirección, contenido permitido, fecha/hora, usuario emisor, número origen/destino, identificador externo y conversación.
- Mostrar estados como Pendiente/En cola, Enviado, Entregado, Leído y Fallido, además de detalle de error cuando sea seguro
presentarlo.
- Procesar actualizaciones de estado mediante webhooks y reflejarlas en la línea de tiempo sin duplicar eventos.
- Soportar plantillas aprobadas y reglas de ventana de atención definidas por WhatsApp/proveedor.
- Registrar consentimiento u opt-in cuando el proceso y la regulación aplicable lo requieran.
- Permitir que supervisores consulten conversaciones según permisos y que la reasignación del lead cambie el responsable operativo
sin perder mensajes.
- Mostrar fallos de envío y permitir reintento controlado cuando la causa sea recuperable.
### Reglas de negocio
- La integración debe realizarse mediante WhatsApp Business Platform o un proveedor oficial aprobado; no se deben utilizar
automatizaciones no autorizadas.
- Los mensajes fuera de la ventana permitida deben usar una plantilla aprobada o bloquearse con una explicación clara.
- No se puede enviar a un teléfono inválido, sin consentimiento requerido o bloqueado por la política definida.
- Cada webhook debe procesarse de forma idempotente para evitar mensajes o estados duplicados.
- Los datos sensibles, credenciales y tokens nunca deben mostrarse en historial ni logs funcionales.
- La retención de contenido y archivos debe ajustarse a la política de privacidad y seguridad aprobada.
- Los estados recibidos fuera de orden deben actualizar el mensaje sin retroceder incoherentemente su estado final.
### Datos y trazabilidad mínima
- Identificador interno y externo del mensaje, conversación, teléfono normalizado, dirección, tipo y estado.
- Fecha de creación, envío, entrega, lectura y fallo; código de error normalizado cuando aplique.
- Usuario o servicio emisor, plantilla utilizada, referencia a medio y consentimiento asociado.
### Consideraciones técnicas
- Crear endpoint seguro de webhook con validación de firma o mecanismo equivalente del proveedor.
- Procesar webhooks mediante cola o mecanismo tolerante a reintentos y picos de volumen.

- Mantener mapeo entre identificadores externos y registros internos.
- Aplicar cifrado, control de acceso, enmascaramiento de logs y almacenamiento seguro de credenciales.
- Implementar observabilidad: mensajes enviados, entregados, leídos, fallidos, latencia y errores por causa.
### Criterios de aceptación
AC-01. Un usuario autorizado puede enviar un mensaje desde la ficha y obtiene un identificador interno de seguimiento.
AC-02. El mensaje cambia de estado cuando llegan los webhooks Enviado, Entregado y Leído, registrando sus fechas.
AC-03. Un mensaje fallido muestra una causa comprensible y permite reintento cuando la política lo autoriza.
AC-04. Los mensajes entrantes se asocian al lead correcto o se envían a una bandeja de revisión cuando no existe coincidencia
segura.
AC-05. El reenvío del mismo webhook no crea mensajes ni eventos duplicados.
AC-06. Los mensajes fuera de ventana se envían solo mediante plantilla aprobada o quedan bloqueados con instrucción al usuario.
AC-07. La conversación completa aparece en el historial y respeta permisos por vendedor e inmobiliaria.
AC-08. Los logs técnicos no exponen tokens, credenciales ni contenido sensible innecesario.
### Checklist sugerido para Microsoft Planner
- Confirmar proveedor oficial, número, credenciales y ambientes de prueba/producción.
- Definir plantillas, ventana de atención, consentimiento y política de retención.
- Diseñar modelo de mensajes, conversaciones y estados.
- Implementar envío, recepción y webhook seguro.
- Crear interfaz de conversación y estados de entrega.
- Integrar asignación, historial y auditoría.
- Agregar colas, reintentos, métricas y alertas.
- Ejecutar pruebas end-to-end con mensajes entrantes, salientes, fallidos y fuera de ventana.
### Dependencias y decisiones pendientes
- Cuenta y número de WhatsApp Business habilitados.
- Credenciales, webhooks y plantillas aprobadas por Meta o BSP.
- Política de consentimiento, privacidad y retención.
- Resolución de identidad por teléfono del ticket CRM-LEAD-002.
### Evidencias requeridas para cierre
- Capturas o video de una conversación completa con estados de entrega.
- Registro de webhook duplicado procesado una sola vez.
- Prueba de plantilla fuera de ventana y de fallo controlado.
- Reporte de seguridad que confirme ausencia de secretos en logs.
## CRM-LEAD-008
Implementar filtros, indicadores y dashboards de gestión comercial
Prioridad        Media-Alta                                        Tamaño             XL

Tipo           Historia funcional                            Dependencias           Datos de CRM-LEAD-001 a 007
### Historia de usuario
Como gerente comercial, necesito dashboards y filtros confiables, para medir captación, seguimiento, conversión y ventas por
fuente, vendedor, inmobiliaria y campaña.
### Objetivo y resultado esperado
Construir una capa de indicadores con definiciones explícitas, filtros consistentes, control de acceso y capacidad de
profundizar desde el resumen hasta los leads que componen cada métrica.
### Alcance funcional incluido
- Indicadores mínimos: leads captados, leads activos, contactados, calificados, convertidos, perdidos, tasa de conversión, tiempo
promedio de conversión, tareas vencidas y leads sin actividad.
- Medición de ventas o conversiones por fuente, canal, campaña, formulario, vendedor, inmobiliaria y periodo.
- Filtros combinables por rango de fechas, estado, fuente, campaña, vendedor, inmobiliaria, equipo y tipo de cierre.
- Definir para cada indicador cuál fecha utiliza: captación, cambio de estado, conversión, venta o actividad.
- Mostrar comparaciones por periodo cuando el negocio las solicite y exista información suficiente.
- Permitir abrir el listado de leads que compone una cifra, respetando los mismos filtros y permisos.
- Incluir vistas para vendedor, supervisor, inmobiliaria y administración según el alcance de datos autorizado.
- Permitir actualización manual y mostrar la hora de última actualización cuando los datos no sean en tiempo real.
### Reglas de negocio
- Cada KPI debe tener nombre, fórmula, campos fuente, fecha de referencia, exclusiones y responsable de negocio.
- La tasa de conversión debe utilizar un denominador aprobado y mantenerse consistente en todas las pantallas.
- Los leads fusionados o marcados como duplicados no deben inflar la captación ni la conversión.
- Los datos deben respetar alcance organizacional; un vendedor no puede visualizar totales de otras inmobiliarias sin permiso.
- Los filtros aplicados deben conservarse al abrir el detalle y al exportar.
- Los valores históricos no deben cambiar por la desactivación de campañas, usuarios o catálogos.
### Datos y trazabilidad mínima
- Dimensiones: tiempo, estado, fuente, canal, campaña, formulario, vendedor, equipo e inmobiliaria.
- Hechos: captación, actividades, cambios de estado, conversión, pérdida, tareas y ventas vinculadas.
- Metadatos de actualización y calidad de datos: desconocidos, duplicados y registros incompletos.
### Consideraciones técnicas
- Optimizar consultas con índices, agregaciones, vistas o capa analítica según el volumen esperado.
- Evitar cálculos distintos entre frontend, exportación y API; centralizar fórmulas.
- Aplicar paginación y límites en listados de detalle.
- Agregar pruebas de reconciliación entre KPI y registros fuente.
### Criterios de aceptación
AC-01. El dashboard muestra los KPI aprobados con definición accesible o documentada.
AC-02. Al aplicar filtros, todos los indicadores y gráficos se actualizan de manera coherente.
AC-03. Al seleccionar una cifra, el listado de detalle contiene exactamente los registros que la componen.
AC-04. La tasa de conversión coincide con la fórmula aprobada y excluye duplicados conforme a la regla.
AC-05. Un vendedor, supervisor y administrador visualizan únicamente el alcance permitido por su rol.
AC-06. Los totales del dashboard pueden reconciliarse con consultas o exportaciones de detalle.
AC-07. La pantalla indica la fecha/hora de actualización y maneja correctamente periodos sin datos.
### Checklist sugerido para Microsoft Planner
- Crear diccionario de KPI y validarlo con negocio.
- Definir wireframes y jerarquía de filtros.
- Diseñar consultas, vistas o capa de agregación.
- Implementar endpoints de indicadores y detalle.
- Construir dashboard responsive con estados de carga y sin datos.
- Aplicar permisos y alcance organizacional.
- Ejecutar pruebas de reconciliación y rendimiento.
- Preparar manual de interpretación de métricas.
### Dependencias y decisiones pendientes
- Definiciones oficiales de conversión, venta, lead activo y periodo de atribución.
- Volumen esperado, frecuencia de actualización y SLA de rendimiento.
- Vínculo definitivo entre lead convertido y venta/operación.
### Evidencias requeridas para cierre
- Diccionario de KPI aprobado.
- Matriz de reconciliación KPI -> leads fuente.
- Pruebas de permisos por rol y de filtros combinados.
- Resultado de prueba de rendimiento con volumen representativo.
## CRM-LEAD-009
Mantener un registro de auditoría de modificaciones del CRM
Prioridad          Alta                                              Tamaño             L

Tipo            Historia funcional                            Dependencias           Transversal
### Historia de usuario
Como administrador o auditor, necesito identificar qué usuario realizó cada modificación, para investigar incidentes, cumplir
controles internos y garantizar responsabilidad sobre los datos.
### Objetivo y resultado esperado
Implementar un registro de auditoría inmutable y consultable para acciones críticas del CRM, incluyendo valor anterior, valor
nuevo, usuario, fecha/hora y contexto de la operación.
### Alcance funcional incluido
- Auditar creación, actualización, eliminación lógica, restauración, cambio de estado, asignación, fusión, exportación y cambios de
permisos o catálogos relevantes.
- Registrar entidad, identificador, acción, usuario o servicio, fecha/hora, campos modificados y resultado de la operación.
- Conservar valor anterior y valor nuevo para campos permitidos, aplicando enmascaramiento a información sensible.
- Distinguir acciones manuales, procesos automáticos, importaciones, APIs e integraciones.
- Permitir buscar por usuario, entidad, registro, acción y rango de fechas.
- Restringir la consulta a perfiles autorizados y evitar edición o eliminación desde la aplicación ordinaria.
- Registrar exportaciones indicando usuario, filtros, cantidad de registros y resultado.
### Reglas de negocio
- Una operación fallida debe registrarse cuando sea relevante para seguridad o control, sin almacenar información sensible
innecesaria.
- El sistema no debe guardar contraseñas, tokens, credenciales, contenido completo de documentos sensibles ni secretos en la
auditoría.
- Las acciones realizadas por servicios deben identificar el nombre del servicio y, cuando exista, el usuario que originó la solicitud.
- La retención y archivo del log deben definirse por política y no depender de la eliminación del lead.
- El acceso a auditoría también debe quedar registrado.
### Datos y trazabilidad mínima
- Actor, rol, organización, acción, entidad, identificador, fecha/hora y resultado.
- Campos modificados con valor anterior/nuevo en formato seguro y resumido.
- Origen de solicitud, identificador de correlación, lote o integración; IP o sesión solo si la política lo aprueba.
### Consideraciones técnicas
- Implementar almacenamiento append-only o controles equivalentes para evitar alteración desde la capa de negocio.
- Centralizar la generación de auditoría para cubrir interfaz, API, procesos y migraciones.
- Aplicar enmascaramiento, cifrado, control de acceso y monitoreo de volumen.
- Definir estrategia de retención, partición o archivo para evitar degradación de rendimiento.
### Criterios de aceptación
AC-01. Cada modificación crítica genera un registro con actor, fecha/hora, entidad, acción y resultado.
AC-02. Los cambios de campos muestran valor anterior y nuevo sin exponer secretos o datos prohibidos.
AC-03. Las acciones automáticas e integraciones identifican correctamente el servicio origen.
AC-04. Un usuario sin permiso no puede consultar ni descargar auditoría.
AC-05. Los filtros permiten localizar las acciones de un usuario o un lead dentro de un rango de fechas.
AC-06. La eliminación o fusión de un lead no elimina su historial de auditoría.
AC-07. La exportación de datos genera su propio evento de auditoría.
### Checklist sugerido para Microsoft Planner
- Crear matriz de eventos y campos auditables.
- Definir política de retención, acceso y enmascaramiento.
- Diseñar almacenamiento y servicio central de auditoría.
- Integrar auditoría en cada ticket transversal.
- Construir visor con filtros y paginación.
- Agregar alertas para fallos o ausencia de eventos críticos.
- Ejecutar pruebas de integridad, permisos y volumen.
### Dependencias y decisiones pendientes
- Aprobación de política de seguridad, privacidad y retención.
- Definición de roles autorizados para consulta y exportación.
- Identidad confiable de usuarios, servicios e integraciones.
### Evidencias requeridas para cierre
- Matriz de cobertura de eventos auditados.
- Prueba de modificación, fusión, reasignación y exportación.
- Validación de que secretos y campos excluidos no aparecen en el log.
## CRM-LEAD-010
Permitir la exportación segura de información a Excel
Prioridad         Media                                             Tamaño             M

Tipo           Historia funcional                            Dependencias           CRM-LEAD-008, 009
### Historia de usuario
Como usuario autorizado, necesito exportar a Excel los leads y resultados que estoy consultando, para realizar análisis,
conciliaciones y reportes operativos fuera del CRM.
### Objetivo y resultado esperado
Generar archivos .xlsx con datos consistentes, columnas definidas, filtros aplicados y control de permisos, manteniendo
trazabilidad de cada exportación.
### Alcance funcional incluido
- Permitir exportar el listado de leads respetando filtros activos, orden y alcance de datos del usuario.
- Incluir columnas configuradas o aprobadas: identificador, nombre, contacto, estado, fuente, campaña, vendedor, inmobiliaria, fechas,
última actividad, próxima tarea y resultado de cierre, según permisos.
- Generar un archivo .xlsx con encabezados claros, fechas reconocidas como fecha, teléfonos tratados como texto y valores
normalizados.
- Permitir seleccionar un conjunto aprobado de columnas o utilizar una plantilla predefinida.
- Para volúmenes grandes, procesar la exportación en segundo plano, informar progreso y disponibilizar un enlace temporal.
- Registrar usuario, filtros, columnas, cantidad, fecha/hora, resultado y archivo generado en auditoría.
- Aplicar límites y mensajes claros cuando la consulta exceda la capacidad permitida.
### Reglas de negocio
- La exportación nunca puede incluir registros o campos que el usuario no tenga permiso de visualizar.
- Los filtros utilizados en pantalla deben coincidir con los registros exportados.
- Los campos sensibles deben omitirse o enmascararse según rol y política.
- Los archivos temporales deben caducar y eliminarse según la política definida.
- Debe mitigarse la inyección de fórmulas en Excel para valores que inicien con caracteres interpretables como fórmula.
- La exportación no debe bloquear la operación normal del CRM.
### Datos y trazabilidad mínima
- Solicitud de exportación, filtros, columnas, usuario, estado del proceso, cantidad y ruta temporal.
- Fecha de creación, finalización, expiración, descarga y errores.
- Referencia del evento de auditoría correspondiente.
### Consideraciones técnicas
- Generar archivos en streaming o proceso asíncrono según volumen.
- Aplicar formato seguro a celdas, validación de datos y neutralización de fórmulas.
- Usar almacenamiento temporal protegido y enlaces con expiración cuando aplique.
- Evitar cargas completas en memoria para conjuntos grandes.
### Criterios de aceptación
AC-01. El archivo exportado contiene únicamente los leads visibles con los filtros aplicados.
AC-02. Las columnas, fechas, teléfonos y encabezados se abren correctamente en Excel.
AC-03. Un usuario sin permiso no puede exportar campos restringidos ni datos de otra inmobiliaria.
AC-04. Una exportación grande se procesa en segundo plano y el usuario recibe estado y resultado.
AC-05. Cada exportación queda registrada con usuario, filtros, cantidad y resultado.
AC-06. Los valores potencialmente interpretables como fórmulas se exportan de forma segura.
AC-07. El enlace temporal deja de funcionar después de su expiración y el archivo se elimina según política.
### Checklist sugerido para Microsoft Planner
- Definir plantilla de columnas y campos restringidos.
- Implementar servicio de exportación sincrónico/asíncrono.
- Aplicar filtros, permisos y formatos de Excel.
- Agregar protección contra inyección de fórmulas.
- Crear interfaz de solicitud, progreso, descarga y error.
- Integrar auditoría y caducidad de archivos.
- Probar volúmenes pequeños, grandes y permisos por rol.
### Dependencias y decisiones pendientes
- Catálogo definitivo de campos exportables y clasificación de sensibilidad.
- Límite de registros, tiempo de retención y mecanismo de almacenamiento temporal.
- Filtros y permisos implementados en CRM-LEAD-008 y auditoría en CRM-LEAD-009.
### Evidencias requeridas para cierre
- Archivo de prueba validado en Excel con fechas y teléfonos correctos.
- Prueba de seguridad para fórmulas y campos restringidos.
- Registro de auditoría y verificación de expiración del archivo.
# 2. Plan de implementación recomendado
### Fase 1 - Fundamentos y trazabilidad
CRM-LEAD-009, CRM-LEAD-001, CRM-LEAD-002, CRM-LEAD-003, CRM-LEAD-004 y CRM-LEAD-005. Establece
identidad del actor, estados, datos confiables, historial, origen y responsabilidad comercial.
### Fase 2 - Operación y seguimiento
CRM-LEAD-006 y CRM-LEAD-007. Agrega tareas, recordatorios y comunicación WhatsApp sobre una base ya trazable.
### Fase 3 - Analítica y salida de datos
CRM-LEAD-008 y CRM-LEAD-010. Construye métricas y exportaciones con fórmulas, permisos y datos previamente
normalizados.
### Buckets sugeridos en Microsoft Planner
- 01 - Refinamiento y decisiones de negocio.
- 02 - Fundamentos de datos y seguridad.
- 03 - Operación comercial.
- 04 - Integraciones y mensajería.
- 05 - Dashboards y exportaciones.
- 06 - QA, UAT y documentación.
### Etiquetas sugeridas
- Backend / API, Frontend / UX, Base de datos, Integración, Seguridad, Analítica, QA/UAT y Decisión pendiente.
- Prioridad Alta, Media-Alta y Media.
- Bloqueado por negocio, Bloqueado por proveedor o Listo para desarrollo.
### Definición de Ready antes de iniciar un ticket
DR-01. Historia, alcance y exclusiones comprendidos por desarrollo y QA.
DR-02. Reglas de negocio, catálogos, roles y permisos validados.
DR-03. Diseño o wireframe aprobado cuando el cambio incluya interfaz.
DR-04. Contrato de API, eventos, webhooks o campos de integración disponible.
DR-05. Dependencias resueltas o planificadas y datos de prueba preparados.
DR-06. Criterios de aceptación verificables y responsables de UAT identificados.
### Definición de Done para todos los tickets
DD-01. Código revisado y desplegado en ambiente de pruebas mediante el proceso aprobado.
DD-02. Migraciones de base de datos versionadas y con plan de reversión.
DD-03. Validaciones de permisos, auditoría, manejo de errores y datos sensibles completadas.
DD-04. Pruebas unitarias, integración y end-to-end aprobadas según el riesgo.
DD-05. Evidencias adjuntas en Planner y criterios de aceptación marcados uno por uno.
DD-06. Documentación funcional/técnica actualizada, incluyendo configuración y operación.
DD-07. Prueba UAT aprobada por el responsable de negocio y defectos críticos cerrados.
DD-08. Métricas, logs y alertas mínimas disponibles para operar la funcionalidad en producción.
