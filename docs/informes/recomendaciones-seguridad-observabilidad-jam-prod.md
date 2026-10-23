# Recomendaciones para JAM produccion

## Estado actual

Se reviso la configuracion del codigo y de AWS para produccion.

Importante: aunque el ambiente se llama produccion, por el momento el sistema sigue en etapa de desarrollo/validacion. Por eso la recomendacion debe cuidar costos y no agregar servicios innecesarios hasta que el uso real aumente.

Actualmente `jam-api-prod` esta funcionando, pero no tiene activadas algunas herramientas de observabilidad y proteccion:

- API Gateway no tiene access logs.
- API Gateway no tiene metricas detalladas por ruta/metodo.
- API Gateway no tiene X-Ray activo.
- API Gateway no tiene cache activo.
- API Gateway no tiene WAF asociado.
- CloudFront no tiene WAF asociado.
- CloudFront no tiene access logs activos.
- CORS esta abierto con `*` en API Gateway, respuestas Lambda y buckets S3 de uploads/assets.

El volumen revisado de `jam-api-prod` fue bajo: aproximadamente `4,431` requests entre el 1 y el 23 de junio de 2026. Por ese volumen, no parece necesario agregar cache dedicado de API Gateway todavia.

## Costos estimados

Los precios son aproximados para `us-east-1` y pueden variar segun volumen real de uso.

| Opcion | Que aporta | Costo estimado con uso actual |
| --- | --- | --- |
| Access logs de API Gateway | Saber ruta, metodo, IP, status, user-agent y requestId | Menos de `US$1/mes` con el trafico actual. Si el trafico crece mucho, depende de GB de logs guardados. |
| Metricas detalladas por metodo | Ver requests, errores y latencia por endpoint | Bajo. Puede sumar algunos dolares si hay muchos endpoints con metricas activas. |
| Alarmas CloudWatch | Alertas por picos, errores o fallos | Aprox. `US$0.10` por alarma al mes. Con 5 alarmas: aprox. `US$0.50/mes`. |
| CORS restringido | Limitar llamadas desde navegadores a dominios autorizados | Sin costo adicional. |
| WAF basico | Rate limit y reglas contra trafico sospechoso | Aprox. `US$5/mes` por Web ACL + `US$1/mes` por regla + requests. Para JAM actual: aprox. `US$8 a US$15/mes`, segun cantidad de reglas. |
| X-Ray con muestreo bajo | Diagnosticar rendimiento interno | Con trafico actual seria casi `US$0/mes` o muy bajo. No es prioridad. |
| Cache API Gateway | Reducir llamadas repetidas al API | Aprox. desde `US$27/mes` para cache pequeno. No recomendado ahora. |
| CloudFront access logs | Revisar trafico al frontend | Bajo, pero genera almacenamiento en S3. No es prioridad si no hay problema de trafico frontend. |

## Recomendacion minima para produccion

### 1. Activar access logs en API Gateway

Esto permitiria saber que ruta se llama, metodo, estado de respuesta, IP, user-agent y requestId.

Es lo mas importante para investigar problemas futuros sin depender de suposiciones.

Recomendado para prod: si.

Costo esperado: menos de `US$1/mes` con el volumen actual. Si el sistema crece mucho, se cobrara segun la cantidad de logs almacenados.

### 2. Activar metricas detalladas por metodo en API Gateway

Esto permitiria ver requests, errores y latencia por endpoint.

Ayuda a detectar si una ruta empieza a recibir demasiadas llamadas o si un endpoint empieza a fallar.

Recomendado para prod: si.

Costo esperado: bajo. Se debe monitorear porque al activar metricas por muchas rutas puede subir algunos dolares al mes.

### 3. Crear alarmas basicas en CloudWatch

Alarmas sugeridas:

- Requests diarios anormales en `jam-api-prod`.
- Errores 4XX altos.
- Errores 5XX altos.
- Invocaciones Lambda anormales.
- Errores Lambda.

Recomendado para prod: si.

Costo esperado: aprox. `US$0.10` por alarma al mes. Con 5 alarmas, aprox. `US$0.50/mes`.

