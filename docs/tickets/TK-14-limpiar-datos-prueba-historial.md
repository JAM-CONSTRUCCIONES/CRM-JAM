# TK-14 - Limpiar datos de prueba en historial de bloqueos

**Referencia original:** TK-JAM-02
**Responsable:** Andres Alvarez
**Prioridad:** Media
**Estado sugerido:** Pendiente
**Estimación:** 2 a 4 horas

---

## Objetivo

Depurar el historial de bloqueos eliminando registros de prueba o inconsistentes para que el entorno de demo y validación refleje únicamente información útil y confiable.

---

## Alcance propuesto

- Identificar registros de testing en la tabla de historial de bloqueos.
- Definir criterio de depuración segura antes de eliminar datos.
- Corregir valores incorrectos o huérfanos si aplica.
- Validar que la limpieza no afecte la trazabilidad funcional del módulo.

---

## Criterios de aceptación

- [ ] La tabla de historial ya no muestra datos de prueba irrelevantes.
- [ ] La información restante es coherente con bloqueos reales o válidos.
- [ ] No se afectan relaciones críticas ni la lógica de auditoría.
- [ ] La demo queda lista con datos limpios.

---

## Notas técnicas

- Crear script en `scripts/` que identifique registros de prueba por criterio (fechas anteriores al go-live, unidades inexistentes en inventario).
- Ejecutar primero en modo dry-run (solo listar, no eliminar) para validar.
- Hacer backup manual antes de ejecutar la limpieza.
- Depende de: TK-04 (bloqueos), TK-11 (backup)
