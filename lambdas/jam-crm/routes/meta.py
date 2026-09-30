import base64
import os
import re
import json
import uuid
import urllib.error
import urllib.request
from urllib.parse import quote, urlencode
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from utils.response import _build, bad_request, conflict, ok
from utils.auth import get_nombre, get_sub
from routes.estatus import _activar_bloqueo_desde_proceso


dynamodb = boto3.resource('dynamodb')
ssm = boto3.client('ssm')
s3 = boto3.client('s3')
ASSETS_BUCKET = os.environ.get('ASSETS_BUCKET', '')
CLOUDFRONT_URL = os.environ.get('CLOUDFRONT_URL', '').rstrip('/')
META_CONVERSACIONES_TABLE = os.environ.get('META_CONVERSACIONES_TABLE', '')
meta_table = dynamodb.Table(META_CONVERSACIONES_TABLE) if META_CONVERSACIONES_TABLE else None
CLIENTES_TABLE = os.environ.get('CLIENTES_TABLE', '')
PROCESOS_TABLE = os.environ.get('PROCESOS_TABLE', '')
INVENTARIO_TABLE = os.environ.get('INVENTARIO_TABLE', '')
clientes_table = dynamodb.Table(CLIENTES_TABLE) if CLIENTES_TABLE else None
procesos_table = dynamodb.Table(PROCESOS_TABLE) if PROCESOS_TABLE else None
inventario_table = dynamodb.Table(INVENTARIO_TABLE) if INVENTARIO_TABLE else None

INSTAGRAM_TOKEN_PARAMS = {
    'jamconstruccionessrl': os.environ.get('INSTAGRAM_TOKEN_PARAM_JAM', ''),
    'caneyoriental': os.environ.get('INSTAGRAM_TOKEN_PARAM_CANEY', ''),
}
MESSENGER_TOKEN_PARAMS = {
    'jam_construcciones': os.environ.get('MESSENGER_PAGE_TOKEN_PARAM_JAM', ''),
}
WHATSAPP_TOKEN_PARAMS = {
    'jam_construcciones': os.environ.get('WHATSAPP_TOKEN_PARAM_JAM', ''),
}
WHATSAPP_PHONE_NUMBER_IDS = {
    'jam_construcciones': os.environ.get('WHATSAPP_PHONE_NUMBER_ID_JAM', ''),
}
METHODICA_CHANNEL_MESSAGES_URL = os.environ.get(
    'METHODICA_CHANNEL_MESSAGES_URL',
    'https://1ojgtdj4qf.execute-api.us-east-1.amazonaws.com/prod/channels/messages',
)
METHODICA_CHANNEL_KEY_PARAM = os.environ.get('METHODICA_CHANNEL_KEY_PARAM', '')
METHODICA_TENANT_ID = os.environ.get('METHODICA_TENANT_ID', 'jam')
META_APP_ID_PARAM = os.environ.get('META_APP_ID_PARAM', '')
META_APP_SECRET_PARAM = os.environ.get('META_APP_SECRET_PARAM', '')
META_FACEBOOK_REDIRECT_URI = os.environ.get('META_FACEBOOK_REDIRECT_URI', '')
META_MESSENGER_PAGE_TOKEN_PARAM = os.environ.get('MESSENGER_PAGE_TOKEN_PARAM_JAM', '')
META_MESSENGER_DEFAULT_ALIAS = 'jam_construcciones'
META_OAUTH_SCOPES = 'pages_show_list,pages_manage_metadata,pages_messaging,instagram_business_basic,instagram_business_manage_messages'

DOCUMENTO_RE = re.compile(r'^[A-Z0-9]+$')
EMAIL_RE = re.compile(r'^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$')
ESTADOS_META_LEAD = {'nuevo', 'en_seguimiento', 'convertido', 'cerrado'}
SIN_ASIGNAR = '__sin_asignar__'
MOTIVOS_CIERRE_META = {
    'No interesado',
    'No responde',
    'Presupuesto insuficiente',
    'Contacto incorrecto',
    'Duplicado',
    'Compra pospuesta',
    'Otro',
}


def facebook_oauth_url(event):
    app_id = _get_token(META_APP_ID_PARAM)
    if not app_id:
        return bad_request('Meta App ID no configurado')
    redirect_uri = _facebook_redirect_uri()
    params = {
        'client_id': app_id,
        'redirect_uri': redirect_uri,
        'scope': META_OAUTH_SCOPES,
        'response_type': 'code',
        'state': 'jam-facebook-messenger',
    }
    return ok({
        'auth_url': f'https://www.facebook.com/v26.0/dialog/oauth?{urlencode(params)}',
        'redirect_uri': redirect_uri,
    })


def facebook_oauth_callback(event):
    body = _json_body(event)
    code = str(body.get('code') or '').strip()
    page_id_preferido = str(body.get('page_id') or '').strip()
    if not code:
        return bad_request('code es requerido')

    app_id = _get_token(META_APP_ID_PARAM)
    app_secret = _get_token(META_APP_SECRET_PARAM)
    if not app_id or not app_secret:
        return bad_request('Meta App ID o App Secret no configurado')

    redirect_uri = _facebook_redirect_uri()
    token_data = _graph_get(
        'https://graph.facebook.com/v26.0/oauth/access_token',
        {
            'client_id': app_id,
            'client_secret': app_secret,
            'redirect_uri': redirect_uri,
            'code': code,
        },
    )
    user_token = str(token_data.get('access_token') or '')
    if not user_token:
        return bad_request('Meta no devolvio access_token')

    pages_data = _graph_get(
        'https://graph.facebook.com/v26.0/me/accounts',
        {
            'fields': 'id,name,access_token,tasks,category',
            'access_token': user_token,
        },
    )
    pages = pages_data.get('data') if isinstance(pages_data.get('data'), list) else []
    if not pages:
        return bad_request('No se encontraron paginas administradas por este usuario')

    selected = None
    for page in pages:
        if page_id_preferido and str(page.get('id')) == page_id_preferido:
            selected = page
            break
    if not selected:
        selected = pages[0]

    page_id = str(selected.get('id') or '')
    page_name = str(selected.get('name') or '')
    page_token = str(selected.get('access_token') or '')
    if not page_id or not page_token:
        return bad_request('La pagina seleccionada no devolvio token')

    _put_secure_parameter(META_MESSENGER_PAGE_TOKEN_PARAM, page_token)
    subscription = _subscribe_page_to_webhook(page_id, page_token)
    _upsert_connected_messenger_page(page_id, page_name)

    return ok({
        'connected': True,
        'channel': 'messenger',
        'account_alias': META_MESSENGER_DEFAULT_ALIAS,
        'page_id': page_id,
        'page_name': page_name,
        'subscription': subscription,
        'pages': [
            {
                'id': str(page.get('id') or ''),
                'name': str(page.get('name') or ''),
                'category': str(page.get('category') or ''),
            }
            for page in pages
        ],
    })


def listar_leads(event):
    if not meta_table:
        return ok({'items': [], 'count': 0})

    params = event.get('queryStringParameters') or {}
    canal = str(params.get('canal') or '').strip().lower()
    estado = str(params.get('estado') or '').strip().lower()
    responsable_id = str(params.get('responsable_id') or '').strip()
    inmobiliaria_id = str(params.get('inmobiliaria_id') or '').strip()
    search_text = str(params.get('q') or params.get('busqueda') or '').strip().lower()
    cursor = str(params.get('cursor') or '').strip()
    raw_limit = params.get('limit')
    if raw_limit is None and not cursor:
        limit = None
    else:
        try:
            limit = int(raw_limit or 50)
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 100))

    def matches_filters(item):
        if canal and item.get('channel') != canal:
            return False
        if estado and item.get('estado') != estado:
            return False
        if responsable_id:
            if responsable_id == SIN_ASIGNAR:
                if item.get('responsable_id'):
                    return False
            elif item.get('responsable_id') != responsable_id:
                return False
        if inmobiliaria_id:
            if inmobiliaria_id == SIN_ASIGNAR:
                if item.get('inmobiliaria_id'):
                    return False
            else:
                inmobiliaria_normalizada = _normalizar_inmo_id(inmobiliaria_id)
                if _normalizar_inmo_id(item.get('inmobiliaria_id')) != inmobiliaria_normalizada:
                    return False
        if search_text and not _lead_matches_search(item, search_text):
            return False
        return True

    result = _listar_leads_feed(limit, cursor, matches_filters)

    return ok({
        'items': result['items'],
        'count': len(result['items']),
        'has_more': bool(result.get('next_cursor')),
        'next_cursor': result.get('next_cursor', ''),
    })


