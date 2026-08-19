import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


VERIFY_TOKEN = os.environ.get('META_WEBHOOK_VERIFY_TOKEN', '')
ssm = boto3.client('ssm')
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
conversaciones_table_name = os.environ.get('META_CONVERSACIONES_TABLE', '')
conversaciones_table = (
    dynamodb.Table(conversaciones_table_name)
    if conversaciones_table_name
    else None
)
assets_bucket = os.environ.get('ASSETS_BUCKET', '')
cloudfront_url = os.environ.get('CLOUDFRONT_URL', '').rstrip('/')

INSTAGRAM_ACCOUNTS = {
    os.environ.get('INSTAGRAM_ACCOUNT_ID_JAM', ''): {
        'alias': 'jamconstruccionessrl',
        'token_param': os.environ.get('INSTAGRAM_TOKEN_PARAM_JAM', ''),
    },
    os.environ.get('INSTAGRAM_ACCOUNT_ID_CANEY', ''): {
        'alias': 'caneyoriental',
        'token_param': os.environ.get('INSTAGRAM_TOKEN_PARAM_CANEY', ''),
    },
}

MESSENGER_PAGES = {
    os.environ.get('MESSENGER_PAGE_ID_JAM', ''): {
        'alias': 'jam_construcciones',
    },
}

WHATSAPP_ACCOUNTS = {
    os.environ.get('WHATSAPP_BUSINESS_ACCOUNT_ID_JAM', ''): {
        'alias': 'jam_construcciones',
        'phone_number_id': os.environ.get('WHATSAPP_PHONE_NUMBER_ID_JAM', ''),
        'token_param': os.environ.get('WHATSAPP_TOKEN_PARAM_JAM', ''),
    },
}


def _response(status_code, body='', content_type='text/plain'):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': content_type,
            'Access-Control-Allow-Origin': '*',
        },
        'body': body,
    }


def _json_response(status_code, body):
    return _response(
        status_code,
        json.dumps(body, ensure_ascii=False, default=str),
        'application/json',
    )


def _verify_webhook(event):
    params = event.get('queryStringParameters') or {}
    mode = params.get('hub.mode')
    token = params.get('hub.verify_token')
    challenge = params.get('hub.challenge')

    if mode == 'subscribe' and token == VERIFY_TOKEN and challenge:
        return _response(200, challenge)

    print(json.dumps({
        'event': 'meta_webhook_verification_failed',
        'mode': mode,
        'has_token': bool(token),
        'has_challenge': bool(challenge),
    }))
    return _json_response(403, {'message': 'Invalid verify token'})