### 4. Ajustar CORS en produccion

Actualmente CORS esta abierto con `*`.

Para produccion conviene permitir solamente los dominios reales del sistema, por ejemplo:

- `https://dcgjiswnwqab6.cloudfront.net`
- Dominio propio de JAM, si se configura mas adelante.

Tambien se debe ajustar CORS en:

- API Gateway.
- Respuestas de Lambdas.
- Gateway responses de error.
- Buckets S3 usados con URLs prefirmadas.

Recomendado para prod: si.

Importante: CORS no reemplaza WAF ni autenticacion. Solo controla llamadas desde navegador.

Costo esperado: sin costo adicional.

## Recomendacion de proteccion

### 5. Agregar WAF basico

WAF ayudaria a limitar abuso o trafico raro antes de que llegue al API.

Reglas sugeridas:

- Rate limit por IP.
- AWS Managed Rules basicas.
- Bloqueo de patrones comunes maliciosos.

Para JAM, lo mas simple seria asociarlo al API Gateway de produccion o a CloudFront si se decide proteger primero el frontend.

Recomendado para prod: si, pero despues de access logs y alarmas.

Costo esperado: aprox. `US$8 a US$15/mes` para una configuracion basica, dependiendo de cuantas reglas se activen.

## Opcional

### 6. X-Ray

X-Ray sirve para diagnosticar rendimiento interno: cuanto tarda Lambda, DynamoDB, S3 u otros servicios.

No es la primera herramienta para controlar costos por trafico. Para eso son mas utiles los access logs y las metricas por ruta.

Recomendado para prod: opcional.

Costo esperado: muy bajo con el trafico actual si se usa muestreo bajo. No lo pondria primero porque no resuelve el problema principal de visibilidad por ruta.

### 7. Cache de API Gateway

No lo recomiendo todavia para JAM prod porque el volumen actual de requests es bajo.

Si en el futuro aparece una ruta publica muy consultada, se puede evaluar cache para esa ruta especifica.

Recomendado para prod ahora: no.

Costo esperado: desde aprox. `US$27/mes` para cache pequeno. Para el uso actual de JAM no se justifica.

## Paquetes recomendados

### Paquete minimo mientras sigue en desarrollo

- Access logs de API Gateway.
- 5 alarmas CloudWatch.
- CORS restringido a los dominios reales.

Costo estimado: aprox. `US$1 a US$3/mes`.

Este paquete es suficiente para tener visibilidad basica sin subir mucho el costo.

### Paquete recomendado para produccion cuidada

- Access logs de API Gateway.
- Metricas detalladas por metodo.
- 5 alarmas CloudWatch.
- CORS restringido.
- WAF basico con rate limit.

Costo estimado: aprox. `US$10 a US$20/mes`.

Este paquete es el mas balanceado para cuando el sistema ya este siendo usado por clientes reales.

### Paquete avanzado

- Todo lo anterior.
- X-Ray con muestreo bajo.
- CloudFront access logs.
- Cache API Gateway solo si aparece una ruta con muchas llamadas repetidas.

Costo estimado: aprox. `US$40+/mes` si se incluye cache de API Gateway.

No lo recomiendo todavia mientras el sistema siga en desarrollo.

## Orden recomendado de implementacion

1. Activar access logs de API Gateway.
2. Activar metricas detalladas por metodo.
3. Crear alarmas CloudWatch.
4. Restringir CORS a dominios reales de produccion.
5. Agregar WAF basico con rate limit.
6. Evaluar X-Ray solo si se necesita diagnosticar rendimiento.
7. Evaluar cache solo si aumenta mucho el trafico.

## Resumen

Para JAM produccion, tomando en cuenta que todavia esta en etapa de desarrollo/validacion, no recomiendo empezar por cache ni X-Ray.

Lo mas sano es primero tener visibilidad y alertas:

- Logs de API Gateway.
- Metricas por endpoint.
- Alarmas.
- CORS restringido.

Luego agregar WAF basico para reducir riesgo de abuso.

Recomendacion actual: aplicar el paquete minimo ahora y dejar el paquete con WAF para cuando el sistema pase a uso mas activo.
