export type Rol = 'admin' | 'coordinador' | 'supervisor' | 'inmobiliaria';
export type RolInterno = 'admin' | 'coordinador' | 'supervisor';

export interface Usuario {
  sub: string;
  username?: string;
  nombre: string;
  rol: Rol;
  inmobiliaria_id?: string;
  inmobiliaria_nombre?: string;
  proyectos?: string[];
  activo: boolean;
  mfa_required?: boolean;
  foto_url?: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface Proyecto {
  pk: string;
  proyecto_id: string;
  nombre: string;
  descripcion?: string;
  imagen_url?: string;
  activo: boolean;
  creado_en: string;
}

export interface Etapa {
  pk: string;
  sk: string;
  etapa_id: string;
  nombre: string;
  activo: boolean;
  creado_en: string;
}

export interface Unidad {
  pk: string;
  sk: string;
  unidad_id: string;
  id_unidad: string;
  etapa_id: string;
  metraje: number;
  metraje_terraza?: number;
  metraje_patio?: number;
  precio: number;
  precio_reserva?: number;
  precio_separacion?: number;
  precio_inicial?: number;
  cuota_monto?: number;
  cuota_meses?: number;
  contra_entrega?: number;
  tipo?: string;
  manzana?: string;
  piso?: string;
  parqueos?: number;
  num_cuartos?: number;
  num_banos?: number;
  comentario?: string;
  estado: string;
  bloqueado_por?: string;
  cliente_cedula?: string;
  fecha_bloqueo?: string;
  fecha_liberacion?: string;
  tiempo_restante?: number;
  creado_en: string;
  actualizado_en: string;
}

export interface HistorialBloqueo {
  pk: string;
  sk: string;
  unidad_id: string;
  unidad_nombre?: string;
  torre_id?: string;
  torre_nombre?: string;
  proyecto_id: string;
  inmobiliaria_id: string;
  inmobiliaria_nombre?: string;
  fecha_bloqueo: string;
  fecha_liberacion: string;
  motivo_liberacion?: string;
  liberado_por?: string;
}

export interface Bloqueo {
  pk: string;
  sk: string;
  unidad_id: string;
  id_unidad?: string;
  torre_nombre?: string;
  proyecto_id: string;
  bloqueado_por: string;
  fecha_bloqueo: string;
  fecha_liberacion: string;
  tiempo_restante?: number;
  estado: string;
  cliente_cedula?: string;
  cliente_nombre?: string;
}

export type EstadoCliente = 'captacion' | 'reserva' | 'separacion' | 'inicial' | 'pagos_atrasados' | 'contra_entrega' | 'vendida' | 'desvinculado';

export interface HistorialProcesoEntry {
  tipo?: 'cambio_estatus' | 'traspaso_cliente';
  estatus_anterior?: string;
  estatus_nuevo?: string;
  ejecutado_por: string;
  ejecutado_por_nombre: string;
  notificacion_enviada: boolean;
  timestamp: string;
  cedula_anterior?: string;
  cliente_anterior_nombre?: string;
  cedula_nueva?: string;
  cliente_nuevo_nombre?: string;
  justificacion?: string;
  estado_proceso?: string;
}

export interface Proceso {
  pk: string;
  sk: string;
  cedula: string;
  inmobiliaria_id: string;
  proyecto_id: string;
  unidad_id: string;
  unidad_nombre: string;
  estado: EstadoCliente;
  historial: HistorialProcesoEntry[];
  fecha_inicio: string;
  actualizado_en: string;
  fecha_separacion?: string;
  pago_confirmado?: boolean;
  alerta_separacion_vencida?: boolean;
}

export interface Cliente {
  pk: string;
  sk: string;
  cedula: string;
  inmobiliaria_id: string;
  proyecto_id: string;
  nombres: string;
  apellidos: string;
  correo?: string;
  telefono?: string;
  estado_civil?: string;
  nacionalidad?: string;
  pais_residencia?: string;
  fecha_nacimiento?: string;
  edad?: number;
  exclusividad_activa: boolean;
  fecha_captacion: string;
  fecha_vencimiento: string;
}

export interface ClienteProyecto extends Cliente {
  estatus: EstadoCliente | 'sin_unidad' | string;
  estatus_label?: string;
  unidad_id?: string;
  unidad_nombre?: string;
  proceso_pk?: string;
  proceso_sk?: string;
}
