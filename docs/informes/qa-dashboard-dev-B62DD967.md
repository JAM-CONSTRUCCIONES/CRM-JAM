# QA dashboard dev - Proyecto Vendedor x (B62DD967)

Fecha de analisis: 18/6/2026, 2:03:33 p. m.

Este documento contiene los valores esperados calculados desde DynamoDB dev para comparar contra las capturas del dashboard.

## Fuente revisada

- Proyecto: Vendedor x `B62DD967`.
- Inventario: `jam-inventario`.
- Clientes: `jam-clientes`.
- Procesos: `jam-procesos`.

## Conteos base

| Dato | Cantidad |
| --- | ---: |
| Unidades de inventario | 176 |
| Clientes del proyecto | 125 |
| Procesos del proyecto | 122 |

## Estatus de unidades

| Estatus | Cantidad |
| --- | ---: |
| bloqueada | 9 |
| disponible | 55 |
| no_disponible | 112 |
| total | 176 |

Nota: este conteo sale del estado actual de la unidad en inventario.

## Estatus de procesos

| Estatus | Cantidad |
| --- | ---: |
| captacion | 9 |
| contra_entrega | 6 |
| desvinculado | 5 |
| inicial | 8 |
| reserva | 66 |
| separacion | 28 |
| total | 122 |

## Clientes y exclusividad

| Dato | Cantidad |
| --- | ---: |
| Total clientes | 125 |
| Exclusividad activa | 125 |
| Exclusividad vencida | 0 |

## Ventas / unidades no disponibles por piso

El dashboard administrativo cuenta como venta las unidades en estados de venta desde separacion en adelante: separacion, inicial, pagos atrasados, contra entrega y vendida. Se cuenta una sola vez por unidad.

| Piso | Total esperado |
| --- | ---: |
| 1 | 14 |
| 2 | 11 |
| 3 | 10 |
| 4 | 7 |
| **Total** | **42** |

## Ventas / unidades no disponibles por metraje

| Metraje | Total esperado |
| --- | ---: |
| 61.74 | 3 |
| 76.34 | 20 |
| 76.67 | 1 |
| 82.09 | 7 |
| 85.98 | 11 |
| **Total** | **42** |

## Ventas por inmobiliaria

| Inmobiliaria | ID | Total esperado |
| --- | --- | ---: |
| PS Inmobiliaira | 9CFE7AB9 | 15 |
| Plusval | 5D9CF004 | 6 |
| Administracion DOES | 10FC29DA | 5 |
| East Home | E4B4F014 | 3 |
| HOMEWAY | E5F40AFB | 3 |
| Oferta Inmobiliaria | 4547650D | 3 |
| TUCASARD | A6220AEA | 3 |
| LOFT HOME | 6D2D5073 | 2 |
| MR HOME | 08F12E2A | 1 |
| Inmoniliaria Reservas | 55DDDFA0 | 1 |
| **Total** |  | **42** |

## Conversion por inmobiliaria

| Inmobiliaria | ID | Captados | Reservas o mas | Separacion o mas | Desvinculados |
| --- | --- | ---: | ---: | ---: | ---: |
| MR HOME | 08F12E2A | 1 | 1 | 1 | 0 |
| Administracion DOES | 10FC29DA | 12 | 12 | 5 | 0 |
| Oferta Inmobiliaria | 4547650D | 8 | 4 | 3 | 2 |
| Inmoniliaria Reservas | 55DDDFA0 | 1 | 1 | 1 | 0 |
| Plusval | 5D9CF004 | 33 | 30 | 6 | 1 |
| LOFT HOME | 6D2D5073 | 4 | 4 | 2 | 0 |
| PS Inmobiliaira | 9CFE7AB9 | 37 | 35 | 15 | 0 |
| TUCASARD | A6220AEA | 8 | 8 | 3 | 0 |
| East Home | E4B4F014 | 8 | 6 | 3 | 0 |
| HOMEWAY | E5F40AFB | 10 | 7 | 3 | 2 |

