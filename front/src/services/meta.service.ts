import { apiGet, apiPost, apiPut } from './api';
import type { Cliente, Proceso } from '../types';

export interface MetaLead {
  pk: string;
  sk: string;
  tipo: 'META_LEAD';
  channel: 'instagram' | 'messenger' | 'whatsapp' | string;
  account_alias: string;
  account_id: string;
  external_contact_id: string;
  fuente: string;
  origen: string;
  origen_detalle?: Record<string, unknown>;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  form_name?: string;
  referral_source?: string;
  referral_type?: string;
  referral_url?: string;
  ctwa_clid?: string;
  ads_origin?: Record<string, unknown>;
  estado: string;
  primer_mensaje_en?: string;
  ultimo_mensaje_en?: string;
  ultimo_mensaje_texto?: string;
  ultimo_evento_id?: string;
  creado_en?: string;
  actualizado_en?: string;
  mensajes_recibidos?: number | string;
  mensajes_enviados?: number | string;
  mensajes_totales?: number | string;
  responsable_id?: string;
  responsable_nombre?: string;
  inmobiliaria_id?: string;
  inmobiliaria_nombre?: string;
  asignado_en?: string;
  asignado_por_nombre?: string;
  cliente_cedula?: string;
  cliente_pk?: string;
  proyecto_id?: string;
  unidad_id?: string;
  convertido_en?: string;
  motivo_cierre?: string;
  cerrado_en?: string;
  cerrado_por_nombre?: string;
  reabierto_en?: string;
  reabierto_por_nombre?: string;
  historial_conversiones?: Array<{
    convertido_en?: string;
    usuario_nombre?: string;
    cedula?: string;
    cliente_pk?: string;
    proyecto_id?: string;
    inmobiliaria_id?: string;
    unidad_id?: string;
    unidad_nombre?: string;
    con_unidad?: boolean;
  }>;
}

export interface MetaMensaje {
  pk: string;
  sk: string;
  tipo: 'META_MENSAJE';
  channel: string;
  account_alias: string;
  external_contact_id: string;
  sender_id: string;
  recipient_id: string;
  direction: 'incoming' | 'outgoing' | 'unknown';
  event_type: string;
  external_event_id: string;
  event_timestamp: string;
  text?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  form_name?: string;
  referral_source?: string;
  referral_type?: string;
  referral_url?: string;
  ctwa_clid?: string;
  ads_origin?: Record<string, unknown>;
  payload_summary?: Record<string, unknown>;
  attachments?: Array<{
    type?: string;
    url?: string;
    title?: string;
    id?: string;
    mime_type?: string;
    filename?: string;
    caption?: string;
    public_url?: string;
    storage_status?: string;
  }>;
  media?: {
    type?: string;
    id?: string;
    mime_type?: string;
    sha256?: string;
    filename?: string;
    caption?: string;
    public_url?: string;
    storage_status?: string;
  } | null;
  message_status?: string;
  meta_error?: string;
  error_message?: string;
}

export interface MetaActividad {
  pk: string;
  sk: string;
  tipo: 'META_ACTIVIDAD';
  tipo_actividad: 'cambio_estado' | 'nota' | string;
  creado_en: string;
  usuario_nombre?: string;
  estado_anterior?: string;
  estado_nuevo?: string;
  nota?: string;
  responsable_anterior_nombre?: string;
  responsable_nuevo_nombre?: string;
  inmobiliaria_anterior_nombre?: string;
  inmobiliaria_nueva_nombre?: string;
  cedula?: string;
  cliente_pk?: string;
  proyecto_id?: string;
  inmobiliaria_id?: string;
  unidad_id?: string;
  motivo_cierre?: string;
  motivo_cierre_anterior?: string;
}

export interface MetaTimelineItem {
  id: string;
  tipo: string;
  categoria: 'mensaje' | 'actividad' | 'nota' | 'oportunidad' | string;
  fecha: string;
  titulo: string;
  detalle?: string;
  usuario_nombre?: string;
  direction?: 'incoming' | 'outgoing' | 'unknown' | string;
  message_status?: string;
  channel?: string;
  proyecto_id?: string;
  unidad_id?: string;
  unidad_nombre?: string;
  cedula?: string;
  inmobiliaria_id?: string;
}