def ver_conversacion(event):
    if not meta_table:
        return ok({'lead': None, 'mensajes': []})

    params = event.get('queryStringParameters') or {}
    lead_pk = str(params.get('lead_pk') or '').strip()
    if not lead_pk:
        return bad_request('lead_pk es requerido')

    lead = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')

    if not lead:
        return ok({'lead': None, 'mensajes': []})

    oportunidades_asociadas = _listar_oportunidades_cliente_asociado(lead)
    if oportunidades_asociadas:
        lead['oportunidades_asociadas'] = oportunidades_asociadas

    # Paginacion / incremental para no traer conversaciones enteras de golpe.
    #  - after:  solo mensajes mas nuevos que ese sk (modo polling incremental)
    #  - before: mensajes anteriores a ese sk (cargar historial hacia arriba)
    #  - limit:  cantidad por pagina (default 50, tope 200)
    after_sk = str(params.get('after') or '').strip()
    before_sk = str(params.get('before') or '').strip()
    try:
        limit = int(params.get('limit') or 50)
    except (TypeError, ValueError):
        limit = 50
    limit = max(1, min(limit, 200))

    conversation_pk = _conversation_pk_from_lead(lead)

    # ── Modo incremental (polling): solo lo nuevo tras 'after' ───────────────
    if after_sk and conversation_pk:
        nuevos = _query_all(
            KeyConditionExpression=(
                Key('pk').eq(conversation_pk)
                & Key('sk').gt(after_sk)
            ),
            ScanIndexForward=True,
        )
        nuevos = [
            m for m in nuevos
            if str(m.get('sk', '')).startswith('MENSAJE#') and _is_displayable_message(m)
        ]
        return ok({
            'lead': lead,
            'mensajes': nuevos,
            'incremental': True,
            'count': len(nuevos),
        })

    # ── Modo paginado: ultimos 'limit' mensajes (o anteriores a 'before') ────
    mensajes = []
    has_more = False
    if conversation_pk:
        key_condition = Key('pk').eq(conversation_pk)
        if before_sk:
            key_condition = key_condition & Key('sk').lt(before_sk)
        else:
            key_condition = key_condition & Key('sk').begins_with('MENSAJE#')
        # Traemos los mas recientes primero (limit+1 para saber si hay mas atras)
        result = meta_table.query(
            KeyConditionExpression=key_condition,
            ScanIndexForward=False,
            Limit=limit + 1,
        )
        page = [
            m for m in result.get('Items', [])
            if str(m.get('sk', '')).startswith('MENSAJE#') and _is_displayable_message(m)
        ]
        has_more = len(page) > limit
        page = page[:limit]
        # Devolvemos en orden cronologico ascendente (viejo -> nuevo)
        mensajes = list(reversed(page))

    actividades = _query_all(
        KeyConditionExpression=(
            Key('pk').eq(lead_pk)
            & Key('sk').begins_with('ACTIVIDAD#')
        ),
        ScanIndexForward=True,
    )
    timeline = _build_timeline(lead, mensajes, actividades)

    return ok({
        'lead': lead,
        'mensajes': mensajes,
        'actividades': actividades,
        'timeline': timeline,
        'count': len(mensajes),
        'has_more': has_more,
        # cursor para "cargar anteriores": el sk del mensaje mas antiguo cargado
        'oldest_sk': mensajes[0].get('sk') if mensajes else '',
    })


def gestionar_lead(event):
    if not meta_table:
        return bad_request('Tabla Meta no configurada')

    params = event.get('queryStringParameters') or {}
    lead_pk = str(params.get('lead_pk') or '').strip()
    if not lead_pk:
        return bad_request('lead_pk es requerido')

    body = _json_body(event)
    nuevo_estado = str(body.get('estado') or '').strip()
    nota = str(body.get('nota') or '').strip()
    motivo_cierre = str(body.get('motivo_cierre') or body.get('motivo_descarte') or '').strip()
    responsable_id = str(body.get('responsable_id') or '').strip()
    responsable_nombre = str(body.get('responsable_nombre') or '').strip()
    inmobiliaria_id = str(body.get('inmobiliaria_id') or '').strip()
    inmobiliaria_nombre = str(body.get('inmobiliaria_nombre') or '').strip()
    hay_asignacion_responsable = 'responsable_id' in body
    hay_asignacion_inmobiliaria = 'inmobiliaria_id' in body
    if not any([nuevo_estado, nota, motivo_cierre, hay_asignacion_responsable, hay_asignacion_inmobiliaria]):
        return bad_request('estado, nota, responsable o inmobiliaria es requerido')

    lead = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')
    if not lead:
        return bad_request('Lead Meta no encontrado')
    if nuevo_estado and nuevo_estado not in ESTADOS_META_LEAD:
        return bad_request('Estado de lead Meta no permitido')
    if nuevo_estado == 'convertido' and not lead.get('cliente_cedula'):
        return bad_request('Para convertir el lead usa la accion formal de conversion a cliente')
    if nuevo_estado == 'cerrado':
        if not motivo_cierre:
            return bad_request('motivo_cierre es requerido para cerrar o descartar el lead')
        if motivo_cierre not in MOTIVOS_CIERRE_META:
            return bad_request('motivo_cierre no es valido')

    ahora = _now()
    usuario = {
        'sub': get_sub(event) or '',
        'nombre': get_nombre(event),
    }

    updates = ['actualizado_en = :actualizado_en']
    values = {':actualizado_en': ahora}
    actividades = []

    if nuevo_estado:
        estado_anterior = lead.get('estado', 'nuevo')
        updates.append('#estado = :estado')
        values[':estado'] = nuevo_estado
        actividad_estado = {
            'tipo_actividad': 'cambio_estado',
            'estado_anterior': estado_anterior,
            'estado_nuevo': nuevo_estado,
        }
        if nuevo_estado == 'cerrado':
            updates.extend([
                'motivo_cierre = :motivo_cierre',
                'cerrado_en = :cerrado_en',
                'cerrado_por_sub = :cerrado_por_sub',
                'cerrado_por_nombre = :cerrado_por_nombre',
            ])
            values[':motivo_cierre'] = motivo_cierre
            values[':cerrado_en'] = ahora
            values[':cerrado_por_sub'] = usuario['sub']
            values[':cerrado_por_nombre'] = usuario['nombre']
            actividad_estado['motivo_cierre'] = motivo_cierre
        elif estado_anterior == 'cerrado':
            updates.extend([
                'reabierto_en = :reabierto_en',
                'reabierto_por_sub = :reabierto_por_sub',
                'reabierto_por_nombre = :reabierto_por_nombre',
            ])
            values[':reabierto_en'] = ahora
            values[':reabierto_por_sub'] = usuario['sub']
            values[':reabierto_por_nombre'] = usuario['nombre']
            actividad_estado['tipo_actividad'] = 'reapertura_lead'
            actividad_estado['motivo_cierre_anterior'] = lead.get('motivo_cierre', '')
        actividades.append(actividad_estado)

    if nota:
        updates.append('ultima_nota = :ultima_nota')
        updates.append('ultima_nota_en = :ultima_nota_en')
        values[':ultima_nota'] = nota
        values[':ultima_nota_en'] = ahora
        actividades.append({
            'tipo_actividad': 'nota',
            'nota': nota,
        })

    if hay_asignacion_responsable:
        responsable_anterior = lead.get('responsable_id', '')
        responsable_nombre_anterior = lead.get('responsable_nombre', '')
        updates.append('responsable_id = :responsable_id')
        updates.append('responsable_nombre = :responsable_nombre')
        updates.append('asignado_en = :asignado_en')
        updates.append('asignado_por_sub = :asignado_por_sub')
        updates.append('asignado_por_nombre = :asignado_por_nombre')
        values[':responsable_id'] = responsable_id
        values[':responsable_nombre'] = responsable_nombre
        values[':asignado_en'] = ahora
        values[':asignado_por_sub'] = usuario['sub']
        values[':asignado_por_nombre'] = usuario['nombre']
        if responsable_id != responsable_anterior:
            actividades.append({
                'tipo_actividad': 'asignacion_responsable',
                'responsable_anterior_id': responsable_anterior,
                'responsable_anterior_nombre': responsable_nombre_anterior,
                'responsable_nuevo_id': responsable_id,
                'responsable_nuevo_nombre': responsable_nombre,
            })

    if hay_asignacion_inmobiliaria:
        inmobiliaria_anterior = lead.get('inmobiliaria_id', '')
        inmobiliaria_nombre_anterior = lead.get('inmobiliaria_nombre', '')
        updates.append('inmobiliaria_id = :inmobiliaria_id')
        updates.append('inmobiliaria_nombre = :inmobiliaria_nombre')
        values[':inmobiliaria_id'] = inmobiliaria_id
        values[':inmobiliaria_nombre'] = inmobiliaria_nombre
        if inmobiliaria_id != inmobiliaria_anterior:
            actividades.append({
                'tipo_actividad': 'asignacion_inmobiliaria',
                'inmobiliaria_anterior_id': inmobiliaria_anterior,
                'inmobiliaria_anterior_nombre': inmobiliaria_nombre_anterior,
                'inmobiliaria_nueva_id': inmobiliaria_id,
                'inmobiliaria_nueva_nombre': inmobiliaria_nombre,
            })

    update_kwargs = {
        'Key': {'pk': lead_pk, 'sk': 'METADATA'},
        'UpdateExpression': 'SET ' + ', '.join(updates),
        'ExpressionAttributeValues': values,
    }
    if nuevo_estado:
        update_kwargs['ExpressionAttributeNames'] = {'#estado': 'estado'}

    meta_table.update_item(**update_kwargs)

    for index, actividad in enumerate(actividades):
        meta_table.put_item(Item={
            'pk': lead_pk,
            'sk': f'ACTIVIDAD#{ahora}#{index:02d}#{actividad["tipo_actividad"]}',
            'tipo': 'META_ACTIVIDAD',
            'creado_en': ahora,
            'usuario_sub': usuario['sub'],
            'usuario_nombre': usuario['nombre'],
            **actividad,
        })

    lead_actualizado = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')

    return ok({
        'lead': lead_actualizado,
        'actividades_creadas': len(actividades),
    })


