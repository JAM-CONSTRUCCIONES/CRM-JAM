# Informe resumido: Seguridad y control de costos para pagina publica serverless

Fecha: 2026-06-25

Estado: propuesta para revision tecnica y aprobacion de alcance

Repositorio evaluado: JAM-Construcciones

## 1. Resumen ejecutivo

La aplicacion expone endpoints publicos en AWS mediante API Gateway, Lambda y DynamoDB. La mayor parte del CRM esta protegida por Cognito, pero existen rutas publicas para captura de clientes e inventario publico. Tambien existe un Lambda Function URL usado por el chatbot, que debe revisarse porque queda fuera de los controles del API Gateway principal.

El objetivo es reducir riesgo de bots, scraping, spam, errores masivos y costos inesperados. La recomendacion es implementar controles de bajo costo primero:

- AWS WAF en API Gateway.
- Reglas WAF basicas y rate limits por IP.
- Throttling en API Gateway.
- Reserved concurrency en Lambdas publicas.
- Validaciones y paginacion en codigo.
- CloudWatch Alarms.
- AWS Budgets.
- Cost Anomaly Detection.
- Shield Standard.

No se recomienda iniciar con Shield Advanced, Bot Control, CAPTCHA ni limites directos de DynamoDB. Esas opciones quedan como futuras si aparece evidencia real de abuso.

## 2. Endpoints publicos detectados

| Endpoint | Metodo | Uso | Riesgo principal |
|---|---:|---|---|
| `/publico/inmobiliarias` | GET | Lista inmobiliarias activas | Enumeracion y scraping |
| `/publico/proyectos` | GET | Lista proyectos e inventario publico por query string | Scraping y lecturas repetidas |
| `/publico/clientes` | POST | Registro publico de clientes | Spam y escrituras basura |
| Lambda Function URL chatbot | POST | Chatbot del frontend | Abuso fuera de API Gateway/WAF |

Inventario publico usado por frontend:

- `/publico/proyectos?inventario_publico=detalle&proyecto_id=...`
- `/publico/proyectos?inventario_publico=etapas&proyecto_id=...`
- `/publico/proyectos?inventario_publico=unidades&proyecto_id=...`

## 3. Riesgos principales

| Riesgo | Impacto | Comentario |
|---|---:|---|
| Bots o scraping sobre inventario publico | Alto | Puede multiplicar requests y lecturas. |
| Spam en `/publico/clientes` | Alto | Puede crear datos basura y costos indirectos. |
| Crecimiento de requests API Gateway | Alto | API Gateway cobra por request. |
| Invocaciones masivas de Lambda | Alto | Puede subir costo y afectar disponibilidad. |
| Logs excesivos en CloudWatch | Medio/Alto | Un ataque puede generar mucho gasto en logs. |
| CORS abierto | Medio | No bloquea bots, pero aumenta superficie desde navegador. |
| Chatbot por Lambda URL | Medio/Alto | No hereda controles del API principal. |
| DynamoDB con limites duros | Riesgo operativo | No se recomienda limitar capacidad inicialmente. |

## 4. Decision tecnica recomendada

### Implementar inicialmente

1. WAF en API Gateway REST API `JamApi`.
2. Reglas WAF basicas en modo `Count` al inicio y luego `Block`.
3. Rate limits WAF por IP para `/publico/*`.
4. Throttling en API Gateway por stage y por metodo publico.
5. Reserved concurrency en Lambdas expuestas, especialmente `JamCaptacionLambda`.
6. Paginacion y limites de respuesta en inventario publico.
7. Validacion estricta en `POST /publico/clientes`.
8. CloudWatch Alarms y dashboard.
9. AWS Budgets y Cost Anomaly Detection.
10. Revision del Lambda URL del chatbot.

### No implementar inicialmente

| Control | Motivo |
|---|---|
| Shield Advanced | Costo aproximado USD 3,000/mes; no justificado inicialmente. |
| WAF Bot Control | Costo adicional; activar solo con evidencia de bots distribuidos. |
| CAPTCHA/Challenge | Puede afectar UX; usar solo si aparece spam real. |
| Limites directos de DynamoDB | El modelo NoSQL sostiene relaciones de negocio; un limite duro puede romper flujos validos. |
| Segundo WAF para CloudFront | Opcional; primero proteger API Gateway, donde esta el mayor riesgo de costo. |

