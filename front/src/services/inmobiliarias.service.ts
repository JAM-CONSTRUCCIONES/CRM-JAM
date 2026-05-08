import { apiGet, apiPost, apiPut, apiDelete } from './api';

export interface Inmobiliaria {
  pk: string;
  nombre: string;
  correos: string[];
  proyectos: string[];
  activo: boolean;
  creado_en: string;
  imagen_url?: string;
}

export interface UsuarioInmo {
  pk: string;
  cognito_username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  creado_en: string;
}

const inmoId = (pk: string) => pk.replace('INMOBILIARIA#', '');
const usuarioId = (pk: string) => pk.replace('USUARIO#', '');

export const getInmobiliarias = (): Promise<Inmobiliaria[]> =>
  apiGet('/admin/inmobiliarias');

export const crearInmobiliaria = (data: { nombre: string; correos: string[]; proyectos: string[] }): Promise<Inmobiliaria> =>
  apiPost('/admin/inmobiliarias', data);

export const actualizarInmobiliaria = (pk: string, data: { nombre?: string; correos?: string[]; proyectos?: string[]; imagen_url?: string }): Promise<void> =>
  apiPut(`/admin/inmobiliarias/${inmoId(pk)}`, data);

export const getPresignedImagenInmobiliaria = (pk: string, contentType = 'image/jpeg'): Promise<{ upload_url: string; public_url: string; key: string }> =>
  apiPost(`/admin/inmobiliarias/${inmoId(pk)}/imagen`, { content_type: contentType });

export const deshabilitarInmobiliaria = (pk: string): Promise<void> =>
  apiPut(`/admin/inmobiliarias/${inmoId(pk)}/deshabilitar`, {});

export const habilitarInmobiliaria = (pk: string): Promise<void> =>
  apiPut(`/admin/inmobiliarias/${inmoId(pk)}/habilitar`, {});

export const eliminarInmobiliaria = (pk: string): Promise<void> =>
  apiDelete(`/admin/inmobiliarias/${inmoId(pk)}`);

export const getUsuariosInmobiliaria = (pk: string): Promise<UsuarioInmo[]> =>
  apiGet(`/admin/inmobiliarias/${inmoId(pk)}/usuarios`);

export const crearUsuarioInmobiliaria = (pk: string, data: { username: string; password: string; nombre?: string; correo?: string }): Promise<void> =>
  apiPost(`/admin/inmobiliarias/${inmoId(pk)}/usuarios`, data);

export const deshabilitarUsuario = (inmoPk: string, usuarioPk: string): Promise<void> =>
  apiPut(`/admin/inmobiliarias/${inmoId(inmoPk)}/usuarios/${usuarioId(usuarioPk)}/deshabilitar`, {});

export const habilitarUsuario = (inmoPk: string, usuarioPk: string): Promise<void> =>
  apiPut(`/admin/inmobiliarias/${inmoId(inmoPk)}/usuarios/${usuarioId(usuarioPk)}/habilitar`, {});

export const eliminarUsuarioInmobiliaria = (inmoPk: string, usuarioPk: string): Promise<void> =>
  apiDelete(`/admin/inmobiliarias/${inmoId(inmoPk)}/usuarios/${usuarioId(usuarioPk)}`);
