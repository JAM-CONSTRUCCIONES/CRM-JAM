import json
import os
import urllib.error
from urllib.parse import urlencode
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
    os.environ.get('INSTAGRAM_USER_ID_JAM', ''): {
        'alias': 'jamconstruccionessrl',
        'token_param': os.environ.get('INSTAGRAM_TOKEN_PARAM_JAM', ''),
    },
    os.environ.get('INSTAGRAM_ACCOUNT_ID_CANEY', ''): {
        'alias': 'caneyoriental',
        'token_param': os.environ.get('INSTAGRAM_TOKEN_PARAM_CANEY', ''),
    },
    os.environ.get('INSTAGRAM_USER_ID_CANEY', ''): {
        'alias': 'caneyoriental',
        'token_param': os.environ.get('INSTAGRAM_TOKEN_PARAM_CANEY', ''),
    },
}

MESSENGER_PAGES = {
    os.environ.get('MESSENGER_PAGE_ID_JAM', ''): {
        'alias': 'jam_construcciones',
        'token_param': os.environ.get('MESSENGER_PAGE_TOKEN_PARAM_JAM', ''),
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
        if item.get('tipo') == 'META_FORM_SUBMISSION':
            was_new = _put_or_update_form_submission(item)
            _upsert_meta_lead_from_form(item)
            if was_new:
                stored_count += 1
            else:
                duplicate_count += 1
            continue
        if item.get('tipo') == 'META_MENSAJE' and _merge_duplicate_message(item):
            duplicate_count += 1
            continue
        try:
            conversaciones_table.put_item(
                Item=item,
                ConditionExpression='attribute_not_exists(pk) AND attribute_not_exists(sk)',
            )
            if item.get('tipo') == 'META_MENSAJE':
                _apply_whatsapp_message_event(item)
                if not _is_whatsapp_auxiliary_event(item):
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


def _put_or_update_form_submission(item):
    try:
        conversaciones_table.put_item(
            Item=item,
            ConditionExpression='attribute_not_exists(pk) AND attribute_not_exists(sk)',
        )
        return True
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
            raise

    conversaciones_table.update_item(
        Key={'pk': item['pk'], 'sk': item['sk']},
        UpdateExpression=(
            'SET actualizado_en = :actualizado_en, lead_pk = :lead_pk, '
            'leadgen_graph = :leadgen_graph, raw_webhook_value = :raw_webhook_value, '
            'field_data = :field_data, field_map = :field_map, '
            'nombre = :nombre, telefono = :telefono, telefono_normalizado = :telefono_normalizado, correo = :correo, '
            'campaign_id = :campaign_id, campaign_name = :campaign_name, '
            'adset_id = :adset_id, adset_name = :adset_name, '
            'ad_id = :ad_id, ad_name = :ad_name, form_id = :form_id, form_name = :form_name, '
            'fetch_status = :fetch_status, fetch_error = :fetch_error'
        ),
        ExpressionAttributeValues={
            ':actualizado_en': _now_iso(),
            ':lead_pk': item.get('lead_pk', ''),
            ':leadgen_graph': item.get('leadgen_graph') or {},
            ':raw_webhook_value': item.get('raw_webhook_value') or {},
            ':field_data': item.get('field_data') or [],
            ':field_map': item.get('field_map') or {},
            ':nombre': item.get('nombre', ''),
            ':telefono': item.get('telefono', ''),
            ':telefono_normalizado': item.get('telefono_normalizado', ''),
            ':correo': item.get('correo', ''),
            ':campaign_id': item.get('campaign_id', ''),
            ':campaign_name': item.get('campaign_name', ''),
            ':adset_id': item.get('adset_id', ''),
            ':adset_name': item.get('adset_name', ''),
            ':ad_id': item.get('ad_id', ''),
            ':ad_name': item.get('ad_name', ''),
            ':form_id': item.get('form_id', ''),
            ':form_name': item.get('form_name', ''),
            ':fetch_status': item.get('fetch_status', ''),
            ':fetch_error': item.get('fetch_error', ''),
        },
    )
    return False


def _merge_duplicate_message(item):
    external_event_id = item.get('external_event_id')
    if not external_event_id:
        return False

    result = conversaciones_table.query(
        IndexName='gsi-external-event',
        KeyConditionExpression=Key('external_event_id').eq(external_event_id),
        Limit=10,
    )
    for existing in result.get('Items', []):
        if (
            existing.get('tipo') == 'META_MENSAJE'
            and existing.get('channel') == item.get('channel')
            and existing.get('account_alias') == item.get('account_alias')
        ):
            _update_existing_message_from_duplicate(existing, item)
            return True
    return False


def _update_existing_message_from_duplicate(existing, incoming):
    set_parts = [
        'message_status = :message_status',
        'message_status_updated_at = :updated_at',
    ]
    names = {}
    values = {
        ':message_status': incoming.get('message_status') or existing.get('message_status') or '',
        ':updated_at': incoming.get('event_timestamp') or incoming.get('created_at') or _now_iso(),
    }
    if incoming.get('quoted_message_id') and not existing.get('quoted_message_id'):
        set_parts.extend([
            'quoted_message_id = :quoted_message_id',
            'quoted_text = :quoted_text',
            'quoted_sender = :quoted_sender',
        ])
        values[':quoted_message_id'] = incoming.get('quoted_message_id', '')
        values[':quoted_text'] = incoming.get('quoted_text', '')
        values[':quoted_sender'] = incoming.get('quoted_sender', '')
    if incoming.get('text') and incoming.get('text') != existing.get('text'):
        set_parts.append('#txt = :text')
        names['#txt'] = 'text'
        values[':text'] = incoming.get('text', '')

    kwargs = {
        'Key': {'pk': existing['pk'], 'sk': existing['sk']},
        'UpdateExpression': 'SET ' + ', '.join(set_parts),
        'ExpressionAttributeValues': values,
    }
    if names:
        kwargs['ExpressionAttributeNames'] = names
    conversaciones_table.update_item(**kwargs)


def _apply_message_status(status_item):
    message_id = status_item.get('external_event_id')
    message_status = status_item.get('message_status')
    if not message_id or not message_status:
        return
    error_message = _whatsapp_status_error_message(status_item)

    result = conversaciones_table.query(
        IndexName='gsi-external-event',
        KeyConditionExpression=Key('external_event_id').eq(message_id),
        Limit=5,
    )
    for message in result.get('Items', []):
        if message.get('tipo') != 'META_MENSAJE':
            continue
        set_expression = (
            'SET message_status = :message_status, '
            'message_status_updated_at = :updated_at, '
            'message_status_event_pk = :status_pk, '
            'message_status_event_sk = :status_sk'
        )
        values = {
            ':message_status': message_status,
            ':updated_at': status_item.get('event_timestamp') or _now_iso(),
            ':status_pk': status_item.get('pk', ''),
            ':status_sk': status_item.get('sk', ''),
        }
        if error_message:
            set_expression += ', error_message = :error_message'
            values[':error_message'] = error_message
        conversaciones_table.update_item(
            Key={'pk': message['pk'], 'sk': message['sk']},
            UpdateExpression=set_expression,
            ExpressionAttributeValues=values,
        )


def _whatsapp_status_error_message(status_item):
    errors = status_item.get('errors') or []
    if not isinstance(errors, list) or not errors:
        return ''
    parts = []
    for error in errors[:3]:
        if not isinstance(error, dict):
            parts.append(str(error))
            continue
        code = str(error.get('code') or '').strip()
        title = str(error.get('title') or '').strip()
        message = str(error.get('message') or error.get('details') or '').strip()
        detail = ' - '.join(part for part in (title, message) if part)
        parts.append(f'{code}: {detail}' if code and detail else detail or code)
    return ' | '.join(part for part in parts if part)[:1000]


def _is_whatsapp_auxiliary_event(item):
    if item.get('channel') != 'whatsapp':
        return False
    event_type = item.get('event_type')
    return (
        (event_type == 'edit' and bool(item.get('edited_message_id')))
        or (event_type == 'reaction' and bool(item.get('reaction_message_id')))
        or (event_type == 'revoke' and bool(item.get('revoked_message_id')))
    )


def _apply_whatsapp_message_event(item):
    if item.get('channel') != 'whatsapp':
        return
    event_type = item.get('event_type')
    if event_type == 'edit':
        _apply_message_edit(item)
    elif event_type == 'reaction':
        _apply_message_reaction(item)
    elif event_type == 'revoke':
        _apply_message_revoke(item)


def _messages_by_external_id(external_event_id):
    if not external_event_id:
        return []
    result = conversaciones_table.query(
        IndexName='gsi-external-event',
        KeyConditionExpression=Key('external_event_id').eq(external_event_id),
        Limit=10,
    )
    return [item for item in result.get('Items', []) if item.get('tipo') == 'META_MENSAJE']


def _apply_message_edit(edit_item):
    target_id = edit_item.get('edited_message_id') or ''
    edited_text = edit_item.get('edited_text') or ''
    if not target_id or not edited_text:
        return

    for message in _messages_by_external_id(target_id):
        original_text = message.get('original_text') or message.get('text') or ''
        conversaciones_table.update_item(
            Key={'pk': message['pk'], 'sk': message['sk']},
            UpdateExpression=(
                'SET #txt = :text, edited = :edited, edited_at = :edited_at, '
                'edit_event_id = :edit_event_id, original_text = :original_text'
            ),
            ExpressionAttributeNames={'#txt': 'text'},
            ExpressionAttributeValues={
                ':text': edited_text,
                ':edited': True,
                ':edited_at': edit_item.get('event_timestamp') or _now_iso(),
                ':edit_event_id': edit_item.get('external_event_id') or '',
                ':original_text': original_text,
            },
        )
        _update_lead_last_text_if_matches(message, target_id, edited_text)


def _apply_message_reaction(reaction_item):
    target_id = reaction_item.get('reaction_message_id') or ''
    emoji = reaction_item.get('reaction_emoji') or ''
    if not target_id:
        return

    for message in _messages_by_external_id(target_id):
        reactions = list(message.get('reactions') or [])
        sender_id = reaction_item.get('sender_id') or ''
        reactions = [item for item in reactions if item.get('sender_id') != sender_id]
        if emoji:
            reactions.append({
                'sender_id': sender_id,
                'emoji': emoji,
                'event_id': reaction_item.get('external_event_id') or '',
                'event_timestamp': reaction_item.get('event_timestamp') or _now_iso(),
            })
        conversaciones_table.update_item(
            Key={'pk': message['pk'], 'sk': message['sk']},
            UpdateExpression='SET reactions = :reactions, reactions_updated_at = :updated_at',
            ExpressionAttributeValues={
                ':reactions': reactions,
                ':updated_at': reaction_item.get('event_timestamp') or _now_iso(),
            },
        )


def _apply_message_revoke(revoke_item):
    target_id = revoke_item.get('revoked_message_id') or ''
    if not target_id:
        return

    for message in _messages_by_external_id(target_id):
        original_text = message.get('original_text') or message.get('text') or ''
        conversaciones_table.update_item(
            Key={'pk': message['pk'], 'sk': message['sk']},
            UpdateExpression=(
                'SET revoked = :revoked, revoked_at = :revoked_at, '
                'revoke_event_id = :revoke_event_id, original_text = :original_text, '
                '#txt = :text'
            ),
            ExpressionAttributeNames={'#txt': 'text'},
            ExpressionAttributeValues={
                ':revoked': True,
                ':revoked_at': revoke_item.get('event_timestamp') or _now_iso(),
                ':revoke_event_id': revoke_item.get('external_event_id') or '',
                ':original_text': original_text,
                ':text': 'Mensaje eliminado en WhatsApp',
            },
        )
        _update_lead_last_text_if_matches(message, target_id, 'Mensaje eliminado en WhatsApp')


def _update_lead_last_text_if_matches(message, target_id, text):
    lead_key = _lead_key(message)
    legacy_lead_key = _legacy_lead_key(message)
    for pk in {lead_key, legacy_lead_key}:
        lead = conversaciones_table.get_item(Key={'pk': pk, 'sk': 'METADATA'}).get('Item')
        if not lead or lead.get('ultimo_evento_id') != target_id:
            continue
        conversaciones_table.update_item(
            Key={'pk': pk, 'sk': 'METADATA'},
            UpdateExpression='SET ultimo_mensaje_texto = :text, actualizado_en = :updated_at',
            ExpressionAttributeValues={
                ':text': text,
                ':updated_at': _now_iso(),
            },
        )


def _upsert_meta_lead(message_item):
    now = _now_iso()
    lead_key = _lead_key(message_item)
    legacy_lead_key = _legacy_lead_key(message_item)
    origen_detalle = _origin_metadata(message_item)
    ads_metadata = _ads_origin_metadata(message_item)
    contact_profile_name = message_item.get('contact_profile_name', '')
    contact_username = message_item.get('contact_username', '')
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
        'fuente = :fuente',
        'origen = :origen',
        'origen_plataforma = :origen_plataforma',
        'origen_canal = :origen_canal',
        'origen_tipo_interaccion = :origen_tipo_interaccion',
        'origen_cuenta_id = :origen_cuenta_id',
        'origen_cuenta_alias = :origen_cuenta_alias',
        'origen_contacto_id = :origen_contacto_id',
        'origen_detalle = :origen_detalle',
        'campaign_id = if_not_exists(campaign_id, :campaign_id)',
        'campaign_name = if_not_exists(campaign_name, :campaign_name)',
        'adset_id = if_not_exists(adset_id, :adset_id)',
        'adset_name = if_not_exists(adset_name, :adset_name)',
        'ad_id = if_not_exists(ad_id, :ad_id)',
        'ad_name = if_not_exists(ad_name, :ad_name)',
        'form_id = if_not_exists(form_id, :form_id)',
        'form_name = if_not_exists(form_name, :form_name)',
        'referral_source = if_not_exists(referral_source, :referral_source)',
        'referral_type = if_not_exists(referral_type, :referral_type)',
        'referral_url = if_not_exists(referral_url, :referral_url)',
        'ctwa_clid = if_not_exists(ctwa_clid, :ctwa_clid)',
        'ads_origin = if_not_exists(ads_origin, :ads_origin)',
        'estado = if_not_exists(estado, :estado)',
        'primer_mensaje_en = if_not_exists(primer_mensaje_en, :primer_mensaje_en)',
        'ultimo_mensaje_en = :ultimo_mensaje_en',
        'feed_pk = :feed_pk',
        'feed_sk = :feed_sk',
        'ultimo_mensaje_texto = :ultimo_mensaje_texto',
        'ultimo_evento_id = :ultimo_evento_id',
        'actualizado_en = :actualizado_en',
        'creado_en = if_not_exists(creado_en, :creado_en)',
        'mensajes_recibidos = if_not_exists(mensajes_recibidos, :zero) + :incoming_inc',
        'mensajes_enviados = if_not_exists(mensajes_enviados, :zero) + :outgoing_inc',
        'mensajes_totales = if_not_exists(mensajes_totales, :zero) + :one',
    ]
    if contact_profile_name:
        update_expression.append('contact_profile_name = :contact_profile_name')
    else:
        update_expression.append('contact_profile_name = if_not_exists(contact_profile_name, :contact_profile_name)')
    if contact_username:
        update_expression.append('contact_username = :contact_username')
    expression_values = {
        ':tipo': 'META_LEAD',
        ':channel': message_item.get('channel', ''),
        ':account_id': message_item.get('account_id', ''),
        ':account_alias': message_item.get('account_alias', ''),
        ':channel_account': message_item.get('channel_account', ''),
        ':contact_key': message_item.get('contact_key', ''),
        ':external_contact_id': message_item.get('external_contact_id', ''),
        ':contact_profile_name': contact_profile_name,
        ':fuente': _source_label(message_item.get('channel', '')),
        ':origen': 'meta',
        ':origen_plataforma': origen_detalle['plataforma'],
        ':origen_canal': origen_detalle['canal'],
        ':origen_tipo_interaccion': origen_detalle['tipo_interaccion'],
        ':origen_cuenta_id': origen_detalle['cuenta_id'],
        ':origen_cuenta_alias': origen_detalle['cuenta_alias'],
        ':origen_contacto_id': origen_detalle['contacto_id'],
        ':origen_detalle': origen_detalle,
        ':campaign_id': ads_metadata['campaign_id'],
        ':campaign_name': ads_metadata['campaign_name'],
        ':adset_id': ads_metadata['adset_id'],
        ':adset_name': ads_metadata['adset_name'],
        ':ad_id': ads_metadata['ad_id'],
        ':ad_name': ads_metadata['ad_name'],
        ':form_id': ads_metadata['form_id'],
        ':form_name': ads_metadata['form_name'],
        ':referral_source': ads_metadata['referral_source'],
        ':referral_type': ads_metadata['referral_type'],
        ':referral_url': ads_metadata['referral_url'],
        ':ctwa_clid': ads_metadata['ctwa_clid'],
        ':ads_origin': ads_metadata,
        ':estado': 'nuevo',
        ':primer_mensaje_en': message_item.get('event_timestamp', now),
        ':ultimo_mensaje_en': message_item.get('event_timestamp', now),
        ':feed_pk': 'META_LEAD',
        ':feed_sk': message_item.get('event_timestamp', now),
        ':ultimo_mensaje_texto': message_item.get('text', ''),
        ':ultimo_evento_id': message_item.get('external_event_id', ''),
        ':actualizado_en': now,
        ':creado_en': now,
        ':zero': 0,
        ':one': 1,
        ':incoming_inc': 1 if message_item.get('direction') == 'incoming' else 0,
        ':outgoing_inc': 1 if message_item.get('direction') == 'outgoing' else 0,
    }
    if contact_username:
        expression_values[':contact_username'] = contact_username

    conversaciones_table.update_item(
        Key={
            'pk': lead_key,
            'sk': 'METADATA',
        },
        UpdateExpression=', '.join(update_expression),
        ExpressionAttributeValues=expression_values,
    )


def _upsert_meta_lead_from_form(form_item):
    now = _now_iso()
    lead_pk = form_item.get('lead_pk') or f"META_LEAD#leadgen#{form_item.get('page_id', 'unknown')}#{form_item.get('leadgen_id', 'unknown')}"
    linked_channel = form_item.get('linked_channel') or 'leadgen'
    account_alias = form_item.get('linked_account_alias') or form_item.get('account_alias') or ''
    external_contact_id = (
        form_item.get('telefono_normalizado')
        if linked_channel == 'whatsapp'
        else form_item.get('leadgen_id')
    ) or ''
    contact_name = form_item.get('nombre') or ''
    form_summary = _leadgen_summary_text(form_item)
    origen_detalle = {
        'plataforma': 'Meta',
        'canal': linked_channel,
        'canal_label': _source_label(linked_channel),
        'tipo_interaccion': 'formulario',
        'event_type': 'leadgen',
        'cuenta_id': form_item.get('page_id', ''),
        'cuenta_alias': form_item.get('account_alias', ''),
        'contacto_id': external_contact_id,
        'leadgen_id': form_item.get('leadgen_id', ''),
        'form_id': form_item.get('form_id', ''),
        'form_name': form_item.get('form_name', ''),
        'campaign_id': form_item.get('campaign_id', ''),
        'campaign_name': form_item.get('campaign_name', ''),
        'adset_id': form_item.get('adset_id', ''),
        'adset_name': form_item.get('adset_name', ''),
        'ad_id': form_item.get('ad_id', ''),
        'ad_name': form_item.get('ad_name', ''),
        'platform': form_item.get('platform', ''),
    }
    ads_origin = {
        'campaign_id': form_item.get('campaign_id', ''),
        'campaign_name': form_item.get('campaign_name', ''),
        'adset_id': form_item.get('adset_id', ''),
        'adset_name': form_item.get('adset_name', ''),
        'ad_id': form_item.get('ad_id', ''),
        'ad_name': form_item.get('ad_name', ''),
        'form_id': form_item.get('form_id', ''),
        'form_name': form_item.get('form_name', ''),
        'raw': form_item.get('leadgen_graph') or form_item.get('raw_webhook_value') or {},
    }
    update_expression = (
        'SET tipo = :tipo, channel = if_not_exists(channel, :channel), '
        'account_id = if_not_exists(account_id, :account_id), '
        'account_alias = if_not_exists(account_alias, :account_alias), '
        'channel_account = if_not_exists(channel_account, :channel_account), '
        'contact_key = if_not_exists(contact_key, :contact_key), '
        'external_contact_id = if_not_exists(external_contact_id, :external_contact_id), '
        'contact_profile_name = if_not_exists(contact_profile_name, :contact_profile_name), '
        'nombre_formulario_meta = :nombre_formulario_meta, '
        'telefono = :telefono, telefono_normalizado = :telefono_normalizado, correo = :correo, '
        'fuente = if_not_exists(fuente, :fuente), origen = :origen, '
        'origen_plataforma = :origen_plataforma, origen_canal = if_not_exists(origen_canal, :origen_canal), '
        'origen_tipo_interaccion = if_not_exists(origen_tipo_interaccion, :origen_tipo_interaccion), '
        'origen_cuenta_id = if_not_exists(origen_cuenta_id, :origen_cuenta_id), '
        'origen_cuenta_alias = if_not_exists(origen_cuenta_alias, :origen_cuenta_alias), '
        'origen_contacto_id = if_not_exists(origen_contacto_id, :origen_contacto_id), '
        'origen_detalle = if_not_exists(origen_detalle, :origen_detalle), '
        'campaign_id = if_not_exists(campaign_id, :campaign_id), '
        'campaign_name = if_not_exists(campaign_name, :campaign_name), '
        'adset_id = if_not_exists(adset_id, :adset_id), '
        'adset_name = if_not_exists(adset_name, :adset_name), '
        'ad_id = if_not_exists(ad_id, :ad_id), ad_name = if_not_exists(ad_name, :ad_name), '
        'form_id = if_not_exists(form_id, :form_id), form_name = if_not_exists(form_name, :form_name), '
        'ads_origin = if_not_exists(ads_origin, :ads_origin), '
        '#estado = if_not_exists(#estado, :estado), '
        'primer_formulario_en = if_not_exists(primer_formulario_en, :event_timestamp), '
        'ultimo_formulario_en = :event_timestamp, ultimo_formulario_id = :leadgen_id, '
        'ultimo_formulario_resumen = :form_summary, '
        'ultimo_mensaje_en = if_not_exists(ultimo_mensaje_en, :event_timestamp), '
        'feed_pk = :feed_pk, feed_sk = if_not_exists(feed_sk, :event_timestamp), '
        'ultimo_mensaje_texto = if_not_exists(ultimo_mensaje_texto, :form_summary), '
        'actualizado_en = :actualizado_en, creado_en = if_not_exists(creado_en, :creado_en), '
        'mensajes_recibidos = if_not_exists(mensajes_recibidos, :zero), '
        'mensajes_enviados = if_not_exists(mensajes_enviados, :zero), '
        'mensajes_totales = if_not_exists(mensajes_totales, :zero)'
    )
    values = {
        ':tipo': 'META_LEAD',
        ':channel': linked_channel,
        ':account_id': _primary_whatsapp_account().get('account_id', '') if linked_channel == 'whatsapp' else form_item.get('page_id', ''),
        ':account_alias': account_alias,
        ':channel_account': f'{linked_channel}#{account_alias}',
        ':contact_key': f'{linked_channel}#{external_contact_id}',
        ':external_contact_id': external_contact_id,
        ':contact_profile_name': contact_name,
        ':nombre_formulario_meta': contact_name,
        ':telefono': form_item.get('telefono', ''),
        ':telefono_normalizado': form_item.get('telefono_normalizado', ''),
        ':correo': form_item.get('correo', ''),
        ':fuente': 'Meta Lead Ads',
        ':origen': 'meta',
        ':origen_plataforma': 'Meta',
        ':origen_canal': linked_channel,
        ':origen_tipo_interaccion': 'formulario',
        ':origen_cuenta_id': form_item.get('page_id', ''),
        ':origen_cuenta_alias': form_item.get('account_alias', ''),
        ':origen_contacto_id': external_contact_id,
        ':origen_detalle': origen_detalle,
        ':campaign_id': form_item.get('campaign_id', ''),
        ':campaign_name': form_item.get('campaign_name', ''),
        ':adset_id': form_item.get('adset_id', ''),
        ':adset_name': form_item.get('adset_name', ''),
        ':ad_id': form_item.get('ad_id', ''),
        ':ad_name': form_item.get('ad_name', ''),
        ':form_id': form_item.get('form_id', ''),
        ':form_name': form_item.get('form_name', ''),
        ':ads_origin': ads_origin,
        ':estado': 'nuevo',
        ':event_timestamp': form_item.get('event_timestamp') or now,
        ':leadgen_id': form_item.get('leadgen_id', ''),
        ':form_summary': form_summary,
        ':feed_pk': 'META_LEAD',
        ':actualizado_en': now,
        ':creado_en': now,
        ':zero': 0,
    }
    conversaciones_table.update_item(
        Key={'pk': lead_pk, 'sk': 'METADATA'},
        UpdateExpression=update_expression,
        ExpressionAttributeNames={'#estado': 'estado'},
        ExpressionAttributeValues=values,
    )
    _put_form_activity(lead_pk, form_item, form_summary)


def _put_form_activity(lead_pk, form_item, form_summary):
    try:
        conversaciones_table.put_item(
            Item={
                'pk': lead_pk,
                'sk': f"ACTIVIDAD#{form_item.get('event_timestamp') or _now_iso()}#leadgen#{form_item.get('leadgen_id', '')}",
                'tipo': 'META_ACTIVIDAD',
                'tipo_actividad': 'leadgen_recibido',
                'creado_en': form_item.get('event_timestamp') or _now_iso(),
                'usuario_nombre': 'Meta',
                'leadgen_id': form_item.get('leadgen_id', ''),
                'form_submission_pk': form_item.get('pk', ''),
                'form_id': form_item.get('form_id', ''),
                'form_name': form_item.get('form_name', ''),
                'campaign_id': form_item.get('campaign_id', ''),
                'campaign_name': form_item.get('campaign_name', ''),
                'ad_id': form_item.get('ad_id', ''),
                'ad_name': form_item.get('ad_name', ''),
                'detalle': form_summary,
            },
            ConditionExpression='attribute_not_exists(pk) AND attribute_not_exists(sk)',
        )
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
            raise


def _leadgen_summary_text(form_item):
    label = _first_str(form_item.get('form_name'), form_item.get('form_id'), 'Formulario Meta')
    name = form_item.get('nombre') or ''
    phone = form_item.get('telefono_normalizado') or form_item.get('telefono') or ''
    email = form_item.get('correo') or ''
    parts = [part for part in (name, phone, email) if part]
    return f'{label}: ' + (' - '.join(parts) if parts else 'respuestas recibidas')


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


def _first_str(*values):
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ''


def _compact_dict(value):
    if not isinstance(value, dict):
        return {}
    compacted = {}
    for key, item in value.items():
        if item in (None, '', [], {}):
            continue
        if isinstance(item, dict):
            nested = _compact_dict(item)
            if nested:
                compacted[key] = nested
        elif isinstance(item, list):
            compacted[key] = item[:10]
        else:
            compacted[key] = item
    return compacted


def _ads_metadata_empty():
    return {
        'campaign_id': '',
        'campaign_name': '',
        'adset_id': '',
        'adset_name': '',
        'ad_id': '',
        'ad_name': '',
        'form_id': '',
        'form_name': '',
        'referral_source': '',
        'referral_type': '',
        'referral_url': '',
        'referral_ref': '',
        'source_id': '',
        'source_type': '',
        'ctwa_clid': '',
        'raw': {},
    }


def _ads_origin_metadata(message_item):
    metadata = _ads_metadata_empty()
    for source in [
        message_item.get('ads_origin'),
        message_item.get('payload_summary', {}).get('ads_origin') if isinstance(message_item.get('payload_summary'), dict) else None,
    ]:
        if not isinstance(source, dict):
            continue
        for key in metadata:
            if key == 'raw':
                continue
            metadata[key] = metadata[key] or _first_str(source.get(key))
        raw = source.get('raw')
        if isinstance(raw, dict) and raw:
            metadata['raw'] = raw
    return metadata


def _extract_meta_ads_metadata(event_payload):
    message = event_payload.get('message') or {}
    postback = event_payload.get('postback') or {}
    optin = event_payload.get('optin') or {}
    raw_sources = [
        event_payload.get('referral'),
        message.get('referral'),
        message.get('ads_context_data'),
        event_payload.get('ads_context_data'),
        postback.get('referral'),
        optin.get('referral'),
    ]
    raw = {}
    for source in raw_sources:
        raw.update(_compact_dict(source))

    metadata = _ads_metadata_empty()
    metadata.update({
        'campaign_id': _first_str(raw.get('campaign_id'), raw.get('campaignID')),
        'campaign_name': _first_str(raw.get('campaign_name'), raw.get('campaignName')),
        'adset_id': _first_str(raw.get('adset_id'), raw.get('ad_set_id')),
        'adset_name': _first_str(raw.get('adset_name'), raw.get('ad_set_name')),
        'ad_id': _first_str(raw.get('ad_id'), raw.get('adID'), raw.get('source_id')),
        'ad_name': _first_str(raw.get('ad_name'), raw.get('ad_title'), raw.get('headline')),
        'form_id': _first_str(raw.get('form_id'), raw.get('leadgen_id')),
        'form_name': _first_str(raw.get('form_name'), raw.get('form_title')),
        'referral_source': _first_str(raw.get('source'), raw.get('referral_source')),
        'referral_type': _first_str(raw.get('type'), raw.get('source_type')),
        'referral_url': _first_str(raw.get('referer_uri'), raw.get('source_url'), raw.get('url')),
        'referral_ref': _first_str(raw.get('ref')),
        'source_id': _first_str(raw.get('source_id'), raw.get('post_id')),
        'source_type': _first_str(raw.get('source_type')),
        'ctwa_clid': _first_str(raw.get('ctwa_clid')),
        'raw': raw,
    })
    return metadata


def _extract_whatsapp_ads_metadata(event_payload):
    raw = _compact_dict(event_payload.get('referral'))
    context = event_payload.get('context') or {}
    if isinstance(context, dict):
        raw_context = _compact_dict({
            'context_id': context.get('id'),
            'forwarded': context.get('forwarded'),
            'frequently_forwarded': context.get('frequently_forwarded'),
            'referred_product': context.get('referred_product'),
        })
        if raw_context:
            raw['context'] = raw_context

    metadata = _ads_metadata_empty()
    metadata.update({
        'campaign_id': _first_str(raw.get('campaign_id')),
        'campaign_name': _first_str(raw.get('campaign_name')),
        'adset_id': _first_str(raw.get('adset_id'), raw.get('ad_set_id')),
        'adset_name': _first_str(raw.get('adset_name'), raw.get('ad_set_name')),
        'ad_id': _first_str(raw.get('ad_id'), raw.get('source_id')),
        'ad_name': _first_str(raw.get('ad_name'), raw.get('headline')),
        'form_id': _first_str(raw.get('form_id')),
        'form_name': _first_str(raw.get('form_name')),
        'referral_source': _first_str(raw.get('source_url'), raw.get('source')),
        'referral_type': _first_str(raw.get('source_type'), raw.get('media_type')),
        'referral_url': _first_str(raw.get('source_url')),
        'referral_ref': _first_str(raw.get('ref')),
        'source_id': _first_str(raw.get('source_id')),
        'source_type': _first_str(raw.get('source_type')),
        'ctwa_clid': _first_str(raw.get('ctwa_clid')),
        'raw': raw,
    })
    return metadata


def _origin_metadata(message_item):
    channel = str(message_item.get('channel') or '').lower()
    event_type = str(message_item.get('event_type') or 'message')
    ads_metadata = _ads_origin_metadata(message_item)
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
        'call': 'llamada',
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
        'campaign_id': ads_metadata['campaign_id'],
        'campaign_name': ads_metadata['campaign_name'],
        'adset_id': ads_metadata['adset_id'],
        'adset_name': ads_metadata['adset_name'],
        'ad_id': ads_metadata['ad_id'],
        'ad_name': ads_metadata['ad_name'],
        'form_id': ads_metadata['form_id'],
        'form_name': ads_metadata['form_name'],
        'referral_source': ads_metadata['referral_source'],
        'referral_type': ads_metadata['referral_type'],
        'referral_url': ads_metadata['referral_url'],
        'ctwa_clid': ads_metadata['ctwa_clid'],
    }