## 5. DynamoDB: criterio especial

No se recomienda aplicar request limits ni max throughput inicial sobre DynamoDB.

Motivo: aunque DynamoDB es NoSQL, en este sistema sostiene relaciones de negocio entre inventario, clientes, procesos, historiales y bloqueos. Un limite agresivo puede proteger costo, pero tambien puede cortar operaciones internas legitimas.

Control recomendado:

- Frenar abuso antes de DynamoDB con WAF, API Gateway throttling y Lambda reserved concurrency.
- Usar paginacion y limites de respuesta desde Lambda.
- Usar alarmas de consumo/throttling solo como visibilidad.
- Usar TTL solo en datos temporales, no en entidades de negocio ni historiales requeridos.

## 6. Matriz de aprobacion

### 6.1 Configuraciones sin costo directo

| Aprobar | Accion | Donde | Costo AWS | Recomendacion |
|---|---|---|---:|---|
| [ ] | API Gateway throttling por stage | `JamApi` stage `api` | USD 0 | Si |
| [ ] | API Gateway throttling por metodo | `/publico/*` | USD 0 | Si |
| [ ] | Restringir CORS | API Gateway | USD 0 | Si |
| [ ] | Validar payload temprano | `JamCaptacionLambda` | USD 0 | Si |
| [ ] | Limitar payload | API/Lambda | USD 0 | Si |
| [ ] | Paginacion inventario publico | Lambda/API | USD 0 | Si |
| [ ] | Limite de resultados por respuesta | Inventario publico | USD 0 | Si |
| [ ] | Reserved concurrency | Lambdas expuestas | USD 0 | Si |
| [ ] | Reducir logs verbosos | Lambdas | USD 0 | Si |
| [ ] | Revisar URL chatbot | Frontend/Lambda URL | USD 0 | Si |
| [ ] | TTL solo temporal | Datos temporales | USD 0 | Opcional |

### 6.2 AWS WAF seleccionable

| Aprobar | Item WAF | Costo mensual aprox. | Recomendacion |
|---|---|---:|---|
| [ ] | Web ACL para API Gateway | USD 5.00 | Si |
| [ ] | Rate limit general por IP | USD 1.00 | Si |
| [ ] | Rate limit `/publico/clientes` | USD 1.00 | Si |
| [ ] | Rate limit inventario publico | USD 1.00 | Si |
| [ ] | AWS Common Rule Set | USD 1.00 | Si |
| [ ] | Amazon IP Reputation List | USD 1.00 | Si |
| [ ] | Known Bad Inputs | USD 1.00 | Si |
| [ ] | SQLi Rule Set | USD 1.00 | Si, en Count primero |
| [ ] | Linux Rule Set | USD 1.00 | Opcional |
| [ ] | Bloqueo User-Agent sospechoso | USD 1.00 | Opcional |
| [ ] | Bloqueo por pais | USD 1.00 | Solo si negocio lo aprueba |
| [ ] | Request inspection WAF | USD 0.60 por 1M requests | Variable |

Subtotal WAF recomendado: USD 15.00/mes fijo + USD 0.60 por cada 1M requests inspeccionadas.

### 6.3 CloudWatch Alarms seleccionables

Cada alarma estandar se cotiza sin free tier a USD 0.10/mes. Composite alarm: USD 0.50/mes.

