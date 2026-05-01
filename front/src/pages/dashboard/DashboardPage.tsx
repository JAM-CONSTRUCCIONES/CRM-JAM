import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Select, Spin, Typography, Empty, Grid } from 'antd';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import { getAnalytics } from '../../services/analytics.service';
import type { AnalyticsData } from '../../services/analytics.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Proyecto } from '../../types';
import useAuth from '../../hooks/useAuth';

const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

// ── Paleta estilo Excel ───────────────────────────────────────────────────────
const BLUE   = '#2E75B6';
const ORANGE = '#ED7D31';
const GREEN  = '#375623';
const GRAY   = '#7F7F7F';

// ── Tabla resumen estilo Excel ────────────────────────────────────────────────
interface SummaryRow { label: string; value: number; bold?: boolean }

const SummaryTable = ({
  col1, col2, rows,
}: {
  col1: string; col2: string; rows: SummaryRow[];
}) => (
  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
    <thead>
      <tr style={{ background: '#BDD7EE' }}>
        <th style={th}>{col1}</th>
        <th style={{ ...th, textAlign: 'right' }}>{col2}</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i} style={{ background: r.bold ? '#BDD7EE' : i % 2 === 0 ? '#fff' : '#f5f5f5' }}>
          <td style={{ ...td, fontWeight: r.bold ? 700 : 400 }}>{r.label}</td>
          <td style={{ ...td, textAlign: 'right', fontWeight: r.bold ? 700 : 400 }}>{r.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const th: React.CSSProperties = {
  padding: '5px 10px', textAlign: 'left', fontWeight: 600,
  border: '1px solid #9DC3E6', fontSize: 13,
};
const td: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid #ddd',
};

