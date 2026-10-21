import { apiGet, apiPut, apiPost } from './api';
import type { Proceso } from '../types';
import type { RegistrarClientePayload } from './clientes.service';
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
  /** Texto de búsqueda. Cuando se envía, el backend recorre todo el proyecto. */
  q?: string;
  /** true = el backend enriquece todos (lento). Por defecto devuelve crudo. */
  enrich?: boolean;
}): Promise<ProcesosResponse> => {
  const entries: Record<string, string> = {};
  if (params?.proyecto_id) entries.proyecto_id = params.proyecto_id;
  if (params?.inmobiliaria_id) entries.inmobiliaria_id = params.inmobiliaria_id;
  if (params?.estado) entries.estado = params.estado;
  if (params?.incluir_cerrados) entries.incluir_cerrados = 'true';
  if (params?.q && params.q.trim()) entries.q = params.q.trim();
  if (params?.enrich) entries.enrich = 'true';
  const qs = Object.keys(entries).length ? '?' + new URLSearchParams(entries).toString() : '';
  return apiGet<ProcesosResponse>(`/admin/procesos${qs}`);
};

/**
 * Enriquece un lote de procesos (la página visible, ~100) con datos de cliente
 * y estado de unidad. Se usa junto con el listado crudo: traer todo liviano y
 * enriquecer solo lo que se muestra.
 */
export const enriquecerProcesos = (
  claves: Array<{ pk: string; sk: string }>,
): Promise<ProcesosResponse> =>
  apiPost<ProcesosResponse>('/admin/procesos?tipo=enriquecer-procesos', { claves });

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

export interface TraspasarClienteProcesoPayload {
  inmobiliaria_id: string;
  tipo_destino: 'existente' | 'nuevo';
  cedula_destino?: string;
  cliente?: Omit<RegistrarClientePayload, 'proyecto_id' | 'unidad_id'>;
  justificacion: string;
}

export const traspasarClienteProceso = (
  cedulaActual: string,
  proyectoId: string,
  unidadId: string,
  data: TraspasarClienteProcesoPayload,
): Promise<{
  message: string;
  cedula_anterior: string;
  cedula_nueva: string;
  proceso: Proceso;
  advertencia?: string;
}> =>
  apiPut(
    `/admin/clientes/${encodeURIComponent(cedulaActual)}/proyecto/${encodeURIComponent(proyectoId)}/unidad/${encodeURIComponent(unidadId)}/estatus?accion=traspasar_cliente`,
    data,
  );
