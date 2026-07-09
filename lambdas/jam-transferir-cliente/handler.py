"""
Lambda para Step Function: Transferir Cliente entre Inmobiliarias
Paso 1: Validar que la transferencia es posible
"""
import json
import os
import re
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
scheduler = boto3.client('scheduler')

clientes_table = dynamodb.Table(os.environ['CLIENTES_TABLE'])
procesos_table = dynamodb.Table(os.environ['PROCESOS_TABLE'])
inventario_table = dynamodb.Table(os.environ['INVENTARIO_TABLE'])

BLOQUEOS_LAMBDA_ARN = os.environ.get('BLOQUEOS_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')


def _schedule_name(unidad_id, suffix):
    """Genera nombre seguro para schedule (sin '/' ni '#')"""
    safe = unidad_id.replace('/', '-').replace('#', '-')
    return f"bloqueo-{safe}-{suffix}"


def crear_schedules_bloqueo(unidad_id, proyecto_id, ts_liberacion_iso, ts_alerta_iso):
    """
    Crea dos schedules one-time para el bloqueo:
      - alerta: 5h antes de vencer
      - liberacion: cuando vence (48h)
    """
    print(f'[SCHEDULES] Iniciando creación de schedules para unidad {unidad_id}')
    print(f'[SCHEDULES] BLOQUEOS_LAMBDA_ARN={BLOQUEOS_LAMBDA_ARN}')
    print(f'[SCHEDULES] SCHEDULER_ROLE_ARN={SCHEDULER_ROLE_ARN}')
    print(f'[SCHEDULES] ts_alerta_iso={ts_alerta_iso}')
    print(f'[SCHEDULES] ts_liberacion_iso={ts_liberacion_iso}')
    
    if not BLOQUEOS_LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        print(f'⚠ crear_schedules: LAMBDA_ARN o SCHEDULER_ROLE_ARN no configurados, omitiendo schedules para {unidad_id}')
        return
    
    payload_base = {'unidad_id': unidad_id, 'proyecto_id': proyecto_id}
    schedules_creados = 0
    
    for suffix, at_time, accion in [
        ('alerta', ts_alerta_iso, 'alerta_vencimiento'),
        ('liberacion', ts_liberacion_iso, 'liberar_automatico'),
    ]:
        try:
            schedule_name = _schedule_name(unidad_id, suffix)
            scheduler.create_schedule(
                Name=schedule_name,
                ScheduleExpression=f"at({at_time})",
                ScheduleExpressionTimezone='UTC',
                FlexibleTimeWindow={'Mode': 'OFF'},
                Target={
                    'Arn': BLOQUEOS_LAMBDA_ARN,
                    'RoleArn': SCHEDULER_ROLE_ARN,
                    'Input': json.dumps({**payload_base, 'accion': accion}),
                },
                ActionAfterCompletion='DELETE',
            )
            schedules_creados += 1
            print(f'✓ Schedule creado: {schedule_name} at {at_time} (accion: {accion})')
        except Exception as e:
            print(f'✗ crear_schedules error ({suffix}): {type(e).__name__}: {e}')
    
    if schedules_creados == 2:
        print(f'✓ Ambos schedules creados exitosamente para unidad {unidad_id}')
    elif schedules_creados == 1:
        print(f'⚠ Solo 1 de 2 schedules creado para unidad {unidad_id}')
    else:
        print(f'✗ No se crearon schedules para unidad {unidad_id}')


