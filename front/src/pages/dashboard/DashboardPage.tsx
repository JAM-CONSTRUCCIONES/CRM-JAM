import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Home,
  Loader2,
  PieChart as PieChartIcon,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import useAuth from '../../hooks/useAuth';
import { getAnalytics } from '../../services/analytics.service';
import type { AnalyticsData } from '../../services/analytics.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import { getProyectos } from '../../services/proyectos.service';
import type { Proyecto } from '../../types';

interface SummaryRow {
  label: string;
  value: number;
  bold?: boolean;
}

interface ChartPoint {
  name?: string;
  value?: number;
  color?: string;
  [key: string]: string | number | undefined;
}

const CHART_COLORS = {
  blue: '#1677ff',
  sky: '#38bdf8',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
  slate: '#64748b',
  teal: '#14b8a6',
  pink: '#ec4899',
  indigo: '#6366f1',
};

const PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.amber,
  CHART_COLORS.green,
  CHART_COLORS.violet,
  CHART_COLORS.red,
  CHART_COLORS.sky,
  CHART_COLORS.teal,
  CHART_COLORS.pink,
  CHART_COLORS.indigo,
  CHART_COLORS.slate,
];

const MES_LABEL: Record<string, string> = {
  '01': 'Ene',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dic',
};

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value ?? 0);

const shortLabel = (value: string, max = 24) => (value.length > max ? `${value.slice(0, max)}...` : value);