def _normalize_events(body):
    object_type = body.get('object')
    if object_type == 'instagram':
        return _normalize_instagram_events(body)
    if object_type == 'page':
        return _normalize_messenger_events(body) + _normalize_leadgen_events(body)
    if object_type == 'whatsapp_business_account':
        return _normalize_whatsapp_events(body)
    return []


def _normalize_leadgen_events(body):
    items = []
    for entry in body.get('entry') or []:
        page_id = str(entry.get('id') or '')
        page = _get_messenger_page(page_id)
        page_alias = page.get('alias') or page_id or 'unknown'
        for change in entry.get('changes') or []:
            if change.get('field') != 'leadgen':
                continue
            value = change.get('value') or {}
            if not isinstance(value, dict):
                continue
            item = _build_leadgen_submission_item(
                page_id=page_id,
                page_alias=page_alias,
                event_payload=value,
            )
            if item:
                items.append(item)
    return items


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
        page = _get_messenger_page(page_id)
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


def _get_messenger_page(page_id):
    page = MESSENGER_PAGES.get(page_id)
    if page:
        return page
    if not conversaciones_table or not page_id:
        return {}
    try:
        item = conversaciones_table.get_item(
            Key={
                'pk': 'META_ACCOUNT#messenger#jam_construcciones',
                'sk': 'METADATA',
            }
        ).get('Item') or {}
        if str(item.get('page_id') or item.get('account_id') or '') == str(page_id):
            return {
                'alias': item.get('account_alias') or 'jam_construcciones',
                'token_param': item.get('token_param') or '',
            }
    except Exception as exc:
        print(json.dumps({
            'event': 'messenger_connected_page_lookup_failed',
            'page_id': page_id,
            'error': str(exc)[:500],
        }))
    return {}


