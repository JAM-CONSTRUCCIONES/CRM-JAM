import json

d = json.load(open('scripts/desfasados_prod.json', encoding='utf-8'))
lineas = []
for t in ('procesos', 'clientes', 'historial'):
    lst = d.get(t, [])
    lineas.append(f'===== {t} ({len(lst)}) =====')
    for i, r in enumerate(lst, 1):
        lineas.append(
            f"{i:3}. pk={r['pk']} | sk={r['sk']} | "
            f"'{r['nombre_guardado']}' -> '{r['nombre_correcto']}'"
        )
    lineas.append('')

texto = '\n'.join(lineas)
open('scripts/lista_edicion_prod.txt', 'w', encoding='utf-8').write(texto)
print(texto)