MEDIA_EXT_BY_TYPE = {
    'image': {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'},
    'video': {'video/mp4': 'mp4', 'video/3gpp': '3gp'},
    'audio': {'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/amr': 'amr'},
    'document': {'application/pdf': 'pdf'},
}


def _media_type_from_content_type(content_type):
    ct = (content_type or '').lower().split(';')[0].strip()
    if ct.startswith('image/'):
        return 'image', ct
    if ct.startswith('video/'):
        return 'video', ct
    if ct.startswith('audio/'):
        return 'audio', ct
    return 'document', ct or 'application/octet-stream'


def renombrar_contacto(event):
    """Guarda un nombre manual (editable por el agente) para la conversacion.
    Prioridad de visualizacion en el front: nombre_manual > contact_profile_name > numero."""
    if not meta_table:
        return bad_request('Tabla Meta no configurada')
    params = event.get('queryStringParameters') or {}
    lead_pk = str(params.get('lead_pk') or '').strip()
    if not lead_pk:
        return bad_request('lead_pk es requerido')
    body = _json_body(event)
    nombre = str(body.get('nombre_manual') or body.get('nombre') or '').strip()[:120]

    lead = meta_table.get_item(Key={'pk': lead_pk, 'sk': 'METADATA'}).get('Item')
    if not lead:
        return bad_request('Lead Meta no encontrado')

    meta_table.update_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'},
        UpdateExpression='SET nombre_manual = :n, actualizado_en = :a',
        ExpressionAttributeValues={':n': nombre, ':a': _now()},
    )
    lead['nombre_manual'] = nombre
    return ok({'lead': lead})


def get_media_upload_url(event):
    """Genera una presigned URL para subir un archivo del inbox al bucket de
    assets. Devuelve tambien la public_url (via CloudFront) que Meta usara para
    descargar el archivo al enviarlo por WhatsApp."""
    if not ASSETS_BUCKET or not CLOUDFRONT_URL:
        return bad_request('Carga de archivos no configurada')
    params = event.get('queryStringParameters') or {}
    content_type = str(params.get('content_type') or '').strip().lower()
    filename = str(params.get('filename') or '').strip()
    if not content_type:
        return bad_request('content_type es requerido')

    media_type, ct = _media_type_from_content_type(content_type)
    ext = MEDIA_EXT_BY_TYPE.get(media_type, {}).get(ct)
    if not ext:
        # Fallback: usar extension del filename o generica.
        ext = (filename.rsplit('.', 1)[-1] if '.' in filename else 'bin')[:8]
    media_id = str(uuid.uuid4())
    key = f'assets/meta-media/outgoing/whatsapp/{media_id}.{ext}'
    try:
        upload_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': ASSETS_BUCKET,
                'Key': key,
                'ContentType': content_type,
            },
            ExpiresIn=300,
        )
    except ClientError as exc:
        return bad_request(f'No se pudo generar la URL de carga: {exc}')

    return ok({
        'upload_url': upload_url,
        'public_url': f'{CLOUDFRONT_URL}/{quote(key)}',
        'key': key,
        'media_type': media_type,
        'content_type': content_type,
        'filename': filename,
    })


def enviar_mensaje(event):
    if not meta_table:
        return bad_request('Tabla Meta no configurada')

    params = event.get('queryStringParameters') or {}
    lead_pk = str(params.get('lead_pk') or '').strip()
    if not lead_pk:
        return bad_request('lead_pk es requerido')

    body = _json_body(event)
    texto = str(body.get('texto') or body.get('text') or '').strip()
    # Multimedia opcional: media_type + media_url (public_url del upload previo).
    media_type = str(body.get('media_type') or '').strip().lower()
    media_url = str(body.get('media_url') or '').strip()
    media_filename = str(body.get('filename') or '').strip()
    media_content_type = str(body.get('content_type') or '').strip()
    media_voice = bool(body.get('voice'))
    quoted_message_id = str(body.get('quoted_message_id') or body.get('context_message_id') or '').strip()
    quoted_text = str(body.get('quoted_text') or '').strip()[:500]
    quoted_sender = str(body.get('quoted_sender') or '').strip()[:120]
    if len(texto) > 4000:
        return bad_request('texto no debe exceder 4000 caracteres')
    if media_type and media_type not in {'image', 'video', 'audio', 'document'}:
        return bad_request('media_type no soportado')
    if media_type and not media_url:
        return bad_request('media_url es requerido para envio multimedia')
    if not texto and not media_type:
        return bad_request('texto o archivo es requerido')

    lead = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')
    if not lead:
        return bad_request('Lead Meta no encontrado')

    canal = str(lead.get('channel') or '').lower()
    account_alias = str(lead.get('account_alias') or '')
    contact_id = str(lead.get('external_contact_id') or '')
    if not all([canal, account_alias, contact_id]):
        return bad_request('Lead Meta incompleto para envio')

    ahora = _now()
    usuario = {
        'sub': get_sub(event) or '',
        'nombre': get_nombre(event),
    }
    local_event_id = f'local#{ahora}#{usuario["sub"][-8:] or "system"}'
    conversation_pk = _conversation_pk_from_lead(lead)
    mensaje = {
        'pk': conversation_pk,
        'sk': f'MENSAJE#{ahora}#{local_event_id}',
        'tipo': 'META_MENSAJE',
        'channel': canal,
        'account_id': lead.get('account_id', ''),
        'account_alias': account_alias,
        'channel_account': f'{canal}#{account_alias}',
        'contact_key': f'{canal}#{contact_id}',
        'external_contact_id': contact_id,
        'sender_id': lead.get('account_id', ''),
        'recipient_id': contact_id,
        'direction': 'outgoing',
        'event_type': 'message',
        'external_event_id': local_event_id,
        'local_event_id': local_event_id,
        'event_timestamp': ahora,
        'text': texto,
        'message_status': 'pendiente',
        'created_at': ahora,
        'enviado_por_sub': usuario['sub'],
        'enviado_por_nombre': usuario['nombre'],
    }
    if quoted_message_id:
        mensaje['quoted_message_id'] = quoted_message_id
        mensaje['quoted_text'] = quoted_text
        mensaje['quoted_sender'] = quoted_sender
    if media_type and media_url:
        mensaje['event_type'] = media_type
        mensaje['media'] = {
            'type': media_type,
            'mime_type': str(body.get('content_type') or ''),
            'filename': media_filename,
            'caption': texto,
            'public_url': media_url,
            'storage_status': 'stored',
            **({'voice': True} if media_voice else {}),
        }

    send_result = _send_meta_message(
        lead, texto,
        media_type=media_type,
        media_url=media_url,
        media_filename=media_filename,
        media_content_type=media_content_type,
        media_voice=media_voice,
        quoted_message_id=quoted_message_id,
    )
    if send_result.get('ok'):
        mensaje['message_status'] = 'enviado'
        mensaje['external_event_id'] = send_result.get('message_id') or local_event_id
        mensaje['meta_response'] = send_result.get('response') or {}
    else:
        mensaje['message_status'] = send_result.get('status') or 'fallido'
        mensaje['error_message'] = send_result.get('message') or 'No se pudo enviar el mensaje'
        mensaje['meta_response'] = send_result.get('response') or {}

    meta_table.put_item(Item=mensaje)
    _actualizar_lead_por_mensaje_saliente(lead_pk, mensaje)
    meta_table.put_item(Item={
        'pk': lead_pk,
        'sk': f'ACTIVIDAD#{ahora}#mensaje_saliente',
        'tipo': 'META_ACTIVIDAD',
        'tipo_actividad': 'mensaje_saliente',
        'creado_en': ahora,
        'usuario_sub': usuario['sub'],
        'usuario_nombre': usuario['nombre'],
        'channel': canal,
        'message_status': mensaje['message_status'],
        'texto': texto[:500],
        'error_message': mensaje.get('error_message', ''),
    })

    status_code = 200 if send_result.get('ok') else 202
    return _build(status_code, {
        'message': 'Mensaje registrado',
        'sent': bool(send_result.get('ok')),
        'status': mensaje['message_status'],
        'item': mensaje,
    })


