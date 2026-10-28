"""
Corrección de unidad_nombre desfasado.

REGLA DE ORO: el nombre solo se corrige cuando el registro apunta a la MISMA
unidad identificada por `unidad_id`. Nunca por coincidencia de nombre.
Para cada registro se vuelve a resolver el nombre vigente desde inventario por
(proyecto_id, unidad_id); si la unidad no existe, se omite (no se toca).

Uso:
    python corregir_nombres_unidad.py prod --dry-run   # simula, no escribe
    python corregir_nombres_unidad.py prod             # aplica
"""
import sys
import boto3
from boto3.dynamodb.conditions import Key, Attr

SUFIJO = {'dev': '', 'prod': '-prod'}

def tabla(base, env):
    return f'{base}{SUFIJO[env]}'

def scan_all(table, **kwargs):
    items = []
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get('Items', []))
        lek = resp.get('LastEvaluatedKey')
        if not lek:
            break
        kwargs['ExclusiveStartKey'] = lek
    return items

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in SUFIJO:
        print('Uso: python corregir_nombres_unidad.py <dev|prod> [--dry-run]')
        return
    env = sys.argv[1]
    dry = '--dry-run' in sys.argv

    ddb = boto3.resource('dynamodb', region_name='us-east-1')
    inv = ddb.Table(tabla('jam-inventario', env))
    procesos = ddb.Table(tabla('jam-procesos', env))
    historial = ddb.Table(tabla('jam-historial-bloqueos', env))

    # Mapa nombre vigente por (proyecto_id, unidad_id) -> id_unidad (fuente de verdad).
    vigente = {}
    for it in scan_all(inv, ProjectionExpression='pk, sk, id_unidad'):
        pk, sk = it.get('pk', ''), it.get('sk', '')
        if pk.startswith('PROYECTO#') and sk.startswith('UNIDAD#') and it.get('id_unidad'):
            vigente[(pk.replace('PROYECTO#', ''), sk.replace('UNIDAD#', ''))] = it['id_unidad']

    print(f'== Corrección de nombres | ambiente={env} | dry_run={dry} ==')
    print(f'Unidades en inventario: {len(vigente)}')

    total = {'procesos': 0, 'historial': 0}

    def corregir(nombre_tabla, table):
        items = scan_all(table, ProjectionExpression='pk, sk, proyecto_id, unidad_id, unidad_nombre')
        cambios = 0
        for it in items:
            uid = it.get('unidad_id')
            if not uid:
                continue
            pid = str(it.get('proyecto_id', '')).replace('PROYECTO#', '')
            # REGLA DE ORO: resolver por unidad_id contra inventario.
            correcto = vigente.get((pid, uid))
            if correcto is None:
                continue  # la unidad no existe en inventario -> no tocar
            if it.get('unidad_nombre') == correcto:
                continue  # ya está bien
            cambios += 1
            if not dry:
                table.update_item(
                    Key={'pk': it['pk'], 'sk': it['sk']},
                    UpdateExpression='SET unidad_nombre = :n',
                    ExpressionAttributeValues={':n': correcto},
                    # Doble seguro: solo si el unidad_id del item sigue siendo el mismo.
                    ConditionExpression=Attr('unidad_id').eq(uid),
                )
        total[nombre_tabla] = cambios
        print(f'  {nombre_tabla}: {cambios} {"a corregir (simulado)" if dry else "corregidos"}')

    corregir('procesos', procesos)
    corregir('historial', historial)

    print(f'\nTotal: {sum(total.values())} registros {"(simulado)" if dry else "corregidos"}')

if __name__ == '__main__':
    main()
