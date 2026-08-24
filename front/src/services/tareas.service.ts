import { apiDelete, apiGet, apiPost, apiPut } from './api';

export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
export type PrioridadTarea = 'baja' | 'media' | 'alta';

export interface TrabajadorJam {
  trabajador_id: string;
  nombre: string;
  telefono?: string;
  correo?: string;
  cargo?: string;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface TareaJam {
  tarea_id: string;
  titulo: string;
  descripcion?: string;
  trabajador_id: string;
  trabajador_nombre: string;
  fecha: string;
  hora: string;
  fecha_hora_inicio: string;
  duracion_minutos?: number;
  estado: EstadoTarea;
  prioridad: PrioridadTarea;
  proyecto_id?: string;
  proyecto_nombre?: string;
  unidad_id?: string;
  relacion_tipo?: string;
  relacion_id?: string;
  relacion_nombre?: string;
  recordatorio_minutos_antes?: number;
  creado_por?: string;
  creado_por_nombre?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface TareasFiltros {
  fecha?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  trabajador_id?: string;
  estado?: EstadoTarea;
  prioridad?: PrioridadTarea;
  relacion_tipo?: string;
  relacion_id?: string;
}

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const getTareas = (filtros: TareasFiltros = {}): Promise<TareaJam[]> =>
  apiGet(`/admin/tareas${query(filtros as Record<string, string | undefined>)}`);

export const crearTarea = (
  data: Omit<TareaJam, 'tarea_id' | 'trabajador_nombre' | 'fecha_hora_inicio' | 'estado' | 'prioridad'> & {
    estado?: EstadoTarea;
    prioridad?: PrioridadTarea;
  },
): Promise<TareaJam> => apiPost('/admin/tareas', data);

export const actualizarTarea = (
  tareaId: string,
  data: Partial<TareaJam>,
): Promise<TareaJam> => apiPut('/admin/tareas', { ...data, tarea_id: tareaId });

export const cancelarTarea = (tareaId: string): Promise<TareaJam> =>
  apiDelete(`/admin/tareas?tarea_id=${encodeURIComponent(tareaId)}`);

export const getTrabajadores = (incluirInactivos = false): Promise<TrabajadorJam[]> =>
  apiGet(`/admin/tareas?tipo=trabajadores${incluirInactivos ? '&incluir_inactivos=true' : ''}`);

export const crearTrabajador = (
  data: Omit<TrabajadorJam, 'trabajador_id' | 'creado_en' | 'actualizado_en'>,
): Promise<TrabajadorJam> => apiPost('/admin/tareas', { ...data, tipo: 'trabajador' });

export const actualizarTrabajador = (
  trabajadorId: string,
  data: Partial<TrabajadorJam>,
): Promise<TrabajadorJam> =>
  apiPut('/admin/tareas', { ...data, tipo: 'trabajador', trabajador_id: trabajadorId });
