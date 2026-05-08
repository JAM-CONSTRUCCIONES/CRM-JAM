path = 'lambdas/jam-proyectos/routes/excel.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix torre creation: add orden incremental and use etapa_id from fila
old = (
    "            inventario_t.put_item(Item={\n"
    "                'pk': f'PROYECTO#{proyecto_id}',\n"
    "                'sk': f'TORRE#{torre_id}',\n"
    "                'torre_id': torre_id,\n"
    "                'nombre': torre_nombre,\n"
    "                'etapa_id': '',\n"
    "                'orden': 0,\n"
    "                'activo': True,\n"
    "                'creado_en': ahora,\n"
    "            })\n"
    "            torres_cache[torre_nombre] = torre_id"
)
new = (
    "            orden = len(torres_cache) + 1\n"
    "            inventario_t.put_item(Item={\n"
    "                'pk': f'PROYECTO#{proyecto_id}',\n"
    "                'sk': f'TORRE#{torre_id}',\n"
    "                'torre_id': torre_id,\n"
    "                'nombre': torre_nombre,\n"
    "                'etapa_id': fila.get('etapa_id') or '',\n"
    "                'orden': orden,\n"
    "                'activo': True,\n"
    "                'creado_en': ahora,\n"
    "            })\n"
    "            torres_cache[torre_nombre] = torre_id"
)

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Torre fix: OK')
else:
    print('Torre fix: NOT FOUND')
    # Show context
    idx = content.find("'etapa_id': ''")
    if idx >= 0:
        print('Found etapa_id at:', idx)
        print(repr(content[idx-200:idx+100]))
    else:
        print('etapa_id empty string not found either')
