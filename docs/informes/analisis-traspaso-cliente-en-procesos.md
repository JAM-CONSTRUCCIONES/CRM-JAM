# Análisis para traspasar el cliente de un proceso

## Objetivo entendido

Agregar en **Procesos** una acción para cambiar el cliente asociado a una unidad/proceso sin alterar la inmobiliaria, el proyecto, la unidad ni el estado comercial alcanzado.

El cambio debe permitir:

- seleccionar un cliente ya registrado;
- crear un cliente nuevo y asignarlo;
- hacerlo desde un proceso en `captacion` cuya unidad todavía está bloqueada y tiene cliente;
- hacerlo en los estados posteriores, donde el proceso necesariamente ya tiene cliente;
- conservar el historial comercial del proceso.

En este documento, **traspasar cliente** significa reemplazar el cliente de un proceso específico. No significa transferir al cliente a otra inmobiliaria.

## Conclusión

La funcionalidad no existe actualmente.

Sí existe una transferencia de cliente **entre inmobiliarias**, implementada con `jam-transferir-cliente` y Step Functions, pero no es reutilizable directamente: elimina y recrea procesos, puede mover el cliente completo, modifica la inmobiliaria y recrea bloqueos con otras fechas. Ese comportamiento es distinto y demasiado amplio para este requerimiento.

La solución recomendada es crear una operación administrativa específica para **reasignar un solo proceso a otro cliente**, respaldada por una transacción de DynamoDB.

## Funcionamiento actual

### Bloqueos sin cliente

En `front/src/pages/procesos/ProcesosPage.tsx` ya existe el modal **Asignar cliente al bloqueo**.

Permite:

- seleccionar un cliente existente;
- registrar un cliente nuevo;
- llamar nuevamente a `POST /bloqueos`;
- actualizar `cliente_cedula` en inventario;
- crear o actualizar el cliente;
- crear el proceso en estado `captacion`.

Esta interfaz puede servir como referencia visual para el nuevo modal, pero el flujo backend actual sólo cubre un bloqueo que todavía no tiene cliente.

### Procesos con cliente

Los procesos se almacenan en `jam-procesos` con estas llaves:

```text
pk = PROCESO#{cedula}#{inmobiliaria_id}
sk = UNIDAD#{unidad_id}
```

También contienen:

- `cedula`;
- `proyecto_id`;
- `inmobiliaria_id`;
- `unidad_id`;
- `estado`;
- `historial`;
- fechas y banderas propias del estado.

Como la cédula está dentro de `pk`, reemplazar al cliente obliga a crear una llave nueva y eliminar la anterior. Un `UpdateItem` común no puede modificar una clave primaria.

La unidad en `jam-inventario` también puede contener:

```text
cliente_cedula
bloqueado_por
estado
fecha_bloqueo
fecha_liberacion
```

Por tanto, cambiar sólo el proceso dejaría datos inconsistentes.

### Clientes

Los clientes se almacenan por inmobiliaria y proyecto:

```text
pk = CLIENTE#{cedula}#{inmobiliaria_id}
sk = PROYECTO#{proyecto_id}
```

El mismo documento puede existir en diferentes inmobiliarias o proyectos. Para este traspaso, el cliente destino debe existir —o crearse— específicamente para la **misma inmobiliaria y el mismo proyecto del proceso**.

### Transferencia existente entre inmobiliarias

Actualmente existen:

- `front/src/services/clientes.service.ts::transferirClienteInmobiliaria`;
- `lambdas/jam-transferir-cliente/handler.py`;
- `jam-transferir-cliente-workflow`;
- `jam-iniciar-transferencia`;
- `POST /admin/clientes/{cedula}/proyecto/{proyecto_id}/transferir`.

Ese flujo:

- cambia la inmobiliaria;
- puede mover todos los procesos del cliente;
- elimina registros antes de recrearlos;
- libera y recrea bloqueos;
- reinicia fechas de bloqueo y exclusividad en algunos casos.

