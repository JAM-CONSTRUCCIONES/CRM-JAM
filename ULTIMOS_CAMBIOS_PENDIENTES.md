# Ultimos cambios pendientes

Documento editable para consolidar pendientes, correcciones y mejoras solicitadas.

## Sistema administrativo

### Dashboard

- [ ] En el reporte "Total de venta por piso", revisar el total mostrado actualmente como 36. El total esperado de unidades no disponibles es 162, correspondientes a unidades reservadas.
se solucionara es un problema de que es sistema no esta haciendo bien los calculos 
- [ ] Completar los metrajes faltantes en el reporte "Total de ventas por metraje".
se solucionara es un problema de que es sistema no esta haciendo bien los calculos 
- [ ] Revisar el reporte "Estatus de contratos Promesa de Venta":
  - "Cliente listo para contratos" debe alimentarse del estatus "Separacion".
  - "Contrato firmado" debe alimentarse del estatus "Contrato firmado".
- [ ] El reporte "Venta por Inmobiliaria" debe coincidir con el monto de unidades no disponibles.
entonces en el dashboard contara como venta todas las unidades que esten dentro como no disponibles que son las que perenecen a los procesos separacion, contrato firmado pagos atrasados contra entrega y las unidades en vendidas

- [ ] Corregir el error en el rango de edad del reporte "Rango Edad de Compradores".
se solucionara es un problema de que es sistema no esta haciendo bien los calculos 

- [ ] Validar especificamente el rango menor de 25 anos: "<25".
se solucionara es un problema de que es sistema no esta haciendo bien los calculos 

### Proyectos

- [ ] Identificar y documentar la funcion del icono indicado por el cliente.
esto es para visualizar el comentario ya se dijo al cliente sin cambio 

- [ ] Corregir filtros por bloque o tipo para que funcionen aunque la letra ingresada este en minuscula.
se normalizara los caracteres en las busquedas 
### Clientes

- [ ] Al editar un cliente, validar correctamente los campos para evitar que telefono y correo puedan intercambiarse.
se pondra requisitons en el front para llenar el formulario, numero solo permite numeros y gmail necesita .com
- [ ] Guardar nombre y apellido en mayuscula. 
lo mismo se pondra requisitos, pero no se como xD
- [ ] Guardar telefono sin simbolos.
- [ ] Revisar el cliente de prueba dejado por el cliente para comprobar las validaciones.
se registro con la cedula de otro cliente, y las busquedas se hacen por cedula, aparece con el nombre del primer user creado 
- [ ] Permitir exportar el apartado de clientes.
- [ ] La exportacion debe incluir clientes de captacion y clientes con unidad.
- [ ] Considerar el caso de uso de campanas de correo para clientes que aun no han comprado.
veremos estas tres mas adelante como hacer 

### Inmobiliarias

- [ ] Revisar si hay pendientes especificos no detallados en esta seccion. nada

### Procesos

- [ ] Corregir envio de notificacion al bloquear una unidad. ya corregido el cliente debe ponerverificar el correo 
- [ ] Al cambiar el estatus de un cliente, deben mostrarse todas las opciones de estatus.  el sistema permite ir hacia atras de manera lineal falta agregar un senalizador a que se esta volviendo a un paso anterior 
- [ ] Permitir revertir cambios de estatus cuando se seleccione uno incorrecto, por ejemplo de "Contrato firmado" a "Separacion". lo mismo
- [ ] Corregir envio de notificaciones en cambio de estatus cuando se elige "Solo administracion".ya corregido el cliente debe ponerverificar el correo 

### Migracion Excel

- [ ] Agregar columna de fecha de nacimiento.
- [ ] Agregar columna de pais de residencia.
- [ ] Agregar columna de pais de nacionalidad.
- [ ] Al cargar el Excel, completar automaticamente esos datos si las columnas existen.

### Usuarios

- [ ] El usuario coordinador debe tener acceso a todo excepto:
  - Eliminar usuarios.
  - Cambiar rol de usuario.

### Configuracion