const DashboardPage = () => {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'admin';
  const isInterno = ['admin', 'coordinador', 'supervisor'].includes(usuario?.rol ?? '');

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async (pid: string) => {
    setLoading(true);
    setData(null);
    try {
      setData(await getAnalytics(pid));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [projs, inmos] = await Promise.all([
          getProyectos(),
          isAdmin ? getInmobiliarias() : Promise.resolve([] as Inmobiliaria[]),
        ]);
        const filtrados = usuario?.rol === 'inmobiliaria' && usuario.proyectos?.length
          ? projs.filter(p => usuario.proyectos!.includes(p.proyecto_id))
          : projs;
        setProyectos(filtrados);
        setInmobiliarias(inmos);
        if (filtrados.length > 0) {
          setProyectoId(filtrados[0].proyecto_id);
          await cargar(filtrados[0].proyecto_id);
          return;
        }
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    init();
  }, [usuario, isAdmin, cargar]);

  const proyectoActual = proyectos.find(p => p.proyecto_id === proyectoId);
  const inmoNombre = (id: string) =>
    inmobiliarias.find(i => i.pk === id || i.pk === `INMOBILIARIA#${id}`)?.nombre ?? id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-2xl font-semibold tracking-normal text-foreground">Dashboard</h1>
            <Badge variant="secondary" className="border border-border">
              {isInterno ? 'Vista interna' : 'Vista comercial'}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {proyectoActual?.nombre ?? 'Selecciona un proyecto para visualizar la operacion comercial.'}
          </p>
        </div>

        <div className="w-full md:w-[300px]">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Proyecto</label>
          <select
            value={proyectoId}
            onChange={event => {
              setProyectoId(event.target.value);
              cargar(event.target.value);
            }}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            {proyectos.map(p => (
              <option key={p.proyecto_id} value={p.proyecto_id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : !data || proyectos.length === 0 ? (
        <EmptyState />
      ) : (
        <DashboardContent
          data={data}
          isAdmin={isAdmin}
          isInterno={isInterno}
          inmoNombre={inmoNombre}
        />
      )}
    </div>
  );
};

const LoadingState = () => (
  <Card className="border-dashed">
    <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-8 animate-spin text-primary" />
      <div className="text-sm font-medium">Cargando analitica del proyecto...</div>
    </CardContent>
  </Card>
);

const EmptyState = () => (
  <Card className="border-dashed">
    <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-full border border-border bg-muted p-4">
        <BarChart3 className="size-8 text-muted-foreground" />
      </div>
      <div>
        <div className="font-semibold text-foreground">No hay datos disponibles</div>
        <p className="mt-1 text-sm text-muted-foreground">Cuando el proyecto tenga actividad, aparecera aqui.</p>
      </div>
    </CardContent>
  </Card>
);

const DashboardContent = ({
  data,
  isAdmin,
  isInterno,
  inmoNombre,
}: {
  data: AnalyticsData;
  isAdmin: boolean;
  isInterno: boolean;
  inmoNombre: (id: string) => string;
}) => {
  const {
    unidad_stats,
    proceso_stats,
    cierres_mensuales,
    conversion_por_inmobiliaria,
    ventas_por_piso,
    ventas_por_metraje,
    demograficos,
  } = data;

  const estatusData = (isInterno
    ? [
        { name: 'Bloqueada', value: unidad_stats.bloqueada, color: CHART_COLORS.blue },
        { name: 'Disponible', value: unidad_stats.disponible, color: CHART_COLORS.amber },
        { name: 'No disponible', value: unidad_stats.no_disponible, color: CHART_COLORS.green },
        { name: 'Vendida', value: unidad_stats.vendida, color: CHART_COLORS.violet },
        { name: 'Desvinculada', value: unidad_stats.desvinculada, color: CHART_COLORS.red },
      ]
    : [
        { name: 'Bloqueadas', value: unidad_stats.bloqueada, color: CHART_COLORS.blue },
        { name: 'No disponibles', value: unidad_stats.no_disponible, color: CHART_COLORS.green },
        { name: 'Desvinculadas', value: unidad_stats.desvinculada, color: CHART_COLORS.red },
      ]).filter(d => d.value > 0);

  const estatusBaseRows: SummaryRow[] = isInterno
    ? [
        { label: 'Bloqueada', value: unidad_stats.bloqueada },
        { label: 'Disponible', value: unidad_stats.disponible },
        { label: 'No disponible', value: unidad_stats.no_disponible },
        { label: 'Vendida', value: unidad_stats.vendida },
        { label: 'Desvinculada', value: unidad_stats.desvinculada },
      ]
    : [
        { label: 'Bloqueadas', value: unidad_stats.bloqueada },
        { label: 'No disponibles', value: unidad_stats.no_disponible },
        { label: 'Desvinculadas', value: unidad_stats.desvinculada },
      ];
  const estatusRows: SummaryRow[] = [
    ...estatusBaseRows,
    { label: 'Total general', value: unidad_stats.total, bold: true },
  ];

  const ventasMetraje = Object.entries(ventas_por_metraje ?? {})
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([metraje, total]) => ({ metraje, Total: total }));

  const ventasMes = cierres_mensuales.map(c => {
    const [, m] = c.mes.split('-');
    return {
      mes: MES_LABEL[m] ?? m,
      Total: c.reservas + c.separaciones,
    };
  });

  const ventasPiso = Object.entries(ventas_por_piso ?? {})
    .sort((a, b) => {
      const na = parseFloat(a[0]);
      const nb = parseFloat(b[0]);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a[0].localeCompare(b[0]);
    })
    .map(([piso, total]) => ({ piso, Total: total }));

  const ventasInmo = [...conversion_por_inmobiliaria]
    .sort((a, b) => b.separaciones - a.separaciones)
    .map(i => ({
      nombre: inmoNombre(i.inmobiliaria_id),
      Total: i.separaciones,
      Captados: i.captados,
      Conversion: i.pct_conversion,
    }));

  const contratoData = [
    { name: 'Cliente listo', value: proceso_stats.separacion, color: CHART_COLORS.blue },
    { name: 'Contrato firmado', value: proceso_stats.inicial, color: CHART_COLORS.amber },
  ].filter(d => d.value > 0);

  const contratoRows: SummaryRow[] = [
    { label: 'Cliente listo para contrato', value: proceso_stats.separacion },
    { label: 'Contrato firmado', value: proceso_stats.inicial },
    { label: 'Total', value: proceso_stats.separacion + proceso_stats.inicial, bold: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Estatus de unidades"
          description="Distribucion actual del inventario comercial."
          icon={<PieChartIcon className="size-4" />}
          footer={<SummaryTable col1="Estatus" col2="Cantidad" rows={estatusRows} />}
        >
          <PiePanel data={estatusData} />
        </ChartCard>

        {isInterno && (
          <ChartCard
            title="Ventas por mes"
            description="Reservas y separaciones consolidadas por mes."
            icon={<BarChart3 className="size-4" />}
            footer={<SummaryTable col1="Mes" col2="Ventas" rows={toRows(ventasMes, 'mes')} />}
          >
            <VerticalBarPanel data={ventasMes} xKey="mes" color={CHART_COLORS.blue} />
          </ChartCard>
        )}

        {isInterno && ventasPiso.length > 0 && (
          <ChartCard
            title="Ventas por piso"
            description="Pisos con mayor movimiento comercial."
            icon={<Building2 className="size-4" />}
            footer={<SummaryTable col1="Piso" col2="Total vendido" rows={toRows(ventasPiso, 'piso')} />}
          >
            <HorizontalBarPanel data={ventasPiso} yKey="piso" color={CHART_COLORS.sky} />
          </ChartCard>
        )}

        {isInterno && ventasMetraje.length > 0 && (
          <ChartCard
            title="Ventas por metraje"
            description="Preferencias de unidades vendidas por tamano."
            icon={<Home className="size-4" />}
            footer={<SummaryTable col1="Metraje" col2="Total vendido" rows={toRows(ventasMetraje, 'metraje')} />}
          >
            <VerticalBarPanel data={ventasMetraje} xKey="metraje" color={CHART_COLORS.green} />
          </ChartCard>
        )}

        {isAdmin && ventasInmo.length > 0 && (
          <ChartCard
            title="Ventas por inmobiliaria"
            description="Ranking de separaciones por aliado comercial."
            icon={<CircleDollarSign className="size-4" />}
            footer={<SummaryTable col1="Inmobiliaria" col2="Total vendido" rows={toRows(ventasInmo, 'nombre')} />}
          >
            <HorizontalBarPanel data={ventasInmo} yKey="nombre" color={CHART_COLORS.violet} />
          </ChartCard>
        )}

        {isInterno && (
          <ChartCard
            title="Contratos promesa de venta"
            description="Estado del tramo final antes del cierre."
            icon={<CheckCircle2 className="size-4" />}
            footer={<SummaryTable col1="Estatus contrato" col2="Cantidad" rows={contratoRows} />}
          >
            <PiePanel data={contratoData} />
          </ChartCard>
        )}
      </div>

      {isInterno && demograficos && <DemograficosSection demograficos={demograficos} />}
    </div>
  );
};

const ChartCard = ({
  title,
  description,
  icon,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => (
  <Card className="overflow-hidden">
    <CardHeader className="pb-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-border bg-muted p-2 text-primary">{icon}</div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {children}
      {footer}
    </CardContent>
  </Card>
);

const SummaryTable = ({ col1, col2, rows }: { col1: string; col2: string; rows: SummaryRow[] }) => (
  <div className="overflow-hidden rounded-md border border-border">
    <table className="w-full border-collapse text-sm">
      <thead className="bg-muted text-muted-foreground">
        <tr>
          <th className="px-3 py-2 text-left font-semibold">{col1}</th>
          <th className="px-3 py-2 text-right font-semibold">{col2}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.label}-${index}`} className={cn(index % 2 === 1 && 'bg-muted/40', row.bold && 'bg-primary/10')}>
            <td className={cn('px-3 py-2 text-foreground', row.bold && 'font-semibold')}>{row.label}</td>
            <td className={cn('px-3 py-2 text-right text-foreground', row.bold && 'font-semibold')}>{formatNumber(row.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const toRows = <T extends Record<string, string | number>>(items: T[], key: keyof T): SummaryRow[] => {
  const rows: SummaryRow[] = items.map(item => ({ label: String(item[key]), value: Number(item.Total ?? 0) }));
  return [
    ...rows,
    { label: 'Total', value: rows.reduce((sum, row) => sum + row.value, 0), bold: true },
  ];
};

const EmptyChart = () => (
  <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
    Sin datos para graficar
  </div>
);

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
};

const PiePanel = ({ data }: { data: ChartPoint[] }) => {
  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={entry.color ?? PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
        />
        <RTooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
};

const VerticalBarPanel = ({
  data,
  xKey,
  color,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  color: string;
}) => {
  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 42)}>
      <BarChart data={data} margin={{ left: 0, right: 12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
        <RTooltip contentStyle={tooltipStyle} />
        <Legend formatter={() => <span className="text-xs text-foreground">Total</span>} />
        <Bar dataKey="Total" fill={color} radius={[5, 5, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const HorizontalBarPanel = ({
  data,
  yKey,
  color,
}: {
  data: Record<string, string | number>[];
  yKey: string;
  color: string;
}) => {
  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 18 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey={yKey}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          width={130}
          tickFormatter={(value: string) => shortLabel(value, 18)}
        />
        <RTooltip contentStyle={tooltipStyle} />
        <Legend formatter={() => <span className="text-xs text-foreground">Total</span>} />
        <Bar dataKey="Total" fill={color} radius={[0, 5, 5, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const DemograficosSection = ({ demograficos }: { demograficos: NonNullable<AnalyticsData['demograficos']> }) => {
  const { rangos_edad, pais_residencia, nacionalidad } = demograficos;

  const edadData = useMemo(() => {
    const orden = ['<25', '25-34', '35-44', '45-54', '55+', 'Sin edad'];
    const base = orden
      .filter(k => (rangos_edad?.[k] ?? 0) > 0)
      .map(k => ({ rango: k, Total: rangos_edad[k] }));
    Object.entries(rangos_edad ?? {}).forEach(([k, v]) => {
      if (!orden.includes(k) && v > 0) base.push({ rango: k, Total: v });
    });
    return base;
  }, [rangos_edad]);

  const residencia = topPieData(pais_residencia);
  const nacionalidades = topPieData(nacionalidad);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="m-0 text-lg font-semibold text-foreground">Perfil de clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Senales demograficas para mejorar campanas y seguimiento.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {edadData.length > 0 && (
          <ChartCard
            title="Rango de edad"
            description="Distribucion de clientes registrados."
            icon={<Users className="size-4" />}
            footer={<SummaryTable col1="Rango" col2="Clientes" rows={toRows(edadData, 'rango')} />}
          >
            <VerticalBarPanel data={edadData} xKey="rango" color={CHART_COLORS.amber} />
          </ChartCard>
        )}

        {residencia.data.length > 0 && (
          <ChartCard
            title="Pais de residencia"
            description="Top de ubicaciones declaradas."
            icon={<PieChartIcon className="size-4" />}
            footer={<SummaryTable col1="Pais" col2="Clientes" rows={residencia.rows} />}
          >
            <PiePanel data={residencia.data} />
          </ChartCard>
        )}

        {nacionalidades.data.length > 0 && (
          <ChartCard
            title="Nacionalidad"
            description="Composicion por nacionalidad."
            icon={<PieChartIcon className="size-4" />}
            footer={<SummaryTable col1="Nacionalidad" col2="Clientes" rows={nacionalidades.rows} />}
          >
            <PiePanel data={nacionalidades.data} />
          </ChartCard>
        )}
      </div>
    </div>
  );
};

const topPieData = (source: Record<string, number> = {}) => {
  const entries = Object.entries(source)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 8);
  const otros = entries.slice(8).reduce((sum, [, value]) => sum + value, 0);
  const data = [
    ...top.map(([name, value], index) => ({ name, value, color: PALETTE[index % PALETTE.length] })),
    ...(otros > 0 ? [{ name: 'Otros', value: otros, color: CHART_COLORS.slate }] : []),
  ];
  const rows: SummaryRow[] = [
    ...entries.map(([label, value]) => ({ label, value })),
    { label: 'Total', value: entries.reduce((sum, [, value]) => sum + value, 0), bold: true },
  ];

  return { data, rows };
};

export default DashboardPage;
