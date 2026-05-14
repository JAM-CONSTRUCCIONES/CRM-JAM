// Config service — routes config calls through existing /admin/inmobiliarias endpoint
// using a special marker in the request body to avoid adding new API Gateway routes
import { apiGet, apiPost } from './api';

export interface EmailTemplate {
  tipo: string;
  label: string;
  titulo: string;
  mensaje: string;
  variables?: string[];
  modificado_en?: string;
}

// GET uses query params (works fine with apiGet)
const BASE = '/admin/inmobiliarias?_config=email-templates';

export const getEmailTemplates = (): Promise<EmailTemplate[]> =>
  apiGet<EmailTemplate[]>(BASE);

export const getEmailTemplate = (tipo: string): Promise<EmailTemplate> =>
  apiGet<EmailTemplate>(`${BASE}&tipo=${encodeURIComponent(tipo)}`);

// PUT uses body marker — no query params to avoid Amplify auth header issue
// Uses POST on existing /admin/inmobiliarias route (PUT base path not registered)
export const saveEmailTemplate = (tipo: string, data: { titulo: string; mensaje: string }): Promise<void> =>
  apiPost(`/admin/inmobiliarias`, { _config: 'email-templates', tipo, ...data });

export const resetEmailTemplate = (tipo: string): Promise<void> =>
  apiPost(`/admin/inmobiliarias`, { _config: 'email-templates', tipo, action: 'reset' });
