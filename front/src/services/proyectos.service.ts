import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { Proyecto, Unidad, Etapa } from '../types';

export const getProyectos = (): Promise<Proyecto[]> =>
  apiGet<Proyecto[]>('/proyectos');

export const getProyecto = (proyectoId: string): Promise<Proyecto> =>
  apiGet<Proyecto>(`/proyectos/${proyectoId}`);

export const crearProyecto = (data: { nombre: string; descripcion?: string }): Promise<Proyecto> =>
  apiPost<Proyecto>('/admin/proyectos', data);

export const actualizarProyecto = (proyectoId: string, data: { nombre?: string; descripcion?: string; imagen_url?: string }): Promise<void> =>
  apiPut(`/admin/proyectos/${proyectoId}`, data);

export const eliminarProyecto = (proyectoId: string): Promise<void> =>
  apiDelete(`/admin/proyectos/${proyectoId}`);

export const getPresignedImagenProyecto = (proyectoId: string, contentType = 'image/jpeg'): Promise<{ upload_url: string; public_url: string; key: string }> =>
  apiPost(`/admin/proyectos/${proyectoId}/imagen`, { content_type: contentType });

// Etapas
export const getEtapas = (proyectoId: string): Promise<Etapa[]> =>
  apiGet<Etapa[]>(`/proyectos/${proyectoId}/etapas`);

export const crearEtapa = (proyectoId: string, data: { nombre: string }): Promise<Etapa> =>
  apiPost<Etapa>(`/admin/proyectos/${proyectoId}/etapas`, data);

export const actualizarEtapa = (proyectoId: string, etapaId: string, data: { nombre?: string }): Promise<void> =>
  apiPut(`/admin/proyectos/${proyectoId}/etapas/${etapaId}`, data);

export const eliminarEtapa = (proyectoId: string, etapaId: string): Promise<void> =>
  apiDelete(`/admin/proyectos/${proyectoId}/etapas/${etapaId}`);

// Unidades
export const getUnidades = (
  proyectoId: string,
  filtros?: { estado?: string; etapa_id?: string; id_unidad?: string; tipo?: string; manzana?: string; piso?: string; limit?: number; next_token?: string }
): Promise<Unidad[]> => {
  const params = new URLSearchParams();
  if (filtros?.estado) params.append('estado', filtros.estado);
  if (filtros?.etapa_id) params.append('etapa_id', filtros.etapa_id);
  if (filtros?.id_unidad) params.append('id_unidad', filtros.id_unidad);
  if (filtros?.tipo) params.append('tipo', filtros.tipo);
  if (filtros?.manzana) params.append('manzana', filtros.manzana);
  if (filtros?.piso) params.append('piso', filtros.piso);
  if (filtros?.limit) params.append('limit', filtros.limit.toString());
  if (filtros?.next_token) params.append('next_token', filtros.next_token);
  const qs = params.toString();
  const url = `/proyectos/${proyectoId}/unidades${qs ? `?${qs}` : ''}`;
  return apiGet<{ items: Unidad[]; count: number; next_token?: string }>(url)
    .then(response => {
      // Si la respuesta es un array (backend antiguo), devolverlo directamente
      if (Array.isArray(response)) {
        return response;
      }
      // Si es el nuevo formato con paginación, devolver solo los items
      return response.items || [];
    });
};

export const getUnidad = (proyectoId: string, unidadId: string): Promise<Unidad> =>
  apiGet<Unidad>(`/proyectos/${proyectoId}/unidades/${unidadId}`);

export const crearUnidad = (
  proyectoId: string,
  data: { id_unidad: string; etapa_id: string; metraje: number; precio: number; tipo?: string; manzana?: string; piso?: string }
): Promise<Unidad> =>
  apiPost<Unidad>(`/admin/proyectos/${proyectoId}/unidades`, data);

export const actualizarUnidad = (
  proyectoId: string,
  unidadId: string,
  data: { id_unidad?: string; etapa_id?: string; metraje?: number; precio?: number; tipo?: string; manzana?: string; piso?: string }
): Promise<void> =>
  apiPut(`/admin/proyectos/${proyectoId}/unidades/${unidadId}`, data);

export const eliminarUnidad = (proyectoId: string, unidadId: string): Promise<void> =>
  apiDelete(`/admin/proyectos/${proyectoId}/unidades/${unidadId}`);

// Exportación de inventario
export const exportarInventario = (proyectoId: string): Promise<{ download_url: string; filename: string; total_unidades: number; proyecto_nombre: string }> =>
  apiGet(`/admin/inventario/exportar?proyecto_id=${proyectoId}`);
