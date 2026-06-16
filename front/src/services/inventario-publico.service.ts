import { apiGet } from './api';
import type { Etapa, Proyecto, Unidad } from '../types';

const cleanFilter = (value?: string) => value?.trim();

export const getProyectoPublico = (proyectoId: string): Promise<Proyecto> =>
  apiGet<Proyecto>(`/publico/proyectos?inventario_publico=detalle&proyecto_id=${proyectoId}`);

export const getEtapasPublicas = (proyectoId: string): Promise<Etapa[]> =>
  apiGet<Etapa[]>(`/publico/proyectos?inventario_publico=etapas&proyecto_id=${proyectoId}`);

export const getUnidadesPublicas = (
  proyectoId: string,
  filtros?: { etapa_id?: string; id_unidad?: string; tipo?: string; manzana?: string; piso?: string }
): Promise<Unidad[]> => {
  const params = new URLSearchParams();
  if (cleanFilter(filtros?.etapa_id)) params.append('etapa_id', cleanFilter(filtros?.etapa_id)!);
  if (cleanFilter(filtros?.id_unidad)) params.append('id_unidad', cleanFilter(filtros?.id_unidad)!);
  if (cleanFilter(filtros?.tipo)) params.append('tipo', cleanFilter(filtros?.tipo)!);
  if (cleanFilter(filtros?.manzana)) params.append('manzana', cleanFilter(filtros?.manzana)!);
  if (cleanFilter(filtros?.piso)) params.append('piso', cleanFilter(filtros?.piso)!);
  const qs = params.toString();
  const base = `/publico/proyectos?inventario_publico=unidades&proyecto_id=${proyectoId}`;
  return apiGet<{ items: Unidad[]; count: number }>(`${base}${qs ? `&${qs}` : ''}`)
    .then(response => response.items || []);
};
