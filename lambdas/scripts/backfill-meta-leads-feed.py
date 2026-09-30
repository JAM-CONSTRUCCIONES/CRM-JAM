import argparse
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr


def _scan_meta_leads(table):
    kwargs = {
        'FilterExpression': Attr('tipo').eq('META_LEAD'),
    }
    while True:
        result = table.scan(**kwargs)
        for item in result.get('Items', []):
            yield item
        last_key = result.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key


def _feed_sk(item):
    return (
        item.get('ultimo_mensaje_en')
        or item.get('actualizado_en')
        or item.get('creado_en')
        or datetime.now(timezone.utc).isoformat()
    )


def main():
    parser = argparse.ArgumentParser(
        description='Backfill feed_pk/feed_sk en leads Meta existentes.'
    )
    parser.add_argument('--table', required=True, help='Nombre de jam-meta-conversaciones')
    parser.add_argument('--dry-run', action='store_true', help='Solo muestra conteo, no actualiza')
    args = parser.parse_args()

    table = boto3.resource('dynamodb').Table(args.table)
    total = 0
    updated = 0

    for item in _scan_meta_leads(table):
        total += 1
        pk = item.get('pk')
        sk = item.get('sk')
        if not pk or not sk:
            continue
        feed_sk = _feed_sk(item)
        if item.get('feed_pk') == 'META_LEAD' and item.get('feed_sk') == feed_sk:
            continue
        updated += 1
        if args.dry_run:
            continue
        table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET feed_pk = :feed_pk, feed_sk = :feed_sk',
            ExpressionAttributeValues={
                ':feed_pk': 'META_LEAD',
                ':feed_sk': feed_sk,
            },
        )

    mode = 'dry-run' if args.dry_run else 'updated'
    print(f'{mode}: total_meta_leads={total} leads_to_update={updated}')


if __name__ == '__main__':
    main()