No debe utilizarse para cambiar únicamente el cliente de una unidad.

## Alcance funcional recomendado

### Dónde mostrar la acción

Agregar **Traspasar cliente** en las acciones de cada proceso visible para administración.

Estados recomendados:

- `captacion`;
- `reserva`;
- `separacion`;
- `pagos_atrasados`;
- `inicial`;
- `contra_entrega`;
- `vendida`.

Recomendación: no permitirlo inicialmente en `desvinculado`, porque ya no representa la relación vigente entre cliente y unidad. Si se necesita corregir registros históricos desvinculados, debería tratarse como una corrección administrativa separada.

En `captacion`, la acción aplica tanto si la unidad continúa bloqueada como si el proceso todavía existe sin bloqueo activo. Si la unidad está bloqueada, debe actualizarse también `cliente_cedula` en inventario sin reiniciar sus fechas.

### Modal propuesto

El modal puede reutilizar la experiencia del actual **Asignar cliente al bloqueo**:

1. Mostrar cliente actual, unidad, proyecto, inmobiliaria y estado.
2. Elegir:
   - **Cliente existente**.
   - **Nuevo cliente**.
3. Mostrar un resumen de confirmación:
   - cliente anterior;
   - cliente nuevo;
   - unidad;
   - estado que se conservará.
4. Solicitar una justificación obligatoria.
5. Confirmar explícitamente el traspaso.

### Clientes existentes

La búsqueda debe realizarse en backend y limitarse a:

- misma inmobiliaria;
- mismo proyecto;
- cliente distinto del actual.

No conviene copiar literalmente la carga actual del modal de bloqueo. Actualmente usa `getClientesAdmin` con límite predeterminado de 50, descarga una página y filtra en el navegador. Eso puede ocultar clientes cuando existen más de 50 registros.

Se recomienda usar la búsqueda administrativa existente o agregar una búsqueda específica paginada/autocompletable por nombre y cédula.

### Cliente nuevo

Debe reutilizar:

- normalización de nombres, documento, correo y teléfono;
- campos de catálogos;
- validación de fecha de nacimiento;
- cálculo de edad;
- reglas de exclusividad.

No se debe duplicar la lógica de validación en una Lambda nueva sin compartir helpers, porque actualmente ya hay implementaciones similares en captación, bloqueos y clientes.

## API propuesta

Para evitar aumentar la cantidad de recursos de API Gateway, se reutiliza el recurso administrativo de estatus con una acción explícita:

```http
PUT /admin/clientes/{cedula_actual}/proyecto/{proyecto_id}/unidad/{unidad_id}/estatus?accion=traspasar_cliente
```

Payload para cliente existente:

```json
{
  "inmobiliaria_id": "inmo-id",
  "tipo_destino": "existente",
  "cedula_destino": "12345678",
  "justificacion": "Corrección solicitada por administración"
}
```

Payload para cliente nuevo:

```json
{
  "inmobiliaria_id": "inmo-id",
  "tipo_destino": "nuevo",
  "cliente": {
    "cedula": "87654321",
    "nombres": "NOMBRE",
    "apellidos": "APELLIDO",
    "correo": "correo@ejemplo.com",
    "telefono": "70000000",
    "fecha_nacimiento": "1990-01-01",
    "estado_civil": "Soltero/a",
    "nacionalidad": "Boliviana",
    "pais_residencia": "Bolivia"
  },
  "justificacion": "Cambio de titular"
}
```

La respuesta debe ser síncrona. El frontend necesita saber si la operación terminó correctamente antes de recargar. Para un solo proceso no se justifica iniciar la Step Function existente.

## Operación backend requerida

### Validaciones previas

El backend debe comprobar:

