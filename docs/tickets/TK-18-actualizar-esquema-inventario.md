# TK-18 - Actualizar esquema de base de datos e inventario para nuevos campos y lógica de unidades

**Referencia original:** TK-JAM-06
**Responsable:** Andres Alvarez
**Prioridad:** Alta
**Estado sugerido:** Pendiente
**Estimación:** 12 a 18 horas

---

## Objetivo

Rediseñar la estructura de datos del inventario y del historial operativo para soportar nuevos campos comerciales, de filtrado y de auditoría, alineados con los requisitos discutidos en reunión.

---

## Alcance propuesto

- Agregar precios y otros datos comerciales relevantes al inventario.
- Unificar Edificio + Unidad en un identificador único de unidad.
- Incorporar campos de Tipo, Manzana, Piso y Estado para filtros.
- Registrar día de bloqueo y día de desbloqueo en historial o tablas relacionadas.
- Ajustar consultas, UI y lógica asociada a la nueva estructura.

---

## Criterios de aceptación

- [ ] La base de datos soporta todos los nuevos campos requeridos.
- [ ] La vista de inventario puede filtrar por Tipo, Manzana, Piso y Estado.
- [ ] La unidad se representa con un identificador único claro.
- [ ] El historial conserva fecha o día de bloqueo y desbloqueo.
- [ ] No se rompen funciones existentes tras la migración.

---

## Notas técnicas

- Los nuevos campos son opcionales en DynamoDB — no requieren migración forzosa, se agregan progresivamente.
- El identificador único puede derivarse de `torre_nombre + id_unidad` que ya existe.
- Los nuevos filtros requieren GSIs adicionales o FilterExpression según el volumen.
- Requiere script de migración para poblar los nuevos campos en registros existentes.
- Depende de: TK-02 (modelo de datos base), TK-03 (visualización inventario)
