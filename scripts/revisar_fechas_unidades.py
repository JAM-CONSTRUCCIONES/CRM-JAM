"""Solo lectura: revisa en inventario prod la fecha actualizado_en de las unidades
desfasadas, para ver cuando se renombraron y si fue en lote."""
import json
import boto3
from collections import Counter

d = json.load(open('scripts/desfasados_prod.json', encoding='utf-8'))
# Reunir unidad_ids desfasados (procesos + historial)
unidades = set()
for t in ('procesos', 'historial'):
    for r in d.get(t, []):
        unidades.add((r['proyecto_id'], r['unidad_id'], r['nombre_correcto']))

ddb = boto3.resource('dynamodb', region_name='us-east-1')
inv = ddb.Table('jam-inventario-prod')

filas = []
for pid, uid, nombre in unidades:
    it = inv.get_item(Key={'pk': f'PROYECTO#{pid}', 'sk': f'UNIDAD#{uid}'}).get('Item', {})
    filas.append({
        'id_unidad': it.get('id_unidad'),
        'actualizado_en': it.get('actualizado_en'),
        'creado_en': it.get('creado_en') or it.get('created_at'),
    })

print(f'Unidades revisadas: {len(filas)}')
print('\n-- Campos presentes en una unidad de ejemplo --')
# mostrar todas las keys del primer item para ver que campos de fecha existen
ej = inv.get_item(Key={'pk': f'PROYECTO#{list(unidades)[0][0]}', 'sk': f'UNIDAD#{list(unidades)[0][1]}'}).get('Item', {})
print(sorted(ej.keys()))

# Agrupar por dia de actualizado_en
dias = Counter()
for f in filas:
    ae = f['actualizado_en']
    dia = (ae or 'SIN_FECHA')[:10]
    dias[dia] += 1

print('\n-- actualizado_en agrupado por dia --')
for dia, n in sorted(dias.items()):
    print(f'   {dia}: {n} unidades')

print('\n-- Muestra (primeras 15) --')
for f in sorted(filas, key=lambda x: x.get('actualizado_en') or '')[:15]:
    print(f"   {f['id_unidad']}: actualizado_en={f['actualizado_en']}  creado_en={f['creado_en']}")