1. usuario con rol administrativo, no sólo token Cognito válido;
2. existencia exacta del proceso origen;
3. coincidencia de proyecto, inmobiliaria y unidad;
4. estado permitido;
5. cliente destino diferente del actual;
6. existencia del cliente destino en el mismo proyecto e inmobiliaria, si es existente;
7. validez completa de datos, si es nuevo;
8. exclusividad con otra inmobiliaria;
9. que no exista ya otro proceso activo para la combinación cliente destino + unidad;
10. que la unidad no esté asociada a un tercero diferente al proceso que se está corrigiendo;
11. justificación no vacía.

### Escrituras

La reasignación debe ejecutarse con `TransactWriteItems`:

1. condición de que el proceso origen siga existiendo y conserve el cliente/estado esperado;
2. condición de que no exista la llave destino;
3. creación del cliente destino, sólo cuando corresponda;
4. creación del proceso destino copiando todos los campos del proceso origen;
5. adición de una entrada de auditoría;
6. actualización de `cliente_cedula` en inventario cuando el atributo corresponda a la relación vigente;
7. eliminación del proceso origen.

El proceso nuevo debe preservar:

- `estado`;
- `fecha_inicio`;
- `historial`;
- `fecha_separacion`;
- `pago_confirmado`;
- `alerta_separacion_vencida`;
- `unidad_nombre`;
- cualquier otro campo comercial que se agregue posteriormente.

Conviene copiar el documento completo y cambiar únicamente:

- `pk`;
- `cedula`;
- `actualizado_en`;
- datos explícitos de auditoría.

### Historial

El cambio debe quedar auditable con:

- cédula y nombre del cliente anterior;
- cédula y nombre del cliente nuevo;
- administrador;
- fecha;
- justificación;
- estado del proceso al momento del cambio.

El historial actual está orientado a cambios de estatus. Hay dos alternativas:

1. ampliar las entradas embebidas con `tipo: "traspaso_cliente"` y hacer que el drawer renderice ambos tipos;
2. crear un historial administrativo separado.

Para este alcance, la primera alternativa es más simple, siempre que `HistorialEstatusDrawer` se adapte para no asumir que todas las entradas tienen `estatus_anterior` y `estatus_nuevo`.

No se recomienda borrar el cliente anterior. Puede tener otros procesos, captaciones, exclusividad o trazabilidad dentro del mismo proyecto.

### Inventario y schedules

Si la unidad está `bloqueada`, se debe cambiar sólo `cliente_cedula`.

No se deben:

- reiniciar `fecha_bloqueo`;
- reiniciar `fecha_liberacion`;
- cambiar `bloqueado_por`;
- borrar o recrear schedules;
- generar un bloqueo nuevo.

Para estados con unidad `no_disponible` o `vendida`, puede existir todavía `cliente_cedula` por compatibilidad. Si existe y coincide con el cliente anterior, debe actualizarse; si contiene otro cliente, la transacción debe fallar para revisión manual.

La alerta de separación usa actualmente un nombre derivado de la cédula y la unidad. Si el proceso está en `separacion`, el traspaso también debe:

- eliminar el schedule construido con la cédula anterior;
- recrearlo con la cédula nueva;
- mantener el vencimiento original, no iniciar otros 30 días.

Este punto requiere recuperar o calcular la fecha de vencimiento desde `fecha_separacion`.

## Archivos que tendrían cambios

### Frontend

- `front/src/pages/procesos/ProcesosPage.tsx`
  - acción en tarjetas, filas y menú móvil;
  - estado y formulario del modal;
  - búsqueda de cliente existente;
  - formulario de cliente nuevo;
  - confirmación y recarga.
- `front/src/services/crm.service.ts`
  - método `traspasarClienteProceso`.
- `front/src/types/index.ts`
  - tipos del payload y entrada de historial de traspaso.
- `front/src/components/common/HistorialEstatusDrawer.tsx`
  - presentación del evento de cambio de cliente.

Recomendación adicional: extraer el selector/formulario existente de `ProcesosPage.tsx` a un componente compartido para no duplicar el modal de asignación.

### Backend

- `lambdas/jam-crm/handler.py`
  - nueva ruta.
