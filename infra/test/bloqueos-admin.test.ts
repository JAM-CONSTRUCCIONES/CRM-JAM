import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('bloqueos admin', () => {
  test('forzar_admin solo aplica a usuarios internos y salta rebloqueo 24h', () => {
    const bloqueos = read('lambdas/jam-bloqueos/routes/bloqueos.py');

    expect(bloqueos).toContain("solicita_forzar_admin = bool(body.get('forzar_admin', False))");
    expect(bloqueos).toContain('forzar_admin = es_admin and solicita_forzar_admin');
    expect(bloqueos).toContain('if tiene_cliente and not forzar_admin:');
    expect(bloqueos).toContain('if not ya_bloqueada_propia and not forzar_admin:');
  });
});
