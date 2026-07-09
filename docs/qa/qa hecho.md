# QA: ultimos cambios pendientes

## Ambiente

- Ambiente: dev
- URL: `https://d12nm0khvt8zd9.cloudfront.net`
- Ultimo deploy dev disponible: `8807b92`.
- Incluye: migracion Excel, exclusividad, catalogos de clientes, validaciones, exportacion de clientes, permisos, notificaciones, campanias y link publico de inventario por proyecto.

## Estados

- `Listo para QA`: ya fue implementado o ajustado en dev y debe probarse.
- `Pendiente de implementar`: todavia falta desarrollo.
- `Pendiente de confirmar`: falta aprobacion o definicion antes de desarrollar.
- `No requiere cambio`: se reviso y no se hara cambio de sistema.
- `Listo para revision documental`: no es funcionalidad implementada, pero el texto/propuesta ya puede revisarse con el cliente.

---

## Orden sugerido para QA

1. Probar link publico de inventario por proyecto.
2. Probar modulo de campanias de correo.
3. Probar clientes por proyecto y exportacion.
4. Probar validaciones y catalogos de clientes/captacion.
5. Probar migracion Excel con archivo real.
6. Probar permisos de coordinador.
7. Probar notificaciones y formato de correo.
8. Probar dashboard/reportes.

No probar todavia como funcionalidad terminada:

- Grafico de inmobiliaria con unidades desvinculadas: pendiente de confirmacion.
- Icono de informacion en proceso de venta para inmobiliaria: pendiente de implementar.
- Pasaporte alfanumerico: pendiente de definicion.
- Cliente captado que no aparece en administrativo: pendiente de revisar con caso real.
- Notificacion `Cliente Captado`: pendiente de revisar con caso real y correo verificado.

---

## Sistema Administrativo

### Dashboard

- [ ] `Listo para QA` Corregir calculos de reportes del dashboard administrativo.

  Probar:

  - [ ] Total de venta por piso cuenta unidades no disponibles.
  - [ ] Total de ventas por metraje muestra todos los metrajes esperados.
  - [ ] Venta por inmobiliaria coincide con unidades no disponibles.
  - [ ] Rango edad de compradores calcula edades correctamente.
  - [ ] Rango `<25` aparece cuando corresponde.

- [ ] `Listo para QA` Ajustar reporte "Estatus de contratos Promesa de Venta".

  Probar:

  - [ ] "Cliente listo para contrato" sale de estatus `Separacion`.
  - [ ] "Contrato firmado" sale de estatus `Contrato firmado`.
  - [ ] No se crearon estatus nuevos.


### Clientes

- [ ] `Listo para QA` Validar y normalizar datos al crear o editar clientes.

  Probar:

  - [x] Telefono solo permite numeros.
  - [x] Telefono con letras no guarda.
  - [x] Telefono con simbolos no guarda.
  - [x] Cedula solo permite numeros.
  - [x] Cedula con guiones no guarda.
  - [x] Correo sin dominio con punto no guarda.
  - [x] Nombre con numeros no guarda.
  - [x] Apellido con simbolos no guarda.
  - [x] Nombre y apellido se guardan en mayuscula.
  - [x] Los mensajes aparecen debajo del campo invalido.
  - [x] Si hay dos errores, se ven ambos en sus campos correspondientes.

- [x] `Listo para QA` Catalogos de estado civil, nacionalidad y pais de residencia.

  Probar en:
### Proyectos

- [x] `Listo para QA` Icono de comentario interno.

  Probar:

  - [x] El icono abre o muestra el comentario.
  - [x] El tooltip indica que es comentario interno.
  - [x] No cambia la funcion original.