- `lambdas/jam-crm/routes/estatus.py` o un archivo nuevo como `routes/traspaso_cliente.py`
  - validaciones y transacción.
- helpers de clientes
  - reutilización de normalización, creación y exclusividad.
- `infra/lib/jam-stack.ts`
  - ruta de API Gateway;
  - permisos adicionales sólo si la Lambda CRM no posee las escrituras necesarias.

No deberían modificarse `jam-transferir-cliente` ni su Step Function para esta funcionalidad.

## Riesgos encontrados

### Operación parcial

Hacer `put`, `update` y `delete` por separado puede dejar:

- dos procesos para una unidad;
- proceso con un cliente e inventario con otro;
- proceso eliminado si falla la creación destino.

Por eso la transacción es un requisito, no una optimización.

### Colisión de proceso destino

Si el cliente destino ya tiene un proceso sobre esa misma unidad, no se debe sobrescribir. Se debe responder `409 Conflict`.

### Exclusividad

Crear un cliente nuevo desde el modal puede chocar con una exclusividad activa en otra inmobiliaria. El backend debe rechazarlo antes de mover el proceso.

Para un cliente existente de la misma inmobiliaria/proyecto, no se debería reiniciar automáticamente su fecha de exclusividad.

### Alertas asociadas a la cédula

Los schedules de separación incluyen la cédula en el nombre y payload. Si no se migran, una alerta posterior buscará el proceso con la llave antigua.

### Paginación de clientes

La lista actual de clientes existentes puede quedar limitada a 50. El nuevo flujo necesita búsqueda remota o paginación completa.

### Autorización

API Gateway exige Cognito, pero la nueva operación debe validar expresamente el rol administrador dentro de la Lambda, porque es una corrección sensible.

### Transferencia sobre una venta cerrada

Permitir el cambio en `vendida` es útil para corregir al titular, pero tiene mayor impacto legal y de reporte. Se recomienda permitirlo sólo a administración, con advertencia reforzada y justificación obligatoria.

## Pruebas mínimas

1. Traspasar un proceso `captacion` con bloqueo a un cliente existente.
2. Confirmar que conserva las fechas y schedules del bloqueo.
3. Traspasar un proceso `reserva` a un cliente existente.
4. Traspasar un proceso `separacion` y verificar la migración de su alerta.
5. Traspasar a un cliente nuevo válido.
6. Rechazar un documento con exclusividad de otra inmobiliaria.
7. Rechazar el mismo cliente actual.
8. Rechazar un cliente destino que ya tenga esa unidad.
9. Simular concurrencia y comprobar que no queden dos procesos.
10. Verificar que el proceso conserva estado, fechas, banderas e historial.
11. Verificar que el cliente anterior y sus otros procesos no se eliminan.
12. Verificar el evento de auditoría en el drawer.
13. Verificar la operación en móvil y escritorio.
14. Verificar que una inmobiliaria no pueda invocar directamente la ruta.

## Decisiones de negocio pendientes

Antes de implementar conviene confirmar:

1. si `vendida` debe aceptar traspasos o sólo estados activos;
2. si `desvinculado` debe quedar completamente excluido;
3. si al crear un cliente nuevo se inicia una exclusividad de tres meses o se trata únicamente como corrección del titular;
4. si se debe enviar alguna notificación al cliente anterior, al nuevo o a la inmobiliaria;
5. si “Bloque P” se refiere al estado `captacion` con unidad bloqueada. No existe en el código un estado llamado literalmente `bloquep`.

## Orden sugerido de implementación

1. acordar las cinco decisiones de negocio anteriores;
2. extraer/reutilizar validaciones de clientes;
3. implementar endpoint y transacción;
4. manejar auditoría y schedule de separación;
5. agregar servicio y modal en Procesos;
6. ejecutar pruebas de integración y concurrencia;
7. desplegar primero en desarrollo y validar con casos reales antes de producción.