def validar_transferencia(event, context):
    """
    Valida que la transferencia sea posible.
    Input: { cedula, proyecto_id, inmobiliaria_origen, inmobiliaria_destino, unidad_id? }
    Output: { valido: bool, cliente: {...}, procesos: [...], bloqueos: [...], error?: str }
    """
    print(f"[VALIDAR] Iniciando validación con event: {event}")
    
    cedula = event['cedula']
    proyecto_id = event['proyecto_id']
    inmo_origen = event['inmobiliaria_origen']
    inmo_destino = event['inmobiliaria_destino']
    unidad_id = event.get('unidad_id')  # Opcional: si viene, solo transferir este proceso
    
    print(f"[VALIDAR] Buscando cliente: cedula={cedula}, proyecto={proyecto_id}, inmo_origen={inmo_origen}")
    if unidad_id:
        print(f"[VALIDAR] Transferencia de proceso específico: unidad_id={unidad_id}")
    else:
        print(f"[VALIDAR] Transferencia completa del cliente")
    
    # 1. Verificar que el cliente existe
    # Formato correcto: pk = CLIENTE#{cedula}#{inmobiliaria_id}, sk = PROYECTO#{proyecto_id}
    pk = f'CLIENTE#{cedula}#{inmo_origen}'
    sk = f'PROYECTO#{proyecto_id}'
    
    print(f"[VALIDAR] Consultando DynamoDB: pk={pk}, sk={sk}")
    
    response = clientes_table.get_item(Key={'pk': pk, 'sk': sk})
    if 'Item' not in response:
        error_msg = f'Cliente {cedula} no encontrado en proyecto {proyecto_id} con inmobiliaria {inmo_origen}'
        print(f"[VALIDAR] ERROR: {error_msg}")
        return {
            'valido': False,
            'error': error_msg
        }
    
    cliente = response['Item']
    print(f"[VALIDAR] Cliente encontrado: {cliente.get('nombres')} {cliente.get('apellidos')}")
    
    # 2. Buscar procesos asociados
    pk_proceso = f'PROCESO#{cedula}#{inmo_origen}'
    print(f"[VALIDAR] Buscando procesos: pk={pk_proceso}")
    procesos_response = procesos_table.query(
        KeyConditionExpression=Key('pk').eq(pk_proceso)
    )
    procesos_todos = procesos_response.get('Items', [])
    
    # Si se especificó unidad_id, filtrar solo ese proceso
    if unidad_id:
        # El sk tiene formato UNIDAD#{unidad_id}, así que debemos comparar correctamente
        procesos = [p for p in procesos_todos if p.get('sk') == f'UNIDAD#{unidad_id}']
        if not procesos:
            error_msg = f'Proceso no encontrado para unidad {unidad_id}'
            print(f"[VALIDAR] ERROR: {error_msg}")
            return {
                'valido': False,
                'error': error_msg
            }
        print(f"[VALIDAR] Proceso específico encontrado: {procesos[0].get('unidad_nombre', unidad_id)}")
    else:
        procesos = procesos_todos
        print(f"[VALIDAR] Procesos encontrados: {len(procesos)}")
    
    # 3. Buscar unidades bloqueadas (sin importar por quién)
    # Si la unidad está bloqueada, se creará un nuevo bloqueo para la inmobiliaria destino
    bloqueos = []
    for proceso in procesos:
        if proceso.get('unidad_id'):
            # Verificar si la unidad está bloqueada
            unidad_pk = f'PROYECTO#{proyecto_id}'
            unidad_sk = f'UNIDAD#{proceso["unidad_id"]}'
            unidad_response = inventario_table.get_item(Key={'pk': unidad_pk, 'sk': unidad_sk})
            
            if 'Item' in unidad_response:
                unidad = unidad_response['Item']
                estado = unidad.get('estado', '')
                bloqueado_por = unidad.get('bloqueado_por', '')
                print(f"[VALIDAR] Unidad {proceso['unidad_id']}: estado={estado}, bloqueado_por={bloqueado_por}, cliente_cedula={unidad.get('cliente_cedula')}")
                
                # Si la unidad está bloqueada (sin importar por quién), la incluimos
                # Se creará un NUEVO bloqueo para la inmobiliaria destino
                if estado == 'bloqueada':
                    bloqueos.append({
                        'unidad_id': proceso['unidad_id'],
                        'unidad_data': unidad,
                        'proceso_data': proceso
                    })
                    print(f"[VALIDAR] ✓ Unidad bloqueada detectada: {proceso['unidad_id']} (se creará nuevo bloqueo)")
    
    print(f"[VALIDAR] Bloqueos encontrados: {len(bloqueos)}")
    print(f"[VALIDAR] Validación exitosa")
    
    return {
        'valido': True,
        'cedula': cedula,
        'proyecto_id': proyecto_id,
        'inmobiliaria_origen': inmo_origen,
        'inmobiliaria_destino': inmo_destino,
        'unidad_id': unidad_id,  # Pasar el unidad_id para los siguientes pasos
        'cliente': cliente,
        'procesos': procesos,
        'bloqueos': bloqueos,
        'transferencia_parcial': bool(unidad_id)  # Flag para saber si es parcial
    }