- [x] `Listo para QA` Filtros por bloque/tipo sin depender de mayusculas.

  Probar:

  - [x] Buscar `a` devuelve lo mismo que `A`.
  - [x] Buscar tipo con minuscula devuelve resultado aunque este guardado con mayuscula.
  - [x] Aplica en administrativo.
  - [x] Aplica en usuario inmobiliaria.

  - [x] Captacion global.
  - [x] Captacion por inmobiliaria.
  - [x] Clientes.
  - [x] Procesos.
  - [x] Bloqueos.
  - [x] Crear bloqueo manual desde inventario.
  - [x] migraciones 
  Validar:

  - [x] Estado civil es lista seleccionable.
  - [x] Nacionalidad es lista seleccionable.
  - [x] Pais de residencia es lista seleccionable.
  - [x] No se puede escribir texto libre como `USA`, `23`, `RD` o `Dominicanooo`.
  - [x] Backend rechaza valores fuera del catalogo si se mandan directo por API.
  - [x] Dashboard agrupa por valores consistentes.

- [x ] `No requiere cambio` Cliente de prueba con cedula repetida.
  Validar:

  - [x] El comportamiento fue aclarado.
  - [x] No se implementa cambio de sistema.

- [x] `Listo para QA` Clientes por proyecto y exportacion.

  Probar:

  - [x] Clientes inicia con seleccion de proyecto.
  - [x] Al seleccionar proyecto se muestran clientes del proyecto.
  - [x] Clientes sin unidad aparecen con estatus `Sin unidad`.
  - [x] Clientes con varias unidades/procesos aparecen por unidad/proceso.
  - [x] Boton exportar clientes descarga Excel.
  - [x] Excel incluye cedula, nombres, apellidos, correo, telefono, proyecto, inmobiliaria, unidad, estatus, nacionalidad y pais de residencia.

- [ ] `Listo para QA` Modulo de campanias de correo.

  Probar:

  - [x] El menu muestra `Campanias` para administrador.
  - [ ] El menu muestra `Campanias` para coordinador.
  - [ ] El menu muestra `Campanias` para supervisor.
  - [x] Al entrar al modulo se muestran las plantillas como tarjetas.
  - [x] Se puede iniciar una campania nueva desde plantilla en blanco.
  - [x] Se puede seleccionar una plantilla existente y cargar su titulo, descripcion, asunto y mensaje.
  - [x] Desde una plantilla existente se puede guardar cambios en la misma plantilla.
  - [x] Desde una plantilla existente se puede crear una nueva plantilla.
  - [x] El proyecto se selecciona dentro del envio, no antes de entrar al modulo.
  - [x] Seleccionar proyecto permite calcular destinatarios de ese proyecto.
  - [ ] Grupo `Clientes sin unidad` incluye clientes sin unidad actual y procesos desvinculados.
  - [ ] Grupo `Clientes con unidad` no incluye procesos desvinculados.
  - [x] No aparece grupo `Todos`.
  - [x] Filtro por pais de residencia reduce destinatarios.
  - [x] Filtro por nacionalidad reduce destinatarios.
  - [x] Los filtros de grupo, pais de residencia y nacionalidad se combinan entre si.
  - [x] Si un cliente aparece dos veces en la seleccion, queda dos veces como destinatario.
  - [x] Vista previa muestra el asunto y cuerpo del correo.
  - [x] Resumen del envio muestra total clientes, correos validos, sin correo e invalidos.
  - [ ] No permite enviar si no hay correos validos.
  - [x] Permite subir imagen JPG, PNG o WEBP.
  - [ ] Rechaza imagen con formato no permitido.
  - [ ] Rechaza imagen mayor a 5 MB.
  - [x] La imagen subida se inserta dentro del mensaje.
  - [x] El correo recibido muestra la imagen en la posicion insertada.
  - [x] Envio manual envia correos a destinatarios validos.
  - [x] Historial muestra titulo, descripcion, proyecto, fecha, usuario, grupo, clientes seleccionados, enviados y omitidos.
  - [x] Historial no muestra el cuerpo completo del correo.
  - [ ] Supervisor puede ver modulo e historial, pero no puede enviar.
  - [ ] Supervisor no puede guardar cambios ni crear nueva plantilla.
  - [ ] Backend rechaza envio si el rol no es administrador o coordinador.
  - [ ] Backend rechaza subida de imagen si el rol no es administrador o coordinador.

