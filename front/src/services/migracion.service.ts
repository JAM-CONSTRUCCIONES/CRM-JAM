import { apiGet, apiPost } from './api';

export interface FilaMigracion {
  fila_excel: number;
  id_unidad: string;
  metraje: number | null;
  precio: number | null;
  num_cuartos: number | null;
  num_banos: number | null;
  tipo: string | null;
  manzana: string | null;
  piso: number | null;
  parqueos: number | null;
  metraje_terraza: number | null;
  metraje_patio: number | null;
  precio_reserva: number | null;
  precio_separacion: number | null;
  precio_inicial: number | null;
  cuota_monto: number | null;
  contra_entrega: number | null;
  comentario: string | null;
  estado: string;
  estado_proceso: string | null;
  cliente_nombre_excel: string | null;
  nombres_sugerido: string | null;
  apellidos_sugerido: string | null;
  cedula: string | null;
  inmobiliaria_excel: string | null;
  inmobiliaria_id_sugerido: string | null;
  inmobiliaria_nombre_sugerido: string | null;
  inmobiliaria_confianza: number;
  inmobiliaria_es_nueva: boolean;
  fecha_bloqueo: string | null;
  fecha_liberacion: string | null;
  errores: string[];
  advertencias: string[];
  ia_sugerido: boolean;
}

export interface PreviewMigracion {
  job_id: string;
  proyecto_id: string;
  archivo: string;
  total_filas: number;
  filas: FilaMigracion[];
  creado_en: string;
}

export interface ReporteMigracion {
  job_id: string;
  archivo: string;
  proyecto_id: string;
  total_filas: number;
  unidades_cargadas: number;
  clientes_creados: number;
  inmobiliarias_creadas: number;
  advertencias: number;
  detalle: { fila: number; id_unidad: string; tipo: string; motivo: string }[];
  completado_en: string;
}

export const getUploadUrl = (proyectoId: string): Promise<{ upload_url: string; job_id: string; key: string }> =>
  apiGet(`/admin/inventario/upload-url?proyecto_id=${proyectoId}`);

export const uploadExcel = async (uploadUrl: string, file: File): Promise<void> => {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
  if (!res.ok) throw new Error('Error al subir el archivo');
};

export const getPreview = (jobId: string): Promise<PreviewMigracion> =>
  apiGet(`/admin/inventario/preview/${jobId}`);

export const confirmarMigracion = (jobId: string, filas: FilaMigracion[]): Promise<ReporteMigracion> =>
  apiPost(`/admin/inventario/confirmar/${jobId}`, { filas });

export const getReporte = (jobId: string): Promise<ReporteMigracion> =>
  apiGet(`/admin/inventario/reportes/${jobId}`);

export const listarReportes = (proyectoId?: string): Promise<ReporteMigracion[]> =>
  apiGet(`/admin/inventario/reportes${proyectoId ? `?proyecto_id=${proyectoId}` : ''}`);
