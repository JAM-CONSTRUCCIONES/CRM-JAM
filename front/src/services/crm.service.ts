import { apiGet, apiPut } from './api';
import type { Proceso } from '../types';
import type { ModoNotificacion } from '../components/common/CambiarEstatusModal';

export interface CambiarEstatusPayload {
  estatus: string;
  inmobiliaria_id: string;
  notificar: ModoNotificacion;
}

export interface ProcesoEnriquecido extends Proceso {
  cliente?: {
    nombres: string;
    apellidos: string;
    correo?: string;
    telefono?: string;
  };
  estado_unidad?: string;
  fecha_liberacion_unidad?: string;
}

export interface ProcesosResponse {
  items: ProcesoEnriquecido[];
  next_token?: string;
}

export const listarTodosProcesos = (params?: {
  proyecto_id?: string;
  inmobiliaria_id?: string;
  estado?: string;
  incluir_cerrados?: boolean;
  next_token?: string;
}): Promise<ProcesosResponse> => {
  const entries: Record<string, string> = {};
  if (params?.proyecto_id) entries.proyecto_id = params.proyecto_id;
  if (params?.inmobiliaria_id) entries.inmobiliaria_id = params.inmobiliaria_id;
  if (params?.estado) entries.estado = params.estado;
  if (params?.incluir_cerrados) entries.incluir_cerrados = 'true';
  if (params?.next_token) entries.next_token = params.next_token;
  const qs = Object.keys(entries).length ? '?' + new URLSearchParams(entries).toString() : '';
  return apiGet<ProcesosResponse>(`/admin/procesos${qs}`);
};

export const getProcesosCliente = (cedula: string, inmobiliariaId?: string): Promise<Proceso[]> => {
  const qs = inmobiliariaId ? `?inmobiliaria_id=${encodeURIComponent(inmobiliariaId)}` : '';
  return apiGet<Proceso[]>(`/admin/clientes/${encodeURIComponent(cedula)}/procesos${qs}`);
};

export const getMisProcesos = (proyectoId?: string): Promise<Proceso[]> => {
  const qs = proyectoId ? `?proyecto_id=${proyectoId}` : '';
  return apiGet<Proceso[]>(`/mis-procesos${qs}`);
};

export const cambiarEstatus = (
  cedula: string,
  proyectoId: string,
  unidadId: string,
  data: CambiarEstatusPayload
): Promise<{ message: string; estatus: string }> =>
  apiPut(
    `/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}/unidad/${encodeURIComponent(unidadId)}/estatus`,
    data
  );

export const getHistorialProceso = (
  cedula: string,
  proyectoId: string,
  unidadId: string,
  inmobiliariaId: string
): Promise<Proceso['historial']> =>
  apiGet(
    `/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}/unidad/${encodeURIComponent(unidadId)}/historial?inmobiliaria_id=${encodeURIComponent(inmobiliariaId)}`
  );
