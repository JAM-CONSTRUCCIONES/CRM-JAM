Ticket de Seguridad: Evaluación de
Protección, Monitoreo y Control de
Costos para Página Pública Serverless
Título del ticket
Evaluar e implementar controles de seguridad, monitoreo y prevención de costos elevados
para página pública serverless en AWS.
Tipo de ticket
Seguridad / Cloud / FinOps / Observabilidad
Prioridad
Alta
Contexto
Actualmente se requiere proteger una página pública que utiliza una arquitectura serverless
en AWS. La página expone endpoints públicos mediante API Gateway REST API, ejecuta
lógica en AWS Lambda y almacena eventos o clics en Amazon DynamoDB.
Debido a que la página es pública, existe riesgo de recibir tráfico malicioso, bots, scraping,
ataques de denegación de servicio, abuso de endpoints o generación masiva de peticiones.
Esto puede afectar la disponibilidad del sistema y también provocar costos elevados en
servicios como API Gateway, Lambda, DynamoDB, CloudWatch, CloudFront y otros
servicios asociados.
Se requiere realizar una exploración técnica para determinar qué controles de seguridad,
monitoreo, alarmas y límites deben implementarse para proteger la aplicación y evitar
aumentos inesperados en la factura mensual.
Objetivo del ticket
Investigar, definir y documentar una estrategia de seguridad y control de costos para la
página pública serverless, incluyendo AWS WAF, CloudWatch Alarms, API Gateway
throttling, AWS Budgets, AWS Cost Anomaly Detection, AWS Shield, métricas de uso,
límites operativos y cualquier otro servicio recomendado para proteger la aplicación contra
ataques y consumo excesivo por peticiones.
Alcance técnico
El análisis debe cubrir como mínimo los siguientes puntos:
1. Identificación de todos los endpoints públicos expuestos por API Gateway REST
API.
2. Evaluación del flujo actual de tráfico:
○ Usuario / navegador.
○ CloudFront, si aplica.
○ API Gateway REST API.
○ Lambda.
○ DynamoDB.
○ CloudWatch Logs.
○ Otros servicios involucrados.
3. Evaluación de riesgos principales:
○ Ataques por volumen de requests.
○ Bots automatizados.
○ Scraping.
○ Abuso de endpoints públicos.
○ Ataques por IP repetitiva.
○ Incremento inesperado de costos por API Gateway.
○ Incremento inesperado de costos por Lambda.
○ Incremento inesperado de costos por DynamoDB.
○ Exceso de logs en CloudWatch.
○ Errores 4XX y 5XX generados por tráfico inválido.
○ Saturación o throttling de servicios serverless.
4. Definición de controles recomendados de seguridad.
5. Definición de alarmas mínimas requeridas en CloudWatch.
6. Definición de presupuestos y alertas de costos.
7. Estimación mensual aproximada de costos de seguridad y monitoreo.
8. Recomendación final para pasar a revisión técnica.
Servicios a evaluar
Se deben evaluar los siguientes servicios y controles:
AWS WAF
Evaluar la implementación de un Web ACL para proteger la aplicación pública.
Reglas mínimas a considerar:
● Rate-based rule por IP.
● AWS Managed Rules Common Rule Set.
● Amazon IP Reputation List.
● Known Bad Inputs.
● SQL Injection protection.
● XSS protection.
● Bloqueo de países si aplica.
● Bloqueo de User Agents sospechosos.
● Reglas específicas para endpoints sensibles.
● Bot Control como opción adicional si el tráfico bot es alto.
AWS WAF tiene costo aproximado de US$5 por Web ACL al mes, US$1 por regla al mes
y alrededor de US$0.60 por cada millón de requests inspeccionadas. AWS muestra
ejemplos donde un Web ACL con varias reglas y 10 millones de requests puede estar entre
aproximadamente US$14 y US$30 mensuales, dependiendo de la cantidad de reglas y
grupos usados.
AWS Shield
Evaluar AWS Shield Standard y AWS Shield Advanced.
Recomendación inicial:
● Usar AWS Shield Standard.
● Shield Standard viene incluido sin costo adicional cuando se usan servicios como
CloudFront, Route 53, Elastic Load Balancing y otros servicios compatibles.
● Shield Advanced solo debe considerarse si el proyecto requiere protección
empresarial avanzada contra DDoS, soporte especializado y protección de costos
DDoS.
AWS Shield Advanced tiene un costo base aproximado de US$3,000 mensuales con
compromiso anual, por lo que no se recomienda para una página pública pequeña o
mediana salvo que el riesgo o el tráfico lo justifique.
API Gateway REST API
Evaluar límites de uso y throttling.
Controles mínimos:
● Definir throttling por stage.
● Definir throttling por método.
● Configurar burst limit.
● Configurar rate limit.
● Evaluar usage plans si aplica.
● Evaluar API keys si hay endpoints no totalmente públicos.
● Validar CORS.
● Validar payload máximo permitido.
● Bloquear métodos innecesarios.
● Revisar logs de acceso.
API Gateway REST API cuesta aproximadamente US$3.50 por millón de requests, sin
incluir transferencia de datos.
AWS Lambda
Evaluar protección contra exceso de invocaciones.
Controles mínimos:
● Reserved concurrency para limitar impacto.
● Alarmas por errores.
● Alarmas por throttles.
● Alarmas por duración.
● Alarmas por invocaciones anormales.
● Timeouts bajos y bien definidos.
● Validación de entrada antes de procesar.
● Evitar lógica pesada en endpoints públicos.
Lambda cobra por cantidad de requests y duración. El free tier incluye 1 millón de requests
al mes y luego el precio base de requests es aproximadamente US$0.20 por millón de
requests, más el costo de cómputo por duración y memoria.
Amazon DynamoDB
Evaluar protección contra escrituras excesivas.
Controles mínimos:
● Definir si la tabla estará en on-demand o provisioned.
● Evaluar límites de escritura.
● Evaluar TTL para expirar eventos antiguos.
● Evaluar particionamiento correcto para evitar hot partitions.
● Alarmas por throttling.
● Alarmas por consumo de escritura.
● Alarmas por errores de sistema.
● Validar si todos los clics deben guardarse o si se puede agregar
batching/agregación.
DynamoDB On-Demand permite pagar por request sin planificación de capacidad, por lo
que debe controlarse bien si el endpoint público puede generar escrituras masivas.
Amazon CloudWatch
Evaluar métricas, logs, dashboards y alarmas.
Se debe definir cuántas alarmas son necesarias. Como base inicial, se recomienda evaluar
entre 14 y 18 alarmas.
Alarmas mínimas propuestas:
1. API Gateway - cantidad total de requests.
2. API Gateway - errores 4XX.
3. API Gateway - errores 5XX.
4. API Gateway - latencia alta.
5. API Gateway - integration latency alta.
6. Lambda - invocaciones anormales.
7. Lambda - errores.
8. Lambda - throttles.
9. Lambda - duración alta.
10. Lambda - concurrencia cercana al límite.
11. DynamoDB - throttled requests.
12. DynamoDB - errores de sistema.
13. DynamoDB - consumo elevado de escritura.
14. WAF - allowed requests anormales.
15. WAF - blocked requests anormales.
16. CloudFront - errores 4XX, si aplica.
17. CloudFront - errores 5XX, si aplica.
18. Billing / EstimatedCharges o alarma de presupuesto.
También se debe evaluar al menos un Composite Alarm para agrupar señales críticas y
reducir ruido.
CloudWatch cobra aproximadamente US$0.10 por alarma estándar por métrica al mes y
US$0.50 por composite alarm al mes. Por ejemplo, 18 alarmas estándar serían
aproximadamente US$1.80 mensuales, sin incluir logs, dashboards u otros consumos.
AWS Budgets
Configurar presupuestos mensuales para evitar sorpresas de facturación.
Presupuestos sugeridos:
● Budget general de la cuenta.
● Budget específico para API Gateway.
● Budget específico para Lambda.
● Budget específico para DynamoDB.
● Budget específico para CloudWatch.
● Budget específico para WAF / CloudFront.
Alertas sugeridas:
● 50% del presupuesto.
● 80% del presupuesto.
● 100% del presupuesto.
● Forecasted cost superior al presupuesto.
AWS Budgets permite monitorear presupuestos y recibir notificaciones sin costo en su uso
básico. Las acciones automatizadas tienen las primeras dos gratuitas y luego pueden
generar costo adicional.
AWS Cost Anomaly Detection
Evaluar la activación de AWS Cost Anomaly Detection para detectar gastos anómalos
mediante machine learning.
Debe configurarse al menos:
● Monitor general de la cuenta.
● Monitor por servicio.
● Alerta por email o SNS.
● Umbral mínimo de impacto económico.
AWS Cost Anomaly Detection ayuda a identificar patrones anormales de gasto y sus causas
raíz.
Documento técnico requerido
Como parte de este ticket, se debe entregar un documento técnico antes de pasar a revisión
técnica.
El documento debe incluir:
1. Resumen ejecutivo.
2. Arquitectura actual de la página pública.
3. Diagrama del flujo de tráfico.
4. Identificación de riesgos.
5. Endpoints públicos detectados.
6. Servicios AWS involucrados.
7. Recomendación de AWS WAF.
8. Reglas WAF propuestas.
9. Recomendación de API Gateway throttling.
10. Recomendación de límites para Lambda.
11. Recomendación de control para DynamoDB.
12. Lista de métricas CloudWatch a monitorear.
13. Cantidad recomendada de CloudWatch Alarms.
14. Justificación de cada alarma.
15. Recomendación de AWS Budgets.
16. Recomendación de Cost Anomaly Detection.
17. Estimación mensual aproximada de costos.
18. Riesgos restantes.
19. Plan de implementación.
20. Conclusión técnica.
Costos aproximados esperados
Los costos deben calcularse por escenario.
Escenario bajo
Tráfico aproximado: 100,000 a 1,000,000 requests mensuales.
Costo mensual estimado:
● WAF: US$10 a US$20.
● CloudWatch Alarms: US$1 a US$3.
● AWS Budgets: US$0 en uso básico.
● Cost Anomaly Detection: sin costo directo relevante.
● Shield Standard: US$0.
● API Gateway REST: US$0.35 a US$3.50 aprox. por requests.
● Lambda: bajo o dentro del free tier, dependiendo de duración.
● DynamoDB: bajo, dependiendo de escrituras.
Total aproximado: US$15 a US$35 mensuales, sin contar tráfico alto de CloudFront ni logs
excesivos.
Escenario medio
Tráfico aproximado: 1,000,000 a 10,000,000 requests mensuales.
Costo mensual estimado:
● WAF: US$15 a US$35.
● CloudWatch Alarms: US$2 a US$5.
● API Gateway REST: US$3.50 a US$35.
● Lambda: US$1 a US$10+, dependiendo de duración y memoria.
● DynamoDB: variable según escrituras.
● CloudWatch Logs: variable según volumen de logs.
Total aproximado: US$40 a US$120 mensuales.
Escenario alto
Tráfico aproximado: 10,000,000 a 50,000,000 requests mensuales.
Costo mensual estimado:
● WAF: US$30 a US$80+.
● CloudWatch Alarms: US$3 a US$10.
● API Gateway REST: US$35 a US$175.
● Lambda: variable según duración y memoria.
● DynamoDB: variable según escrituras.
● CloudWatch Logs: puede aumentar considerablemente si se guarda demasiado
detalle.
Total aproximado: US$150 a US$500+ mensuales, dependiendo de logs, tamaño de
respuesta, escrituras y reglas WAF.
Criterios de aceptación
Este ticket se considerará completado cuando:
1. Se haya entregado el documento técnico solicitado.
2. El documento incluya costos aproximados por escenario.
3. Se haya definido cuántas CloudWatch Alarms se recomiendan implementar.
4. Se haya justificado cada alarma propuesta.
5. Se haya definido si AWS WAF debe proteger CloudFront, API Gateway o ambos.
6. Se hayan definido reglas WAF mínimas.
7. Se haya definido un límite recomendado de requests por IP.
8. Se hayan definido límites de throttling en API Gateway.
9. Se hayan definido límites de concurrencia para Lambda.
10. Se hayan definido alertas de presupuesto en AWS Budgets.
11. Se haya evaluado AWS Shield Standard vs Shield Advanced.
12. Se haya identificado el riesgo de costos elevados por peticiones.
13. Se haya preparado la propuesta para revisión técnica.
Resultado esperado
El resultado esperado es contar con una propuesta técnica clara para proteger la página
pública serverless contra abuso, bots, ataques por volumen y costos inesperados.
Después de completar la exploración, el documento debe pasar a revisión técnica para
validar la arquitectura propuesta, los costos aproximados, las reglas de seguridad, las
alarmas y los límites operativos antes de proceder con la implementación.
Notas técnicas importantes
La solución inicial recomendada debe priorizar servicios de bajo costo y alto impacto:
● AWS WAF.
● AWS Shield Standard.
● API Gateway throttling.
● Lambda reserved concurrency.
● DynamoDB TTL.
● CloudWatch Alarms.
● AWS Budgets.
● AWS Cost Anomaly Detection.
● Revisión de logs para evitar costos innecesarios.
Shield Advanced no debe incluirse como implementación inicial salvo que el negocio acepte
un costo aproximado de US$3,000 mensuales y exista una necesidad real de protección
empresarial contra DDoS.