// ── Página principal ──────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'admin';
  const isInterno = ['admin', 'coordinador', 'supervisor'].includes(usuario?.rol ?? '');
  const { md } = useBreakpoint();
  const isMobile = !md;

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async (pid: string) => {
    setLoading(true);
    setData(null);
    try {
      const res = await getAnalytics(pid);
      setData(res);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
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
        } else {
          setLoading(false);
        }
      } catch { setLoading(false); }
    };
    init();
  }, [usuario, isAdmin, cargar]);

  const handleProyecto = (pid: string) => {
    setProyectoId(pid);
    cargar(pid);
  };

  const inmoNombre = (id: string) =>
    inmobiliarias.find(i => i.pk === id || i.pk === `INMOBILIARIA#${id}`)?.nombre ?? id;

  const proyectoActual = proyectos.find(p => p.proyecto_id === proyectoId);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
          {proyectoActual && <Text type="secondary">{proyectoActual.nombre}</Text>}
        </div>
        <Select
          value={proyectoId || undefined}
          onChange={handleProyecto}
          style={{ minWidth: 220, width: isMobile ? '100%' : undefined }}
          options={proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
          placeholder="Seleccionar proyecto"
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : !data || proyectos.length === 0 ? (
        <Empty description="No hay datos disponibles" />
      ) : (
        <DashboardContent
          data={data}
          isAdmin={isAdmin}
          isInterno={isInterno}
          inmoNombre={inmoNombre}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

// ── Contenido ─────────────────────────────────────────────────────────────────
const DashboardContent = ({
  data, isAdmin, isInterno, inmoNombre, isMobile,
}: {
  data: AnalyticsData;
  isAdmin: boolean;
  isInterno: boolean;
  inmoNombre: (id: string) => string;
  isMobile: boolean;
}) => {
  const { unidad_stats, proceso_stats, cierres_mensuales, conversion_por_inmobiliaria,
          ventas_por_piso, ventas_por_metraje } = data;

  // ── 1. Estatus de unidades (torta) ────────────────────────────────────────
  const estatusData = [
    { name: 'BLOQUEADO',       value: unidad_stats.bloqueada,      color: BLUE   },
    { name: 'DISPONIBLE',      value: unidad_stats.disponible,     color: ORANGE },
    { name: 'NO DISPONIBLE',   value: unidad_stats.no_disponible,  color: GREEN  },
  ].filter(d => d.value > 0);

  const estatusRows: SummaryRow[] = [
    { label: 'BLOQUEADO',     value: unidad_stats.bloqueada     },
    { label: 'DISPONIBLE',    value: unidad_stats.disponible    },
    { label: 'NO DISPONIBLE', value: unidad_stats.no_disponible },
    { label: 'Total general', value: unidad_stats.bloqueada + unidad_stats.disponible + unidad_stats.no_disponible, bold: true },
  ];

  // ── 2. Ventas por metraje (barras verticales) ─────────────────────────────
  const ventasMetraje = Object.entries(ventas_por_metraje ?? {})
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([m, total]) => ({ metraje: m, Total: total }));
  const totalVentasMetraje = ventasMetraje.reduce((s, r) => s + r.Total, 0);
  const ventasMetrajeRows: SummaryRow[] = [
    ...ventasMetraje.map(r => ({ label: r.metraje, value: r.Total })),
    { label: 'Total', value: totalVentasMetraje, bold: true },
  ];

  // ── 3. Ventas por mes (barras horizontales) ───────────────────────────────
  const MES_LABEL: Record<string, string> = {
    '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr',
    '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago',
    '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic',
  };
  const ventasMes = cierres_mensuales.map(c => {
    const [, m] = c.mes.split('-');
    return {
      mes: MES_LABEL[m] ?? m,
      Total: c.reservas + c.separaciones,
    };
  });
  const totalVentasMes = ventasMes.reduce((s, r) => s + r.Total, 0);
  const ventasMesRows: SummaryRow[] = [
    ...ventasMes.map(r => ({ label: r.mes, value: r.Total })),
    { label: 'Total', value: totalVentasMes, bold: true },
  ];

  // ── 4. Ventas por piso (barras horizontales) ──────────────────────────────
  const ventasPiso = Object.entries(ventas_por_piso ?? {})
    .sort((a, b) => {
      const na = parseFloat(a[0]), nb = parseFloat(b[0]);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a[0].localeCompare(b[0]);
    })
    .map(([piso, total]) => ({ piso, Total: total }));
  const totalVentasPiso = ventasPiso.reduce((s, r) => s + r.Total, 0);
  const ventasPisoRows: SummaryRow[] = [
    ...ventasPiso.map(r => ({ label: r.piso, value: r.Total })),
    { label: 'Total', value: totalVentasPiso, bold: true },
  ];

  // ── 5. Ventas por inmobiliaria (barras horizontales) ──────────────────────
  const ventasInmo = [...conversion_por_inmobiliaria]
    .sort((a, b) => (a.reservas + a.separaciones) - (b.reservas + b.separaciones))
    .map(i => ({
      nombre: inmoNombre(i.inmobiliaria_id),
      Total: i.reservas + i.separaciones,
    }));
  const totalVentasInmo = ventasInmo.reduce((s, r) => s + r.Total, 0);
  const ventasInmoRows: SummaryRow[] = [
    ...([...ventasInmo].sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(r => ({ label: r.nombre, value: r.Total }))),
    { label: 'Total', value: totalVentasInmo, bold: true },
  ];

  // ── 6. Estatus contratos (torta) ──────────────────────────────────────────
  const contratoData = [
    { name: 'CLIENTA LISTA PARA CONTRATO', value: proceso_stats.reserva,    color: BLUE   },
    { name: 'CONTRATO FIRMADO',            value: proceso_stats.separacion,  color: ORANGE },
  ].filter(d => d.value > 0);
  const totalContratos = proceso_stats.reserva + proceso_stats.separacion;
  const contratoRows: SummaryRow[] = [
    { label: 'CLIENTA LISTA PARA CONTRATO', value: proceso_stats.reserva    },
    { label: 'CONTRATO FIRMADO',            value: proceso_stats.separacion  },
    { label: 'Total',                       value: totalContratos, bold: true },
  ];

  const chartCard: React.CSSProperties = {
    background: '#fff', border: '1px solid #d9d9d9',
    borderRadius: 4, padding: '16px 16px 12px', marginBottom: 20,
  };
  const chartTitle: React.CSSProperties = {
    textAlign: 'center', fontWeight: 600, fontSize: 14,
    letterSpacing: 1, marginBottom: 12, color: '#222',
  };

  return (
    <Row gutter={[24, 0]}>
      <Col xs={24} lg={12}>

        {/* ── Torta: Estatus ── */}
        <div style={chartCard}>
          <div style={chartTitle}>ESTATUS</div>
          {estatusData.length === 0 ? <Empty description="Sin datos" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={estatusData} dataKey="value" cx="40%" outerRadius={100} label={false}>
                  {estatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend
                  layout="vertical" align="right" verticalAlign="middle"
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: '#333' }}>{value}</span>
                  )}
                />
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <SummaryTable col1="Estatus" col2="Cantidad" rows={estatusRows} />
        </div>

        {/* ── Barras: Ventas por mes ── */}
        {isInterno && (
          <div style={chartCard}>
            <div style={chartTitle}>TOTAL DE VENTA POR MES</div>
            {ventasMes.length === 0 ? <Empty description="Sin datos" /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, ventasMes.length * 50)}>
                <BarChart data={ventasMes} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="mes" tick={{ fontSize: 12 }} width={35} />
                  <RTooltip />
                  <Legend formatter={() => <span style={{ fontSize: 12 }}>Total</span>} />
                  <Bar dataKey="Total" fill={BLUE} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div style={{ marginTop: 12 }}>
              <SummaryTable col1="Mes" col2="Cantidad de ventas por mes" rows={ventasMesRows} />
            </div>
          </div>
        )}

        {/* ── Torta: Estatus contratos ── */}
        {isInterno && (
          <div style={chartCard}>
            <div style={chartTitle}>ESTATUS DE CONTRATOS PROMESA DE VENTA</div>
            {contratoData.length === 0 ? <Empty description="Sin datos" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={contratoData} dataKey="value" cx="40%" outerRadius={100} label={false}>
                    {contratoData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Legend
                    layout="vertical" align="right" verticalAlign="middle"
                    formatter={(value) => (
                      <span style={{ fontSize: 12, color: '#333', maxWidth: 120, display: 'inline-block', whiteSpace: 'normal' }}>{value}</span>
                    )}
                  />
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <SummaryTable col1="Estatus contrato" col2="Cantidad" rows={contratoRows} />
          </div>
        )}

      </Col>

      <Col xs={24} lg={12}>

        {/* ── Barras: Ventas por piso ── */}
        {isInterno && ventasPiso.length > 0 && (
          <div style={chartCard}>
            <div style={chartTitle}>TOTAL DE VENTA POR PISO</div>
            <ResponsiveContainer width="100%" height={Math.max(180, ventasPiso.length * 50)}>
              <BarChart data={ventasPiso} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="piso" tick={{ fontSize: 12 }} width={25} />
                <RTooltip />
                <Legend formatter={() => <span style={{ fontSize: 12 }}>Total</span>} />
                <Bar dataKey="Total" fill={BLUE} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12 }}>
              <SummaryTable col1="Piso" col2="Total vendido" rows={ventasPisoRows} />
            </div>
          </div>
        )}

        {/* ── Barras: Ventas por metraje ── */}
        {isInterno && ventasMetraje.length > 0 && (
          <div style={chartCard}>
            <div style={chartTitle}>TOTAL DE VENTAS POR METRAJE</div>
            <ResponsiveContainer width="100%" height={Math.max(200, ventasMetraje.length * 55)}>
              <BarChart data={ventasMetraje} margin={{ left: 10, right: 30, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="metraje" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RTooltip />
                <Legend formatter={() => <span style={{ fontSize: 12 }}>Total</span>} />
                <Bar dataKey="Total" fill={BLUE} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12 }}>
              <SummaryTable col1="Metraje" col2="Total vendidos" rows={ventasMetrajeRows} />
            </div>
          </div>
        )}

        {/* ── Barras: Ventas por inmobiliaria ── */}
        {isAdmin && ventasInmo.length > 0 && (          <div style={chartCard}>
            <div style={chartTitle}>VENTAS POR INMOBILIARIAS</div>
            <ResponsiveContainer width="100%" height={Math.max(200, ventasInmo.length * 28)}>
              <BarChart data={ventasInmo} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category" dataKey="nombre" tick={{ fontSize: 10 }}
                  width={160}
                  tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                />
                <RTooltip />
                <Legend formatter={() => <span style={{ fontSize: 12 }}>Total</span>} />
                <Bar dataKey="Total" fill={BLUE} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12 }}>
              <SummaryTable col1="Inmobiliaria" col2="Total vendido" rows={ventasInmoRows} />
            </div>
          </div>
        )}

      </Col>
    </Row>
  );
};

export default DashboardPage;