def eliminar_registros(event, context):
    """
    Elimina los registros antiguos (cliente, procesos, libera bloqueos).
    Si es transferencia parcial (unidad_id presente), NO elimina el cliente.
    Input: resultado de validar_transferencia
    Output: { eliminado: bool, items_eliminados: [...] }
    """
    print("[ELIMINAR] Iniciando eliminación de registros")
    
    cedula = event['cedula']
    proyecto_id = event['proyecto_id']
    inmo_origen = event['inmobiliaria_origen']
    cliente = event['cliente']
    procesos = event['procesos']
    bloqueos = event['bloqueos']
    transferencia_parcial = event.get('transferencia_parcial', False)
    
    items_eliminados = []
    
    # 1. Liberar bloqueos SOLO si son de la inmobiliaria origen
    # Si el bloqueo es de otra inmobiliaria, NO lo liberamos (solo creamos uno nuevo)
    print(f"[ELIMINAR] Verificando {len(bloqueos)} unidades bloqueadas")
    for bloqueo in bloqueos:
        unidad_id = bloqueo["unidad_id"]
        unidad_data = bloqueo["unidad_data"]
        bloqueado_por = unidad_data.get('bloqueado_por', '')
        
        # Solo liberar si el bloqueo es de la inmobiliaria origen
        es_bloqueo_propio = (
            bloqueado_por == f'INMOBILIARIA#{inmo_origen}' or 
            bloqueado_por == inmo_origen
        )
        
        if es_bloqueo_propio:
            unidad_pk = f'PROYECTO#{proyecto_id}'
            unidad_sk = f'UNIDAD#{unidad_id}'
            
            # Eliminar schedules pendientes
            for suffix in ('alerta', 'liberacion'):
                try:
                    schedule_name = _schedule_name(unidad_id, suffix)
                    scheduler.delete_schedule(Name=schedule_name)
                    print(f'✓ Schedule eliminado: {schedule_name}')
                except scheduler.exceptions.ResourceNotFoundException:
                    print(f'⚠ Schedule no encontrado (ya eliminado o no existe): {_schedule_name(unidad_id, suffix)}')
                except Exception as e:
                    print(f'✗ Error eliminando schedule {suffix} para {unidad_id}: {type(e).__name__}: {e}')
            
            # Liberar unidad
            inventario_table.update_item(
                Key={'pk': unidad_pk, 'sk': unidad_sk},
                UpdateExpression='SET estado = :estado REMOVE bloqueado_por, cliente_cedula, fecha_bloqueo, fecha_liberacion',
                ExpressionAttributeValues={':estado': 'disponible'}
            )
            items_eliminados.append(f'Bloqueo liberado: {unidad_id}')
            print(f"[ELIMINAR] Bloqueo liberado: {unidad_id}")
        else:
            print(f"[ELIMINAR] Unidad {unidad_id} bloqueada por otra inmobiliaria ({bloqueado_por}), no se libera")
            items_eliminados.append(f'Unidad bloqueada detectada (no liberada): {unidad_id}')
    
    # 2. Eliminar procesos
    print(f"[ELIMINAR] Eliminando {len(procesos)} procesos")
    for proceso in procesos:
        procesos_table.delete_item(Key={'pk': proceso['pk'], 'sk': proceso['sk']})
        items_eliminados.append(f'Proceso eliminado: {proceso["sk"]}')
        print(f"[ELIMINAR] Proceso eliminado: {proceso['sk']}")
    
    # 3. Eliminar cliente SOLO si es transferencia completa
    if transferencia_parcial:
        print(f"[ELIMINAR] Transferencia parcial: NO se elimina el cliente")
        items_eliminados.append(f'Cliente mantenido (transferencia parcial)')
    else:
        pk_cliente = f'CLIENTE#{cedula}#{inmo_origen}'
        sk_cliente = f'PROYECTO#{proyecto_id}'
        print(f"[ELIMINAR] Eliminando cliente: pk={pk_cliente}, sk={sk_cliente}")
        clientes_table.delete_item(Key={'pk': pk_cliente, 'sk': sk_cliente})
        items_eliminados.append(f'Cliente eliminado: {sk_cliente}')
    
    print(f"[ELIMINAR] Eliminación completada. Items eliminados: {len(items_eliminados)}")
    
    return {
        'eliminado': True,
        'items_eliminados': items_eliminados,
        'cedula': cedula,
        'proyecto_id': proyecto_id,
        'inmobiliaria_origen': inmo_origen,
        'inmobiliaria_destino': event['inmobiliaria_destino'],
        'unidad_id': event.get('unidad_id'),  # Pasar el unidad_id al siguiente paso
        'cliente': cliente,
        'procesos': procesos,  # Pasar los procesos originales para recrearlos
        'bloqueos': bloqueos,
        'transferencia_parcial': transferencia_parcial
    }


