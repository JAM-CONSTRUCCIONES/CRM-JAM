"""
Vacía torres y unidades de jam-inventario.
Conserva proyectos (METADATA) y etapas (ETAPA#).

Uso:
  python scripts/vaciar-inventario.py --dry-run   # solo lista, no elimina
  python scripts/vaciar-inventario.py             # elimina
"""
import boto3
import argparse

TABLE = 'jam-inventario'

def main(dry_run: bool):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(TABLE)

    # Scan completo
    items = []
    resp = table.scan()
    items.extend(resp.get('Items', []))
    while resp.get('LastEvaluatedKey'):
        resp = table.scan(ExclusiveStartKey=resp['LastEvaluatedKey'])
        items.extend(resp.get('Items', []))

    # Filtrar solo TORRE# y UNIDAD#
    a_eliminar = [
        i for i in items
        if i.get('sk', '').startswith('TORRE#') or i.get('sk', '').startswith('UNIDAD#')
    ]

    print(f"Total registros en tabla: {len(items)}")
    print(f"Torres y unidades a eliminar: {len(a_eliminar)}")

    if dry_run:
        print("\n[DRY RUN] No se eliminó nada. Registros que se eliminarían:")
        for i in a_eliminar:
            print(f"  {i['pk']} | {i['sk']}")
        return

    print("\nEliminando...")
    with table.batch_writer() as batch:
        for i in a_eliminar:
            batch.delete_item(Key={'pk': i['pk'], 'sk': i['sk']})

    print(f"✓ {len(a_eliminar)} registros eliminados.")
    print("Proyectos y etapas conservados.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    main(args.dry_run)
