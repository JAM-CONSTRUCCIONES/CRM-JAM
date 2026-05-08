# TK-15 - Implementar enlace único de captura externa de clientes con selector de inmobiliaria

**Referencia original:** TK-JAM-03
**Responsable:** Andres Alvarez
**Prioridad:** Alta
**Estado sugerido:** Pendiente
**Estimación:** 8 a 12 horas

---

## Objetivo

Crear un único enlace externo de captura de clientes que permita seleccionar la inmobiliaria correspondiente, facilitando el registro estandarizado sin depender de múltiples formularios o accesos separados.

---

## Alcance propuesto

- Diseñar formulario público o externo para captura de clientes.
- Incluir selector obligatorio de inmobiliaria o agencia.
- Persistir la relación entre cliente, proyecto e inmobiliaria.
- Validar campos requeridos, incluyendo cédula, para evitar registros incompletos.

---

## Criterios de aceptación

- [ ] Existe un solo enlace funcional para la captura externa de clientes.
- [ ] El usuario debe seleccionar una inmobiliaria antes de completar el registro.
- [ ] La información se guarda correctamente en el sistema.
- [ ] El flujo funciona correctamente en desktop y móvil.

---

## Notas técnicas

- El endpoint público debe tener rate limiting para evitar abuso.
- No exponer datos internos (IDs, otras inmobiliarias).
- Aplicar la misma lógica de exclusividad que el flujo interno.
- Si el cliente ya tiene exclusividad activa, mostrar mensaje claro.
- URL propuesta: `https://app.jamconstrucciones.com/captura`
- Depende de: TK-05 (captación de clientes)
