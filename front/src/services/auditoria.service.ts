import { apiGet } from './api';

export interface AuditoriaItem {
  pk: string;
  sk: string;
  evento_id: string;
  fecha: string;
  accion: string;
  modulo: string;
  resultado: string;
  usuario_sub?: string;
  usuario_nombre?: string;
  usuario_rol?: string;
  rol?: string;
  entidad_tipo?: string;
  entidad_id?: string;
  entidad_nombre?: string;
  detalles?: Record<string, unknown>;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
}

export interface AuditoriaResponse {
  items: AuditoriaItem[];
  fecha: string;
  count: number;
  next_token?: string | null;
}

export interface AuditoriaUsuarioOption {
  value: string;
  label: string;
  username: string;
  rol: string;
  activo: boolean;
}

export interface AuditoriaOpcionesResponse {
  actores: { value: 'usuario' | 'sistema'; label: string }[];
  usuarios: AuditoriaUsuarioOption[];
}

export const obtenerOpcionesAuditoria = () =>
  apiGet<AuditoriaOpcionesResponse>('/admin/procesos?tipo=auditoria&opciones=true');

export const listarAuditoria = (params: {
  fecha?: string;
  usuario_sub?: string;
  usuario_nombre?: string;
  actor_tipo?: 'usuario' | 'sistema';
  accion?: string;
  modulo?: string;
  resultado?: string;
  next_token?: string;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams({ tipo: 'auditoria' });
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });
  return apiGet<AuditoriaResponse>(`/admin/procesos?${query.toString()}`);
};
