# Convenciones de arquitectura frontend — JAM Construcciones

## Estructura de carpetas

```
front/src/
├── components/
│   ├── common/          # Componentes reutilizables entre páginas
│   └── <modulo>/        # Componentes específicos de un módulo
│       ├── Modal*.tsx
│       ├── Drawer*.tsx
│       └── Tabla*.tsx
├── constants/
│   └── estados.ts       # Constantes compartidas (colores, labels, gradientes)
├── hooks/
│   └── use*.ts          # Custom hooks con lógica de estado y efectos
├── pages/
│   └── <modulo>/
│       └── *Page.tsx    # Solo JSX de alto nivel + composición de componentes
└── services/
    └── *.service.ts     # Llamadas a la API
```

---

## Regla principal

**Las páginas no tienen lógica.** Solo componen componentes y usan hooks.

Una página bien estructurada tiene:
- Imports de hooks y componentes
- Llamadas al hook del módulo
- JSX que conecta todo

---

## Custom hooks

Cada módulo con estado complejo tiene su propio hook en `src/hooks/`:

| Hook | Módulo |
|------|--------|
| `useInventario` | InventarioPage |

El hook exporta: estado, setters, handlers y helpers.
El componente solo consume lo que necesita del hook.

---

## Componentes

Cada pieza visual reutilizable o compleja va en su propio archivo:

- `Modal*.tsx` — modales con formulario
- `Drawer*.tsx` — drawers con contenido
- `Tabla*.tsx` — tablas con columnas definidas

Los componentes reciben props tipadas, no acceden al estado global directamente.

---

## Constantes compartidas

`src/constants/estados.ts` contiene:
- `ESTADO_UNIDAD_CONFIG` — colores y labels de estados de unidad
- `ESTADO_PROCESO_COLOR` / `ESTADO_PROCESO_LABEL` — estados del proceso de venta
- `projectGradient()` — función de gradiente para cards de proyectos

**No duplicar estas constantes en los componentes.** Siempre importar desde `constants/`.

---

## Cuándo extraer un componente

Extraer cuando:
- El JSX tiene más de ~50 líneas
- La misma estructura se repite en más de un lugar
- El bloque tiene su propio estado interno (form, loading, etc.)

No extraer cuando:
- Es un bloque de 5-10 líneas sin estado propio
- Solo se usa en un lugar y es trivial

---

## Cuándo extraer un hook

Extraer cuando:
- El componente tiene más de 5 `useState`
- Hay lógica de `useEffect` + llamadas a API
- Los handlers son funciones async con try/catch

---

## Ejemplo aplicado — InventarioPage

Antes: ~400 líneas en un solo archivo
Después:

```
hooks/useInventario.ts          → todo el estado y lógica
components/inventario/
  TablaUnidades.tsx             → tabla con columnas
  DrawerEtapas.tsx              → drawer de gestión de etapas
  ModalUnidad.tsx               → modal crear/editar unidad
  ModalBloqueo.tsx              → modal de bloqueo con cliente
pages/inventario/InventarioPage.tsx  → ~120 líneas, solo composición
```