def _build_leadgen_submission_item(page_id, page_alias, event_payload):
    leadgen_id = _first_str(event_payload.get('leadgen_id'), event_payload.get('id'))
    if not leadgen_id:
        return None

    graph_data, fetch_status, fetch_error = _fetch_leadgen_details(page_id, leadgen_id)
    lead_data = graph_data if graph_data else {}
    field_data = lead_data.get('field_data') if isinstance(lead_data.get('field_data'), list) else []
    field_map = _leadgen_field_map(field_data)
    contact = _leadgen_contact_fields(field_map)
    event_timestamp = _leadgen_timestamp(
        lead_data.get('created_time') or event_payload.get('created_time')
    )

    campaign_id = _first_str(
        lead_data.get('campaign_id'),
        (lead_data.get('campaign') or {}).get('id') if isinstance(lead_data.get('campaign'), dict) else '',
    )
    campaign_name = _first_str(
        lead_data.get('campaign_name'),
        (lead_data.get('campaign') or {}).get('name') if isinstance(lead_data.get('campaign'), dict) else '',
    )
    adset_id = _first_str(
        lead_data.get('adset_id'),
        lead_data.get('adgroup_id'),
        event_payload.get('adgroup_id'),
        (lead_data.get('adset') or {}).get('id') if isinstance(lead_data.get('adset'), dict) else '',
    )
    adset_name = _first_str(
        lead_data.get('adset_name'),
        lead_data.get('adgroup_name'),
        (lead_data.get('adset') or {}).get('name') if isinstance(lead_data.get('adset'), dict) else '',
    )
    ad_id = _first_str(
        lead_data.get('ad_id'),
        event_payload.get('ad_id'),
        (lead_data.get('ad') or {}).get('id') if isinstance(lead_data.get('ad'), dict) else '',
    )
    ad_name = _first_str(
        lead_data.get('ad_name'),
        (lead_data.get('ad') or {}).get('name') if isinstance(lead_data.get('ad'), dict) else '',
    )
    form_id = _first_str(
        lead_data.get('form_id'),
        event_payload.get('form_id'),
        (lead_data.get('form') or {}).get('id') if isinstance(lead_data.get('form'), dict) else '',
    )
    form_name = _first_str(
        lead_data.get('form_name'),
        (lead_data.get('form') or {}).get('name') if isinstance(lead_data.get('form'), dict) else '',
    )
    platform = _first_str(lead_data.get('platform'), event_payload.get('platform'))

    telefono_normalizado = _normalize_phone(contact['telefono'])
    whatsapp_account = _primary_whatsapp_account()
    if telefono_normalizado and whatsapp_account.get('account_id'):
        lead_pk = (
            f"META_LEAD#whatsapp#{whatsapp_account['account_id']}#"
            f"{telefono_normalizado}"
        )
        linked_channel = 'whatsapp'
        linked_account_alias = whatsapp_account.get('alias', '')
    else:
        lead_pk = f"META_LEAD#leadgen#{page_id or 'unknown'}#{leadgen_id}"
        linked_channel = 'leadgen'
        linked_account_alias = page_alias

    return {
        'pk': f'META_FORM_SUBMISSION#{leadgen_id}',
        'sk': 'METADATA',
        'tipo': 'META_FORM_SUBMISSION',
        'leadgen_id': leadgen_id,
        'external_event_id': f'leadgen#{leadgen_id}',
        'page_id': page_id,
        'account_id': page_id,
        'account_alias': page_alias,
        'channel': 'leadgen',
        'linked_channel': linked_channel,
        'linked_account_alias': linked_account_alias,
        'lead_pk': lead_pk,
        'event_timestamp': event_timestamp,
        'created_at': _now_iso(),
        'actualizado_en': _now_iso(),
        'feed_pk': 'META_FORM_SUBMISSION',
        'feed_sk': event_timestamp,
        'estado': 'nuevo',
        'nombre': contact['nombre'],
        'telefono': contact['telefono'],
        'telefono_normalizado': telefono_normalizado,
        'correo': contact['correo'],
        'field_data': field_data,
        'field_map': field_map,
        'campaign_id': campaign_id,
        'campaign_name': campaign_name,
        'adset_id': adset_id,
        'adset_name': adset_name,
        'ad_id': ad_id,
        'ad_name': ad_name,
        'form_id': form_id,
        'form_name': form_name,
        'platform': platform,
        'raw_webhook_value': event_payload,
        'leadgen_graph': lead_data,
        'fetch_status': fetch_status,
        'fetch_error': fetch_error,
    }