def crear_registros(event, context):
    """
    Crea los nuevos registros con la inmobiliaria destino.
    Si es transferencia parcial, verifica si el cliente ya existe en destino.
    Input: resultado de eliminar_registros
    Output: { creado: bool, items_creados: [...] }
    """
    import datetime
    
    print("[CREAR] Iniciando creación de registros")
    
    cedula = event['cedula']
    proyecto_id = event['proyecto_id']
    inmo_destino = event['inmobiliaria_destino']
    cliente_original = event['cliente']
    bloqueos = event['bloqueos']
    transferencia_parcial = event.get('transferencia_parcial', False)
    
    items_creados = []
    ahora = datetime.datetime.utcnow().isoformat() + 'Z'
    
    # 1. Crear o verificar cliente en inmobiliaria destino
    pk_nuevo = f'CLIENTE#{cedula}#{inmo_destino}'
    sk_nuevo = f'PROYECTO#{proyecto_id}'
    nuevo_cliente = None  # Inicializar
    
    if transferencia_parcial:
        # Verificar si el cliente ya existe en la inmobiliaria destino
        cliente_existente = clientes_table.get_item(Key={'pk': pk_nuevo, 'sk': sk_nuevo}).get('Item')
        if cliente_existente:
            print(f"[CREAR] Cliente ya existe en inmobiliaria destino (transferencia parcial)")
            items_creados.append(f'Cliente ya existente en destino')
        else:
            print(f"[CREAR] Creando cliente en inmobiliaria destino: pk={pk_nuevo}, sk={sk_nuevo}")
            nuevo_cliente = {
                'pk': pk_nuevo,
                'sk': sk_nuevo,
                'cedula': cedula,
                'inmobiliaria_id': inmo_destino,
                'proyecto_id': proyecto_id,
                'nombres': cliente_original['nombres'],
                'apellidos': cliente_original['apellidos'],
                'correo': cliente_original.get('correo'),
                'telefono': cliente_original.get('telefono'),
                'estado_civil': cliente_original.get('estado_civil'),
                'nacionalidad': cliente_original.get('nacionalidad'),
                'pais_residencia': cliente_original.get('pais_residencia'),
                'fecha_nacimiento': cliente_original.get('fecha_nacimiento'),
                'edad': cliente_original.get('edad'),
                'exclusividad_activa': True,
                'fecha_captacion': ahora,
                'fecha_vencimiento': (datetime.datetime.utcnow() + datetime.timedelta(days=90)).isoformat() + 'Z',
            }
            clientes_table.put_item(Item=nuevo_cliente)
            items_creados.append(f'Cliente creado: {sk_nuevo}')
            print(f"[CREAR] Cliente creado exitosamente")
    else:
        # Transferencia completa: crear cliente nuevo
        print(f"[CREAR] Creando cliente: pk={pk_nuevo}, sk={sk_nuevo}")
        nuevo_cliente = {
            'pk': pk_nuevo,
            'sk': sk_nuevo,
            'cedula': cedula,
            'inmobiliaria_id': inmo_destino,
            'proyecto_id': proyecto_id,
            'nombres': cliente_original['nombres'],
            'apellidos': cliente_original['apellidos'],
            'correo': cliente_original.get('correo'),
            'telefono': cliente_original.get('telefono'),
            'estado_civil': cliente_original.get('estado_civil'),
            'nacionalidad': cliente_original.get('nacionalidad'),
            'pais_residencia': cliente_original.get('pais_residencia'),
            'fecha_nacimiento': cliente_original.get('fecha_nacimiento'),
            'edad': cliente_original.get('edad'),
            'exclusividad_activa': True,
            'fecha_captacion': ahora,
            'fecha_vencimiento': (datetime.datetime.utcnow() + datetime.timedelta(days=90)).isoformat() + 'Z',
        }
        clientes_table.put_item(Item=nuevo_cliente)
        items_creados.append(f'Cliente creado: {sk_nuevo}')
        print(f"[CREAR] Cliente creado exitosamente")
    
    # 2. Obtener todos los procesos originales (no solo los que tienen bloqueos)
    procesos_originales = event.get('procesos', [])
    print(f"[CREAR] Procesando {len(procesos_originales)} procesos")
    
    # Crear un set de unidades que ya tienen bloqueo para no duplicar
    unidades_con_bloqueo = {b['unidad_id'] for b in bloqueos}
    
    # 3. Recrear bloqueos para TODAS las unidades que estaban bloqueadas
    # Se crea un NUEVO bloqueo de 48h para la inmobiliaria destino
    print(f"[CREAR] Recreando {len(bloqueos)} bloqueos para inmobiliaria destino")
    for bloqueo in bloqueos:
        unidad_id = bloqueo['unidad_id']
        unidad_data = bloqueo['unidad_data']
        proceso_data = bloqueo['proceso_data']
        
        # PRIMERO: Eliminar schedules existentes (pueden ser de otra inmobiliaria)
        print(f"[CREAR] Eliminando schedules existentes para unidad {unidad_id}")
        for suffix in ('alerta', 'liberacion'):
            try:
                schedule_name = _schedule_name(unidad_id, suffix)
                scheduler.delete_schedule(Name=schedule_name)
                print(f'✓ Schedule existente eliminado: {schedule_name}')
            except scheduler.exceptions.ResourceNotFoundException:
                print(f'⚠ Schedule no encontrado: {schedule_name}')
            except Exception as e:
                print(f'✗ Error eliminando schedule {suffix}: {type(e).__name__}: {e}')
        
        # Calcular nueva fecha de liberación (48 horas desde ahora)
        fecha_liberacion = (datetime.datetime.utcnow() + datetime.timedelta(hours=48)).isoformat() + 'Z'
        
        # Crear NUEVO bloqueo para la inmobiliaria destino
        bloqueado_por = inmo_destino  # Sin prefijo, como en bloqueos.py
        
        inventario_table.update_item(
            Key={
                'pk': f'PROYECTO#{proyecto_id}',
                'sk': f'UNIDAD#{unidad_id}'
            },
            UpdateExpression='''
                SET estado = :estado,
                    bloqueado_por = :bloqueado_por,
                    cliente_cedula = :cedula,
                    fecha_bloqueo = :fecha_bloqueo,
                    fecha_liberacion = :fecha_liberacion
            ''',
            ExpressionAttributeValues={
                ':estado': 'bloqueada',
                ':bloqueado_por': bloqueado_por,
                ':cedula': cedula,
                ':fecha_bloqueo': ahora,
                ':fecha_liberacion': fecha_liberacion
            }
        )
        items_creados.append(f'Bloqueo recreado: {unidad_id}')
        print(f"[CREAR] Nuevo bloqueo creado para unidad {unidad_id} (inmobiliaria: {inmo_destino})")
        
        # Crear schedules para el bloqueo (alerta + liberación)
        # Formato: YYYY-MM-DDTHH:MM:SS (sin 'Z', 19 caracteres)
        fecha_alerta = (datetime.datetime.utcnow() + datetime.timedelta(hours=43)).isoformat()[:19]
        fecha_lib = (datetime.datetime.utcnow() + datetime.timedelta(hours=48)).isoformat()[:19]
        print(f"[CREAR] Llamando crear_schedules_bloqueo para unidad {unidad_id}")
        print(f"[CREAR] Parámetros: proyecto_id={proyecto_id}, fecha_lib={fecha_lib}, fecha_alerta={fecha_alerta}")
        crear_schedules_bloqueo(unidad_id, proyecto_id, fecha_lib, fecha_alerta)
        
        # Crear proceso de venta con el estado original
        # Usar el mismo formato de sk que tenía el proceso original
        nuevo_proceso = {
            'pk': f'PROCESO#{cedula}#{inmo_destino}',
            'sk': proceso_data['sk'],  # Copiar el sk exactamente como estaba
            'cedula': cedula,
            'inmobiliaria_id': inmo_destino,
            'proyecto_id': proyecto_id,
            'unidad_id': unidad_id,
            'unidad_nombre': unidad_data.get('id_unidad', unidad_id),
            'estado': proceso_data.get('estado', 'captacion'),
            'historial': proceso_data.get('historial', []),
            'fecha_inicio': ahora,
            'actualizado_en': ahora,
            # Preservar campos importantes del proceso original
            'fecha_separacion': proceso_data.get('fecha_separacion'),
            'pago_confirmado': proceso_data.get('pago_confirmado'),
            'alerta_separacion_vencida': proceso_data.get('alerta_separacion_vencida'),
        }
        procesos_table.put_item(Item=nuevo_proceso)
        items_creados.append(f'Proceso creado: {nuevo_proceso["sk"]}')
        print(f"[CREAR] Proceso creado con estado '{nuevo_proceso['estado']}': {nuevo_proceso['sk']}")
    
    # 4. Recrear procesos sin bloqueo (unidades que ya no están bloqueadas pero tienen proceso)
    print(f"[CREAR] Verificando procesos sin bloqueo activo")
    for proceso in procesos_originales:
        unidad_id = proceso.get('unidad_id')
        if not unidad_id or unidad_id in unidades_con_bloqueo:
            continue  # Ya se procesó con el bloqueo o no tiene unidad
        
        # Crear proceso sin bloqueo
        # Usar el mismo formato de sk que tenía el proceso original
        nuevo_proceso = {
            'pk': f'PROCESO#{cedula}#{inmo_destino}',
            'sk': proceso['sk'],  # Copiar el sk exactamente como estaba
            'cedula': cedula,
            'inmobiliaria_id': inmo_destino,
            'proyecto_id': proyecto_id,
            'unidad_id': unidad_id,
            'unidad_nombre': proceso.get('unidad_nombre', unidad_id),
            'estado': proceso.get('estado', 'captacion'),
            'historial': proceso.get('historial', []),
            'fecha_inicio': ahora,
            'actualizado_en': ahora,
            # Preservar campos importantes del proceso original
            'fecha_separacion': proceso.get('fecha_separacion'),
            'pago_confirmado': proceso.get('pago_confirmado'),
            'alerta_separacion_vencida': proceso.get('alerta_separacion_vencida'),
        }
        procesos_table.put_item(Item=nuevo_proceso)
        items_creados.append(f'Proceso sin bloqueo creado: {nuevo_proceso["sk"]}')
        print(f"[CREAR] Proceso sin bloqueo creado con estado '{nuevo_proceso['estado']}': {nuevo_proceso['sk']}")
    
    print(f"[CREAR] Creación completada. Items creados: {len(items_creados)}")
    
    result = {
        'creado': True,
        'items_creados': items_creados,
        'mensaje': f'Cliente {cedula} transferido exitosamente a inmobiliaria {inmo_destino}'
    }
    
    # Solo incluir nuevo_cliente si se creó uno
    if nuevo_cliente:
        result['nuevo_cliente'] = nuevo_cliente
    
    return result


