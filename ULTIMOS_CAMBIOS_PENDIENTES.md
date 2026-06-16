# Ultimos cambios pendientes

Documento para presentar al cliente los cambios pendientes de forma clara, agrupada y entendible.  
La idea es que cada punto describa que se hara, como se validara y que no se debe interpretar como parte del cambio.

Una vez aprobado este documento, cualquier solicitud adicional o cambio distinto a lo descrito aqui debera tratarse como un requerimiento nuevo.

## Sistema administrativo

### Dashboard

Nota de avance: estos cambios ya fueron desplegados y revisados en dev usando el proyecto "Vendedor x" (`B62DD967`). La validacion quedo documentada en `docs/informes/analisis-dashboard-dev-B62DD967.md`. El despliegue a produccion se realizara al final, cuando se completen y validen todos los pendientes de este documento.

- [x] Corregir los calculos de los reportes del dashboard administrativo.

  Se corregiran los reportes donde el sistema actualmente no esta calculando bien cantidades, agrupaciones o filtros. Esto incluye:

  - "Total de venta por piso": actualmente muestra 36, pero debe reflejar el total correcto de unidades no disponibles. El caso reportado indica 162 unidades.
  - "Total de ventas por metraje": deben aparecer los metrajes que actualmente faltan.
  - "Venta por Inmobiliaria": debe coincidir con el monto o total de unidades no disponibles.
  - "Rango Edad de Compradores": debe corregirse el calculo de edades, incluyendo el rango "<25".

  Para estos reportes, el dashboard contara como venta las unidades que esten como no disponibles. Se consideran no disponibles las unidades en procesos de separacion, contrato firmado, pagos atrasados, contra entrega y vendidas.

  No incluye crear reportes nuevos ni cambiar el diseno completo del dashboard.

- [x] Ajustar el reporte "Estatus de contratos Promesa de Venta".

  El reporte debe alimentarse de los estatus correctos:

  - "Cliente listo para contratos" debe salir del estatus "Separacion".
  - "Contrato firmado" debe salir del estatus "Contrato firmado".

  La correccion consiste en ajustar la fuente del calculo, no en crear nuevos estatus.

### Proyectos

- [x] Mantener el icono de comentario sin cambios funcionales.

  El icono indicado por el cliente es para visualizar el comentario. Esta funcion ya fue aclarada al cliente. Se cambio a un icono de mensaje mas claro, con tooltip explicito para ver el comentario interno, sin modificar la funcionalidad.

- [x] Corregir filtros por bloque o tipo para que no dependan de mayusculas o minusculas.

  Se normalizaran los caracteres usados en la busqueda. Por ejemplo, buscar "a" debe funcionar igual que buscar "A".

  Este mismo criterio aplicara tambien al modulo Proyecto del usuario inmobiliaria.

  Hecho: los filtros de unidad, tipo y manzana/bloque ahora se comparan sin depender de mayusculas/minusculas, y el frontend envia los filtros sin espacios sobrantes.

### Clientes

- [x] Validar y normalizar datos al crear o editar clientes.

  Se agregaran requisitos en el formulario para evitar datos mal ubicados o mal escritos:

  - El telefono solo debe aceptar numeros.
  - El telefono debe guardarse sin simbolos.
  - El correo debe tener formato de correo valido y dominio con punto, por ejemplo ".com".
  - Nombre y apellido deben guardarse en mayuscula.
  - La cedula solo debe aceptar numeros.
  - No debe aceptarse que el telefono se coloque en el campo correo ni que el correo se coloque en el campo telefono.

  Este cambio aplica a la validacion del formulario y al guardado de datos. No incluye limpieza masiva de clientes antiguos, salvo los casos necesarios para probar la correccion.

  Hecho: se agrego validacion y normalizacion en formularios de clientes, captacion publica/global, asignacion desde bloqueos y procesos. El frontend muestra el mensaje debajo de cada campo invalido y bloquea el guardado si nombres/apellidos tienen numeros o simbolos, si cedula o telefono tienen simbolos/letras, o si el correo no tiene formato valido con dominio con punto. El backend mantiene la validacion defensiva para rechazar datos invalidos y guarda nombres/apellidos en mayuscula.