def _fetch_leadgen_details(page_id, leadgen_id):
    try:
        token = _get_messenger_token(page_id)
    except Exception as exc:
        return {}, 'fallo_token', str(exc)[:1000]
    if not token:
        return {}, 'sin_token', 'No hay page token configurado para consultar el lead'

    fields = ','.join([
        'id',
        'created_time',
        'field_data',
        'ad_id',
        'ad_name',
        'adset_id',
        'adset_name',
        'campaign_id',
        'campaign_name',
        'form_id',
        'platform',
        'is_organic',
        'custom_disclaimer_responses',
    ])
    url = f'https://graph.facebook.com/v26.0/{leadgen_id}?{urlencode({"fields": fields, "access_token": token})}'
    try:
        request = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode('utf-8') or '{}'), 'ok', ''
    except Exception as exc:
        return {}, 'fallo_graph', str(exc)[:1000]


def _leadgen_field_map(field_data):
    result = {}
    for field in field_data or []:
        if not isinstance(field, dict):
            continue
        name = str(field.get('name') or '').strip()
        if not name:
            continue
        values = field.get('values')
        if not isinstance(values, list):
            values = [] if values in (None, '') else [values]
        result[name] = [str(value).strip() for value in values if str(value).strip()]
    return result


def _leadgen_first_field(field_map, *names):
    normalized = {
        str(key).lower().replace(' ', '_').replace('-', '_'): value
        for key, value in (field_map or {}).items()
    }
    for name in names:
        values = normalized.get(name)
        if isinstance(values, list) and values:
            return str(values[0]).strip()
    return ''


