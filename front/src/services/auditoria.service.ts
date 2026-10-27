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
  entidad_tipo?: string;
  entidad_id?: string;
  entidad_nombre?: string;
  detalles?: Record<string, unknown>;
}

export interface AuditoriaResponse {
  items: AuditoriaItem[];
  fecha: string;
  count: number;
  last_key?: string | null;
}

export const listarAuditoria = (params: {
  fecha?: string;
  usuario_sub?: string;
  accion?: string;
  modulo?: string;
  resultado?: string;
} = {}) => {
  const query = new URLSearchParams({ tipo: 'auditoria' });
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return apiGet<AuditoriaResponse>(`/admin/procesos?${query.toString()}`);
};