export interface MetaLeadsResponse {
  items: MetaLead[];
  count: number;
}

export interface MetaConversacionResponse {
  lead: MetaLead | null;
  mensajes: MetaMensaje[];
  actividades?: MetaActividad[];
  timeline?: MetaTimelineItem[];
  count: number;
  has_more?: boolean;
  oldest_sk?: string;
  incremental?: boolean;
}

export const listarMetaLeads = (params?: {
  canal?: string;
  estado?: string;
  responsable_id?: string;
  inmobiliaria_id?: string;
}): Promise<MetaLeadsResponse> => {
  const query = new URLSearchParams({ tipo: 'meta-leads' });
  if (params?.canal) query.set('canal', params.canal);
  if (params?.estado) query.set('estado', params.estado);
  if (params?.responsable_id) query.set('responsable_id', params.responsable_id);
  if (params?.inmobiliaria_id) query.set('inmobiliaria_id', params.inmobiliaria_id);
  return apiGet<MetaLeadsResponse>(`/admin/procesos?${query.toString()}`);
};

export const getMetaConversacion = (
  leadPk: string,
  opts?: { limit?: number; before?: string; after?: string },
): Promise<MetaConversacionResponse> => {
  const query = new URLSearchParams({
    tipo: 'meta-conversacion',
    lead_pk: leadPk,
  });
  if (opts?.limit) query.set('limit', String(opts.limit));
  if (opts?.before) query.set('before', opts.before);
  if (opts?.after) query.set('after', opts.after);
  return apiGet<MetaConversacionResponse>(`/admin/procesos?${query.toString()}`);
};

export const gestionarMetaLead = (
  leadPk: string,
  data: {
    estado?: string;
    nota?: string;
    responsable_id?: string;
    responsable_nombre?: string;
    inmobiliaria_id?: string;
    inmobiliaria_nombre?: string;
    motivo_cierre?: string;
  },
): Promise<{ lead: MetaLead; actividades_creadas: number }> => {
  const query = new URLSearchParams({
    tipo: 'meta-lead',
    lead_pk: leadPk,
  });
  return apiPut<{ lead: MetaLead; actividades_creadas: number }>(
    `/admin/procesos?${query.toString()}`,
    data,
  );
};

export const enviarMetaMensaje = (
  leadPk: string,
  data: {
    texto: string;
    media_type?: string;
    media_url?: string;
    content_type?: string;
    filename?: string;
  },
): Promise<{
  message: string;
  sent: boolean;
  status: string;
  item?: MetaMensaje;
}> => {
  const query = new URLSearchParams({
    tipo: 'meta-mensaje',
    lead_pk: leadPk,
  });
  return apiPost(`/admin/procesos?${query.toString()}`, data);
};

export interface MetaMediaUpload {
  upload_url: string;
  public_url: string;
  key: string;
  media_type: string;
  content_type: string;
  filename: string;
}

// Pide una URL prefirmada para subir un archivo del inbox al bucket de assets.
export const getMetaMediaUploadUrl = (
  contentType: string,
  filename: string,
): Promise<MetaMediaUpload> => {
  const query = new URLSearchParams({
    tipo: 'meta-media-upload',
    content_type: contentType,
    filename,
  });
  return apiGet<MetaMediaUpload>(`/admin/procesos?${query.toString()}`);
};

// Sube el archivo directamente a S3 usando la URL prefirmada (PUT).
export const subirArchivoAS3 = async (uploadUrl: string, file: File): Promise<void> => {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('No se pudo subir el archivo.');
};

export const convertirMetaLead = (
  leadPk: string,
  data: {
    cedula: string;
    proyecto_id: string;
    inmobiliaria_id: string;
    nombres: string;
    apellidos: string;
    correo?: string;
    telefono?: string;
    unidad_id?: string;
    estado_civil?: string;
    nacionalidad?: string;
    pais_residencia?: string;
    fecha_nacimiento?: string;
  },
): Promise<{
  message: string;
  lead: MetaLead;
  cliente: Cliente;
  proceso?: Proceso | null;
}> => {
  const query = new URLSearchParams({
    tipo: 'meta-lead',
    accion: 'convertir',
    lead_pk: leadPk,
  });
  return apiPut(`/admin/procesos?${query.toString()}`, data);
};