def _leadgen_contact_fields(field_map):
    first_name = _leadgen_first_field(field_map, 'first_name', 'nombre')
    last_name = _leadgen_first_field(field_map, 'last_name', 'apellido', 'apellidos')
    full_name = _leadgen_first_field(field_map, 'full_name', 'nombre_completo', 'name')
    nombre = full_name or ' '.join(part for part in (first_name, last_name) if part).strip()
    return {
        'nombre': nombre[:160],
        'telefono': _leadgen_first_field(
            field_map,
            'phone_number',
            'phone',
            'telefono',
            'numero_de_telefono',
            'whatsapp',
        )[:60],
        'correo': _leadgen_first_field(field_map, 'email', 'correo', 'correo_electronico')[:160],
    }


def _normalize_phone(value):
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    if not digits:
        return ''
    if len(digits) == 8:
        return f'591{digits}'
    if digits.startswith('00'):
        return digits[2:]
    return digits


def _leadgen_timestamp(value):
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(int(value), timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return _now_iso()
    text_value = str(value or '').strip()
    if text_value:
        return text_value
    return _now_iso()


def _primary_whatsapp_account():
    for account_id, account in WHATSAPP_ACCOUNTS.items():
        if account_id and account.get('alias') == 'jam_construcciones':
            return {'account_id': account_id, **account}
    for account_id, account in WHATSAPP_ACCOUNTS.items():
        if account_id:
            return {'account_id': account_id, **account}
    return {}


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
            # Coexistencia: mensajes enviados desde la app de WhatsApp Business
            # (celular) llegan como "echoes" via smb_message_echoes / message_echoes.
            echoes = value.get('message_echoes') or value.get('messages_echoes') or []
            for echo in echoes:
                items.append(_build_whatsapp_echo_item(
                    account_id=account_id,
                    account_alias=account_alias,
                    phone_number_id=phone_number_id,
                    display_phone_number=display_phone_number,
                    event_payload=echo,
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
    if not _is_conversation_message_event(event_payload, event_type):
        return None
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
    text = _meta_event_text(event_payload, attachments)
    ads_metadata = _extract_meta_ads_metadata(event_payload)
    contact_profile = _resolve_meta_contact_profile(
        channel,
        account_id,
        account_alias,
        contact_id,
        event_payload,
    )

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
        'contact_profile_name': contact_profile.get('display_name', ''),
        'contact_username': contact_profile.get('username', ''),
        'contact_profile_picture_url': contact_profile.get('profile_pic', ''),
        'sender_id': sender_id,
        'recipient_id': recipient_id,
        'direction': direction,
        'event_type': event_type,
        'external_event_id': external_event_id,
        'event_timestamp': event_timestamp,
        'text': text,
        'attachments': attachments,
        **_meta_context_fields(event_payload),
        'ads_origin': ads_metadata,
        'campaign_id': ads_metadata['campaign_id'],
        'campaign_name': ads_metadata['campaign_name'],
        'adset_id': ads_metadata['adset_id'],
        'adset_name': ads_metadata['adset_name'],
        'ad_id': ads_metadata['ad_id'],
        'ad_name': ads_metadata['ad_name'],
        'form_id': ads_metadata['form_id'],
        'form_name': ads_metadata['form_name'],
        'referral_source': ads_metadata['referral_source'],
        'referral_type': ads_metadata['referral_type'],
        'referral_url': ads_metadata['referral_url'],
        'ctwa_clid': ads_metadata['ctwa_clid'],
        'payload_summary': _payload_summary(event_payload),
        'created_at': created_at,
    }


def _is_conversation_message_event(event_payload, event_type):
    if event_type == 'message':
        message = event_payload.get('message') or {}
        return bool(message.get('text') or _message_attachments(message))
    if event_type == 'postback':
        postback = event_payload.get('postback') or {}
        return bool(postback.get('title') or postback.get('payload'))
    return False


def _meta_context_fields(event_payload):
    message = event_payload.get('message') or {}
    if not isinstance(message, dict):
        return {}
    reply_to = message.get('reply_to') or {}
    if not isinstance(reply_to, dict):
        return {}
    quoted_message_id = _first_str(reply_to.get('mid'), reply_to.get('id'))
    if not quoted_message_id:
        return {}
    return {
        'quoted_message_id': quoted_message_id,
    }


def _meta_event_text(event_payload, attachments):
    message = event_payload.get('message') or {}
    postback = event_payload.get('postback') or {}
    return _first_str(
        message.get('text'),
        postback.get('title'),
        postback.get('payload'),
        _attachment_text(attachments),
    )[:4000]


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
    ads_metadata = _extract_whatsapp_ads_metadata(event_payload)
    special_fields = _whatsapp_special_fields(event_payload, message_type)

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
        **_whatsapp_context_fields(event_payload),
        **special_fields,
        **({'auxiliary_event': True} if message_type in {'edit', 'reaction', 'revoke'} else {}),
        'ads_origin': ads_metadata,
        'campaign_id': ads_metadata['campaign_id'],
        'campaign_name': ads_metadata['campaign_name'],
        'adset_id': ads_metadata['adset_id'],
        'adset_name': ads_metadata['adset_name'],
        'ad_id': ads_metadata['ad_id'],
        'ad_name': ads_metadata['ad_name'],
        'form_id': ads_metadata['form_id'],
        'form_name': ads_metadata['form_name'],
        'referral_source': ads_metadata['referral_source'],
        'referral_type': ads_metadata['referral_type'],
        'referral_url': ads_metadata['referral_url'],
        'ctwa_clid': ads_metadata['ctwa_clid'],
        'payload_summary': _whatsapp_payload_summary(event_payload, message_type),
        'created_at': created_at,
    }


def _build_whatsapp_echo_item(
    account_id,
    account_alias,
    phone_number_id,
    display_phone_number,
    event_payload,
):
    """Mensaje SALIENTE enviado desde la app de WhatsApp Business (coexistencia).
    El 'from' es nuestro numero; el destinatario es el cliente, y lo usamos como
    contact_id para que caiga en la misma conversacion que los mensajes entrantes."""
    message_id = str(event_payload.get('id') or '')
    # El destinatario (cliente) puede venir como 'to' o 'recipient_id'.
    contact_id = str(
        event_payload.get('to')
        or event_payload.get('recipient_id')
        or ''
    )
    if not message_id or not contact_id:
        return None

    event_timestamp = _event_timestamp(event_payload)
    created_at = _now_iso()
    message_type = str(event_payload.get('type') or 'message')
    text = _whatsapp_text(event_payload, message_type)
    media = _whatsapp_media_summary(event_payload, message_type)
    if media:
        media = _archive_whatsapp_media(account_alias, media)
    special_fields = _whatsapp_special_fields(event_payload, message_type)

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
        'sender_id': phone_number_id,
        'recipient_id': contact_id,
        'direction': 'outgoing',
        'event_type': message_type,
        'external_event_id': message_id,
        'event_timestamp': event_timestamp,
        'text': text,
        'media': media,
        **_whatsapp_context_fields(event_payload),
        **special_fields,
        **({'auxiliary_event': True} if message_type in {'edit', 'reaction', 'revoke'} else {}),
        'message_status': 'enviado_desde_app',
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
    if message_type == 'call':
        call = event_payload.get('call') or {}
        status = str(call.get('call_status') or call.get('status') or '').lower()
        duration = call.get('call_duration') or call.get('duration')
        if status in ('missed', 'no_answer', 'no_answer_notified'):
            return 'Llamada de voz - Sin respuesta'
        if duration:
            try:
                mins, secs = divmod(int(duration), 60)
                dur_label = f'{mins}m {secs}s' if mins else f'{secs}s'
            except (ValueError, TypeError):
                dur_label = str(duration)
            return f'Llamada de voz - {dur_label}'
        return 'Llamada de voz'
    if message_type == 'location':
        loc = event_payload.get('location') or {}
        lat = loc.get('latitude')
        lng = loc.get('longitude')
        name = str(loc.get('name') or '').strip()
        address = str(loc.get('address') or '').strip()
        if lat is not None and lng is not None:
            maps_url = f'https://maps.google.com/?q={lat},{lng}'
            label = name or address or f'{lat},{lng}'
            return f'Ubicacion: {label} | {maps_url}'
        return 'Ubicacion compartida'
    if message_type == 'edit':
        edited_text = _whatsapp_edit_text(event_payload)
        return edited_text or 'Mensaje editado en WhatsApp'
    if message_type == 'reaction':
        emoji = _whatsapp_reaction_emoji(event_payload)
        return f'Reacciono {emoji} a un mensaje' if emoji else 'Reacciono a un mensaje'
    if message_type == 'revoke':
        special = _whatsapp_special_fields(event_payload, message_type)
        return 'Mensaje eliminado en WhatsApp' if special.get('revoked_message_id') else 'Se elimino un mensaje'
    if message_type == 'unsupported':
        return 'Tipo de mensaje no soportado por WhatsApp API'
    return f'[{message_type}]'


def _whatsapp_special_fields(event_payload, message_type):
    if message_type == 'edit':
        return {
            'edited_message_id': _whatsapp_edit_message_id(event_payload),
            'edited_text': _whatsapp_edit_text(event_payload),
        }
    if message_type == 'reaction':
        return {
            'reaction_message_id': _whatsapp_reaction_message_id(event_payload),
            'reaction_emoji': _whatsapp_reaction_emoji(event_payload),
        }
    if message_type == 'revoke':
        return {
            'revoked_message_id': _first_str(
                (event_payload.get('revoke') or {}).get('message_id'),
                (event_payload.get('revoke') or {}).get('id'),
                (event_payload.get('context') or {}).get('id'),
            ),
        }
    return {}


def _whatsapp_context_fields(event_payload):
    context = event_payload.get('context') or {}
    if not isinstance(context, dict):
        return {}
    quoted_message_id = _first_str(context.get('id'), context.get('message_id'))
    if not quoted_message_id:
        return {}
    return {
        'quoted_message_id': quoted_message_id,
        'quoted_sender': _first_str(context.get('from')),
    }


def _whatsapp_edit_payload(event_payload):
    edit = event_payload.get('edit') or {}
    if not isinstance(edit, dict):
        return {}, {}
    message = edit.get('message') or edit.get('edited_message') or {}
    if not isinstance(message, dict):
        message = {}
    return edit, message


def _whatsapp_edit_message_id(event_payload):
    edit, message = _whatsapp_edit_payload(event_payload)
    return _first_str(
        edit.get('message_id'),
        edit.get('original_message_id'),
        edit.get('target_message_id'),
        (edit.get('context') or {}).get('id') if isinstance(edit.get('context'), dict) else '',
        (event_payload.get('context') or {}).get('id'),
        message.get('id'),
    )


def _whatsapp_edit_text(event_payload):
    edit, message = _whatsapp_edit_payload(event_payload)
    message_type = str(message.get('type') or edit.get('type') or '').strip()
    source = message if message else edit
    return _first_str(
        ((source.get('text') or {}).get('body') if isinstance(source.get('text'), dict) else source.get('text')),
        ((edit.get('text') or {}).get('body') if isinstance(edit.get('text'), dict) else edit.get('text')),
        ((message.get(message_type) or {}).get('caption') if message_type else ''),
    )[:4000]


def _whatsapp_reaction_message_id(event_payload):
    reaction = event_payload.get('reaction') or {}
    return _first_str(
        reaction.get('message_id'),
        reaction.get('messageId'),
        reaction.get('id'),
        (event_payload.get('context') or {}).get('id'),
    )


def _whatsapp_reaction_emoji(event_payload):
    reaction = event_payload.get('reaction') or {}
    return _first_str(reaction.get('emoji'))


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
    ads_metadata = _extract_whatsapp_ads_metadata(event_payload)
    summary = {
        'message_type': message_type,
        'has_text': bool(_whatsapp_text(event_payload, message_type)),
        'has_media': message_type in ('image', 'video', 'audio', 'document', 'sticker'),
        'has_context': 'context' in event_payload,
        'has_referral': bool(ads_metadata.get('raw')),
        'has_campaign': bool(ads_metadata.get('campaign_id') or ads_metadata.get('campaign_name')),
        'has_ad': bool(ads_metadata.get('ad_id') or ads_metadata.get('ad_name')),
        'has_ctwa_clid': bool(ads_metadata.get('ctwa_clid')),
        'ads_origin': ads_metadata,
    }
    if message_type == 'edit':
        summary.update({
            'edited_message_id': _whatsapp_edit_message_id(event_payload),
            'has_edited_text': bool(_whatsapp_edit_text(event_payload)),
        })
    if message_type == 'reaction':
        summary.update({
            'reaction_message_id': _whatsapp_reaction_message_id(event_payload),
            'reaction_emoji': _whatsapp_reaction_emoji(event_payload),
        })
    if message_type == 'revoke':
        special = _whatsapp_special_fields(event_payload, message_type)
        summary.update({'revoked_message_id': special.get('revoked_message_id', '')})
    if message_type == 'unsupported':
        summary.update({'unsupported_raw_keys': sorted(event_payload.keys())[:30]})
    return summary


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


def _resolve_meta_contact_profile(channel, account_id, account_alias, contact_id, event_payload):
    profile = _contact_profile_from_payload(event_payload)
    if profile.get('display_name'):
        return profile
    if channel not in {'instagram', 'messenger'} or not contact_id or contact_id == 'unknown':
        return profile

    token = _get_instagram_token(account_id) if channel == 'instagram' else _get_messenger_token(account_id)
    if not token:
        return profile

    if channel == 'messenger':
        graph_hosts = (
            ('https://graph.facebook.com/v26.0', 'first_name,last_name,name,profile_pic'),
            ('https://graph.facebook.com/v26.0', 'name'),
        )
    else:
        graph_hosts = (
            ('https://graph.instagram.com/v22.0', 'username,name,profile_pic'),
            ('https://graph.instagram.com/v22.0', 'username,name'),
        ) if token.startswith('IGAA') else (
            ('https://graph.facebook.com/v26.0', 'username,name,profile_pic'),
            ('https://graph.facebook.com/v26.0', 'username,name'),
        )
    for base_url, fields in graph_hosts:
        try:
            data = _graph_get_json(f'{base_url}/{contact_id}?fields={fields}', token)
            username = _first_str(data.get('username'))
            name = _first_str(data.get('name'), ' '.join(
                part for part in [
                    _first_str(data.get('first_name')),
                    _first_str(data.get('last_name')),
                ] if part
            ))
            profile_pic = _first_str(data.get('profile_pic'), data.get('profile_picture_url'))
            display_name = f'@{username}' if username else name
            return {
                'display_name': display_name,
                'username': username,
                'name': name,
                'profile_pic': profile_pic,
            }
        except Exception as exc:
            print(json.dumps({
                'event': f'{channel}_contact_profile_lookup_failed',
                'account_alias': account_alias,
                'contact_id': contact_id,
                'fields': fields,
                'error': str(exc)[:500],
            }))
            continue
    return profile


def _contact_profile_from_payload(event_payload):
    sender = event_payload.get('sender') or {}
    user = event_payload.get('user') or {}
    profile = event_payload.get('profile') or {}
    username = _first_str(
        sender.get('username'),
        user.get('username'),
        profile.get('username'),
    )
    name = _first_str(
        sender.get('name'),
        user.get('name'),
        profile.get('name'),
    )
    profile_pic = _first_str(
        sender.get('profile_pic'),
        user.get('profile_pic'),
        profile.get('profile_pic'),
    )
    return {
        'display_name': f'@{username}' if username else name,
        'username': username,
        'name': name,
        'profile_pic': profile_pic,
    }


def _payload_summary(event_payload):
    message = event_payload.get('message') or {}
    attachments = _message_attachments(message)
    ads_metadata = _extract_meta_ads_metadata(event_payload)
    return {
        'has_text': bool(message.get('text')),
        'attachment_count': len(attachments) if isinstance(attachments, list) else 0,
        'attachment_types': [item.get('type', '') for item in attachments],
        'has_postback': 'postback' in event_payload,
        'has_read': 'read' in event_payload,
        'has_delivery': 'delivery' in event_payload,
        'has_referral': bool(ads_metadata.get('raw')),
        'has_ads_context_data': bool(message.get('ads_context_data') or event_payload.get('ads_context_data')),
        'has_campaign': bool(ads_metadata.get('campaign_id') or ads_metadata.get('campaign_name')),
        'has_ad': bool(ads_metadata.get('ad_id') or ads_metadata.get('ad_name')),
        'ads_origin': ads_metadata,
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


def _get_messenger_token(page_id):
    page = MESSENGER_PAGES.get(str(page_id))
    if not page or not page.get('token_param'):
        return None

    result = ssm.get_parameter(
        Name=page['token_param'],
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

    if path not in {'/webhooks/meta', '/webhooks/whatsapp'}:
        return _json_response(404, {'message': 'Not found'})

    if method == 'GET':
        return _verify_webhook(event)

    if method == 'POST':
        return _receive_event(event)

    return _json_response(405, {'message': 'Method not allowed'})