def convertir_lead(event):
    if not all([meta_table, clientes_table, procesos_table]):
        return bad_request('Tablas requeridas no configuradas')

    params = event.get('queryStringParameters') or {}
    lead_pk = str(params.get('lead_pk') or '').strip()
    if not lead_pk:
        return bad_request('lead_pk es requerido')

    lead = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')
    if not lead:
        return bad_request('Lead Meta no encontrado')

    body = _json_body(event)
    try:
        cedula = _normalizar_documento(body.get('cedula'))
        proyecto_id = _clean(body.get('proyecto_id'))
        inmobiliaria_id = _normalizar_inmo_id(body.get('inmobiliaria_id') or lead.get('inmobiliaria_id'))
        nombres = _normalizar_nombre(body.get('nombres'))
        apellidos = _normalizar_nombre(body.get('apellidos'))
        correo = _normalizar_correo(body.get('correo'))
        telefono = _normalizar_telefono(body.get('telefono'))
        unidad_id = _clean(body.get('unidad_id'))
    except ValueError as exc:
        return bad_request(str(exc))

    if not all([cedula, proyecto_id, inmobiliaria_id, nombres, apellidos]):
        return bad_request('cedula, proyecto_id, inmobiliaria_id, nombres y apellidos son requeridos')

    cedula_asociada = str(lead.get('cliente_cedula') or '').strip().upper()
    if cedula_asociada and cedula != cedula_asociada:
        return conflict(f'Este lead ya esta asociado a la cedula {cedula_asociada}. No se puede registrar con otra cedula')

    pk_cliente = f'CLIENTE#{cedula}#{inmobiliaria_id}'
    sk_cliente = f'PROYECTO#{proyecto_id}'
    existing = clientes_table.get_item(Key={'pk': pk_cliente, 'sk': sk_cliente}).get('Item')
    if not existing:
        coincidencias_contacto = _buscar_clientes_por_contacto(
            proyecto_sk=sk_cliente,
            telefono=telefono,
            correo=correo,
        )
        if coincidencias_contacto:
            primera = coincidencias_contacto[0]
            campo = primera.get('coincidencia_por') or 'telefono/correo'
            nombre = ' '.join([
                str(primera.get('nombres') or '').strip(),
                str(primera.get('apellidos') or '').strip(),
            ]).strip()
            detalle = f' ({nombre})' if nombre else ''
            return conflict(f'Posible duplicado por {campo}{detalle} en este proyecto')

    exclusividad = clientes_table.query(
        IndexName='gsi-cedula-proyecto',
        KeyConditionExpression=Key('cedula').eq(cedula) & Key('sk').eq(sk_cliente),
        FilterExpression=Attr('exclusividad_activa').eq(True),
    )
    for item in exclusividad.get('Items', []):
        if _normalizar_inmo_id(item.get('inmobiliaria_id')) != inmobiliaria_id:
            return conflict('Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto')

    if unidad_id:
        for conversion in lead.get('historial_conversiones') or []:
            if (
                str(conversion.get('proyecto_id') or '') == proyecto_id
                and _normalizar_inmo_id(conversion.get('inmobiliaria_id')) == inmobiliaria_id
                and str(conversion.get('unidad_id') or '') == unidad_id
            ):
                return conflict('Este lead ya registro una oportunidad para esta misma unidad')

        unidad = inventario_table.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
        ).get('Item')
        if not unidad:
            return bad_request('Unidad no encontrada')
        if unidad.get('estado') != 'disponible':
            return conflict(f'La unidad no esta disponible para bloqueo (estado actual: {unidad.get("estado", "-")})')

        procesos_unidad = procesos_table.query(
            IndexName='gsi-proyecto-procesos',
            KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
            FilterExpression=Attr('unidad_id').eq(unidad_id),
        )
        for proceso_existente in procesos_unidad.get('Items', []):
            if proceso_existente.get('estado') != 'desvinculado':
                return conflict('Esta unidad ya tiene un proceso de venta activo')

    ahora_dt = datetime.now(timezone.utc)
    ahora = ahora_dt.isoformat()
    fecha_vencimiento = _add_months(ahora_dt, 3).isoformat()
    usuario = {
        'sub': get_sub(event) or '',
        'nombre': get_nombre(event),
    }

    cliente = {
        'pk': pk_cliente,
        'sk': sk_cliente,
        'tipo': 'CLIENTE',
        'cedula': cedula,
        'inmobiliaria_id': inmobiliaria_id,
        'proyecto_id': proyecto_id,
        'nombres': nombres,
        'apellidos': apellidos,
        'correo': correo,
        'telefono': telefono,
        'estado_civil': _clean(body.get('estado_civil')),
        'nacionalidad': _clean(body.get('nacionalidad')),
        'pais_residencia': _clean(body.get('pais_residencia')),
        'fecha_nacimiento': _clean(body.get('fecha_nacimiento')),
        'exclusividad_activa': True,
        'fecha_captacion': ahora,
        'fecha_vencimiento': fecha_vencimiento,
        'fuente': lead.get('fuente') or 'Meta',
        'origen': lead.get('origen') or 'meta',
        'origen_plataforma': lead.get('origen_plataforma') or 'Meta',
        'origen_canal': lead.get('origen_canal') or lead.get('channel', ''),
        'origen_tipo_interaccion': lead.get('origen_tipo_interaccion') or 'mensaje',
        'origen_cuenta_id': lead.get('origen_cuenta_id') or lead.get('account_id', ''),
        'origen_cuenta_alias': lead.get('origen_cuenta_alias') or lead.get('account_alias', ''),
        'origen_detalle': lead.get('origen_detalle') or {},
        'campaign_id': lead.get('campaign_id', ''),
        'campaign_name': lead.get('campaign_name', ''),
        'adset_id': lead.get('adset_id', ''),
        'adset_name': lead.get('adset_name', ''),
        'ad_id': lead.get('ad_id', ''),
        'ad_name': lead.get('ad_name', ''),
        'form_id': lead.get('form_id', ''),
        'form_name': lead.get('form_name', ''),
        'referral_source': lead.get('referral_source', ''),
        'referral_type': lead.get('referral_type', ''),
        'referral_url': lead.get('referral_url', ''),
        'ctwa_clid': lead.get('ctwa_clid', ''),
        'ads_origin': lead.get('ads_origin') or {},
        'meta_lead_pk': lead_pk,
        'meta_channel': lead.get('channel', ''),
        'meta_contact_id': lead.get('external_contact_id', ''),
        'creado_por_sub': usuario['sub'],
        'creado_por_nombre': usuario['nombre'],
    }
    if existing:
        updates = ['actualizado_en = :actualizado_en']
        values = {':actualizado_en': ahora}
        names = {}
        for campo in (
            'nombres', 'apellidos', 'correo', 'telefono', 'estado_civil',
            'nacionalidad', 'pais_residencia', 'fecha_nacimiento',
        ):
            if cliente.get(campo):
                names[f'#{campo}'] = campo
                values[f':{campo}'] = cliente[campo]
                updates.append(f'#{campo} = :{campo}')
        clientes_table.update_item(
            Key={'pk': pk_cliente, 'sk': sk_cliente},
            UpdateExpression='SET ' + ', '.join(updates),
            ExpressionAttributeValues=values,
            **({'ExpressionAttributeNames': names} if names else {}),
        )
        cliente = clientes_table.get_item(Key={'pk': pk_cliente, 'sk': sk_cliente}).get('Item', cliente)
    else:
        clientes_table.put_item(Item=cliente)

    proceso = None
    if unidad_id:
        unidad_nombre = _resolver_nombre_unidad(proyecto_id, unidad_id)
        proceso = {
            'pk': f'PROCESO#{cedula}#{inmobiliaria_id}',
            'sk': f'UNIDAD#{unidad_id}',
            'cedula': cedula,
            'inmobiliaria_id': inmobiliaria_id,
            'proyecto_id': proyecto_id,
            'unidad_id': unidad_id,
            'unidad_nombre': unidad_nombre,
            'estado': 'captacion',
            'historial': [{
                'tipo': 'conversion_meta',
                'ejecutado_por': usuario['sub'],
                'ejecutado_por_nombre': usuario['nombre'],
                'notificacion_enviada': False,
                'timestamp': ahora,
                'meta_lead_pk': lead_pk,
            }],
            'fecha_inicio': ahora,
            'actualizado_en': ahora,
            'fuente': lead.get('fuente') or 'Meta',
            'origen': lead.get('origen') or 'meta',
            'origen_plataforma': lead.get('origen_plataforma') or 'Meta',
            'origen_canal': lead.get('origen_canal') or lead.get('channel', ''),
            'origen_tipo_interaccion': lead.get('origen_tipo_interaccion') or 'mensaje',
            'origen_cuenta_id': lead.get('origen_cuenta_id') or lead.get('account_id', ''),
            'origen_cuenta_alias': lead.get('origen_cuenta_alias') or lead.get('account_alias', ''),
            'origen_detalle': lead.get('origen_detalle') or {},
            'campaign_id': lead.get('campaign_id', ''),
            'campaign_name': lead.get('campaign_name', ''),
            'adset_id': lead.get('adset_id', ''),
            'adset_name': lead.get('adset_name', ''),
            'ad_id': lead.get('ad_id', ''),
            'ad_name': lead.get('ad_name', ''),
            'form_id': lead.get('form_id', ''),
            'form_name': lead.get('form_name', ''),
            'referral_source': lead.get('referral_source', ''),
            'referral_type': lead.get('referral_type', ''),
            'referral_url': lead.get('referral_url', ''),
            'ctwa_clid': lead.get('ctwa_clid', ''),
            'ads_origin': lead.get('ads_origin') or {},
            'meta_lead_pk': lead_pk,
        }
        procesos_table.put_item(Item=proceso)
        _activar_bloqueo_desde_proceso(
            cedula,
            inmobiliaria_id,
            proyecto_id,
            unidad_id,
            unidad_nombre,
        )

    conversion_meta = {
        'convertido_en': ahora,
        'usuario_sub': usuario['sub'],
        'usuario_nombre': usuario['nombre'],
        'cedula': cedula,
        'cliente_pk': pk_cliente,
        'proyecto_id': proyecto_id,
        'inmobiliaria_id': inmobiliaria_id,
        'unidad_id': unidad_id,
        'unidad_nombre': unidad_nombre if unidad_id else '',
        'con_unidad': bool(unidad_id),
    }

    meta_table.update_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'},
        UpdateExpression=(
            'SET #estado = :estado, convertido_en = :convertido_en, '
            'cliente_cedula = :cedula, cliente_pk = :cliente_pk, proyecto_id = :proyecto_id, '
            'inmobiliaria_id = :inmobiliaria_id, unidad_id = :unidad_id, actualizado_en = :actualizado_en, '
            'historial_conversiones = list_append(if_not_exists(historial_conversiones, :empty_list), :conversion)'
        ),
        ExpressionAttributeNames={'#estado': 'estado'},
        ExpressionAttributeValues={
            ':estado': 'convertido',
            ':convertido_en': ahora,
            ':cedula': cedula,
            ':cliente_pk': pk_cliente,
            ':proyecto_id': proyecto_id,
            ':inmobiliaria_id': inmobiliaria_id,
            ':unidad_id': unidad_id,
            ':actualizado_en': ahora,
            ':empty_list': [],
            ':conversion': [conversion_meta],
        },
    )
    meta_table.put_item(Item={
        'pk': lead_pk,
        'sk': f'ACTIVIDAD#{ahora}#conversion_cliente',
        'tipo': 'META_ACTIVIDAD',
        'tipo_actividad': 'conversion_cliente',
        'creado_en': ahora,
        'usuario_sub': usuario['sub'],
        'usuario_nombre': usuario['nombre'],
        'cedula': cedula,
        'cliente_pk': pk_cliente,
        'proyecto_id': proyecto_id,
        'inmobiliaria_id': inmobiliaria_id,
        'unidad_id': unidad_id,
        'unidad_nombre': unidad_nombre if unidad_id else '',
    })

    lead_actualizado = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')

    return ok({
        'message': 'Operacion registrada desde lead Meta',
        'lead': lead_actualizado,
        'cliente': cliente,
        'proceso': proceso,
    })


