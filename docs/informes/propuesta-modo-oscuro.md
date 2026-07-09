# Propuesta: modo visual oscuro

Se propone agregar una opcion de modo oscuro para mejorar la visualizacion del sistema en ambientes con poca luz y reducir fatiga visual.

## Ubicacion del control

El cambio de modo se colocara en la barra lateral del sistema, cerca de las opciones del usuario y el cierre de sesion.

Opciones visibles:

- Modo claro.
- Modo oscuro.

El sistema recordara la preferencia seleccionada por el usuario para que no tenga que cambiarla cada vez que ingrese.

## Paleta recomendada en palabras simples

La paleta debe mantener una apariencia profesional, clara y facil de leer.

- Fondo general: azul muy oscuro, casi negro.
- Fondos de tablas y secciones: gris azulado oscuro.
- Tarjetas, modales y paneles: gris oscuro un poco mas claro que el fondo.
- Bordes y divisores: gris azulado suave, visible pero discreto.
- Texto principal: blanco suave, no blanco puro para evitar cansancio visual.
- Texto secundario: gris claro.
- Texto deshabilitado: gris medio.
- Botones principales y acciones importantes: azul claro.
- Botones al pasar el mouse: azul un poco mas intenso.
- Mensajes de exito: verde.
- Advertencias: amarillo/naranja.
- Errores: rojo.
- Informacion: azul.

Referencia tecnica de colores:

- Fondo principal: `#0F172A`
- Fondo de secciones y tablas: `#111827`
- Tarjetas, modales y paneles: `#1F2937`
- Bordes y divisores: `#334155`
- Texto principal: `#F8FAFC`
- Texto secundario: `#CBD5E1`
- Texto deshabilitado: `#64748B`
- Acciones principales: `#38BDF8`
- Hover de acciones: `#0EA5E9`
- Exito: `#22C55E`
- Advertencia: `#F59E0B`
- Error: `#EF4444`
- Informacion: `#60A5FA`

## Graficos y tablas

Los graficos mantendran colores distinguibles en fondo oscuro:

- Azul claro para datos principales.
- Verde para datos positivos o disponibles.
- Naranja para advertencias o bloqueos.
- Rojo para errores, desvinculados o estados criticos.
- Morado para categorias adicionales.

Referencia tecnica:

- Azul claro: `#38BDF8`
- Verde: `#22C55E`
- Naranja: `#F59E0B`
- Rojo: `#EF4444`
- Morado: `#A78BFA`

Las tablas deben conservar buena lectura:

- Encabezados con fondo oscuro diferenciado.
- Filas con separacion sutil.
- Hover visible sin perder contraste.
- Textos y numeros siempre claros.

## Alcance

El modo oscuro aplicara a:

- Menu lateral.
- Barra superior.
- Pantallas principales.
- Formularios.
- Tablas.
- Modales.
- Botones.
- Graficos.
- Filtros.

Este cambio es solamente visual. No cambia permisos, calculos, datos, reportes ni flujos del sistema.

## Pendiente para implementar

Implementado: se agrego el selector visual en la barra lateral y se aplica la paleta de forma general en la interfaz.