- [x] Revisar el cliente de prueba dejado por el cliente.

  El caso reportado fue registrado con la cedula de otro cliente. Como las busquedas se hacen por cedula, aparece con el nombre del primer usuario creado con esa cedula. se informo de esto al cliente

  Revisado: no requiere cambio de sistema. Las busquedas usan el GSI de cedula; si se registra una prueba con la misma cedula de otro cliente, el sistema agrupa por esa cedula y puede mostrar el nombre del primer registro encontrado.

- [x] Permitir exportar clientes desde el apartado Clientes.

  La exportacion debe incluir clientes de captacion y clientes que tienen unidad. Esto es necesario para seguimiento comercial y para preparar bases de contacto que luego podran usarse en campanas de correo.

  La propuesta recomendada es organizar primero el apartado Clientes por proyecto. Al entrar, el usuario seleccionara un proyecto y luego vera los clientes relacionados con ese proyecto.

  Dentro del proyecto se mostrara el estatus del cliente. Si el cliente no tiene unidad asignada, se mostrara como "Sin unidad".

  En la pantalla del proyecto se mostrara el boton para exportar clientes en Excel. La exportacion generara un archivo con los clientes del proyecto seleccionado.

  La propuesta clara para cliente esta documentada en:

  - `docs/informes/propuesta-clientes-por-proyecto.md`

  La decision inicial con opciones, ventajas y desventajas queda documentada en:

  - `docs/informes/decision-exportacion-clientes.md`

  Clientes incluidos:

  - Clientes captados, aunque no tengan unidad asignada.
  - Clientes con procesos de venta.
  - Clientes con unidad vinculada.
  - Clientes que tengan mas de una unidad o proceso dentro del mismo proyecto saldran en una fila por cada unidad o proceso.

  Columnas propuestas:

  - Cedula.
  - Nombres.
  - Apellidos.
  - Correo.
  - Telefono.
  - Proyecto.
  - Inmobiliaria.
  - Unidad.
  - Estatus.
  - Nacionalidad.
  - Pais de residencia.

  Hecho: Clientes ahora inicia con seleccion de proyecto. Al entrar a un proyecto se muestran los clientes de ese proyecto con unidad y estatus; los clientes sin unidad aparecen con estatus "Sin unidad". El boton "Exportar clientes" descarga un Excel del proyecto con las columnas definidas.

- [ ] Crear modulo de campanias de correo.

  Este sera un modulo nuevo, separado de la exportacion de clientes.

  Alcance pendiente de definir:

  - Seleccionar destinatarios desde clientes exportables o filtros de clientes.
  - Crear y guardar plantillas de correo.
  - Enviar campanias a grupos de clientes.
  - Registrar historial de envios.
  - Validar correos disponibles, rebotados o no verificados.
  - Definir limites de envio y permisos por rol.

  Este punto no se implementara como parte de la exportacion de clientes. Se deja como tarea nueva para analizar y estimar por separado.


### Procesos

- [x] Validar notificaciones al bloquear unidad y al cambiar estatus.

  El envio de notificacion al bloquear unidad y el envio con la opcion "Solo administracion" ya fueron corregidos. El cliente debe verificar que los correos destinatarios esten correctamente configurados y verificados.

  Si el correo no esta verificado o el proveedor lo bloquea, eso no se considera error del sistema.

  Hecho: el envio de notificacion al bloquear unidad y el envio al cambiar estatus con la opcion "Solo administracion" quedan cerrados como corregidos. La validacion final depende de que los correos destinatarios esten correctamente configurados y verificados.

- [x] Mejorar el cambio de estatus para permitir correcciones controladas.

  El sistema actualmente permite moverse hacia atras de manera lineal. Se debe agregar una senal visual o indicador cuando el usuario este volviendo a un paso anterior.

  Esto cubre el caso donde por error se selecciona "Contrato firmado" y luego se necesita volver a "Separacion".

  No se cambiara el flujo a un sistema totalmente libre; se mantendra la logica del proceso, pero con una forma mas clara de corregir errores.

  Hecho: el modal de cambio de estatus ahora detecta cuando el usuario selecciona un estatus anterior dentro del flujo permitido y muestra una advertencia visual de "Correccion de estatus". La correccion sigue usando las transiciones permitidas y queda registrada en el historial del proceso.

### Migracion Excel y exclusividad

