# QA: ultimos cambios pendientes

## Ambiente

- Ambiente: dev
- URL: `https://d12nm0khvt8zd9.cloudfront.net`
- Ultimo deploy dev revisado: migracion Excel, exclusividad, catalogos de clientes, validaciones, exportacion de clientes, permisos y notificaciones.

## Estados

- `Listo para QA`: ya fue implementado o ajustado en dev y debe probarse.
- `Pendiente de implementar`: todavia falta desarrollo.
- `Pendiente de confirmar`: falta aprobacion o definicion antes de desarrollar.
- `No requiere cambio`: se reviso y no se hara cambio de sistema.
- `Listo para revision documental`: no es funcionalidad implementada, pero el texto/propuesta ya puede revisarse con el cliente.

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

### Proyectos

- [ ] `Listo para QA` Icono de comentario interno.

  Probar:

  - [ ] El icono abre o muestra el comentario.
  - [ ] El tooltip indica que es comentario interno.
  - [ ] No cambia la funcion original.

- [ ] `Listo para QA` Filtros por bloque/tipo sin depender de mayusculas.

  Probar:

  - [ ] Buscar `a` devuelve lo mismo que `A`.
  - [ ] Buscar tipo con minuscula devuelve resultado aunque este guardado con mayuscula.
  - [ ] Aplica en administrativo.
  - [ ] Aplica en usuario inmobiliaria.

### Clientes

- [ ] `Listo para QA` Validar y normalizar datos al crear o editar clientes.

  Probar:

  - [ ] Telefono solo permite numeros.
  - [ ] Telefono con letras no guarda.
  - [ ] Telefono con simbolos no guarda.
  - [ ] Cedula solo permite numeros.
  - [ ] Cedula con guiones no guarda.
  - [ ] Correo sin dominio con punto no guarda.
  - [ ] Nombre con numeros no guarda.
  - [ ] Apellido con simbolos no guarda.
  - [ ] Nombre y apellido se guardan en mayuscula.
  - [ ] Los mensajes aparecen debajo del campo invalido.
  - [ ] Si hay dos errores, se ven ambos en sus campos correspondientes.

- [ ] `Listo para QA` Catalogos de estado civil, nacionalidad y pais de residencia.

  Probar en:

  - [ ] Captacion global.
  - [ ] Captacion por inmobiliaria.
  - [ ] Clientes.
  - [ ] Procesos.
  - [ ] Bloqueos.
  - [ ] Crear bloqueo manual desde inventario.

  Validar:

  - [ ] Estado civil es lista seleccionable.
  - [ ] Nacionalidad es lista seleccionable.
  - [ ] Pais de residencia es lista seleccionable.
  - [ ] No se puede escribir texto libre como `USA`, `23`, `RD` o `Dominicanooo`.
  - [ ] Backend rechaza valores fuera del catalogo si se mandan directo por API.
  - [ ] Dashboard agrupa por valores consistentes.

- [ ] `No requiere cambio` Cliente de prueba con cedula repetida.

  Validar:

  - [ ] El comportamiento fue aclarado.
  - [ ] No se implementa cambio de sistema.

- [ ] `Listo para QA` Clientes por proyecto y exportacion.

  Probar:

  - [ ] Clientes inicia con seleccion de proyecto.
  - [ ] Al seleccionar proyecto se muestran clientes del proyecto.
  - [ ] Clientes sin unidad aparecen con estatus `Sin unidad`.
  - [ ] Clientes con varias unidades/procesos aparecen por unidad/proceso.
  - [ ] Boton exportar clientes descarga Excel.
  - [ ] Excel incluye cedula, nombres, apellidos, correo, telefono, proyecto, inmobiliaria, unidad, estatus, nacionalidad y pais de residencia.

- [ ] `Listo para QA` Modulo de campanias de correo.

  Probar:

  - [ ] El menu muestra `Campanias` para administrador.
  - [ ] El menu muestra `Campanias` para coordinador.
  - [ ] El menu muestra `Campanias` para supervisor.
  - [ ] Seleccionar proyecto carga destinatarios de ese proyecto.
  - [ ] Grupo `Clientes sin unidad` solo incluye clientes sin unidad.
  - [ ] Grupo `Clientes con unidad` solo incluye clientes con unidad.
  - [ ] Grupo `Todos` incluye ambos grupos.
  - [ ] Filtro por pais de residencia reduce destinatarios.
  - [ ] Filtro por nacionalidad reduce destinatarios.
  - [ ] Vista previa muestra total clientes, correos validos, sin correo e invalidos.
  - [ ] No permite enviar si no hay correos validos.
  - [ ] Permite guardar plantilla.
  - [ ] Permite reutilizar plantilla.
  - [ ] Permite colocar URL de imagen en el cuerpo del correo.
  - [ ] Envio manual envia correos a destinatarios validos.
  - [ ] Historial muestra campania enviada, fecha, usuario, grupo, enviados y omitidos.
  - [ ] Supervisor puede ver modulo e historial, pero no puede enviar.
  - [ ] Backend rechaza envio si el rol no es administrador o coordinador.

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

- [ ] `Listo para QA` Filtros por bloque/tipo sin depender de mayusculas.

  Probar:

  - [ ] Usuario inmobiliaria busca bloque con minuscula.
  - [ ] Usuario inmobiliaria busca bloque con mayuscula.
  - [ ] Resultados coinciden.
  - [ ] Mismo criterio para tipo.

- [ ] `Listo para revision documental` Link publico permanente de inventario por proyecto.

  Revisar propuesta con cliente:

  - [ ] El link sera por proyecto.
  - [ ] Se copiara desde el proyecto correspondiente.
  - [ ] Sera el mismo enlace para todos los vendedores externos.
  - [ ] Al abrir, mostrara directamente el inventario disponible del proyecto.
  - [ ] Mostrar mismas columnas que inventario del proyecto.
  - [ ] Mostrar solo unidades disponibles.
  - [ ] No mostrar acciones.
  - [ ] No permitir bloquear.
  - [ ] No mostrar clientes.
  - [ ] No mostrar comentarios internos.
  - [ ] No permitir editar ni cambiar estatus.
  - [ ] Permitir copiar link desde el proyecto en usuario JAM.
  - [ ] Permitir copiar link desde el proyecto en usuario inmobiliaria.

### Clientes

- [ ] `No requiere cambio` Valor "NaNd" si ya no aparece.

  Validar:

  - [ ] No aparece actualmente en "Ver detalle".
  - [ ] Si reaparece, se abre caso reproducible.

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

  - [ ] Estado civil como lista.
  - [ ] Pais de residencia como lista.
  - [ ] Nacionalidad como lista.
  - [ ] No permite escribir pais o nacionalidad como texto libre.
  - [ ] Telefono solo numeros.
  - [ ] Nombre/apellido en mayuscula.
  - [ ] Cedula numerica sin guiones.
  - [ ] Cedula con letras se rechaza mientras no se apruebe pasaporte alfanumerico.
  - [ ] Cedula con guiones se rechaza.

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

- [ ] Probar en dev despues del deploy `5911d12`.
- [ ] Registrar evidencias o capturas de los puntos listos para QA.
- [ ] Separar bugs reales de cambios nuevos de alcance.
- [ ] Confirmar pendientes que no se pueden probar porque aun no estan implementados.
- [ ] Cuando todo lo implementado pase QA, preparar lista para produccion.
