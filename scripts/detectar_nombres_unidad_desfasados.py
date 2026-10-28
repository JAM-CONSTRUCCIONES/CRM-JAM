"""
Detección de solo lectura: lista registros con unidad_nombre desfasado respecto
al id_unidad vigente en inventario. NO modifica nada.

Uso:
    python detectar_nombres_unidad_desfasados.py dev
    python detectar_nombres_unidad_desfasados.py prod
"""
import sys
import json
import boto3

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
    env = sys.argv[1] if len(sys.argv) > 1 else 'dev'
    if env not in SUFIJO:
        print('Ambiente invalido. Usa dev o prod.')
        return

    ddb = boto3.resource('dynamodb', region_name='us-east-1')
    inv = ddb.Table(tabla('jam-inventario', env))
    procesos = ddb.Table(tabla('jam-procesos', env))
    clientes = ddb.Table(tabla('jam-clientes', env))
    historial = ddb.Table(tabla('jam-historial-bloqueos', env))

    # 1) Mapa de nombre vigente por unidad: (proyecto_id, unidad_id) -> id_unidad
    #    Inventario: pk=PROYECTO#<pid>, sk=UNIDAD#<uid>
    vigente = {}
    inv_items = scan_all(inv, ProjectionExpression='pk, sk, id_unidad')
    for it in inv_items:
        pk = it.get('pk', '')
        sk = it.get('sk', '')
        if not pk.startswith('PROYECTO#') or not sk.startswith('UNIDAD#'):
            continue
        pid = pk.replace('PROYECTO#', '')
        uid = sk.replace('UNIDAD#', '')
        idu = it.get('id_unidad')
        if idu:
            vigente[(pid, uid)] = idu

    print(f'== Ambiente: {env} ==')
    print(f'Unidades en inventario: {len(vigente)}')

    resumen = {}
    detalle = {}

    def revisar(nombre_tabla, items):
        desfasados = []
        for it in items:
            pid = str(it.get('proyecto_id', '')).replace('PROYECTO#', '')
            uid = it.get('unidad_id')
            if not uid:
                continue
            actual = it.get('unidad_nombre')
            correcto = vigente.get((pid, uid))
            if correcto is None:
                continue  # unidad no existe en inventario (no comparable)
            if actual != correcto:
                desfasados.append({
                    'proyecto_id': pid,
                    'unidad_id': uid,
                    'nombre_guardado': actual,
                    'nombre_correcto': correcto,
                    'pk': it.get('pk'),
                    'sk': it.get('sk'),
                })
        resumen[nombre_tabla] = len(desfasados)
        detalle[nombre_tabla] = desfasados

    revisar('procesos', scan_all(procesos, ProjectionExpression='pk, sk, proyecto_id, unidad_id, unidad_nombre'))
    revisar('clientes', scan_all(clientes, ProjectionExpression='pk, sk, proyecto_id, unidad_id, unidad_nombre'))
    revisar('historial', scan_all(historial, ProjectionExpression='pk, sk, proyecto_id, unidad_id, unidad_nombre'))

    print('\n-- Resumen de desfasados --')
    for k, v in resumen.items():
        print(f'  {k}: {v}')

    print('\n-- Detalle (primeros 50 por tabla) --')
    for k, lst in detalle.items():
        print(f'\n[{k}] {len(lst)} desfasados')
        for d in lst[:50]:
            print(f"  {d['proyecto_id']} / {d['unidad_id']}: '{d['nombre_guardado']}'  ->  '{d['nombre_correcto']}'")

    # Guardar JSON completo para revision / correccion posterior
    out = f'scripts/desfasados_{env}.json'
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(detalle, f, ensure_ascii=False, indent=2, default=str)
    print(f'\nDetalle completo guardado en {out}')

if __name__ == '__main__':
    main()