- [ ] Las notificaciones recibidas por correo deben coincidir con el cuerpo de correo configurado en el sistema. osea que hacepte espacio o que si en aparece como salto de linea aparesca el salto de linea en la notificacion no en la misma 
- [ ] Revisar diferencias entre el correo recibido y la plantilla configurada.

### Notificacion

- [ ] Revisar pendientes relacionados con notificaciones no detallados en esta seccion.

## Usuario inmobiliarias

### Dashboard

- [ ] Agregar grafico basado en el total de unidades bloqueadas no disponibles desvinculadas.
- [ ] El total debe considerar unidades:
  - Bloqueadas.
  - No disponibles.
  - Desvinculadas.

  actualmente cuando en procesos ponemos desvinculadas el sistema la pone como disponible no tenemos un flujo que la ponfa como desvinculada en inventario, como hacemos eso? 
yo diria que en procesos aunmentar una nueva celda que se llame descinculada de JAM para que esa desvincule de vrdd, la otra esta bien 

### Proyecto

- [ ] Corregir filtros por bloque o tipo para que funcionen aunque la letra ingresada este en minuscula.
- [ ] Generar un link de visibilidad dentro de la inmobiliaria para ver solo el inventario.
- [ ] El link debe poder compartirse con vendedores externos.
entonces link publico de visualizacion solo visualizacion que permita ver solo las unidades disponibles de la inmobiliria 

### Clientes

- [ ] Corregir el calculo de exclusividad.
- [ ] La exclusividad debe durar tres meses.
- [ ] Revisar caso de cliente captado el 28 de mayo que aparece como vencido.
- [ ] Si el cliente se sube por importacion Excel, la exclusividad debe tomar la fecha de la fila "Fecha Bloqueo". si no existe fecha de bloqueo sera editable en la parte de migracion, en caso de estar incompleto mandara error, fecha necesaria 
- [ ] Si el cliente se registra directamente en el sistema, la exclusividad debe tomar la fecha de registro.
- [ ] Registrar la fecha indicada en la celda "Fecha Bloqueo" al importar Excel. se registrara la fecha del bloqueo, pero no lo tomara para crear el tiempo de bloqueo, lo creara con 48 como si se hubiera hecho el bloqueo ese rato 
- [ ] Registrar la fecha cuando el cliente se crea por captacion o bloqueo. se registrara con la misma fecha de bloqueo, en migraciones, 
- [ ] En "Ver detalle", revisar el significado o error de las siglas "NaNd". ya no aparece

### Proceso de venta

- [ ] Corregir icono de informacion que no se visualiza. desde ahora la inmobiliairia podra ver las unidades con las cuales tiene procesos nada mas 
- [ ] Al seleccionar el icono de informacion, permitir ver los datos de la unidad.
- [ ] No mostrar el comentario en esa vista de informacion. las inmobiliarias no veran el comentario

### Captacion / Registro de interes

URL de referencia: https://dcgjiswnwqab6.cloudfront.net/captura-global

- [ ] Agregar listas desplegables para campos como estado civil y paises, evitando registros inconsistentes.
- [ ] Estandarizar paises para evitar variantes como "USA" y "Estados Unidos".
- [ ] Validar telefono para no aceptar simbolos.
- [ ] Guardar nombre y apellido en mayuscula.
- [ ] Validar cedula/pasaporte para no aceptar guiones.
- [ ] Cedula/pasaporte debe aceptar solo letras y numeros.
- [ ] Si cedula/pasaporte contiene letras, deben guardarse en mayuscula.
- [ ] Revisar ejemplo de cliente registrado por inmobiliaria que no se visualiza en el usuario administrativo.
- [ ] Corregir notificacion de captacion para que la inmobiliaria la reciba. falta que acepte la verificacion 
- [ ] La notificacion "Cliente Captado" debe enviarse a la inmobiliaria al registrar el cliente. aceptar verificacion 

## Pendientes por completar despues de revision

- [ ] Adjuntar o describir capturas faltantes donde el texto original menciona imagenes o mensajes de error.
- [ ] Priorizar pendientes criticos antes de implementacion.
- [ ] Confirmar nombres exactos de estatus usados en base de datos y UI.
- [ ] Confirmar permisos esperados para cada rol.