def asociar_cliente_existente(event):
    if not all([meta_table, clientes_table, procesos_table]):
        return bad_request('Tablas requeridas no configuradas')

    params = event.get('queryStringParameters') or {}
    lead_pk = str(params.get('lead_pk') or '').strip()
    if not lead_pk:
        return bad_request('lead_pk es requerido')

    lead = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')
    if not lead:
        return bad_request('Lead Meta no encontrado')

    body = _json_body(event)
    try:
        cedula = _normalizar_documento(body.get('cedula'))
    except ValueError as exc:
        return bad_request(str(exc))

    if not cedula:
        return bad_request('cedula es requerida')

    registros_cliente = _buscar_registros_cliente_por_cedula(cedula)
    if not registros_cliente:
        return bad_request('Cliente existente no encontrado')

    ahora = _now()
    usuario = {
        'sub': get_sub(event) or '',
        'nombre': get_nombre(event),
    }
    cliente_principal = _cliente_principal(registros_cliente)
    cliente_nombre = _cliente_nombre(cliente_principal)
    nombres_variantes = sorted({
        nombre for nombre in (_cliente_nombre(item) for item in registros_cliente)
        if nombre
    })

    meta_table.update_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'},
        UpdateExpression=(
            'SET cliente_asociado = :cliente_asociado, '
            'cliente_asociacion_tipo = :cliente_asociacion_tipo, '
            'cliente_cedula = :cedula, cliente_nombre = :cliente_nombre, '
            'cliente_registros_count = :cliente_registros_count, '
            'cliente_nombre_variantes = :cliente_nombre_variantes, asociado_en = :asociado_en, '
            'asociado_por_sub = :asociado_por_sub, asociado_por_nombre = :asociado_por_nombre, '
            'actualizado_en = :actualizado_en'
            ' REMOVE cliente_pk, cliente_sk, cliente_inmobiliaria_id, cliente_proyecto_id'
        ),
        ExpressionAttributeValues={
            ':cliente_asociado': True,
            ':cliente_asociacion_tipo': 'cedula',
            ':cedula': cedula,
            ':cliente_nombre': cliente_nombre,
            ':cliente_registros_count': len(registros_cliente),
            ':cliente_nombre_variantes': nombres_variantes,
            ':asociado_en': ahora,
            ':asociado_por_sub': usuario['sub'],
            ':asociado_por_nombre': usuario['nombre'],
            ':actualizado_en': ahora,
        },
    )
    meta_table.put_item(Item={
        'pk': lead_pk,
        'sk': f'ACTIVIDAD#{ahora}#cliente_asociado',
        'tipo': 'META_ACTIVIDAD',
        'tipo_actividad': 'cliente_asociado',
        'creado_en': ahora,
        'usuario_sub': usuario['sub'],
        'usuario_nombre': usuario['nombre'],
        'cedula': cedula,
        'cliente_registros_count': len(registros_cliente),
        'cliente_nombre': cliente_nombre,
    })

    lead_actualizado = meta_table.get_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'}
    ).get('Item')
    oportunidades = _listar_oportunidades_cliente_asociado(lead_actualizado or {})
    if lead_actualizado is not None:
        lead_actualizado['oportunidades_asociadas'] = oportunidades

    return ok({
        'message': 'Cliente existente asociado al lead Meta',
        'lead': lead_actualizado,
        'cliente': cliente_principal,
        'clientes': registros_cliente,
        'oportunidades_asociadas': oportunidades,
    })


def _conversation_pk_from_lead(lead):
    channel = lead.get('channel')
    account_alias = lead.get('account_alias')
    external_contact_id = lead.get('external_contact_id')
    if not all([channel, account_alias, external_contact_id]):
        return ''
    return f'CONVERSACION#{channel}#{account_alias}#{external_contact_id}'


