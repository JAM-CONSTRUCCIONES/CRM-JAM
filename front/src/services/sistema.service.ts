import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { RolInterno } from '../types';

export interface UsuarioSistema {
  pk: string;
  cognito_username: string;
  nombre: string;
  rol: RolInterno;
  activo: boolean;
  creado_en: string;
}

const usuarioId = (pk: string) => pk.replace('USUARIO#', '');

export const getUsuariosSistema = (): Promise<UsuarioSistema[]> =>
  apiGet('/admin/sistema/usuarios');

export const crearUsuarioSistema = (data: { username: string; password: string; nombre?: string; rol: RolInterno }): Promise<{ mfa_secret?: string }> =>
  apiPost('/admin/sistema/usuarios', data);

export const actualizarUsuarioSistema = (pk: string, data: { nombre?: string; rol?: RolInterno }): Promise<void> =>
  apiPut(`/admin/sistema/usuarios/${usuarioId(pk)}`, data);

export const deshabilitarUsuarioSistema = (pk: string): Promise<void> =>
  apiPut(`/admin/sistema/usuarios/${usuarioId(pk)}/deshabilitar`, {});

export const habilitarUsuarioSistema = (pk: string): Promise<void> =>
  apiPut(`/admin/sistema/usuarios/${usuarioId(pk)}/habilitar`, {});

export const eliminarUsuarioSistema = (pk: string): Promise<void> =>
  apiDelete(`/admin/sistema/usuarios/${usuarioId(pk)}`);