def handler(event, context):
    """
    Router para las diferentes funciones según el paso de la Step Function
    """
    print(f"[HANDLER] Event recibido: {json.dumps(event)}")
    action = event.get('action')
    print(f"[HANDLER] Action: {action}")
    
    if action == 'validar':
        result = validar_transferencia(event, context)
        print(f"[HANDLER] Resultado validar: {json.dumps(result, default=str)}")
        return result
    elif action == 'eliminar':
        result = eliminar_registros(event, context)
        print(f"[HANDLER] Resultado eliminar: {json.dumps(result, default=str)}")
        return result
    elif action == 'crear':
        result = crear_registros(event, context)
        print(f"[HANDLER] Resultado crear: {json.dumps(result, default=str)}")
        return result
    elif action == 'validar_cedula':
        result = validar_cambio_cedula(event, context)
        print(f"[HANDLER] Resultado validar_cedula: {json.dumps(result, default=str)}")
        return result
    elif action == 'eliminar_cedula':
        result = eliminar_registros_cedula(event, context)
        print(f"[HANDLER] Resultado eliminar_cedula: {json.dumps(result, default=str)}")
        return result
    elif action == 'crear_cedula':
        result = crear_registros_cedula(event, context)
        print(f"[HANDLER] Resultado crear_cedula: {json.dumps(result, default=str)}")
        return result
    else:
        error = {'error': f'Acción desconocida: {action}'}
        print(f"[HANDLER] ERROR: {error}")
        return error