def _build_timeline(lead, mensajes, actividades):
    eventos = []
    for mensaje in mensajes:
        direction = mensaje.get('direction') or 'unknown'
        incoming = direction == 'incoming'
        texto = mensaje.get('text') or _attachment_label(mensaje)
        fecha = mensaje.get('event_timestamp') or mensaje.get('created_at') or ''
        eventos.append({
            'id': f'{mensaje.get("pk", "")}#{mensaje.get("sk", "")}',
            'tipo': 'mensaje_recibido' if incoming else 'mensaje_enviado',
            'categoria': 'mensaje',
            'fecha': fecha,
            'titulo': 'Mensaje recibido' if incoming else 'Mensaje enviado',
            'detalle': texto or 'Evento sin texto',
            'usuario_nombre': mensaje.get('enviado_por_nombre') or '',
            'direction': direction,
            'message_status': mensaje.get('message_status') or '',
            'channel': mensaje.get('channel') or lead.get('channel') or '',
        })

    actividad_conversion_dates = set()
    for actividad in actividades:
        fecha = actividad.get('creado_en') or ''
        if actividad.get('tipo_actividad') == 'conversion_cliente':
            actividad_conversion_dates.add(fecha)
        if actividad.get('tipo_actividad') == 'mensaje_saliente':
            continue
        eventos.append(_timeline_from_actividad(actividad))

    for conversion in lead.get('historial_conversiones') or []:
        fecha = conversion.get('convertido_en') or ''
        if fecha in actividad_conversion_dates:
            continue
        detalle = _conversion_detalle(conversion)
        eventos.append({
            'id': f'conversion#{fecha}#{conversion.get("unidad_id", "sin-unidad")}',
            'tipo': 'oportunidad_registrada',
            'categoria': 'oportunidad',
            'fecha': fecha,
            'titulo': 'Oportunidad registrada',
            'detalle': detalle,
            'usuario_nombre': conversion.get('usuario_nombre') or 'Sistema',
            'proyecto_id': conversion.get('proyecto_id') or '',
            'unidad_id': conversion.get('unidad_id') or '',
            'unidad_nombre': conversion.get('unidad_nombre') or '',
            'cedula': conversion.get('cedula') or '',
            'inmobiliaria_id': conversion.get('inmobiliaria_id') or '',
        })

    eventos.sort(key=lambda item: item.get('fecha') or '')
    return eventos


def _timeline_from_actividad(actividad):
    tipo = actividad.get('tipo_actividad') or 'actividad'
    titulo = {
        'cambio_estado': 'Cambio de estado',
        'reapertura_lead': 'Lead reabierto',
        'asignacion_responsable': 'Responsable actualizado',
        'asignacion_inmobiliaria': 'Inmobiliaria actualizada',
        'nota': 'Nota interna',
        'conversion_cliente': 'Oportunidad registrada',
        'mensaje_saliente': 'Respuesta registrada',
    }.get(tipo, 'Actividad registrada')
    categoria = 'nota' if tipo == 'nota' else 'oportunidad' if tipo == 'conversion_cliente' else 'actividad'

    detalle = ''
    if tipo == 'cambio_estado':
        detalle = f'{actividad.get("estado_anterior") or "-"} -> {actividad.get("estado_nuevo") or "-"}'
        if actividad.get('motivo_cierre'):
            detalle = f'{detalle} ({actividad.get("motivo_cierre")})'
    elif tipo == 'reapertura_lead':
        detalle = f'{actividad.get("estado_anterior") or "cerrado"} -> {actividad.get("estado_nuevo") or "nuevo"}'
    elif tipo == 'asignacion_responsable':
        detalle = (
            f'{actividad.get("responsable_anterior_nombre") or "Sin asignar"}'
            f' -> {actividad.get("responsable_nuevo_nombre") or "Sin asignar"}'
        )
    elif tipo == 'asignacion_inmobiliaria':
        detalle = (
            f'{actividad.get("inmobiliaria_anterior_nombre") or "Sin asignar"}'
            f' -> {actividad.get("inmobiliaria_nueva_nombre") or "Sin asignar"}'
        )
    elif tipo == 'nota':
        detalle = actividad.get('nota') or ''
    elif tipo == 'conversion_cliente':
        detalle = _conversion_detalle(actividad)
    elif tipo == 'mensaje_saliente':
        detalle = actividad.get('texto') or actividad.get('error_message') or ''
    else:
        detalle = tipo.replace('_', ' ')

    return {
        'id': f'{actividad.get("pk", "")}#{actividad.get("sk", "")}',
        'tipo': tipo,
        'categoria': categoria,
        'fecha': actividad.get('creado_en') or '',
        'titulo': titulo,
        'detalle': detalle,
        'usuario_nombre': actividad.get('usuario_nombre') or 'Sistema',
        'message_status': actividad.get('message_status') or '',
        'proyecto_id': actividad.get('proyecto_id') or '',
        'unidad_id': actividad.get('unidad_id') or '',
        'unidad_nombre': actividad.get('unidad_nombre') or '',
        'cedula': actividad.get('cedula') or '',
        'inmobiliaria_id': actividad.get('inmobiliaria_id') or '',
    }


def _conversion_detalle(item):
    cedula = item.get('cedula') or '-'
    proyecto = item.get('proyecto_id') or '-'
    unidad = item.get('unidad_nombre') or item.get('unidad_id') or 'Sin unidad'
    return f'Cliente {cedula} en proyecto {proyecto}. Unidad: {unidad}'


def _attachment_label(mensaje):
    attachments = mensaje.get('attachments') or []
    media = mensaje.get('media') or {}
    if attachments:
        attachment_type = attachments[0].get('type') or 'archivo'
        return f'Adjunto: {attachment_type}'
    if media:
        return f'Adjunto: {media.get("type") or "archivo"}'
    return ''


def _is_displayable_message(mensaje):
    return bool(
        mensaje.get('text')
        or mensaje.get('attachments')
        or mensaje.get('media')
    )


def _scan_all(**kwargs):
    items = []
    while True:
        result = meta_table.scan(**kwargs)
        items.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    return items


def _encode_cursor(last_key):
    if not last_key:
        return ''
    payload = json.dumps(last_key, separators=(',', ':'), default=str).encode('utf-8')
    return base64.urlsafe_b64encode(payload).decode('ascii')


def _decode_cursor(cursor):
    if not cursor:
        return None
    try:
        padded = cursor + ('=' * (-len(cursor) % 4))
        return json.loads(base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8'))
    except Exception:
        return None


def _lead_matches_search(item, search_text):
    fields = (
        item.get('external_contact_id'),
        item.get('nombre_manual'),
        item.get('contact_profile_name'),
        item.get('contact_username'),
        item.get('ultimo_mensaje_texto'),
        item.get('responsable_nombre'),
        item.get('inmobiliaria_nombre'),
        item.get('account_alias'),
        item.get('fuente'),
        item.get('campaign_name'),
        item.get('campaign_id'),
        item.get('ad_name'),
        item.get('ad_id'),
    )
    return any(search_text in str(value or '').lower() for value in fields)


def _buscar_registros_cliente_por_cedula(cedula):
    try:
        result = clientes_table.query(
            IndexName='gsi-cedula-proyecto',
            KeyConditionExpression=Key('cedula').eq(cedula),
        )
        items = result.get('Items', [])
        while result.get('LastEvaluatedKey'):
            result = clientes_table.query(
                IndexName='gsi-cedula-proyecto',
                KeyConditionExpression=Key('cedula').eq(cedula),
                ExclusiveStartKey=result['LastEvaluatedKey'],
            )
            items.extend(result.get('Items', []))
        return items
    except Exception as exc:
        print(f'Error buscando registros de cliente por cedula: {exc}')
        return []


def _cliente_nombre(cliente):
    return ' '.join([
        str(cliente.get('nombres') or '').strip(),
        str(cliente.get('apellidos') or '').strip(),
    ]).strip()


def _cliente_principal(registros):
    def score(item):
        completitud = sum(1 for campo in ('nombres', 'apellidos', 'telefono', 'correo') if item.get(campo))
        fecha = item.get('fecha_captacion') or ''
        return (fecha, completitud)

    return sorted(registros, key=score, reverse=True)[0]


def _listar_oportunidades_cliente_asociado(lead):
    cedula = lead.get('cliente_cedula') or ''
    if not all([procesos_table, cedula]):
        return []
    try:
        result = procesos_table.query(
            IndexName='gsi-cedula-procesos',
            KeyConditionExpression=Key('cedula').eq(cedula),
            ScanIndexForward=False,
        )
        items = result.get('Items', [])
        while result.get('LastEvaluatedKey'):
            result = procesos_table.query(
                IndexName='gsi-cedula-procesos',
                KeyConditionExpression=Key('cedula').eq(cedula),
                ScanIndexForward=False,
                ExclusiveStartKey=result['LastEvaluatedKey'],
            )
            items.extend(result.get('Items', []))
    except Exception as exc:
        print(f'Error cargando oportunidades de cliente asociado: {exc}')
        return []

    items.sort(key=lambda item: item.get('actualizado_en') or item.get('fecha_inicio') or '', reverse=True)
    oportunidades = []
    for item in items:
        oportunidades.append({
            'origen': 'cliente_asociado',
            'cedula': item.get('cedula') or cedula,
            'inmobiliaria_id': _normalizar_inmo_id(item.get('inmobiliaria_id') or ''),
            'proyecto_id': item.get('proyecto_id') or '',
            'unidad_id': item.get('unidad_id') or '',
            'unidad_nombre': item.get('unidad_nombre') or item.get('unidad_id') or '',
            'estado': item.get('estado') or '',
            'fecha_inicio': item.get('fecha_inicio') or '',
            'actualizado_en': item.get('actualizado_en') or '',
            'proceso_pk': item.get('pk') or '',
            'proceso_sk': item.get('sk') or '',
        })
    return oportunidades


def _listar_leads_feed(limit=None, cursor='', matches_filters=None):
    matches_filters = matches_filters or (lambda item: True)
    start_key = _decode_cursor(cursor)
    try:
        items = []
        kwargs = {
            'IndexName': 'gsi-meta-leads-feed',
            'KeyConditionExpression': Key('feed_pk').eq('META_LEAD'),
            'ScanIndexForward': False,
        }
        if limit:
            kwargs['Limit'] = limit
        if start_key:
            kwargs['ExclusiveStartKey'] = start_key

        last_key = None
        while limit is None or len(items) < limit:
            result = meta_table.query(**kwargs)
            items.extend([item for item in result.get('Items', []) if matches_filters(item)])
            last_key = result.get('LastEvaluatedKey')
            if not last_key:
                break
            kwargs['ExclusiveStartKey'] = last_key

        return {
            'items': items[:limit] if limit else items,
            'next_cursor': _encode_cursor(last_key),
        }
    except ClientError as exc:
        code = exc.response.get('Error', {}).get('Code')
        if code not in {'ValidationException', 'ResourceNotFoundException'}:
            raise

    scan_kwargs = {}
    if start_key:
        scan_kwargs['ExclusiveStartKey'] = start_key
    items = []
    last_key = None
    while limit is None or len(items) < limit:
        result = meta_table.scan(**scan_kwargs)
        leads_page = [
            item for item in result.get('Items', [])
            if item.get('tipo') == 'META_LEAD' and matches_filters(item)
        ]
        items.extend(leads_page)
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break
        scan_kwargs['ExclusiveStartKey'] = last_key

    leads = items[:limit] if limit else items
    leads.sort(key=lambda item: item.get('ultimo_mensaje_en', ''), reverse=True)
    return {
        'items': leads,
        'next_cursor': _encode_cursor(last_key),
    }


def _query_all(**kwargs):
    items = []
    while True:
        result = meta_table.query(**kwargs)
        items.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    return items


def _actualizar_lead_por_mensaje_saliente(lead_pk, mensaje):
    meta_table.update_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'},
        UpdateExpression=(
            'SET ultimo_mensaje_en = :ultimo_mensaje_en, '
            'feed_pk = :feed_pk, '
            'feed_sk = :feed_sk, '
            'ultimo_mensaje_texto = :ultimo_mensaje_texto, '
            'ultimo_evento_id = :ultimo_evento_id, '
            'actualizado_en = :actualizado_en '
            'ADD mensajes_enviados :one, mensajes_totales :one'
        ),
        ExpressionAttributeValues={
            ':ultimo_mensaje_en': mensaje.get('event_timestamp'),
            ':feed_pk': 'META_LEAD',
            ':feed_sk': mensaje.get('event_timestamp'),
            ':ultimo_mensaje_texto': mensaje.get('text', ''),
            ':ultimo_evento_id': mensaje.get('external_event_id', ''),
            ':actualizado_en': _now(),
            ':one': 1,
        },
    )


