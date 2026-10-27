import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('bloqueos admin', () => {
  test('los usuarios internos saltan rebloqueo y forzar_admin queda para exclusividad', () => {
    const bloqueos = read('lambdas/jam-bloqueos/routes/bloqueos.py');

    expect(bloqueos).toContain("solicita_forzar_admin = bool(body.get('forzar_admin', False))");
    expect(bloqueos).toContain('forzar_admin = es_admin and solicita_forzar_admin');
    expect(bloqueos).toContain('if tiene_cliente and not forzar_admin:');
    expect(bloqueos).toContain('puede_omitir_rebloqueo = es_admin');
    expect(bloqueos).toContain('if not ya_bloqueada_propia and not puede_omitir_rebloqueo:');
    expect(bloqueos).toContain('omitir_exclusividad=forzar_admin');
    expect(bloqueos).toContain('_revertir_bloqueo_nuevo');
  });

  test('las inmobiliarias deben enviar un cliente para crear bloqueos', () => {
    const bloqueos = read('lambdas/jam-bloqueos/routes/bloqueos.py');

    expect(bloqueos).toContain("if not es_admin and not tiene_cliente:");
    expect(bloqueos).toContain("Las inmobiliarias deben crear el bloqueo con un cliente");
  });

  test('las eliminaciones administrativas dejan auditoria con el actor', () => {
    const clientes = read('lambdas/jam-captacion/routes/clientes.py');

    expect(clientes).toContain("'audit': 'admin_action'");
    expect(clientes).toContain("'accion': 'eliminar_cliente_completo'");
    expect(clientes).toContain("'sub': claims.get('sub')");
    expect(clientes).toContain("'request_id': request_context.get('requestId')");
    expect(clientes).toContain("'completada',");
    expect(clientes).toContain("detalle_items=items_eliminados");
  });

  test('las creaciones dejan auditoria de captacion y bloqueo', () => {
    const clientes = read('lambdas/jam-captacion/routes/clientes.py');
    const bloqueos = read('lambdas/jam-bloqueos/routes/bloqueos.py');

    expect(clientes).toContain("'audit': 'crm_action'");
    expect(clientes).toContain("'accion': accion");
    expect(clientes).toContain("'cliente_captado'");
    expect(bloqueos).toContain("'audit': 'bloqueos_action'");
    expect(bloqueos).toContain("'bloqueo_creado'");
    expect(bloqueos).toContain("'cliente_asignado_bloqueo'");
  });
});
