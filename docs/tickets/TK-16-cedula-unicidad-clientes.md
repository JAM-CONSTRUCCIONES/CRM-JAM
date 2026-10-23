# TK-16 - Actualizar interfaz de clientes para mostrar cédula y mantener regla de unicidad

**Referencia original:** TK-JAM-04
**Responsable:** Andres Alvarez
**Prioridad:** Alta
**Estado sugerido:** Pendiente
**Estimación:** 6 a 10 horas

---

## Objetivo

Ajustar el módulo de clientes para visualizar la cédula en la interfaz y reforzar las validaciones de negocio necesarias para preservar la integridad de los registros dentro del proyecto.

---

## Alcance propuesto

- Mostrar la cédula del cliente en listados, detalle y/o formularios relevantes.
- Mantener la validación de integridad definida para cédula y proyecto.
- Evitar registros duplicados según la regla de negocio acordada.
- Verificar que la experiencia de usuario sea clara al momento de registrar o consultar clientes.

---

## Criterios de aceptación

- [ ] La cédula se visualiza correctamente en la interfaz de clientes.
- [ ] El sistema bloquea duplicidades de acuerdo con la regla de negocio vigente.
- [ ] Los mensajes de validación son claros para el usuario.
- [ ] La funcionalidad no afecta registros existentes.

---

## Notas técnicas

- La cédula ya se muestra en la tabla actual — verificar que aparece en todos los contextos relevantes.
- Revisar que los mensajes de 409 (exclusividad activa) sean descriptivos y consistentes en todos los flujos.
- Depende de: TK-05 (captación), TK-06 (estatus)
