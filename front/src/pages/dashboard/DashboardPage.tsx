import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Select, Spin, Typography, Empty, Grid } from 'antd';
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
        />
      )}
    </div>
  );
};

// ── Contenido ─────────────────────────────────────────────────────────────────
const DashboardContent = ({
  data, isAdmin, isInterno, inmoNombre,
}: {
  data: AnalyticsData;
  isAdmin: boolean;
  isInterno: boolean;
  inmoNombre: (id: string) => string;
}) => {
  const { unidad_stats, proceso_stats, cierres_mensuales, conversion_por_inmobiliaria,
          ventas_por_piso, ventas_por_metraje, demograficos } = data;

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
    .sort((a, b) => a.separaciones - b.separaciones)
    .map(i => ({
      nombre: inmoNombre(i.inmobiliaria_id),
      Total: i.separaciones,
    }));
  const totalVentasInmo = ventasInmo.reduce((s, r) => s + r.Total, 0);
  const ventasInmoRows: SummaryRow[] = [
    ...([...ventasInmo].sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(r => ({ label: r.nombre, value: r.Total }))),
    { label: 'Total', value: totalVentasInmo, bold: true },
  ];

  // ── 6. Estatus contratos (torta) ──────────────────────────────────────────
  const contratoData = [
    { name: 'CLIENTE LISTO PARA CONTRATO', value: proceso_stats.separacion, color: BLUE   },
    { name: 'CONTRATO FIRMADO',            value: proceso_stats.inicial,    color: ORANGE },
  ].filter(d => d.value > 0);
  const totalContratos = proceso_stats.separacion + proceso_stats.inicial;
  const contratoRows: SummaryRow[] = [
    { label: 'CLIENTE LISTO PARA CONTRATO', value: proceso_stats.separacion },
    { label: 'CONTRATO FIRMADO',            value: proceso_stats.inicial    },
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

        {/* ── Demograficos ── */}
        {isInterno && demograficos && <DemograficosSection demograficos={demograficos} />}

      </Col>
    </Row>
  );
};

// ── Sección demográficos ──────────────────────────────────────────────────────
const COLORES_DEMO = ['#2E75B6','#ED7D31','#375623','#9DC3E6','#F4B942','#70AD47','#C00000','#7030A0','#00B0F0','#FF0000'];

const DemograficosSection = ({ demograficos }: { demograficos: NonNullable<AnalyticsData['demograficos']> }) => {
  const { rangos_edad, pais_residencia, nacionalidad } = demograficos;

  const chartCard: React.CSSProperties = {
    background: '#fff', border: '1px solid #d9d9d9',
    borderRadius: 4, padding: '16px 16px 12px', marginBottom: 20,
  };
  const chartTitle: React.CSSProperties = {
    textAlign: 'center', fontWeight: 600, fontSize: 14,
    letterSpacing: 1, marginBottom: 12, color: '#222',
  };

  // Rangos de edad — barras verticales, ordenados naturalmente
  const ORDEN_EDAD = ['<25','25-34','35-44','45-54','55+'];
  const edadData = ORDEN_EDAD
    .filter(k => (rangos_edad?.[k] ?? 0) > 0)
    .map(k => ({ rango: k, Total: rangos_edad[k] }));
  // Si hay rangos no estándar, agregarlos al final
  Object.entries(rangos_edad ?? {}).forEach(([k, v]) => {
    if (!ORDEN_EDAD.includes(k) && v > 0) edadData.push({ rango: k, Total: v });
  });
  const totalEdad = edadData.reduce((s, r) => s + r.Total, 0);

  // Residencia — torta, top 8 + "Otros"
  const residenciaEntries = Object.entries(pais_residencia ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const TOP = 8;
  const residenciaTop = residenciaEntries.slice(0, TOP);
  const residenciaOtros = residenciaEntries.slice(TOP).reduce((s, [, v]) => s + v, 0);
  const residenciaData = [
    ...residenciaTop.map(([pais, v], i) => ({ name: pais, value: v, color: COLORES_DEMO[i] })),
    ...(residenciaOtros > 0 ? [{ name: 'Otros', value: residenciaOtros, color: '#ccc' }] : []),
  ];
  const residenciaRows: SummaryRow[] = [
    ...residenciaEntries.map(([l, v]) => ({ label: l, value: v })),
    { label: 'Total', value: residenciaEntries.reduce((s, [, v]) => s + v, 0), bold: true },
  ];

  // Nacionalidad — torta, top 8 + "Otros"
  const nacionalidadEntries = Object.entries(nacionalidad ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const nacionalidadTop = nacionalidadEntries.slice(0, TOP);
  const nacionalidadOtros = nacionalidadEntries.slice(TOP).reduce((s, [, v]) => s + v, 0);
  const nacionalidadData = [
    ...nacionalidadTop.map(([nac, v], i) => ({ name: nac, value: v, color: COLORES_DEMO[i] })),
    ...(nacionalidadOtros > 0 ? [{ name: 'Otros', value: nacionalidadOtros, color: '#ccc' }] : []),
  ];
  const nacionalidadRows: SummaryRow[] = [
    ...nacionalidadEntries.map(([l, v]) => ({ label: l, value: v })),
    { label: 'Total', value: nacionalidadEntries.reduce((s, [, v]) => s + v, 0), bold: true },
  ];

  return (
    <>
      {/* Rangos de edad */}
      {edadData.length > 0 && (
        <div style={chartCard}>
          <div style={chartTitle}>RANGO DE EDAD DE COMPRADORES</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={edadData} margin={{ left: 0, right: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="rango" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <RTooltip formatter={(v: number) => [`${v} clientes (${totalEdad > 0 ? ((v/totalEdad)*100).toFixed(1) : 0}%)`, 'Total']} />
              <Bar dataKey="Total" fill={ORANGE} barSize={36} radius={[3, 3, 0, 0]}
                label={{ position: 'top', fontSize: 11, fill: '#555' }} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12 }}>
            <SummaryTable col1="Rango de edad" col2="Clientes" rows={[
              ...edadData.map(r => ({ label: r.rango, value: r.Total })),
              { label: 'Total', value: totalEdad, bold: true },
            ]} />
          </div>
        </div>
      )}

      {/* País de residencia */}
      {residenciaData.length > 0 && (
        <div style={chartCard}>
          <div style={chartTitle}>PAÍS DE RESIDENCIA</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={residenciaData} dataKey="value" cx="40%" outerRadius={100} label={false}>
                {residenciaData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Legend
                layout="vertical" align="right" verticalAlign="middle"
                formatter={(value) => <span style={{ fontSize: 11, color: '#333' }}>{value}</span>}
              />
              <RTooltip />
            </PieChart>
          </ResponsiveContainer>
          <SummaryTable col1="País de residencia" col2="Clientes" rows={residenciaRows} />
        </div>
      )}

      {/* Nacionalidad */}
      {nacionalidadData.length > 0 && (
        <div style={chartCard}>
          <div style={chartTitle}>NACIONALIDAD</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={nacionalidadData} dataKey="value" cx="40%" outerRadius={100} label={false}>
                {nacionalidadData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Legend
                layout="vertical" align="right" verticalAlign="middle"
                formatter={(value) => <span style={{ fontSize: 11, color: '#333' }}>{value}</span>}
              />
              <RTooltip />
            </PieChart>
          </ResponsiveContainer>
          <SummaryTable col1="Nacionalidad" col2="Clientes" rows={nacionalidadRows} />
        </div>
      )}
    </>
  );
};

export default DashboardPage;
