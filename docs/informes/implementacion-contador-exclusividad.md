# Implementación: Contador Visual de Exclusividad

## 📋 Resumen

Se implementó un **contador visual de exclusividad** en la vista de clientes que muestra de forma clara y visual:

1. **Tiempo restante** de exclusividad (en días)
2. **Inmobiliaria** que tiene la exclusividad
3. **Proyecto** donde aplica la exclusividad
4. **Indicadores visuales** con colores según el tiempo restante

## 🎯 Objetivo

Permitir al admin y a las inmobiliarias ver de un vistazo:
- Cuánto tiempo queda de exclusividad para cada cliente
- Con qué inmobiliaria tiene exclusividad
- En qué proyecto(s) está registrado
- Alertas visuales cuando la exclusividad está próxima a vencer

## ✅ Características Implementadas

### 1. Sistema de Colores Inteligente

```typescript
// Verde: Más de 30 días restantes
// Azul: Entre 16-30 días
// Naranja: Entre 1-15 días (próxima a vencer)
// Rojo: Vencida (0 días o menos)
```

### 2. Componentes Visuales

**Tags con contador:**
- ✅ Icono de reloj (`ClockCircleOutlined`)
- ✅ Días restantes (ej: "23 días")
- ✅ Color dinámico según tiempo restante
- ✅ Tooltip con fecha exacta de vencimiento

**Barra de progreso:**
- ✅ Muestra porcentaje del tiempo transcurrido (de 90 días)
- ✅ Color sincronizado con el tag
- ✅ Formato compacto para espacios reducidos

### 3. Vistas Mejoradas

#### Vista de Tabla (Desktop)
- Columna "Exclusividad" con tag colorido
- Tooltip al pasar el mouse con fecha exacta
- Formato: "X día(s)" con icono de reloj

#### Vista de Cards (Móvil)
- Tags en cada proyecto con días restantes
- Formato compacto: "Proyecto (Xd)"
- Tooltip con información completa

#### Modal de Detalle (Admin)
- Card por cada registro (proyecto + inmobiliaria)
- Barra de progreso visual
- Información de inmobiliaria con icono
- Fecha de vencimiento visible

#### Modal de Detalle (Inmobiliaria)
- Tag con días restantes
- Barra de progreso horizontal
- Fecha de vencimiento

## 🎨 Ejemplos Visuales

### Tag de Exclusividad

```
🟢 [⏰ 45 días]        → Verde (más de 30 días)
🔵 [⏰ 25 días]        → Azul (16-30 días)
🟠 [⏰ 10 días]        → Naranja (1-15 días, alerta)
🔴 [⏰ Vencida]        → Rojo (0 días o menos)
```

### Card de Registro (Modal Admin)

```
┌─────────────────────────────────────────┐
│ Proyecto López VII          [⏰ 23 días] │
│ 🏢 Inmobiliaria XYZ         ▓▓▓▓▓░░░░░  │
│                             Vence: 15/06 │
├─────────────────────────────────────────┤
│ Procesos de venta                       │
│ ...                                     │
└─────────────────────────────────────────┘
```

## 📝 Funciones Auxiliares

### `calcularDiasRestantes(fechaVencimiento: string): number`
Calcula los días restantes hasta el vencimiento de la exclusividad.

```typescript
const diasRestantes = calcularDiasRestantes(cliente.fecha_vencimiento);
// Retorna: número de días (puede ser negativo si ya venció)
```

### `getColorExclusividad(dias: number): string`
Retorna el color apropiado según los días restantes.

```typescript
const color = getColorExclusividad(diasRestantes);
// Retorna: '#52c41a' | '#1677ff' | '#faad14' | '#ff4d4f'
```

## 🔄 Lógica de Cálculo

**Días restantes:**
```typescript
const ahora = new Date();
const vencimiento = new Date(fechaVencimiento);
const diff = vencimiento.getTime() - ahora.getTime();
const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
```

**Porcentaje de progreso:**
```typescript
// Exclusividad es de 90 días
const porcentaje = Math.max(0, Math.min(100, (diasRestantes / 90) * 100));
```

## 🎯 Casos de Uso

### Para el Admin:
1. **Vista rápida**: Ver todos los clientes y su estado de exclusividad
2. **Identificar urgencias**: Clientes con exclusividad próxima a vencer (naranja/rojo)
3. **Gestión proactiva**: Contactar inmobiliarias antes del vencimiento
4. **Auditoría**: Ver qué inmobiliaria tiene exclusividad en cada proyecto

### Para la Inmobiliaria:
1. **Seguimiento**: Ver cuánto tiempo queda para cada cliente
2. **Planificación**: Priorizar clientes según tiempo restante
3. **Renovación**: Identificar clientes que necesitan seguimiento urgente

## 📊 Mejoras de UX

✅ **Información a primera vista**: No necesitas abrir detalles para ver el estado  
✅ **Colores intuitivos**: Verde = bien, Naranja = atención, Rojo = urgente  
✅ **Tooltips informativos**: Fecha exacta al pasar el mouse  
✅ **Responsive**: Funciona en móvil y desktop  
✅ **Consistente**: Mismo sistema de colores en todas las vistas  

## 🚀 Impacto

**Antes:**
- Solo se veía "Activa" o "Vencida"
- No se sabía cuánto tiempo quedaba
- Difícil identificar urgencias

**Después:**
- Contador en días visible
- Colores indican urgencia
- Fácil priorizar acciones
- Información completa (inmobiliaria + proyecto)

## 📚 Archivos Modificados

```
front/src/pages/clientes/ClientesPage.tsx
```

**Cambios:**
- Agregadas funciones `calcularDiasRestantes` y `getColorExclusividad`
- Importado `Progress` y `ClockCircleOutlined` de Ant Design
- Actualizada columna "Exclusividad" en tabla
- Mejorados cards móviles con contador
- Mejorados modales de detalle con barra de progreso

## 🧪 Testing Sugerido

1. Ver cliente con exclusividad > 30 días (debe ser verde)
2. Ver cliente con exclusividad 15-30 días (debe ser azul)
3. Ver cliente con exclusividad < 15 días (debe ser naranja)
4. Ver cliente con exclusividad vencida (debe ser rojo)
5. Verificar tooltip con fecha exacta
6. Verificar barra de progreso en modal
7. Verificar vista móvil con tags compactos

## ✅ Completado

- ✅ Crear procesos manualmente (con privilegios admin)
- ✅ Contador de exclusividad visible
- ⏳ Botón eliminar cliente en interfaz

¿Continuamos con la eliminación de clientes?
