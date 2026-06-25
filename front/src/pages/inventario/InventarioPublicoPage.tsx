import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Grid, Input, Result, Row, Select, Space, Spin, Switch, Tag, Typography } from 'antd';
import { AppstoreOutlined, MoonOutlined, ReloadOutlined, SunOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import TablaUnidades from '../../components/inventario/TablaUnidades';
import { getEtapasPublicas, getProyectoPublico, getUnidadesPublicas } from '../../services/inventario-publico.service';
import type { Etapa, Proyecto, Unidad } from '../../types';
import { useThemeMode } from '../../context/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const InventarioPublicoPage = () => {
  const { proyectoId = '' } = useParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const { isDark, toggleMode } = useThemeMode();

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [error, setError] = useState('');

  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroUnidad, setFiltroUnidad] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroManzana, setFiltroManzana] = useState('');
  const [filtroPiso, setFiltroPiso] = useState('');

  const cargarUnidades = async (override?: Partial<{
    estado: string;
    etapa_id: string;
    id_unidad: string;
    tipo: string;
    manzana: string;
    piso: string;
  }>) => {
    if (!proyectoId) return;
    setLoadingUnidades(true);
    try {
      const data = await getUnidadesPublicas(proyectoId, {
        estado: override?.estado ?? filtroEstado,
        etapa_id: override?.etapa_id ?? filtroEtapa,
        id_unidad: override?.id_unidad ?? filtroUnidad,
        tipo: override?.tipo ?? filtroTipo,
        manzana: override?.manzana ?? filtroManzana,
        piso: override?.piso ?? filtroPiso,
      });
      setUnidades(data);
    } finally {
      setLoadingUnidades(false);
    }
  };

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setLoading(true);
      setError('');
      try {
        const [proyectoData, etapasData, unidadesData] = await Promise.all([
          getProyectoPublico(proyectoId),
          getEtapasPublicas(proyectoId),
          getUnidadesPublicas(proyectoId),
        ]);
        if (!activo) return;
        setProyecto(proyectoData);
        setEtapas(etapasData);
        setUnidades(unidadesData);
      } catch (err: any) {
        if (!activo) return;
        setError(err?.message || 'No se pudo cargar el inventario publico');
      } finally {
        if (activo) setLoading(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [proyectoId]);

  useEffect(() => {
    if (loading) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      cargarUnidades();
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filtroUnidad, filtroTipo, filtroManzana, filtroPiso]);

  const limpiarFiltros = () => {
    setFiltroEtapa('');
    setFiltroEstado('');
    setFiltroUnidad('');
    setFiltroTipo('');
    setFiltroManzana('');
    setFiltroPiso('');
    cargarUnidades({ estado: '', etapa_id: '', id_unidad: '', tipo: '', manzana: '', piso: '' });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--app-bg)' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--app-bg)', padding: 24 }}>
        <Result
          status="404"
          title="Inventario no disponible"
          subTitle={error}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--text-main)' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? 16 : 24 }}>

        {/* Header con toggle de tema */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 18, flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <Row gutter={[18, 18]} align="middle">
              {proyecto?.imagen_url && (
                <Col xs={24} md={7} lg={6}>
                  <img
                    src={proyecto.imagen_url}
                    alt={proyecto.nombre}
                    style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                  />
                </Col>
              )}
              <Col xs={24} md={proyecto?.imagen_url ? 17 : 24} lg={proyecto?.imagen_url ? 18 : 24}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Tag icon={<AppstoreOutlined />} color="blue" style={{ width: 'fit-content' }}>
                    Inventario publico
                  </Tag>
                  <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>{proyecto?.nombre}</Title>
                  {proyecto?.descripcion && (
                    <Paragraph style={{ margin: 0, maxWidth: 820, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                      {proyecto.descripcion}
                    </Paragraph>
                  )}
                </Space>
              </Col>
            </Row>
          </div>

          {/* Botón tema — igual que en el Sidebar */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '10px 14px', borderRadius: 10, flexShrink: 0,
              color: 'var(--text-secondary)', fontSize: 14,
              background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isDark ? <MoonOutlined /> : <SunOutlined />}
              {isDark ? 'Modo oscuro' : 'Modo claro'}
            </span>
            <Switch size="small" checked={isDark} onChange={toggleMode} />
          </div>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Vista publica de solo lectura"
          description="Solo se muestran unidades disponibles y bloqueadas. Esta vista no permite bloquear, editar, cambiar estatus ni ver informacion interna."
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="Etapa"
            style={{ width: isMobile ? '100%' : 150 }}
            value={filtroEtapa || undefined}
            onChange={v => {
              const value = v || '';
              setFiltroEtapa(value);
              cargarUnidades({ etapa_id: value });
            }}
          >
            {etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
          </Select>
          <Select
            placeholder="Estado"
            value={filtroEstado || 'todos'}
            style={{ width: isMobile ? '100%' : 180 }}
            onChange={v => {
              const value = v === 'todos' ? '' : v || '';
              setFiltroEstado(value);
              cargarUnidades({ estado: value });
            }}
          >
            <Option value="todos">Todas</Option>
            <Option value="disponible">Disponible</Option>
            <Option value="bloqueada">Bloqueada</Option>
          </Select>
          <Input placeholder="Unidad (ej: 101)" style={{ width: isMobile ? '100%' : 140 }} value={filtroUnidad} onChange={e => setFiltroUnidad(e.target.value)} allowClear />
          <Input placeholder="Tipo (ej: D)" style={{ width: isMobile ? '100%' : 120 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} allowClear />
          <Input placeholder="Bloque (ej: A)" style={{ width: isMobile ? '100%' : 140 }} value={filtroManzana} onChange={e => setFiltroManzana(e.target.value)} allowClear />
          <Input placeholder="Piso (ej: 3)" style={{ width: isMobile ? '100%' : 120 }} value={filtroPiso} onChange={e => setFiltroPiso(e.target.value)} allowClear />
          {(filtroEtapa || filtroEstado || filtroUnidad || filtroTipo || filtroManzana || filtroPiso) && (
            <Button onClick={limpiarFiltros}>Limpiar</Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => cargarUnidades()} loading={loadingUnidades}>
            {isMobile ? '' : 'Actualizar'}
          </Button>
        </div>

        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {unidades.length} unidad{unidades.length === 1 ? '' : 'es'} disponible{unidades.length === 1 ? '' : 's'} o bloqueada{unidades.length === 1 ? '' : 's'}
        </Text>

        <TablaUnidades
          unidades={unidades}
          etapas={etapas}
          loading={loadingUnidades}
          isAdmin={false}
          isInmobiliaria
          canEdit={false}
          readOnlyPublic
          inmoNombre={(id) => id}
          onEditar={() => {}}
          onEliminar={() => {}}
        />
      </div>
    </div>
  );
};

export default InventarioPublicoPage;
