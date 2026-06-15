import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('permisos del coordinador', () => {
  test('jam-auth permite al coordinador entrar al modulo administrativo', () => {
    const handler = read('lambdas/jam-auth/handler.py');

    expect(handler).toContain("return _get_rol(event) in ('admin', 'coordinador')");
    expect(handler).toContain('if not _is_internal(event):');
    expect(handler).toContain('return sistema.eliminar(sistema_usuario_id, event)');
  });

  test('backend bloquea cambio de rol y eliminacion si no es admin', () => {
    const sistema = read('lambdas/jam-auth/routes/sistema.py');

    expect(sistema).toContain("if _get_rol(event) != 'admin':");
    expect(sistema).toContain('Solo un administrador puede cambiar el rol de un usuario');
    expect(sistema).toContain('Solo un administrador puede eliminar usuarios');
  });

  test('front habilita rutas administrativas para coordinador', () => {
    const app = read('front/src/App.tsx');

    expect(app).toContain("roles={['admin', 'coordinador']}");
    expect(app).toContain('<InmobiliariasPage />');
    expect(app).toContain('<UsuariosSistemaPage />');
    expect(app).toContain('<ConfigPage />');
  });

  test('pantalla de usuarios no envia rol ni muestra eliminar al coordinador', () => {
    const usuariosPage = read('front/src/pages/sistema/UsuariosSistemaPage.tsx');

    expect(usuariosPage).toContain("const isAdmin = usuarioActual?.rol === 'admin'");
    expect(usuariosPage).toContain("isAdmin ? { nombre: values.nombre, rol: values.rol } : { nombre: values.nombre }");
    expect(usuariosPage).toContain('{isAdmin && (');
    expect(usuariosPage).toContain("disabled={modo === 'editar' && (!isAdmin || editando?.pk === `USUARIO#${usuarioActual?.sub}`)}");
  });
});