| Aprobar | Alarma | Costo mensual | Recomendacion |
|---|---|---:|---|
| [ ] | API Gateway total requests | USD 0.10 | Si |
| [ ] | API Gateway 4XX | USD 0.10 | Si |
| [ ] | API Gateway 5XX | USD 0.10 | Si |
| [ ] | API Gateway latency | USD 0.10 | Si |
| [ ] | API Gateway integration latency | USD 0.10 | Si |
| [ ] | Lambda Captacion invocations | USD 0.10 | Si |
| [ ] | Lambda Captacion errors | USD 0.10 | Si |
| [ ] | Lambda Captacion throttles | USD 0.10 | Si |
| [ ] | Lambda Captacion duration | USD 0.10 | Si |
| [ ] | Lambda concurrent executions | USD 0.10 | Si |
| [ ] | DynamoDB Inventario throttles | USD 0.10 | Si, solo visibilidad |
| [ ] | DynamoDB Clientes throttles | USD 0.10 | Si, solo visibilidad |
| [ ] | DynamoDB Inventario reads alto | USD 0.10 | Si |
| [ ] | DynamoDB Clientes writes alto | USD 0.10 | Si |
| [ ] | WAF blocked requests | USD 0.10 | Si si hay WAF |
| [ ] | WAF allowed requests | USD 0.10 | Si si hay WAF |
| [ ] | CloudFront 4XX/5XX | USD 0.10 | Opcional |
| [ ] | Budget forecasted cost | USD 0.10 | Si |
| [ ] | Composite `PublicApiAbuseCritical` | USD 0.50 | Si |

Subtotal alarmas si se aprueban todas: USD 2.30/mes.

### 6.4 FinOps seleccionable

| Aprobar | Control | Costo mensual | Recomendacion |
|---|---|---:|---|
| [ ] | Budget cuenta total | USD 0 | Si |
| [ ] | Budget API Gateway | USD 0 | Si |
| [ ] | Budget Lambda | USD 0 | Si |
| [ ] | Budget DynamoDB | USD 0 | Si |
| [ ] | Budget CloudWatch | USD 0 | Si |
| [ ] | Budget WAF/CloudFront | USD 0 | Si |
| [ ] | Cost Anomaly Detection cuenta | USD 0 | Si |
| [ ] | Cost Anomaly Detection por servicio | USD 0 | Si |

## 7. Cotizacion resumida

| Paquete | Incluye | Fijo mensual | Variable | Recomendacion |
|---|---|---:|---:|---|
| Minimo recomendado | Configuraciones + WAF API + 10 reglas + 18 alarmas + composite + dashboard + budgets + anomaly detection + Shield Standard | USD 20.30 | WAF requests + logs | Aprobar |
| Minimo sin dashboard | Igual, sin dashboard | USD 17.30 | WAF requests + logs | Aceptable |
| Con WAF CloudFront | Minimo + segundo WAF para CloudFront | USD 35.30 | WAF API + WAF CloudFront + logs | Opcional |
| Con Shield Advanced | Minimo + Shield Advanced | USD 3,020.30 aprox. | Variables adicionales | No recomendado |

Escenarios estimados del minimo recomendado:

| Escenario | WAF requests | Logs seguridad | Total mensual aprox. |
|---|---:|---:|---:|
| Bajo | 1M/mes | 1 GB/mes | USD 21.43 |
| Medio | 10M/mes | 5 GB/mes | USD 28.95 |
| Alto | 50M/mes | 20 GB/mes | USD 60.90 |

Costos excluidos: consumo normal de API Gateway, Lambda, DynamoDB, CloudFront, S3, transferencia de datos y servicios externos.

## 8. Plan de implementacion propuesto

1. Aprobar matriz de alcance.
2. Implementar configuraciones sin costo directo.
3. Implementar WAF en API Gateway en modo `Count`.
4. Crear alarmas, dashboard, budgets y Cost Anomaly Detection.
5. Observar trafico 3 a 7 dias.
6. Cambiar reglas WAF estables de `Count` a `Block`.
7. Revisar si hace falta CloudFront WAF, CAPTCHA, Bot Control o cambios al chatbot.

## 9. Conclusion

La opcion recomendada es aprobar el paquete minimo recomendado. Tiene costo bajo, protege los puntos publicos mas expuestos y evita implementar servicios caros antes de tener evidencia.

Costo esperado inicial:

- Fijo: USD 20.30/mes.
- Variable bajo: total aproximado USD 21.43/mes.
- Variable medio: total aproximado USD 28.95/mes.
- Variable alto: total aproximado USD 60.90/mes.

No se recomienda Shield Advanced ni limites directos de DynamoDB en esta fase.
