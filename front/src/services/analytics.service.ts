import { apiGet } from './api';

export interface UnidadStats {
  disponible: number; bloqueada: number; no_disponible: number;
  vendida: number; desvinculada: number; total: number;
}

export interface ClienteStats {
  total: number; exclusividad_activa: number; exclusividad_vencida: number;
}

export interface ProcesoStats {
  captacion: number; reserva: number; separacion: number;
  inicial: number; pagos_atrasados: number; contra_entrega: number;
  vendida: number; desvinculado: number; total: number;
}

export interface Kpis {
  pct_conversion: number;
  tasa_abandono: number;
  pct_bloqueos_a_venta: number;
}

export interface Velocidad {
  captacion_a_reserva_horas: number | null;
  reserva_a_separacion_horas: number | null;
}

export interface CierreMensual {
  mes: string; reservas: number; separaciones: number;
}

export interface TopUnidad {
  unidad_id: string; nombre: string; procesos: number; vendida: boolean;
}

export interface ConversionInmo {
  inmobiliaria_id: string; captados: number; reservas: number;
  separaciones: number; desvinculados: number; pct_conversion: number;
}

export interface Demograficos {
  rangos_edad: Record<string, number>;
  estado_civil: Record<string, number>;
  pais_residencia: Record<string, number>;
  nacionalidad: Record<string, number>;
}

export interface AnalyticsData {
  unidad_stats: UnidadStats;
  cliente_stats: ClienteStats;
  proceso_stats: ProcesoStats;
  kpis: Kpis;
  velocidad: Velocidad;
  cierres_mensuales: CierreMensual[];
  top_unidades: TopUnidad[];
  conversion_por_inmobiliaria: ConversionInmo[];
  demograficos: Demograficos;
  ventas_por_piso: Record<string, number>;
  ventas_por_metraje: Record<string, number>;
}

export const getAnalytics = (proyectoId: string): Promise<AnalyticsData> =>
  apiGet<AnalyticsData>(`/admin/analytics?proyecto_id=${encodeURIComponent(proyectoId)}`);