# ─── Cambio de cédula ────────────────────────────────────────────────────────

def validar_cambio_cedula(event, context):
    """
    Valida que el cambio de cédula sea posible.
    Input: { cedula_antigua, cedula_nueva }
    """
    cedula_antigua = event['cedula_antigua']
    cedula_nueva   = str(event['cedula_nueva']).strip().upper()
    if not re.match(r'^[A-Z0-9]+$', cedula_nueva):
        return {'valido': False, 'error': 'La cedula/pasaporte nueva solo debe contener letras y numeros, sin guiones ni simbolos'}

    print(f"[VALIDAR_CEDULA] {cedula_antigua} → {cedula_nueva}")

    # Verificar que la cédula nueva no existe ya
    existing = clientes_table.query(
        IndexName='gsi-cedula-proyecto',
        KeyConditionExpression=Key('cedula').eq(cedula_nueva),
        Limit=1,
    )
    if existing.get('Items'):
        return {'valido': False, 'error': f'La cédula {cedula_nueva} ya está registrada en el sistema'}

    # Buscar todos los registros de la cédula antigua
    clientes = clientes_table.query(
        IndexName='gsi-cedula-proyecto',
        KeyConditionExpression=Key('cedula').eq(cedula_antigua),
    ).get('Items', [])

    if not clientes:
        return {'valido': False, 'error': f'No se encontraron registros para la cédula {cedula_antigua}'}

    # Buscar todos los procesos
    procesos = []
    inmo_ids = list({c['inmobiliaria_id'] for c in clientes})
    for inmo_id in inmo_ids:
        pk = f'PROCESO#{cedula_antigua}#{inmo_id}'
        result = procesos_table.query(KeyConditionExpression=Key('pk').eq(pk))
        procesos.extend(result.get('Items', []))

    # Buscar unidades con cliente_cedula = cedula_antigua
    unidades_vinculadas = []
    proyectos_ids = list({c['proyecto_id'] for c in clientes})
    for proyecto_id in proyectos_ids:
        result = inventario_table.query(
            KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#'),
            FilterExpression='cliente_cedula = :c',
            ExpressionAttributeValues={':c': cedula_antigua},
        )
        unidades_vinculadas.extend(result.get('Items', []))

    print(f"[VALIDAR_CEDULA] Clientes: {len(clientes)}, Procesos: {len(procesos)}, Unidades: {len(unidades_vinculadas)}")

    return {
        'valido': True,
        'cedula_antigua': cedula_antigua,
        'cedula_nueva': cedula_nueva,
        'clientes': clientes,
        'procesos': procesos,
        'unidades_vinculadas': [{'pk': u['pk'], 'sk': u['sk']} for u in unidades_vinculadas],
    }


