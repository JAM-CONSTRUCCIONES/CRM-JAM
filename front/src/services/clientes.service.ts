import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { Cliente } from '../types';

export interface RegistrarClientePayload {
  cedula: string;
  proyecto_id: string;
  nombres: string;
  apellidos: string;
  correo?: string;
  telefono?: string;
  estado_civil?: string;
  nacionalidad?: string;
  pais_residencia?: string;
  fecha_nacimiento?: string;
  unidad_id?: string;
}

export const buscarClientePorCedula = (cedula: string, proyectoId?: string): Promise<Cliente | Cliente[]> => {
  const qs = proyectoId ? `?proyecto_id=${proyectoId}` : '';
  return apiGet<Cliente | Cliente[]>(`/clientes/${encodeURIComponent(cedula)}${qs}`);
};

export const registrarCliente = (data: RegistrarClientePayload): Promise<Cliente> =>
  apiPost<Cliente>('/clientes', data);

export const getClientes = (proyectoId?: string): Promise<Cliente[]> => {
  const qs = proyectoId ? `?proyecto_id=${proyectoId}` : '';
  return apiGet<Cliente[]>(`/clientes${qs}`);
};

export const getClientesAdmin = (params?: { proyecto_id?: string; inmobiliaria_id?: string; next_token?: string; limit?: number }): Promise<{ items: Cliente[]; next_token?: string }> => {
  // El campo inmobiliaria_id en DynamoDB se guarda sin el prefijo INMOBILIARIA#
  const normalizedParams = params ? {
    ...params,
    inmobiliaria_id: params.inmobiliaria_id?.replace('INMOBILIARIA#', ''),
  } : params;
  const qs = normalizedParams ? '?' + new URLSearchParams(
    Object.entries({ ...normalizedParams, limit: normalizedParams.limit?.toString() ?? '50' })
      .filter(([, v]) => v) as [string, string][]
  ).toString() : '';
  return apiGet<{ items: Cliente[]; next_token?: string }>(`/admin/clientes${qs}`);
};

export const buscarClienteAdmin = (cedula: string): Promise<(Cliente & { procesos: any[] })[]> =>
  apiGet(`/admin/clientes/buscar?q=${encodeURIComponent(cedula)}&tipo=cedula`);

export const buscarClientesAdmin = (
  query: string,
  tipo: 'nombre' | 'cedula',
  proyectoId?: string,
  inmobiliariaId?: string
): Promise<Cliente[]> => {
  const params = new URLSearchParams({ q: query, tipo });
  if (proyectoId) params.append('proyecto_id', proyectoId);
  if (inmobiliariaId) {
    // Normalizar: quitar prefijo si viene con él
    const normalizedId = inmobiliariaId.replace('INMOBILIARIA#', '');
    params.append('inmobiliaria_id', normalizedId);
  }
  return apiGet<Cliente[]>(`/admin/clientes/buscar?${params.toString()}`);
};

export const actualizarClienteAdmin = (
  cedula: string,
  proyectoId: string,
  inmobiliariaId: string,
  data: Partial<RegistrarClientePayload & { estado: string }>
): Promise<{ message: string }> =>
  apiPut(`/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}?inmobiliaria_id=${encodeURIComponent(inmobiliariaId)}`, data);

export const transferirClienteInmobiliaria = (
  cedula: string,
  proyectoId: string,
  inmobiliariaOrigenId: string,
  inmobiliariaDestinoId: string,
  unidadId?: string
): Promise<{ message: string; execution_arn: string }> => {
  const body: any = {
    cedula,
    proyecto_id: proyectoId,
    inmobiliaria_origen: inmobiliariaOrigenId.replace('INMOBILIARIA#', ''),
    inmobiliaria_destino: inmobiliariaDestinoId.replace('INMOBILIARIA#', ''),
  };
  if (unidadId) {
    body.unidad_id = unidadId;
  }
  console.log('[SERVICE] transferirClienteInmobiliaria - body:', body);
  return apiPost(`/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}/transferir`, body);
};

export const getInmobiliariasPublico = async (): Promise<{ id: string; nombre: string; imagen_url?: string }[]> => {
  const res = await fetch(`${(await import('../config')).default.apiUrl}/publico/inmobiliarias`);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Error'), { response: { status: res.status, data } });
  return data;
};

export const getProyectosPublico = async (inmobiliariaId: string): Promise<{ proyecto_id: string; nombre: string }[]> => {
  const res = await fetch(`${(await import('../config')).default.apiUrl}/publico/proyectos?inmobiliaria_id=${encodeURIComponent(inmobiliariaId)}`);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Error'), { response: { status: res.status, data } });
  return data;
};

export const registrarClientePublico = async (data: RegistrarClientePayload & { inmobiliaria_id: string }): Promise<Cliente> => {
  const cfg = await import('../config');
  const res = await fetch(`${cfg.default.apiUrl}/publico/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.message || 'Error'), { response: { status: res.status, data: json } });
  return json;
};

export const eliminarClienteAdmin = (
  cedula: string,
  proyectoId: string
): Promise<{ message: string; items_eliminados: string[]; registros_eliminados: number; cliente: any }> =>
  apiPut(`/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}?accion=eliminar`, {});
