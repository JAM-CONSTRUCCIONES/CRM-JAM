# TK-13 - Agregar botón de refresco en vista de unidades

**Referencia original:** TK-JAM-01
**Responsable:** Andres Alvarez
**Prioridad:** Media
**Estado sugerido:** Pendiente
**Estimación:** 3 a 5 horas

---

## Objetivo

Incorporar un botón de refresco visible en la vista de unidades para que el usuario pueda actualizar manualmente el inventario y visualizar cambios recientes sin necesidad de recargar toda la aplicación.

---

## Alcance propuesto

- Agregar botón o acción de refresco en el módulo de Units.
- Ejecutar recarga de datos manteniendo filtros activos cuando sea posible.
- Mostrar feedback visual de carga o actualización completada.
- Evitar duplicidad de registros o parpadeos innecesarios en la tabla.

---

## Criterios de aceptación

- [ ] El usuario puede refrescar el listado de unidades desde la interfaz.
- [ ] La información se actualiza sin romper filtros o navegación actual.
- [ ] Existe indicador visual durante la actualización.
- [ ] No se generan errores de UX ni duplicación de filas.

---

## Notas técnicas

- La página de inventario ya tiene lógica de carga — exponer el botón y asegurarse de que pasa los filtros activos al recargar.
- Aplica tanto para la vista por edificio como para la vista de todas las unidades del proyecto.
- Depende de: TK-03 (visualización de inventario)