### Procesos

- [ ] `Listo para QA` Notificaciones al bloquear unidad y al cambiar estatus.

  Probar:

  - [ ] Bloquear unidad envia notificacion.
  - [ ] Cambiar estatus con "Solo administracion" envia a administracion.
  - [ ] Correos destinatarios deben estar configurados y verificados.

- [ ] `Listo para QA` Correccion controlada al volver a estatus anterior.

  Probar:

  - [ ] Seleccionar un estatus anterior dentro del flujo permitido.
  - [ ] Se muestra advertencia visual de correccion.
  - [ ] La correccion queda registrada en historial.
  - [ ] No se libera el flujo a cualquier estatus.

notas: no creo tiempo de bloqueo al volver a paso anterior , 
### Migracion Excel y exclusividad

- [ ] `Listo para QA` Nuevas columnas de migracion y exclusividad.

  Preparar Excel de prueba con al menos tres filas: una disponible sin cliente, una bloqueada con Fecha Bloqueo reciente y cliente, y una bloqueada con Fecha Bloqueo antigua y cliente.

  - [ ] Excel con fecha de nacimiento aparece en preview.
  - [ ] Excel con pais de residencia aparece en preview.
  - [ ] Excel con pais de nacionalidad aparece en preview.
  - [ ] Excel con Fecha Bloqueo aparece en preview.
  - [ ] Las columnas nuevas se pueden corregir antes de confirmar.
  - [ ] Al confirmar, el cliente guarda fecha de nacimiento, pais de residencia y nacionalidad.
  - [ ] La edad se calcula desde fecha de nacimiento.
  - [ ] Fecha Bloqueo se guarda como fecha historica.
  - [ ] Cliente importado con Fecha Bloqueo reciente queda con exclusividad activa.
  - [ ] Cliente importado con Fecha Bloqueo antigua queda sin exclusividad activa si ya vencio.
  - [ ] Cliente importado sin Fecha Bloqueo usa la fecha de importacion.
  - [ ] Bloqueo operativo creado por migracion vence a 48 horas desde la importacion.
  - [ ] Fecha Bloqueo historica no cambia la liberacion operativa del bloqueo.
  - [ ] Fecha invalida en fecha de nacimiento bloquea confirmacion.
  - [ ] Fecha invalida en Fecha Bloqueo bloquea confirmacion.
  - [ ] La migracion termina sin errores con un Excel valido.

### Usuarios

- [ ] `Listo para QA` Permisos del coordinador.

  Probar con usuario coordinador:

  - [ ] Puede acceder a secciones administrativas habilitadas.
  - [ ] No ve o no puede usar eliminar usuario.
  - [ ] No ve o no puede cambiar rol.
  - [ ] Backend rechaza eliminar usuario si se intenta directo.
  - [ ] Backend rechaza cambiar rol si se intenta directo.

### Configuracion

- [ ] `Listo para QA` Formato de notificaciones por correo.

  Probar:

  - [ ] Configurar plantilla con salto de linea.
  - [ ] Configurar plantilla con parrafo separado.
  - [ ] Enviar notificacion.
  - [ ] Correo recibido conserva saltos de linea.
  - [ ] Variables de plantilla siguen funcionando.

---

## Usuario Inmobiliaria

### Dashboard

- [ ] `Pendiente de confirmar` Grafico basado en unidades bloqueadas, no disponibles y desvinculadas.

  Pendiente:

  - [ ] Confirmar si se creara estado `Desvinculada de JAM`.
  - [ ] Definir si desvincular debe liberar unidad o marcarla como desvinculada real.
  - [ ] Implementar grafico cuando la regla este aprobada.

### Proyecto

- [x] `Listo para QA` Filtros por bloque/tipo sin depender de mayusculas.

  Probar:

  - [x] Usuario inmobiliaria busca bloque con minuscula.
  - [x] Usuario inmobiliaria busca bloque con mayuscula.
  - [x] Resultados coinciden.
  - [x] Mismo criterio para tipo.

