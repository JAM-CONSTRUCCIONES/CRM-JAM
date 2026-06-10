# Analisis dashboard dev - Vendedor x (B62DD967)

- Fuente: DynamoDB dev (`jam-inventario`, `jam-procesos`, `jam-clientes`, `jam-usuarios`).
- Fecha de analisis: 2026-06-10T16:50:10.802698+00:00 UTC.
- Proyecto auditado: `B62DD967` / `Vendedor x`.
- Estados contados como venta/no disponible: `separacion`, `inicial`, `pagos_atrasados`, `contra_entrega`, `vendida`.

## Resumen base

| Dato | Total |
| --- | ---: |
| Unidades inventario | 175 |
| Procesos | 117 |
| Clientes | 115 |
| Procesos en estados de venta | 47 |
| Unidades unicas contadas como venta | 47 |
| Procesos con unidad no encontrada en inventario | 0 |

## Estatus de unidades

Este bloque alimenta el grafico `ESTATUS`.

| Estado unidad | Cantidad |
| --- | ---: |
| bloqueada | 2 |
| disponible | 57 |
| no_disponible | 114 |
| vendida | 2 |
| **Total** | **175** |

## Estatus de procesos

| Estado proceso | Cantidad |
| --- | ---: |
| contra_entrega | 3 |
| desvinculado | 3 |
| inicial | 10 |
| pagos_atrasados | 1 |
| reserva | 67 |
| separacion | 31 |
| vendida | 2 |
| **Total** | **117** |

## Total de venta por piso

El dashboard debe mostrar estos valores en `TOTAL DE VENTA POR PISO`.

| Piso | Total vendido |
| --- | ---: |
| 1 | 16 |
| 2 | 12 |
| 3 | 11 |
| 4 | 8 |
| **Total** | **47** |

## Total de ventas por metraje

El dashboard debe mostrar estos valores en `TOTAL DE VENTAS POR METRAJE`.

| Metraje | Total vendido |
| --- | ---: |
| 61.74 | 3 |
| 76.34 | 20 |
| 76.67 | 1 |
| 82.09 | 11 |
| 85.98 | 12 |
| **Total** | **47** |

## Venta por inmobiliaria

El dashboard debe mostrar estos valores en `VENTAS POR INMOBILIARIAS`.

| Inmobiliaria | Total vendido |
| --- | ---: |
| MR HOME (`08F12E2A`) | 1 |
| Administracion DOES (`10FC29DA`) | 5 |
| Oferta Inmobiliaria (`4547650D`) | 3 |
| Inmoniliaria Reservas (`55DDDFA0`) | 1 |
| Plusval (`5D9CF004`) | 7 |
| LOFT HOME (`6D2D5073`) | 3 |
| PS Inmobiliaira (`9CFE7AB9`) | 17 |
| TUCASARD (`A6220AEA`) | 3 |
| East Home (`E4B4F014`) | 4 |
| HOMEWAY (`E5F40AFB`) | 3 |
| **Total** | **47** |

## Estatus de contratos Promesa de Venta

El dashboard debe mostrar estos valores en `ESTATUS DE CONTRATOS PROMESA DE VENTA`.

| Estatus contrato | Fuente proceso | Cantidad |
| --- | --- | ---: |
| Cliente listo para contrato | `separacion` | 31 |
| Contrato firmado | `inicial` | 10 |
| **Total** |  | **41** |

## Rango Edad de Compradores

El dashboard debe mostrar estos valores en `RANGO DE EDAD DE COMPRADORES`.

| Rango edad | Clientes |
| --- | ---: |
| `<25` | 3 |
| `25-34` | 0 |
| `35-44` | 0 |
| `45-54` | 0 |
| `55+` | 0 |
| **Total** | **3** |

## Observaciones

- La suma de ventas por piso, metraje e inmobiliaria coincide: `47`.
- No hay procesos de venta con `unidad_id` faltante en inventario para este proyecto.
- Solo 3 clientes tienen edad calculable o registrada para este proyecto; por eso el reporte de edad totaliza `3`, aunque el proyecto tenga 115 clientes.
- El grafico `ESTATUS` usa estados de inventario y por eso `no_disponible + vendida = 116`; esto no es lo mismo que las `47` unidades contadas como venta por los estados comerciales definidos.
