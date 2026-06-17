import { apiGet, apiPost, apiPut } from './api';

export type GrupoCampania = 'sin_unidad' | 'con_unidad';

export interface CampaniaFiltros {
  pais_residencia?: string;
  nacionalidad?: string;
}

export interface DestinatarioCampania {
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  unidad?: string;
  estatus?: string;
  pais_residencia?: string;
  nacionalidad?: string;
}

export interface PreviewCampania {
  total_clientes: number;
  correos_validos: number;
  sin_correo: number;
  correos_invalidos: number;
  destinatarios: DestinatarioCampania[];
  omitidos_sin_correo: DestinatarioCampania[];
  omitidos_invalidos: DestinatarioCampania[];
}

export interface TemplateCampania {
  template_id: string;
  proyecto_id: string;
  nombre: string;
  descripcion?: string;
  asunto: string;
  mensaje: string;
  actualizado_en?: string;
  actualizado_por?: string;
}

export interface CampaniaHistorial {
  campania_id: string;
  proyecto_id: string;
  proyecto_nombre: string;
  nombre: string;
  descripcion?: string;
  grupo: GrupoCampania;
  fecha_envio: string;
  enviado_por: string;
  cantidad_destinatarios: number;
  correos_validos: number;
  correos_enviados: number;
  clientes_sin_correo: number;
  correos_invalidos: number;
  errores_envio?: { correo: string; error: string }[];
}

export interface EnviarCampaniaPayload {
  proyecto_id: string;
  nombre: string;
  descripcion?: string;
  grupo: GrupoCampania;
  asunto: string;
  mensaje: string;
  filtros?: CampaniaFiltros;
}

export const previewCampania = (data: {
  proyecto_id: string;
  grupo: GrupoCampania;
  filtros?: CampaniaFiltros;
}): Promise<PreviewCampania> =>
  apiPost('/admin/campanias/preview', data);

export const enviarCampania = (data: EnviarCampaniaPayload): Promise<CampaniaHistorial> =>
  apiPost('/admin/campanias/enviar', data);

export const getHistorialCampanias = (proyectoId: string): Promise<CampaniaHistorial[]> =>
  apiGet(`/admin/campanias/historial?proyecto_id=${proyectoId}`);

export const getTemplatesCampanias = (): Promise<TemplateCampania[]> =>
  apiGet('/admin/campanias/templates');

export const guardarTemplateCampania = (
  templateId: string,
  data: Omit<TemplateCampania, 'template_id'>
): Promise<TemplateCampania> =>
  apiPut(`/admin/campanias/templates/${templateId}`, data);

export const getUploadImagenCampania = (
  contentType: string
): Promise<{ upload_url: string; public_url: string; key: string }> =>
  apiGet(`/admin/campanias/templates?upload=image&content_type=${encodeURIComponent(contentType)}`);