def _send_meta_message(lead, texto, media_type='', media_url='', media_filename='', media_content_type='', media_voice=False, quoted_message_id=''):
    canal = str(lead.get('channel') or '').lower()
    account_alias = str(lead.get('account_alias') or '')
    contact_id = str(lead.get('external_contact_id') or '')

    try:
        if canal == 'whatsapp':
            phone_number_id = (
                str(lead.get('phone_number_id') or '')
                or WHATSAPP_PHONE_NUMBER_IDS.get(account_alias, '')
            )
            if quoted_message_id or (media_type and media_url):
                token = _get_token(WHATSAPP_TOKEN_PARAMS.get(account_alias))
                if token and phone_number_id:
                    media_id = ''
                    if media_type == 'audio' and media_url:
                        upload_result = _upload_whatsapp_cloud_media(
                            phone_number_id,
                            token,
                            media_url,
                            media_content_type or 'audio/ogg',
                            media_filename or 'audio.ogg',
                        )
                        if upload_result.get('ok'):
                            media_id = upload_result.get('media_id') or ''
                    return _post_graph(
                        f'https://graph.facebook.com/v22.0/{phone_number_id}/messages',
                        token,
                        _whatsapp_cloud_message_payload(
                            contact_id,
                            texto,
                            media_type=media_type,
                            media_url=media_url,
                            media_id=media_id,
                            media_filename=media_filename,
                            media_voice=media_voice,
                            quoted_message_id=quoted_message_id,
                        ),
                    )

            payload = {
                'tenant': METHODICA_TENANT_ID,
                'provider': 'whatsapp',
                'phoneNumberId': phone_number_id,
                'to': contact_id,
                'text': texto,
                'leadPk': lead.get('pk', ''),
                'accountAlias': account_alias,
            }
            if quoted_message_id:
                payload['context'] = {'message_id': quoted_message_id}
                payload['context_message_id'] = quoted_message_id
                payload['contextMessageId'] = quoted_message_id
                payload['quoted_message_id'] = quoted_message_id
                payload['quotedMessageId'] = quoted_message_id
                payload['reply_to'] = {'message_id': quoted_message_id}
                payload['replyTo'] = {'messageId': quoted_message_id}
                payload['reply_to_message_id'] = quoted_message_id
                payload['replyToMessageId'] = quoted_message_id
            if media_type and media_url:
                payload['mediaType'] = media_type
                payload['mediaUrl'] = media_url
                if texto:
                    payload['caption'] = texto
                if media_filename:
                    payload['filename'] = media_filename
            return _post_methodica_channel_message(payload)

        if canal == 'messenger':
            token = _get_token(MESSENGER_TOKEN_PARAMS.get(account_alias))
            if not token:
                payload = {
                    'tenant': METHODICA_TENANT_ID,
                    'provider': 'messenger',
                    'to': contact_id,
                    'text': texto,
                    'leadPk': lead.get('pk', ''),
                    'accountAlias': account_alias,
                }
                if media_type and media_url:
                    payload['mediaType'] = media_type
                    payload['mediaUrl'] = media_url
                    if texto:
                        payload['caption'] = texto
                    if media_filename:
                        payload['filename'] = media_filename
                return _post_methodica_channel_message(payload)
            message_payload = _meta_send_message_payload(texto, media_type, media_url)
            return _post_graph(
                'https://graph.facebook.com/v26.0/me/messages',
                token,
                {
                    'messaging_type': 'RESPONSE',
                    'recipient': {'id': contact_id},
                    'message': message_payload,
                },
            )

        if canal == 'instagram':
            token = _get_token(INSTAGRAM_TOKEN_PARAMS.get(account_alias))
            account_id = str(lead.get('account_id') or '')
            if not token:
                return _pending_config('Instagram no tiene token configurado')
            # Tokens de Instagram Login API (prefijo IGAA) usan graph.instagram.com
            # con /me/messages. Los tokens de Pagina usan graph.facebook.com.
            if token.startswith('IGAA'):
                url = 'https://graph.instagram.com/v22.0/me/messages'
            else:
                if not account_id:
                    return _pending_config('Instagram no tiene account_id configurado')
                url = f'https://graph.facebook.com/v22.0/{account_id}/messages'
            message_payload = _meta_send_message_payload(texto, media_type, media_url)
            return _post_graph(
                url,
                token,
                {
                    'recipient': {'id': contact_id},
                    'message': message_payload,
                },
            )

        return _pending_config(f'Canal no soportado para envio: {canal}')
    except Exception as exc:
        return {
            'ok': False,
            'status': 'fallido',
            'message': str(exc),
            'response': {},
        }


def _meta_send_message_payload(texto, media_type='', media_url=''):
    if media_type and media_url:
        attachment_type = {
            'image': 'image',
            'video': 'video',
            'audio': 'audio',
            'document': 'file',
        }.get(media_type, media_type)
        return {
            'attachment': {
                'type': attachment_type,
                'payload': {
                    'url': media_url,
                    'is_reusable': True,
                },
            },
        }
    return {'text': texto}