- [x] Agregar columnas de migracion y corregir calculo de exclusividad de clientes.

  La migracion debe soportar estas columnas:

  - Fecha de nacimiento.
  - Pais de residencia.
  - Pais de nacionalidad.
  - Fecha Bloqueo, cuando aplique.

  Si las columnas existen y tienen datos validos, el sistema debe cargarlas automaticamente.

  Si una fecha obligatoria falta, debe poder corregirse en la etapa de migracion o el sistema debe mostrar error antes de completar la carga.

  Para "Fecha Bloqueo":

  - Se guardara como dato historico del bloqueo.
  - Si se usa para calcular exclusividad, contara como fecha inicial de esos tres meses.
  - Si al importar se crea un bloqueo operativo nuevo, el tiempo activo del bloqueo se creara con la regla actual de 48 horas desde el momento de la importacion, no desde la fecha historica del Excel.

  La exclusividad del cliente debe durar tres meses.

  Reglas:

  - Si el cliente se importa por Excel, se usara la "Fecha Bloqueo" cargada en la migracion como fecha inicial de la exclusividad.
  - Si el cliente se registra directamente en el sistema, se tomara la fecha de registro.
  - Si el cliente se registra por captacion o bloqueo, se guardara la fecha correspondiente del registro o bloqueo.

  El caso de un cliente captado el 28 de mayo no debe aparecer vencido antes de cumplir tres meses.

  Hecho: la migracion reconoce y permite revisar fecha de nacimiento, pais de residencia, pais de nacionalidad y Fecha Bloqueo. Al confirmar, guarda los datos demograficos del cliente, calcula edad, usa Fecha Bloqueo como fecha historica para la exclusividad cuando exista, calcula vencimiento a tres meses y programa el vencimiento si la exclusividad sigue activa. Si la exclusividad historica ya esta vencida, el cliente se importa sin exclusividad activa. El bloqueo operativo creado por migracion usa 48 horas desde la importacion.

  Pendiente QA: probar con Excel real de migracion en dev.

### Usuarios

- [x] Ajustar permisos del usuario coordinador.

  El coordinador debe tener acceso a todo excepto:

  - Eliminar usuarios.
  - Cambiar rol de usuario.

  Estas restricciones deben aplicarse tanto en pantalla como en la validacion interna del sistema.

  Hecho: el coordinador puede acceder a las secciones administrativas habilitadas, pero no puede eliminar usuarios ni cambiar roles. La pantalla oculta/bloquea esas acciones y el backend tambien las rechaza si se intentan ejecutar directamente.

### Configuracion

- [x] Corregir formato de las notificaciones recibidas por correo.

  El cuerpo del correo recibido debe coincidir con el cuerpo configurado en el sistema.

  Si en la configuracion hay saltos de linea, el correo debe mostrar esos saltos de linea. No debe enviarse todo pegado en una sola linea cuando la plantilla tiene espacios o parrafos.

  Hecho: el envio de notificaciones ahora convierte los saltos de linea configurados en saltos visibles dentro del correo, manteniendo el formato de parrafos del mensaje.


## Usuario inmobiliarias

### Dashboard

- [ ] Agregar grafico basado en unidades bloqueadas, no disponibles y desvinculadas.

  El grafico debe considerar las unidades de la inmobiliaria que esten:

  - Bloqueadas.
  - No disponibles.
  - Desvinculadas.

  Actualmente, cuando en procesos se marca una unidad como desvinculada, el sistema la vuelve a poner como disponible. Por eso no existe todavia una forma real de contar unidades desvinculadas en inventario.

  Se propone agregar una opcion o estado llamado "Desvinculada de JAM" para representar una desvinculacion real. La opcion actual de desvincular se mantiene como esta si solo libera la unidad.

  Este punto requiere confirmacion antes de implementarse, porque cambia la forma en que el inventario identifica una unidad desvinculada.

### Proyecto

- [x] Corregir filtros por bloque o tipo para que no dependan de mayusculas o minusculas.

  Debe funcionar igual que en el sistema administrativo. Buscar con minuscula o mayuscula debe devolver los mismos resultados.

  Hecho: usa el mismo listado de unidades corregido que el modulo administrativo, por lo que las busquedas por unidad, tipo y manzana/bloque ya no dependen de mayusculas/minusculas.

