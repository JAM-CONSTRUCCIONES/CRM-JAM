# Interfaz responsive

Los estilos compartidos están en `src/responsive.css`, cargados después de `index.css`.
Se conserva la identidad y los modos claro/oscuro del CRM. Migración Excel mantiene
su experiencia de escritorio; su ruta no recibe la clase `responsive-content`.

## Patrones

- Usar `ResponsiveTable` para listados que todavía no tengan tarjetas propias.
  Conserva el Table de Ant Design, sus acciones, paginación y callbacks. Bajo 768 px
  presenta cada fila como tarjeta, con etiquetas derivadas de los títulos de columna.
  Los títulos deben ser texto; los encabezados con filtros u ordenación siguen visibles.
- Conservar las tarjetas específicas de Inventario, Clientes, Procesos y Usuarios.
- `page-toolbar` permite que los controles de búsqueda ocupen una fila en móvil.
  `filter-toolbar` agrupa filtros con espaciado y controles de ancho completo.
- Usar `Col xs={24} sm={12}` (o `sm={8}`) en formularios, en lugar de columnas fijas.
  `detail-grid` apila los detalles de cliente en móvil.
- Los modales limitan su altura al viewport y desplazan el cuerpo; cabecera y botones
  permanecen accesibles. Ant Design 6 usa `.ant-modal-container`; se contempla también
  `.ant-modal-content` para los estilos anteriores.
- Inbox muestra lista o conversación por debajo de 1024 px, con botón para volver.
  El panel de detalles se superpone hasta 1280 px. Se usa `dvh` para la altura disponible.

## Verificación local (21 de octubre de 2026)

`npm run build` valida TypeScript y genera el frontend de desarrollo.
Se revisaron con Edge headless y datos ficticios locales 13 rutas a 360, 820 y 1440 px:
Dashboard, Inventario, Clientes, Procesos, Inmobiliarias, Usuarios, Notificaciones,
Campañas, Formularios Meta, Leads Meta, Inbox, Agenda y Reportes (pantalla existente).
No se detectó desbordamiento horizontal ni excepciones JavaScript en esas vistas.

También se revisaron conversación, detalle de formulario, navegación móvil, modo oscuro
y un formulario de tarea a 360 × 640 px: el modal queda dentro del viewport, con botones
visibles y campos desplazables. Los datos y la sesión de prueba se inyectaron únicamente
en el navegador de verificación; no hay bypass de autenticación en el código de la app.

Estas comprobaciones no sustituyen pruebas en dispositivos físicos, Safari/iOS,
teclado virtual ni operaciones con datos reales. Al extender pantallas, verificar además
formularios con errores, listas largas, permisos y acciones desde sus tarjetas móviles.