## Rangos de edad de compradores/clientes

| Rango | Clientes |
| --- | ---: |
| <25 | 15 |
| 25-34 | 0 |
| 35-44 | 0 |
| 45-54 | 0 |
| 55+ | 0 |
| Sin edad | 110 |
| **Total** | **125** |

Nota: en base existen 125 clientes con `edad = 0`, pero solo 15 tienen fecha de nacimiento valida. Para evitar confusion, el dashboard debe mostrar los 15 clientes con edad calculable y agrupar los otros 110 como `Sin edad`, sin tomar `edad = 0` como edad real.

## Estado civil

| Estado civil | Clientes |
| --- | ---: |
| casado | 1 |
| soltero | 8 |

## Pais de residencia

| Pais | Clientes |
| --- | ---: |
| 23 | 2 |
| Afganistan | 1 |
| Bolivia | 3 |
| Republica Dominicana | 2 |

## Nacionalidad

| Nacionalidad | Clientes |
| --- | ---: |
| 23 | 2 |
| Afgana | 2 |
| Argentina | 1 |
| Boliviana | 2 |
| Dominicana | 1 |

## Cierres mensuales detectados en historial

| Mes | Reservas | Separaciones | Total movimientos |
| --- | ---: | ---: | ---: |
| 2026-05 | 4 | 4 | 8 |
| 2026-06 | 6 | 4 | 10 |

## Unidades con mas procesos

| Unidad | Procesos |
| --- | ---: |
| B-B-301 | 3 |
| B-B-402 | 2 |
| B-A-402 | 2 |
| B-C-402 | 1 |
| A-I-102 | 1 |
| A-I-103 | 1 |
| A-I-402 | 1 |
| A-I-101 | 1 |
| A-I-303 | 1 |
| A-I-302 | 1 |
| A-I-203 | 1 |
| B-A-401 | 1 |
| A-I-104 | 1 |
| A-I-204 | 1 |
| A-I-202 | 1 |

## Puntos a comparar con capturas

- El total por piso debe sumar 42.
- El total por metraje debe sumar 42.
- El total por inmobiliaria debe sumar 42.
- El grafico de estatus debe reflejar 9 bloqueadas, 55 disponibles y 112 no disponibles para vista administrativa.
- En rango de edad, con la data actual los 15 clientes con fecha de nacimiento valida caen en `<25` y los 110 restantes deben aparecer como `Sin edad`.
- Hay valores historicos aun no normalizados en pais/nacionalidad, por ejemplo `23`; si aparecen en dashboard no es calculo incorrecto, es dato existente en base.

## Capturas recibidas para revision posterior

Pendiente de comparar en detalle contra las capturas enviadas por QA. Por ahora solo se registran los valores visibles y observaciones visuales.

### Captura 1: Estatus y total de venta por piso

Valores visibles:

- Estatus:
  - Bloqueado: 9.
  - Disponible: 55.
  - No disponible: 112.
  - Total general: 176.
- Total de venta por piso:
  - Piso 1: 14.
  - Piso 2: 11.
  - Piso 3: 10.
  - Piso 4: 7.
  - Total: 42.

Observacion visual:

- Los graficos estan correctos visualmente en modo oscuro, pero el dashboard concentra muchos graficos en una misma vista.

### Captura 2: venta por mes y venta por metraje

Valores visibles:

- Total de venta por mes:
  - mayo: 8.
  - junio: 10.
  - Total: 18.
- Total de ventas por metraje:
  - 61.74: 3.
  - 76.34: 20.
  - 76.67: 1.
  - 82.09: 7.
  - 85.98: 11.
  - Total: 42.

Observacion visual:

- El grafico de metraje y su tabla se ven juntos y ocupan bastante alto de pantalla.