- [x] `Listo para QA` Link publico permanente de inventario por proyecto.

  Probar:

  - [x] El proyecto muestra el boton `Copiar link de inventario`.
  - [x] El link copiado abre sin iniciar sesion.
  - [x] El link abre directamente el inventario disponible del proyecto.
  - [x] El mismo enlace funciona para cualquier vendedor externo.
  - [x] Mostrar mismas columnas que inventario del proyecto.
  - [x] Mostrar solo unidades disponibles.
  - [x] Unidades bloqueadas no aparecen.
  - [x] Unidades no disponibles no aparecen.
  - [x] Unidades vendidas no aparecen.
  - [x] No mostrar acciones.
  - [x] No permitir bloquear.
  - [x] No mostrar clientes.
  - [x] No mostrar comentarios internos.
  - [x] No permitir editar ni cambiar estatus.
  - [x] Filtro por etapa funciona.
  - [x] Filtro por unidad funciona.
  - [x] Filtro por tipo funciona sin depender de mayusculas/minusculas.
  - [x] Filtro por bloque/manzana funciona sin depender de mayusculas/minusculas.
  - [x] Filtro por piso funciona.
  - [ ] El backend no devuelve cliente, cedula, correo, telefono, comentario interno, bloqueado_por ni fechas internas.
  - [x] Permite copiar link desde el proyecto en usuario JAM.
  - [x] Permite copiar link desde el proyecto en usuario inmobiliaria.

### Clientes

- [x] `No requiere cambio` Valor "NaNd" si ya no aparece.

  Validar:

  - [x] No aparece actualmente en "Ver detalle".
  - [x] Si reaparece, se abre caso reproducible.

### Proceso de Venta

- [ ] `Pendiente de implementar` Icono de informacion.

  Pendiente:

  - [ ] Inmobiliaria solo ve informacion de unidades con procesos relacionados.
  - [ ] Icono muestra datos de unidad.
  - [ ] Icono no muestra comentario interno.
  - [ ] Backend valida permiso, no solo pantalla.

---

## Captacion / Registro de Interes

- [ ] `Listo para QA` Listas desplegables y validaciones.

  Probar:

  - [x] Estado civil como lista.
  - [x] Pais de residencia como lista.
  - [x] Nacionalidad como lista.
  - [x] No permite escribir pais o nacionalidad como texto libre.
  - [x] Telefono solo numeros.
  - [x] Nombre/apellido en mayuscula.
  - [x] Cedula numerica sin guiones.
  - [x] Cedula con letras se rechaza mientras no se apruebe pasaporte alfanumerico.
  - [x] Cedula con guiones se rechaza.

  Nota QA:

  - [ ] Revisar alcance final de cedula/pasaporte: si se requiere pasaporte alfanumerico, falta aprobar y desarrollar esa regla.

- [ ] `Pendiente de revisar` Cliente registrado por inmobiliaria que no aparece en administrativo.

  Probar:

  - [ ] Registrar cliente desde captacion por inmobiliaria.
  - [ ] Buscarlo desde administrativo.
  - [ ] Si no aparece, revisar duplicidad de cedula/pasaporte.
  - [ ] Confirmar que el sistema no oculta registros sin explicacion.

- [ ] `Pendiente de revisar` Notificacion "Cliente Captado".

  Probar:

  - [ ] Registrar cliente desde captacion.
  - [ ] Verificar que la inmobiliaria recibe correo.
  - [ ] Confirmar que el correo de la inmobiliaria esta configurado.
  - [ ] Confirmar que el correo esta verificado.

---



## Checklist De Cierre QA

- [ ] Probar en dev despues del deploy `8807b92`.
- [ ] Registrar evidencias o capturas de los puntos listos para QA.
- [ ] Separar bugs reales de cambios nuevos de alcance.
- [ ] Confirmar pendientes que no se pueden probar porque aun no estan implementados.
- [ ] Cuando todo lo implementado pase QA, preparar lista para produccion.