def _upload_whatsapp_cloud_media(phone_number_id, token, media_url, content_type, filename):
    try:
        with urllib.request.urlopen(media_url, timeout=20) as response:
            file_bytes = response.read()
            response_content_type = response.headers.get('Content-Type') or ''
    except Exception as exc:
        return {'ok': False, 'message': f'No se pudo descargar el audio para Meta: {exc}'}

    upload_content_type = (content_type or response_content_type or 'audio/ogg').split(';')[0].strip()
    boundary = f'----jam-meta-{uuid.uuid4().hex}'
    parts = [
        (
            f'--{boundary}\r\n'
            'Content-Disposition: form-data; name="messaging_product"\r\n\r\n'
            'whatsapp\r\n'
        ).encode('utf-8'),
        (
            f'--{boundary}\r\n'
            'Content-Disposition: form-data; name="type"\r\n\r\n'
            f'{upload_content_type}\r\n'
        ).encode('utf-8'),
        (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="file"; filename="{filename or "audio.ogg"}"\r\n'
            f'Content-Type: {upload_content_type}\r\n\r\n'
        ).encode('utf-8'),
        file_bytes,
        f'\r\n--{boundary}--\r\n'.encode('utf-8'),
    ]
    request = urllib.request.Request(
        f'https://graph.facebook.com/v22.0/{phone_number_id}/media',
        data=b''.join(parts),
        method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response_body = json.loads(response.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as exc:
        response_text = exc.read().decode('utf-8', 'replace')
        return {'ok': False, 'message': response_text[:1000]}
    except Exception as exc:
        return {'ok': False, 'message': str(exc)}

    media_id = str(response_body.get('id') or '')
    return {'ok': bool(media_id), 'media_id': media_id, 'response': response_body}


def _whatsapp_cloud_message_payload(to, texto, media_type='', media_url='', media_id='', media_filename='', media_voice=False, quoted_message_id=''):
    payload = {
        'messaging_product': 'whatsapp',
        'to': to,
    }
    if quoted_message_id:
        payload['context'] = {'message_id': quoted_message_id}

    if media_type and media_url:
        payload['type'] = media_type
        media_payload = {'id': media_id} if media_id else {'link': media_url}
        if media_type in {'image', 'video', 'document'} and texto:
            media_payload['caption'] = texto
        if media_type == 'audio' and media_voice:
            media_payload['voice'] = True
        if media_type == 'document' and media_filename:
            media_payload['filename'] = media_filename
        payload[media_type] = media_payload
        return payload

    payload['type'] = 'text'
    payload['text'] = {
        'preview_url': False,
        'body': texto,
    }
    return payload


def _pending_config(message):
    return {
        'ok': False,
        'status': 'pendiente_configuracion',
        'message': message,
        'response': {},
    }


def _post_methodica_channel_message(payload):
    channel_key = _get_token(METHODICA_CHANNEL_KEY_PARAM)
    if not METHODICA_CHANNEL_MESSAGES_URL or not channel_key:
        return _pending_config('Methodica hub no tiene API key configurada')
    request = urllib.request.Request(
        METHODICA_CHANNEL_MESSAGES_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'X-Methodica-Channel-Key': channel_key,
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            body = json.loads(response.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', 'replace')[:1000]
        return {
            'ok': False,
            'status': 'fallido',
            'message': f'Methodica hub rechazo el envio: {detail}',
            'response': {},
        }
    return {
        'ok': bool(body.get('ok')),
        'status': body.get('status') or ('enviado' if body.get('sent') else 'fallido'),
        'message': body.get('message') or '',
        'message_id': body.get('providerMessageId') or '',
        'response': body,
    }


def _get_token(param_name):
    if not param_name:
        return ''
    try:
        result = ssm.get_parameter(Name=param_name, WithDecryption=True)
        return result.get('Parameter', {}).get('Value') or ''
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'ParameterNotFound':
            return ''
        raise


def _put_secure_parameter(param_name, value):
    if not param_name:
        raise ValueError('Parametro SSM no configurado para Messenger')
    ssm.put_parameter(
        Name=param_name,
        Value=value,
        Type='SecureString',
        Overwrite=True,
    )


def _facebook_redirect_uri():
    if META_FACEBOOK_REDIRECT_URI:
        return META_FACEBOOK_REDIRECT_URI
    return 'https://dcgjiswnwqab6.cloudfront.net/meta/facebook/callback'


def _graph_get(url, params):
    full_url = f'{url}?{urlencode(params)}'
    request = urllib.request.Request(full_url, method='GET')
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', 'replace')[:1000]
        raise ValueError(f'Meta rechazo la solicitud: {detail}')


def _subscribe_page_to_webhook(page_id, page_token):
    payload = urlencode({
        'subscribed_fields': 'messages,messaging_postbacks,message_deliveries,message_reads',
        'access_token': page_token,
    }).encode('utf-8')
    request = urllib.request.Request(
        f'https://graph.facebook.com/v26.0/{page_id}/subscribed_apps',
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', 'replace')[:1000]
        raise ValueError(f'No se pudo suscribir la pagina al webhook: {detail}')


def _upsert_connected_messenger_page(page_id, page_name):
    if not meta_table:
        return
    ahora = _now()
    meta_table.put_item(Item={
        'pk': f'META_ACCOUNT#messenger#{META_MESSENGER_DEFAULT_ALIAS}',
        'sk': 'METADATA',
        'tipo': 'META_ACCOUNT',
        'channel': 'messenger',
        'account_alias': META_MESSENGER_DEFAULT_ALIAS,
        'account_id': page_id,
        'page_id': page_id,
        'page_name': page_name,
        'token_param': META_MESSENGER_PAGE_TOKEN_PARAM,
        'connected': True,
        'actualizado_en': ahora,
    })


def _post_graph(url, token, payload):
    data = json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(
        url,
        data=data,
        method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response_body = json.loads(response.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as exc:
        response_text = exc.read().decode('utf-8')
        try:
            response_body = json.loads(response_text)
        except json.JSONDecodeError:
            response_body = {'message': response_text}
        return {
            'ok': False,
            'status': 'fallido',
            'message': _meta_error_message(response_body),
            'response': response_body,
        }

    message_id = ''
    messages = response_body.get('messages') or []
    if messages and isinstance(messages, list):
        message_id = str((messages[0] or {}).get('id') or '')
    message_id = message_id or str(response_body.get('message_id') or response_body.get('recipient_id') or '')
    return {
        'ok': True,
        'message_id': message_id,
        'response': response_body,
    }


def _meta_error_message(response_body):
    error = response_body.get('error') if isinstance(response_body, dict) else None
    if isinstance(error, dict):
        return str(error.get('message') or error)
    return str(response_body)


def _json_body(event):
    try:
        return json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return {}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _add_months(dt, months):
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    max_day = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
               31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return dt.replace(year=year, month=month, day=min(dt.day, max_day))


def _clean(value):
    return ' '.join(str(value or '').strip().split())


def _normalizar_nombre(value):
    return _clean(value).upper()


def _normalizar_documento(value):
    documento = _clean(value).upper()
    if documento and not DOCUMENTO_RE.match(documento):
        raise ValueError('La cedula/pasaporte solo debe contener letras y numeros, sin guiones ni simbolos')
    return documento


def _normalizar_correo(value):
    correo = _clean(value).lower()
    if correo and not EMAIL_RE.match(correo):
        raise ValueError('El correo debe tener un formato valido')
    return correo


def _normalizar_telefono(value):
    raw = _clean(value)
    if raw and not raw.isdigit():
        raise ValueError('El telefono solo debe contener numeros')
    return raw


def _normalizar_inmo_id(value):
    return str(value or '').replace('INMOBILIARIA#', '').strip()


def _resolver_nombre_unidad(proyecto_id, unidad_id):
    if not inventario_table:
        return unidad_id
    try:
        item = inventario_table.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
        ).get('Item', {})
        id_unidad = item.get('id_unidad') or unidad_id
        torre_id = item.get('torre_id')
        if torre_id:
            torre = inventario_table.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'}
            ).get('Item', {})
            torre_nombre = torre.get('nombre')
            if torre_nombre:
                return f'{torre_nombre} - {id_unidad}'
        return id_unidad
    except Exception:
        return unidad_id


def _buscar_clientes_por_contacto(proyecto_sk, telefono='', correo=''):
    if not clientes_table or not any([telefono, correo]):
        return []

    proyecto_id = str(proyecto_sk or '').replace('PROYECTO#', '')
    if not proyecto_id:
        return []

    contact_filter = None
    if telefono:
        contact_filter = Attr('telefono').eq(telefono)
    if correo:
        correo_filter = Attr('correo').eq(correo)
        contact_filter = correo_filter if contact_filter is None else contact_filter | correo_filter
    if contact_filter is None:
        return []

    items = []
    kwargs = {
        'IndexName': 'gsi-proyecto-clientes',
        'KeyConditionExpression': Key('proyecto_id').eq(proyecto_id),
        'FilterExpression': contact_filter,
        'Limit': 10,
    }
    while len(items) < 10:
        result = clientes_table.query(**kwargs)
        items.extend(result.get('Items', []))
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    items = items[:10]
    for item in items:
        if telefono and item.get('telefono') == telefono:
            item['coincidencia_por'] = 'telefono'
        elif correo and item.get('correo') == correo:
            item['coincidencia_por'] = 'correo'
    return items