def eliminar_registros_cedula(event, context):
    """Elimina todos los registros con la cédula antigua."""
    cedula_antigua = event['cedula_antigua']
    cedula_nueva   = event['cedula_nueva']
    clientes       = event['clientes']
    procesos       = event['procesos']

    print(f"[ELIMINAR_CEDULA] Eliminando registros de {cedula_antigua}")

    for c in clientes:
        clientes_table.delete_item(Key={'pk': c['pk'], 'sk': c['sk']})
    print(f"[ELIMINAR_CEDULA] {len(clientes)} clientes eliminados")

    for p in procesos:
        procesos_table.delete_item(Key={'pk': p['pk'], 'sk': p['sk']})
    print(f"[ELIMINAR_CEDULA] {len(procesos)} procesos eliminados")

    return {
        'cedula_antigua': cedula_antigua,
        'cedula_nueva': cedula_nueva,
        'clientes': clientes,
        'procesos': procesos,
        'unidades_vinculadas': event['unidades_vinculadas'],
    }


def crear_registros_cedula(event, context):
    """Crea todos los registros con la cédula nueva y actualiza unidades."""
    import datetime
    cedula_antigua = event['cedula_antigua']
    cedula_nueva   = event['cedula_nueva']
    clientes       = event['clientes']
    procesos       = event['procesos']
    unidades       = event['unidades_vinculadas']

    print(f"[CREAR_CEDULA] Creando registros para {cedula_nueva}")
    ahora = datetime.datetime.utcnow().isoformat() + 'Z'

    # Recrear clientes con nueva cédula
    for c in clientes:
        inmo_id    = c['inmobiliaria_id']
        proyecto_id = c['proyecto_id']
        nuevo_pk   = f'CLIENTE#{cedula_nueva}#{inmo_id}'
        nuevo_item = {**c, 'pk': nuevo_pk, 'cedula': cedula_nueva}
        clientes_table.put_item(Item=nuevo_item)
    print(f"[CREAR_CEDULA] {len(clientes)} clientes creados")

    # Recrear procesos con nueva cédula
    for p in procesos:
        # pk = PROCESO#{cedula}#{inmo_id}
        partes  = p['pk'].split('#')
        inmo_id = partes[2] if len(partes) > 2 else ''
        nuevo_pk = f'PROCESO#{cedula_nueva}#{inmo_id}'
        nuevo_item = {**p, 'pk': nuevo_pk, 'cedula': cedula_nueva}
        procesos_table.put_item(Item=nuevo_item)
    print(f"[CREAR_CEDULA] {len(procesos)} procesos creados")

    # Actualizar unidades vinculadas
    for u in unidades:
        try:
            inventario_table.update_item(
                Key={'pk': u['pk'], 'sk': u['sk']},
                UpdateExpression='SET cliente_cedula = :c',
                ExpressionAttributeValues={':c': cedula_nueva},
            )
        except Exception as e:
            print(f"[CREAR_CEDULA] Error actualizando unidad {u['sk']}: {e}")
    print(f"[CREAR_CEDULA] {len(unidades)} unidades actualizadas")

    return {
        'cambiado': True,
        'cedula_antigua': cedula_antigua,
        'cedula_nueva': cedula_nueva,
        'clientes_actualizados': len(clientes),
        'procesos_actualizados': len(procesos),
        'unidades_actualizadas': len(unidades),
        'mensaje': f'Cédula cambiada de {cedula_antigua} a {cedula_nueva} exitosamente',
    }