- [ ] Crear link publico permanente de visualizacion de inventario por proyecto.

  Se generara un link permanente de solo lectura por proyecto, para compartir el inventario disponible con vendedores externos sin crearles usuarios en el sistema.

  El link se copiara desde el proyecto correspondiente y debe mostrar solo las unidades disponibles de ese proyecto. No debe permitir editar, bloquear, cambiar estatus, ver clientes, ver comentarios internos ni acceder a inventario de otros proyectos.

  El link permanecera activo mientras el proyecto exista y este activo en el sistema. Si mas adelante se requiere que el link sea revocable, tenga expiracion o requiera clave de acceso, eso se considerara un requerimiento adicional.

### Clientes

- [ ] No realizar cambio sobre "NaNd" si ya no aparece.

  El valor "NaNd" reportado en "Ver detalle" ya no aparece. Si vuelve a presentarse, se revisara con un caso reproducible.

### Proceso de venta

- [ ] Corregir visibilidad y permisos del icono de informacion.

  La inmobiliaria podra ver informacion solo de unidades con las cuales tiene procesos relacionados.

  Al seleccionar el icono de informacion, se deben mostrar los datos de la unidad. No se debe mostrar el comentario interno.

## Captacion / Registro de interes

URL de referencia: https://dcgjiswnwqab6.cloudfront.net/captura-global

- [ ] Agregar listas desplegables y validaciones para evitar datos inconsistentes.

  Se agregaran listas desplegables para campos como estado civil, pais de residencia y pais de nacionalidad. Esto evita registros duplicados o inconsistentes como "USA" y "Estados Unidos".

  Tambien se aplicaran estas validaciones:

  - Telefono solo con numeros y sin simbolos.
  - Nombre y apellido guardados en mayuscula.
  - Cedula/pasaporte sin guiones.
  - Cedula/pasaporte solo con letras y numeros.
  - Letras de cedula/pasaporte guardadas en mayuscula.

  Estas validaciones se aplicaran en todos los formularios donde se pueda crear un usuario o cliente, no solo en el formulario publico de captacion.

  No incluye validar legalmente documentos por pais ni limpiar toda la data historica ya registrada.

- [ ] Revisar cliente registrado por inmobiliaria que no aparece en administrativo.

  Todo cliente registrado desde captacion por una inmobiliaria debe ser visible para el usuario administrativo segun los permisos actuales del sistema.

  Si el problema ocurre por duplicidad de cedula/pasaporte, el sistema debe manejarlo de forma clara y no ocultar el registro sin explicacion.

- [ ] Corregir notificacion "Cliente Captado".

  La inmobiliaria debe recibir la notificacion "Cliente Captado" al registrar un cliente.

  Este envio depende de que el correo de la inmobiliaria este correctamente configurado y verificado.

## Pendientes por confirmar antes de implementar

- [ ] Formato y columnas exactas para exportacion de clientes.
- [ ] Roles que podran exportar clientes.
- [ ] Confirmar si se implementa el nuevo estado "Desvinculada de JAM".
- [ ] Definir si el link publico de inventario por proyecto sera permanente, revocable o con expiracion.
- [ ] Confirmar nombres exactos de estatus usados en base de datos y pantalla.

## Nota de alcance

Al aceptar este documento, el cliente aprueba el alcance descrito y no podra solicitar cambios adicionales sobre estos puntos como parte de la misma entrega.

Despues de la aprobacion solo se atenderan correcciones relacionadas directamente con lo aprobado, por ejemplo:

- Una notificacion incluida en este alcance no se envia.
- Un reporte corregido sigue calculando mal segun la regla definida aqui.
- Una validacion descrita en este documento no se aplica.
- Una importacion de Excel no carga una columna incluida en este alcance.
- El link de inventario aprobado no muestra las unidades disponibles correspondientes.

No se consideraran correcciones y deberan aprobarse como requerimientos nuevos:

- Cambiar una regla ya aprobada.
- Agregar reportes, columnas, filtros, permisos o estados no descritos.
- Cambiar diseno, estructura o flujo de pantallas fuera de lo indicado.
- Pedir limpieza historica masiva de datos.
- Agregar nuevas notificaciones o nuevos destinatarios no mencionados.
- Cambiar el comportamiento del link publico mas alla de ser permanente, de solo lectura y por proyecto.
