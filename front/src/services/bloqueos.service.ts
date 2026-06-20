import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { Bloqueo, HistorialBloqueo } from '../types';
import { validateAndNormalizeClientePayload } from '../utils/clientesValidation';
import type { ModoNotificacion } from '../components/common/CambiarEstatusModal';

export const bloquearUnidad = (data: {
  proyecto_id: string;
  unidad_id: string;
  inmobiliaria_id?: string; // Para que el admin pueda especificar la inmobiliaria
  forzar_admin?: boolean; // Para que el admin pueda saltarse validaciones de exclusividad
  // Datos del cliente — opcionales si se bloquea sin cliente
  cedula?: string;
  nombres?: string;
  apellidos?: string;
  correo?: string;
  telefono?: string;
  fecha_nacimiento?: string;
  estado_civil?: string;
  nacionalidad?: string;
  pais_residencia?: string;
}): Promise<{ unidad_id: string; fecha_liberacion: string; cliente_registrado: boolean; advertencia_cliente?: string }> =>
  apiPost('/bloqueos', validateAndNormalizeClientePayload(data));

export interface BloquesActivosResponse {
  items: Bloqueo[];
  next_token?: string;
}

export const getBloquesActivos = (): Promise<BloquesActivosResponse> =>
  apiGet<BloquesActivosResponse>('/bloqueos/activos');

export interface HistorialResponse {
  items: HistorialBloqueo[];
  next_token?: string;
}

export const getHistorialBloqueos = (unidadId?: string, nextToken?: string): Promise<HistorialResponse> => {
  const params = new URLSearchParams();
  if (unidadId) params.set('unidad_id', unidadId);
  if (nextToken) params.set('next_token', nextToken);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiGet<HistorialResponse>(`/admin/bloqueos/historial${qs}`);
};

export const liberarBloqueo = (
  unidadId: string,
  proyectoId: string,
  notificar: ModoNotificacion = false
): Promise<{ message: string }> => {
  const params = new URLSearchParams({ proyecto_id: proyectoId, notificar: String(notificar) });
  return apiDelete(`/admin/bloqueos/${unidadId}?${params.toString()}`);
};

export const extenderBloqueo = (
  unidadId: string,
  proyectoId: string,
  data: { horas_extra: number; justificacion: string }
): Promise<{ message: string; nueva_fecha_liberacion: string }> =>
  apiPut(`/admin/bloqueos/${unidadId}/extender?proyecto_id=${proyectoId}`, data);
