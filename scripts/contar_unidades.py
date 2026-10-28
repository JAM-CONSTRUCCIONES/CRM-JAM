import json

d = json.load(open('scripts/desfasados_prod.json', encoding='utf-8'))

for t in ('procesos', 'clientes', 'historial'):
    lst = d.get(t, [])
    # unidades distintas por (proyecto, unidad_id)
    unidades = {}
    for r in lst:
        key = (r['proyecto_id'], r['unidad_id'])
        unidades[key] = (r['nombre_guardado'], r['nombre_correcto'])
    print(f'== {t}: {len(lst)} registros | {len(unidades)} unidades distintas ==')
    if t == 'procesos':
        for (pid, uid), (viejo, nuevo) in sorted(unidades.items(), key=lambda x: x[1][1]):
            print(f"   {viejo}  ->  {nuevo}   (unidad_id {uid})")