def _receive_event(event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return _json_response(400, {'message': 'Invalid JSON body'})

    entries = body.get('entry') if isinstance(body, dict) else None
    account_aliases, unknown_entry_ids = _instagram_account_aliases(body)
    stored_count, duplicate_count = _store_meta_events(body)
    print(json.dumps({
        'event': 'meta_webhook_received',
        'object': body.get('object') if isinstance(body, dict) else None,
        'entry_count': len(entries) if isinstance(entries, list) else 0,
        'accounts': account_aliases,
        'unknown_entry_ids': unknown_entry_ids,
        'stored_count': stored_count,
        'duplicate_count': duplicate_count,
    }))

    return _json_response(200, {
        'received': True,
        'stored_count': stored_count,
        'duplicate_count': duplicate_count,
    })


def _store_meta_events(body):
    if not conversaciones_table or not isinstance(body, dict):
        return 0, 0

    items = _normalize_events(body)
    stored_count = 0
    duplicate_count = 0
    for item in items:
        try:
            conversaciones_table.put_item(
                Item=item,
                ConditionExpression='attribute_not_exists(pk) AND attribute_not_exists(sk)',
            )
            if item.get('tipo') == 'META_MENSAJE':
                _upsert_meta_lead(item)
            if item.get('tipo') == 'META_ESTADO_MENSAJE':
                _apply_message_status(item)
            stored_count += 1
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
                duplicate_count += 1
                continue
            raise

    return stored_count, duplicate_count


def _apply_message_status(status_item):
    message_id = status_item.get('external_event_id')
    message_status = status_item.get('message_status')
    if not message_id or not message_status:
        return

    result = conversaciones_table.query(
        IndexName='gsi-external-event',
        KeyConditionExpression=Key('external_event_id').eq(message_id),
        Limit=5,
    )
    for message in result.get('Items', []):
        if message.get('tipo') != 'META_MENSAJE':
            continue
        conversaciones_table.update_item(
            Key={'pk': message['pk'], 'sk': message['sk']},
            UpdateExpression=(
                'SET message_status = :message_status, '
                'message_status_updated_at = :updated_at, '
                'message_status_event_pk = :status_pk, '
                'message_status_event_sk = :status_sk'
            ),
            ExpressionAttributeValues={
                ':message_status': message_status,
                ':updated_at': status_item.get('event_timestamp') or _now_iso(),
                ':status_pk': status_item.get('pk', ''),
                ':status_sk': status_item.get('sk', ''),
            },
        )


def _upsert_meta_lead(message_item):
    now = _now_iso()
    lead_key = _lead_key(message_item)
    legacy_lead_key = _legacy_lead_key(message_item)
    origen_detalle = _origin_metadata(message_item)
    if legacy_lead_key != lead_key:
        existing_legacy = conversaciones_table.get_item(
            Key={'pk': legacy_lead_key, 'sk': 'METADATA'}
        ).get('Item')
        if existing_legacy:
            lead_key = legacy_lead_key
    update_expression = [
        'SET tipo = :tipo',
        'channel = :channel',
        'account_id = :account_id',
        'account_alias = :account_alias',
        'channel_account = :channel_account',
        'contact_key = :contact_key',
        'external_contact_id = :external_contact_id',
        'contact_profile_name = if_not_exists(contact_profile_name, :contact_profile_name)',
        'fuente = :fuente',
        'origen = :origen',
        'origen_plataforma = :origen_plataforma',
        'origen_canal = :origen_canal',
        'origen_tipo_interaccion = :origen_tipo_interaccion',
        'origen_cuenta_id = :origen_cuenta_id',
        'origen_cuenta_alias = :origen_cuenta_alias',
        'origen_contacto_id = :origen_contacto_id',
        'origen_detalle = :origen_detalle',
        'campaign_id = if_not_exists(campaign_id, :empty)',
        'campaign_name = if_not_exists(campaign_name, :empty)',
        'ad_id = if_not_exists(ad_id, :empty)',
        'ad_name = if_not_exists(ad_name, :empty)',
        'form_id = if_not_exists(form_id, :empty)',
        'form_name = if_not_exists(form_name, :empty)',
        'estado = if_not_exists(estado, :estado)',
        'primer_mensaje_en = if_not_exists(primer_mensaje_en, :primer_mensaje_en)',
        'ultimo_mensaje_en = :ultimo_mensaje_en',
        'ultimo_mensaje_texto = :ultimo_mensaje_texto',
        'ultimo_evento_id = :ultimo_evento_id',
        'actualizado_en = :actualizado_en',
        'creado_en = if_not_exists(creado_en, :creado_en)',
        'mensajes_recibidos = if_not_exists(mensajes_recibidos, :zero) + :incoming_inc',
        'mensajes_enviados = if_not_exists(mensajes_enviados, :zero) + :outgoing_inc',
        'mensajes_totales = if_not_exists(mensajes_totales, :zero) + :one',
    ]
    conversaciones_table.update_item(
        Key={
            'pk': lead_key,
            'sk': 'METADATA',
        },
        UpdateExpression=', '.join(update_expression),
        ExpressionAttributeValues={
            ':tipo': 'META_LEAD',
            ':channel': message_item.get('channel', ''),
            ':account_id': message_item.get('account_id', ''),
            ':account_alias': message_item.get('account_alias', ''),
            ':channel_account': message_item.get('channel_account', ''),
            ':contact_key': message_item.get('contact_key', ''),
            ':external_contact_id': message_item.get('external_contact_id', ''),
            ':contact_profile_name': message_item.get('contact_profile_name', ''),
            ':fuente': _source_label(message_item.get('channel', '')),
            ':origen': 'meta',
            ':origen_plataforma': origen_detalle['plataforma'],
            ':origen_canal': origen_detalle['canal'],
            ':origen_tipo_interaccion': origen_detalle['tipo_interaccion'],
            ':origen_cuenta_id': origen_detalle['cuenta_id'],
            ':origen_cuenta_alias': origen_detalle['cuenta_alias'],
            ':origen_contacto_id': origen_detalle['contacto_id'],
            ':origen_detalle': origen_detalle,
            ':empty': '',
            ':estado': 'nuevo',
            ':primer_mensaje_en': message_item.get('event_timestamp', now),
            ':ultimo_mensaje_en': message_item.get('event_timestamp', now),
            ':ultimo_mensaje_texto': message_item.get('text', ''),
            ':ultimo_evento_id': message_item.get('external_event_id', ''),
            ':actualizado_en': now,
            ':creado_en': now,
            ':zero': 0,
            ':one': 1,
            ':incoming_inc': 1 if message_item.get('direction') == 'incoming' else 0,
            ':outgoing_inc': 1 if message_item.get('direction') == 'outgoing' else 0,
        },
    )


def _lead_key(message_item):
    account_identity = (
        message_item.get('account_id')
        or message_item.get('account_alias')
        or 'unknown'
    )
    return (
        f"META_LEAD#{message_item.get('channel', 'unknown')}#"
        f"{account_identity}#"
        f"{message_item.get('external_contact_id', 'unknown')}"
    )


def _legacy_lead_key(message_item):
    return (
        f"META_LEAD#{message_item.get('channel', 'unknown')}#"
        f"{message_item.get('account_alias', 'unknown')}#"
        f"{message_item.get('external_contact_id', 'unknown')}"
    )


def _source_label(channel):
    labels = {
        'instagram': 'Instagram',
        'messenger': 'Facebook Messenger',
        'whatsapp': 'WhatsApp',
    }
    return labels.get(channel, 'Meta')


def _origin_metadata(message_item):
    channel = str(message_item.get('channel') or '').lower()
    event_type = str(message_item.get('event_type') or 'message')
    interaction_labels = {
        'message': 'mensaje',
        'messages': 'mensaje',
        'message_edit': 'mensaje_editado',
        'postback': 'postback',
        'read': 'lectura',
        'delivery': 'entrega',
        'reaction': 'reaccion',
        'referral': 'referido',
        'optin': 'opt_in',
        'text': 'mensaje',
        'image': 'mensaje_media',
        'video': 'mensaje_media',
        'audio': 'mensaje_media',
        'document': 'mensaje_media',
        'sticker': 'mensaje_media',
        'button': 'respuesta_boton',
        'interactive': 'respuesta_interactiva',
    }
    return {
        'plataforma': 'Meta',
        'canal': channel,
        'canal_label': _source_label(channel),
        'tipo_interaccion': interaction_labels.get(event_type, event_type or 'mensaje'),
        'event_type': event_type,
        'cuenta_id': str(message_item.get('account_id') or ''),
        'cuenta_alias': str(message_item.get('account_alias') or ''),
        'contacto_id': str(message_item.get('external_contact_id') or ''),
        'fuente_tecnica': str(message_item.get('channel_account') or ''),
        'campaign_id': '',
        'campaign_name': '',
        'ad_id': '',
        'ad_name': '',
        'form_id': '',
        'form_name': '',
    }


def _normalize_events(body):
    object_type = body.get('object')
    if object_type == 'instagram':
        return _normalize_instagram_events(body)
    if object_type == 'page':
        return _normalize_messenger_events(body)
    if object_type == 'whatsapp_business_account':
        return _normalize_whatsapp_events(body)
    return []


def _normalize_instagram_events(body):
    items = []
    for entry in body.get('entry') or []:
        account_id = str(entry.get('id') or '')
        account = INSTAGRAM_ACCOUNTS.get(account_id, {})
        account_alias = account.get('alias') or account_id or 'unknown'
        for messaging_event in entry.get('messaging') or []:
            items.append(_build_conversation_item(
                channel='instagram',
                account_id=account_id,
                account_alias=account_alias,
                owned_account_id=account_id,
                event_payload=messaging_event,
            ))
        for messaging_event in _change_events(entry, {'messages', 'message_edit'}):
            items.append(_build_conversation_item(
                channel='instagram',
                account_id=account_id,
                account_alias=account_alias,
                owned_account_id=account_id,
                event_payload=messaging_event,
            ))
    return [item for item in items if item]


def _normalize_messenger_events(body):
    items = []
    for entry in body.get('entry') or []:
        page_id = str(entry.get('id') or '')
        page = MESSENGER_PAGES.get(page_id, {})
        page_alias = page.get('alias') or page_id or 'unknown'
        for messaging_event in entry.get('messaging') or []:
            items.append(_build_conversation_item(
                channel='messenger',
                account_id=page_id,
                account_alias=page_alias,
                owned_account_id=page_id,
                event_payload=messaging_event,
            ))
        for messaging_event in _change_events(entry, {'messages', 'message_edit'}):
            items.append(_build_conversation_item(
                channel='messenger',
                account_id=page_id,
                account_alias=page_alias,
                owned_account_id=page_id,
                event_payload=messaging_event,
            ))
    return [item for item in items if item]


def _normalize_whatsapp_events(body):
    items = []
    for entry in body.get('entry') or []:
        account_id = str(entry.get('id') or '')
        account = WHATSAPP_ACCOUNTS.get(account_id, {})
        account_alias = account.get('alias') or account_id or 'unknown'
        owned_phone_id = account.get('phone_number_id') or ''
        for change in entry.get('changes') or []:
            value = change.get('value') or {}
            if not isinstance(value, dict):
                continue
            metadata = value.get('metadata') or {}
            phone_number_id = str(metadata.get('phone_number_id') or owned_phone_id)
            display_phone_number = str(metadata.get('display_phone_number') or '')
            for message in value.get('messages') or []:
                items.append(_build_whatsapp_message_item(
                    account_id=account_id,
                    account_alias=account_alias,
                    phone_number_id=phone_number_id,
                    display_phone_number=display_phone_number,
                    event_payload=message,
                    contacts=value.get('contacts') or [],
                ))
            for status in value.get('statuses') or []:
                items.append(_build_whatsapp_status_item(
                    account_id=account_id,
                    account_alias=account_alias,
                    phone_number_id=phone_number_id,
                    display_phone_number=display_phone_number,
                    event_payload=status,
                ))
    return [item for item in items if item]


def _change_events(entry, supported_fields):
    events = []
    for change in entry.get('changes') or []:
        field = change.get('field')
        value = change.get('value')
        if field in supported_fields and isinstance(value, dict):
            events.append(value)
    return events


def _build_conversation_item(channel, account_id, account_alias, owned_account_id, event_payload):
    sender_id = str((event_payload.get('sender') or {}).get('id') or '')
    recipient_id = str((event_payload.get('recipient') or {}).get('id') or '')
    event_type = _event_type(event_payload)
    external_event_id = _external_event_id(
        channel,
        account_id,
        event_payload,
        event_type,
        sender_id,
        recipient_id,
    )
    if not external_event_id:
        return None

    direction = _direction(owned_account_id, sender_id, recipient_id)
    contact_id = sender_id if direction == 'incoming' else recipient_id
    if not contact_id:
        contact_id = sender_id or recipient_id or 'unknown'

    event_timestamp = _event_timestamp(event_payload)
    created_at = _now_iso()
    message = event_payload.get('message') or {}
    attachments = _message_attachments(message)
    text = (message.get('text') or _attachment_text(attachments))[:4000]

    return {
        'pk': f'CONVERSACION#{channel}#{account_alias}#{contact_id}',
        'sk': f'MENSAJE#{event_timestamp}#{external_event_id}',
        'tipo': 'META_MENSAJE',
        'channel': channel,
        'account_id': account_id,
        'account_alias': account_alias,
        'channel_account': f'{channel}#{account_alias}',
        'contact_key': f'{channel}#{contact_id}',
        'external_contact_id': contact_id,
        'sender_id': sender_id,
        'recipient_id': recipient_id,
        'direction': direction,
        'event_type': event_type,
        'external_event_id': external_event_id,
        'event_timestamp': event_timestamp,
        'text': text,
        'attachments': attachments,
        'payload_summary': _payload_summary(event_payload),
        'created_at': created_at,
    }


def _build_whatsapp_message_item(
    account_id,
    account_alias,
    phone_number_id,
    display_phone_number,
    event_payload,
    contacts,
):
    message_id = str(event_payload.get('id') or '')
    contact_id = str(event_payload.get('from') or '')
    if not message_id or not contact_id:
        return None

    event_timestamp = _event_timestamp(event_payload)
    created_at = _now_iso()
    message_type = str(event_payload.get('type') or 'message')
    contact_profile_name = _whatsapp_contact_name(contact_id, contacts)
    text = _whatsapp_text(event_payload, message_type)
    media = _whatsapp_media_summary(event_payload, message_type)
    if media:
        media = _archive_whatsapp_media(account_alias, media)

    return {
        'pk': f'CONVERSACION#whatsapp#{account_alias}#{contact_id}',
        'sk': f'MENSAJE#{event_timestamp}#{message_id}',
        'tipo': 'META_MENSAJE',
        'channel': 'whatsapp',
        'account_id': account_id,
        'account_alias': account_alias,
        'phone_number_id': phone_number_id,
        'display_phone_number': display_phone_number,
        'channel_account': f'whatsapp#{account_alias}',
        'contact_key': f'whatsapp#{contact_id}',
        'external_contact_id': contact_id,
        'contact_profile_name': contact_profile_name,
        'sender_id': contact_id,
        'recipient_id': phone_number_id,
        'direction': 'incoming',
        'event_type': message_type,
        'external_event_id': message_id,
        'event_timestamp': event_timestamp,
        'text': text,
        'media': media,
        'payload_summary': _whatsapp_payload_summary(event_payload, message_type),
        'created_at': created_at,
    }


def _build_whatsapp_status_item(
    account_id,
    account_alias,
    phone_number_id,
    display_phone_number,
    event_payload,
):
    message_id = str(event_payload.get('id') or '')
    status = str(event_payload.get('status') or '')
    recipient_id = str(event_payload.get('recipient_id') or '')
    if not message_id or not status:
        return None

    event_timestamp = _event_timestamp(event_payload)
    conversation_id = str((event_payload.get('conversation') or {}).get('id') or '')
    pricing = event_payload.get('pricing') or {}
    errors = event_payload.get('errors') or []

    return {
        'pk': f'META_STATUS#whatsapp#{account_alias}#{message_id}',
        'sk': f'STATUS#{event_timestamp}#{status}',
        'tipo': 'META_ESTADO_MENSAJE',
        'channel': 'whatsapp',
        'account_id': account_id,
        'account_alias': account_alias,
        'phone_number_id': phone_number_id,
        'display_phone_number': display_phone_number,
        'channel_account': f'whatsapp#{account_alias}',
        'contact_key': f'whatsapp#{recipient_id}',
        'external_contact_id': recipient_id,
        'external_event_id': message_id,
        'message_status': status,
        'event_timestamp': event_timestamp,
        'conversation_id': conversation_id,
        'pricing_category': pricing.get('category', ''),
        'billable': pricing.get('billable'),
        'errors': errors,
        'payload_summary': {
            'has_errors': bool(errors),
            'error_count': len(errors) if isinstance(errors, list) else 0,
        },
        'created_at': _now_iso(),
    }


def _event_type(event_payload):
    for candidate in (
        'message',
        'postback',
        'read',
        'delivery',
        'reaction',
        'referral',
        'optin',
    ):
        if candidate in event_payload:
            return candidate
    return 'event'


def _whatsapp_text(event_payload, message_type):
    if message_type == 'text':
        return str((event_payload.get('text') or {}).get('body') or '')[:4000]
    if message_type == 'button':
        return str((event_payload.get('button') or {}).get('text') or '')[:4000]
    if message_type == 'interactive':
        interactive = event_payload.get('interactive') or {}
        button_reply = interactive.get('button_reply') or {}
        list_reply = interactive.get('list_reply') or {}
        return str(button_reply.get('title') or list_reply.get('title') or '')[:4000]
    if message_type in ('image', 'video', 'audio', 'document', 'sticker'):
        media = event_payload.get(message_type) or {}
        caption = media.get('caption')
        return str(caption or f'[{message_type}]')[:4000]
    return f'[{message_type}]'


def _whatsapp_media_summary(event_payload, message_type):
    if message_type not in ('image', 'video', 'audio', 'document', 'sticker'):
        return None
    media = event_payload.get(message_type) or {}
    return {
        'type': message_type,
        'id': media.get('id', ''),
        'mime_type': media.get('mime_type', ''),
        'sha256': media.get('sha256', ''),
        'filename': media.get('filename', ''),
        'caption': media.get('caption', ''),
        'storage_status': 'metadata_only',
    }


def _archive_whatsapp_media(account_alias, media):
    media_id = str(media.get('id') or '')
    if not media_id or not assets_bucket:
        return media

    token = _get_whatsapp_token(account_alias)
    if not token:
        media['storage_status'] = 'pending_token'
        return media

    try:
        metadata = _graph_get_json(f'https://graph.facebook.com/v26.0/{media_id}', token)
        media_url = metadata.get('url')
        mime_type = metadata.get('mime_type') or media.get('mime_type') or 'application/octet-stream'
        if not media_url:
            media['storage_status'] = 'metadata_without_url'
            media['meta_media_metadata'] = metadata
            return media

        content = _download_meta_file(media_url, token)
        extension = _media_extension(mime_type, media.get('filename', ''))
        now = datetime.now(timezone.utc)
        key = (
            f'assets/meta-media/whatsapp/{account_alias}/'
            f'{now.year:04d}/{now.month:02d}/{media_id}{extension}'
        )
        s3.put_object(
            Bucket=assets_bucket,
            Key=key,
            Body=content,
            ContentType=mime_type,
        )
        media.update({
            'mime_type': mime_type,
            'meta_media_url_cached': bool(media_url),
            'storage_status': 'stored',
            's3_bucket': assets_bucket,
            's3_key': key,
            'public_url': f'{cloudfront_url}/{key}' if cloudfront_url else '',
        })
    except Exception as exc:
        print(json.dumps({
            'event': 'meta_media_archive_failed',
            'channel': 'whatsapp',
            'account_alias': account_alias,
            'media_id': media_id,
            'error': str(exc),
        }))
        media['storage_status'] = 'archive_failed'
        media['storage_error'] = str(exc)[:500]
    return media


def _graph_get_json(url, token):
    request = urllib.request.Request(
        url,
        method='GET',
        headers={'Authorization': f'Bearer {token}'},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode('utf-8') or '{}')


def _download_meta_file(url, token):
    request = urllib.request.Request(
        url,
        method='GET',
        headers={'Authorization': f'Bearer {token}'},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            content_length = int(response.headers.get('content-length') or 0)
            if content_length > 25 * 1024 * 1024:
                raise ValueError('El archivo supera 25 MB')
            return response.read()
    except urllib.error.HTTPError as exc:
        raise ValueError(f'Meta media download failed: {exc.code}') from exc


def _media_extension(mime_type, filename):
    if filename and '.' in filename:
        return '.' + filename.rsplit('.', 1)[-1].lower()
    mapping = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'audio/mpeg': '.mp3',
        'audio/ogg': '.ogg',
        'application/pdf': '.pdf',
    }
    return mapping.get(mime_type, '')


def _whatsapp_payload_summary(event_payload, message_type):
    return {
        'message_type': message_type,
        'has_text': bool(_whatsapp_text(event_payload, message_type)),
        'has_media': message_type in ('image', 'video', 'audio', 'document', 'sticker'),
        'has_context': 'context' in event_payload,
    }


def _whatsapp_contact_name(contact_id, contacts):
    for contact in contacts:
        if str(contact.get('wa_id') or '') == contact_id:
            return str((contact.get('profile') or {}).get('name') or '')
    return ''


def _external_event_id(channel, account_id, event_payload, event_type, sender_id, recipient_id):
    message = event_payload.get('message') or {}
    for key in ('mid', 'id'):
        if message.get(key):
            return str(message[key])

    timestamp = str(event_payload.get('timestamp') or '')
    if not any([channel, account_id, timestamp, sender_id, recipient_id, event_type]):
        return ''
    return '#'.join([channel, account_id, timestamp, sender_id, recipient_id, event_type])


def _event_timestamp(event_payload):
    raw_timestamp = event_payload.get('timestamp')
    try:
        timestamp = int(raw_timestamp)
        if timestamp > 10_000_000_000:
            timestamp = timestamp / 1000
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return _now_iso()


def _direction(owned_account_id, sender_id, recipient_id):
    if recipient_id and recipient_id == owned_account_id:
        return 'incoming'
    if sender_id and sender_id == owned_account_id:
        return 'outgoing'
    return 'unknown'


def _payload_summary(event_payload):
    message = event_payload.get('message') or {}
    attachments = _message_attachments(message)
    return {
        'has_text': bool(message.get('text')),
        'attachment_count': len(attachments) if isinstance(attachments, list) else 0,
        'attachment_types': [item.get('type', '') for item in attachments],
        'has_postback': 'postback' in event_payload,
        'has_read': 'read' in event_payload,
        'has_delivery': 'delivery' in event_payload,
    }


def _message_attachments(message):
    attachments = message.get('attachments') or []
    if not isinstance(attachments, list):
        return []
    normalized = []
    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue
        payload = attachment.get('payload') or {}
        normalized.append({
            'type': str(attachment.get('type') or ''),
            'url': str(payload.get('url') or ''),
            'title': str(payload.get('title') or ''),
            'sticker_id': str(payload.get('sticker_id') or ''),
        })
    return normalized


def _attachment_text(attachments):
    if not attachments:
        return ''
    types = [item.get('type') or 'adjunto' for item in attachments]
    return '[' + ', '.join(types) + ']'


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _instagram_account_aliases(body):
    if not isinstance(body, dict) or body.get('object') != 'instagram':
        return [], []

    aliases = []
    unknown_entry_ids = []
    for entry in body.get('entry') or []:
        account_id = str(entry.get('id') or '')
        account = INSTAGRAM_ACCOUNTS.get(account_id)
        if account and account.get('alias'):
            aliases.append(account['alias'])
        elif account_id:
            aliases.append('unknown')
            unknown_entry_ids.append(account_id)
    return aliases, unknown_entry_ids


def _get_instagram_token(account_id):
    account = INSTAGRAM_ACCOUNTS.get(str(account_id))
    if not account or not account.get('token_param'):
        return None

    result = ssm.get_parameter(
        Name=account['token_param'],
        WithDecryption=True,
    )
    return result.get('Parameter', {}).get('Value')


def _get_whatsapp_token(account_alias):
    for account in WHATSAPP_ACCOUNTS.values():
        if account.get('alias') != account_alias:
            continue
        token_param = account.get('token_param')
        if not token_param:
            return ''
        try:
            result = ssm.get_parameter(Name=token_param, WithDecryption=True)
            return result.get('Parameter', {}).get('Value') or ''
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code') == 'ParameterNotFound':
                return ''
            raise
    return ''


def handler(event, context):
    method = event.get('httpMethod')
    path = (event.get('path') or '').rstrip('/')

    if path != '/webhooks/meta':
        return _json_response(404, {'message': 'Not found'})

    if method == 'GET':
        return _verify_webhook(event)

    if method == 'POST':
        return _receive_event(event)

    return _json_response(405, {'message': 'Method not allowed'})