### Captura 3: estatus de contratos promesa de venta y ventas por inmobiliarias

Valores visibles:

- Estatus de contratos promesa de venta:
  - Cliente listo para contrato: 28.
  - Contrato firmado: 8.
  - Total: 36.
- Ventas por inmobiliarias:
  - Administracion DOES: 5.
  - East Home: 3.
  - HOMEWAY: 3.
  - Inmoniliaria Reservas: 1.
  - LOFT HOME: 2.
  - MR HOME: 1.
  - Oferta Inmobiliaria: 3.
  - Plusval: 6.
  - PS Inmobiliaira: 15.
  - TUCASARD: 3.
  - Total: 42.

Observacion visual:

- Se nota que la columna izquierda y derecha tienen graficos muy largos en paralelo; conviene evaluar una organizacion visual mas respirada antes de cerrar QA visual.

### Captura 4: rango de edad y pais de residencia

Valores visibles:

- Rango de edad de compradores:
  - `<25`: 15.
  - Total: 15.
- Pais de residencia:
  - Bolivia: 3.
  - 23: 2.
  - Republica Dominicana: 2.
  - Afganistan: 1.
  - Total: 8.

Observacion visual:

- El titulo/eje de rango de edad aparece con seleccion o resaltado azul en la captura. Revisar si fue seleccion manual del navegador o un problema de contraste/estilo.
- Pais de residencia muestra el valor historico `23`, que viene de base de datos y no de un error de render.

### Capturas repetidas del bloque demografico

Se recibieron capturas repetidas del bloque de rango de edad y pais de residencia. Mantienen los mismos valores visibles:

- Rango `<25`: 15.
- Pais de residencia total: 8.

### Captura final: pais de residencia

Valores visibles:

- Bolivia: 3.
- 23: 2.
- Republica Dominicana: 2.
- Afganistan: 1.
- Total: 8.

Resultado:

- Cuadra con los datos esperados de DynamoDB para pais de residencia.

## Comparacion final contra capturas

| Seccion | Esperado DynamoDB | Visible en capturas | Resultado |
| --- | ---: | ---: | --- |
| Estatus - bloqueado | 9 | 9 | Cuadra |
| Estatus - disponible | 55 | 55 | Cuadra |
| Estatus - no disponible | 112 | 112 | Cuadra |
| Estatus - total | 176 | 176 | Cuadra |
| Venta por piso - total | 42 | 42 | Cuadra |
| Venta por metraje - total | 42 | 42 | Cuadra |
| Venta por inmobiliaria - total | 42 | 42 | Cuadra |
| Venta por mes - total movimientos | 18 | 18 | Cuadra |
| Contratos - cliente listo para contrato | 28 | 28 | Cuadra |
| Contratos - contrato firmado | 8 | 8 | Cuadra |
| Contratos - total | 36 | 36 | Cuadra |
| Rango edad `<25` | 15 | 15 | Cuadra |
| Pais de residencia - total | 8 | 8 | Cuadra |

Conclusion funcional:

- Los valores visibles en las capturas cuadran con los datos esperados para el dashboard administrativo del proyecto `B62DD967`.
- La diferencia inicial en rango de edad se debia a que la base tiene `edad = 0` en 125 clientes, pero solo 15 clientes tienen fecha de nacimiento valida. El dashboard muestra los 15 con fecha util, lo cual es correcto para evitar contar edades vacias como edad real.
- Se implementara/validara la categoria `Sin edad` para que esos clientes sin fecha util no queden ocultos ni se interpreten como edad cero.

### Observacion general de visualizacion

El dashboard actualmente muestra muchos graficos en una sola pantalla y en columnas largas. Para QA funcional se puede validar por valores, pero para QA visual seria recomendable revisar si conviene separar por secciones, pestañas o grupos mas claros:

- Resumen general.
- Ventas.
- Contratos/procesos.
- Demograficos.
- Inmobiliarias.
