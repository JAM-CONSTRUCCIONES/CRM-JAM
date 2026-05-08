import { Table, Tag, Button, Space, Tooltip, Popconfirm, Typography, Grid, Popover } from 'antd';
import { EditOutlined, DeleteOutlined, LockOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { Unidad, Etapa } from '../../types';
import { ESTADO_UNIDAD_CONFIG } from '../../constants/estados';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const formatTiempo = (s: number) => {
  if (s <= 0) return 'Vencido';
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

const fmt$ = (v?: number) => v != null ? `$${parseFloat(String(v)).toLocaleString('en-US')}` : null;

interface Props {
  unidades: Unidad[];
  etapas: Etapa[];
  loading: boolean;
  isAdmin: boolean;
  isInmobiliaria: boolean;
  canEdit?: boolean;
  inmoNombre: (id: string) => string;
  onEditar: (u: Unidad) => void;
  onEliminar: (u: Unidad) => void;
  onBloquear?: (u: Unidad) => void;
  onCrearBloqueoAdmin?: (u: Unidad) => void;
}

// ── Card móvil ────────────────────────────────────────────────────────────────
const UnidadCard = ({ u, etapas, isAdmin, isInmobiliaria, canEdit, inmoNombre, onEditar, onEliminar, onBloquear, onCrearBloqueoAdmin }: {
  u: Unidad; etapas: Etapa[]; isAdmin: boolean; isInmobiliaria: boolean; canEdit?: boolean;
  inmoNombre: (id: string) => string;
  onEditar: (u: Unidad) => void; onEliminar: (u: Unidad) => void; onBloquear?: (u: Unidad) => void;
  onCrearBloqueoAdmin?: (u: Unidad) => void;
}) => {
  const cfg = ESTADO_UNIDAD_CONFIG[u.estado] ?? { label: u.estado, tagColor: 'default' };
  const etapa = etapas.find(e => e.etapa_id === u.etapa_id);

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Color bar by estado */}
      <div style={{
        height: 4,
        background: cfg.tagColor === 'success' ? '#52c41a'
          : cfg.tagColor === 'warning' ? '#faad14'
          : cfg.tagColor === 'orange' ? '#fa8c16'
          : cfg.tagColor === 'error' ? '#ff4d4f'
          : '#d9d9d9',
      }} />

      <div style={{ padding: '12px 14px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <Text strong style={{ fontSize: 16 }}>{u.id_unidad}</Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <Tag color={cfg.tagColor} style={{ margin: 0 }}>{cfg.label}</Tag>
              {etapa && <Tag color="blue" style={{ margin: 0 }}>{etapa.nombre}</Tag>}
              {u.tipo && <Tag style={{ margin: 0 }}>{u.tipo}</Tag>}
            </div>
          </div>
          {canEdit && (
            <Space size={4}>
              <Button size="small" icon={<EditOutlined />} onClick={() => onEditar(u)} />
              <Popconfirm title="¿Eliminar unidad?" okText="Sí" cancelText="No" onConfirm={() => onEliminar(u)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          )}
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 8 }}>
          {u.manzana && <div><Text type="secondary" style={{ fontSize: 11 }}>MANZANA</Text><div><Text>{u.manzana}</Text></div></div>}
          {u.piso && <div><Text type="secondary" style={{ fontSize: 11 }}>PISO</Text><div><Text>{u.piso}</Text></div></div>}
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>METRAJE</Text>
            <div>
              <Text>{parseFloat(String(u.metraje)) || 0} m²</Text>
              {u.metraje_terraza ? <Text type="secondary" style={{ fontSize: 11 }}> +{parseFloat(String(u.metraje_terraza))}t</Text> : null}
              {u.metraje_patio ? <Text type="secondary" style={{ fontSize: 11 }}> +{parseFloat(String(u.metraje_patio))}p</Text> : null}
            </div>
          </div>
          {u.parqueos != null && <div><Text type="secondary" style={{ fontSize: 11 }}>PARQUEOS</Text><div><Text>{u.parqueos}</Text></div></div>}
          {(u as any).num_cuartos != null && <div><Text type="secondary" style={{ fontSize: 11 }}>CUARTOS</Text><div><Text>{(u as any).num_cuartos}</Text></div></div>}
          {(u as any).num_banos != null && <div><Text type="secondary" style={{ fontSize: 11 }}>BAÑOS</Text><div><Text>{(u as any).num_banos}</Text></div></div>}
        </div>

        {/* Precio */}
        <div style={{ background: '#fafafa', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 15 }}>{fmt$(u.precio)}</Text>
          {(u.precio_reserva || u.precio_separacion || u.precio_inicial || u.cuota_monto || u.contra_entrega) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', marginTop: 4 }}>
              {u.precio_reserva && <Text type="secondary" style={{ fontSize: 11 }}>Reserva: {fmt$(u.precio_reserva)}</Text>}
              {u.precio_separacion && <Text type="secondary" style={{ fontSize: 11 }}>Sep.: {fmt$(u.precio_separacion)}</Text>}
              {u.precio_inicial && <Text type="secondary" style={{ fontSize: 11 }}>Inicial: {fmt$(u.precio_inicial)}</Text>}
              {u.cuota_monto && <Text type="secondary" style={{ fontSize: 11 }}>Cuota: {fmt$(u.cuota_monto)} x{u.cuota_meses ?? '?'}m</Text>}
              {u.contra_entrega && <Text type="secondary" style={{ fontSize: 11 }}>C.E.: {fmt$(u.contra_entrega)}</Text>}
            </div>
          )}
        </div>

        {/* Bloqueo info */}
        {u.estado === 'bloqueada' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            {u.bloqueado_por && isAdmin && <Text type="secondary" style={{ fontSize: 12 }}>🔒 {inmoNombre(u.bloqueado_por)}</Text>}
            {u.tiempo_restante !== undefined && (
              <Text style={{ fontSize: 12, color: u.tiempo_restante < 5 * 3600 ? '#faad14' : '#52c41a' }}>
                <ClockCircleOutlined style={{ marginRight: 3 }} />{formatTiempo(u.tiempo_restante)}
              </Text>
            )}
          </div>
        )}

        {/* Comentario */}
        {u.comentario && isAdmin && (
          <div style={{ background: '#fffbe6', borderRadius: 6, padding: '4px 8px', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>💬 {u.comentario}</Text>
          </div>
        )}

        {/* Bloquear button (inmobiliaria) */}
        {isInmobiliaria && u.estado === 'disponible' && (
          <Button size="small" icon={<LockOutlined />} type="primary" ghost block onClick={() => onBloquear?.(u)}>
            Bloquear unidad
          </Button>
        )}
        {isInmobiliaria && u.estado === 'bloqueada' && (
          <Tag icon={<LockOutlined />} color="warning" style={{ width: '100%', textAlign: 'center', padding: '4px 0' }}>Bloqueada</Tag>
        )}
        
        {/* Crear bloqueo button (admin) */}
        {isAdmin && !isInmobiliaria && u.estado === 'disponible' && onCrearBloqueoAdmin && (
          <Button size="small" icon={<LockOutlined />} type="primary" block onClick={() => onCrearBloqueoAdmin(u)}>
            Crear bloqueo
          </Button>
        )}
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const TablaUnidades = ({ unidades, etapas, loading, isAdmin, isInmobiliaria, canEdit, inmoNombre, onEditar, onEliminar, onBloquear, onCrearBloqueoAdmin }: Props) => {
  const { md } = useBreakpoint();

  // Móvil → cards
  if (!md) {
    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Cargando...</div>;
    if (!unidades.length) return <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Sin unidades</div>;
    return (
      <div>
        {unidades.map(u => (
          <UnidadCard key={u.unidad_id} u={u} etapas={etapas}
            isAdmin={isAdmin} isInmobiliaria={isInmobiliaria} canEdit={canEdit} inmoNombre={inmoNombre}
            onEditar={onEditar} onEliminar={onEliminar} onBloquear={onBloquear} onCrearBloqueoAdmin={onCrearBloqueoAdmin} />
        ))}
      </div>
    );
  }

  // Desktop → tabla
  const columnas = [
    { title: 'ID Unidad', dataIndex: 'id_unidad', key: 'id_unidad', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Etapa', dataIndex: 'etapa_id', key: 'etapa_id', render: (v: string) => {
      const e = etapas.find(et => et.etapa_id === v);
      return e ? <Tag color="blue">{e.nombre}</Tag> : <Text type="secondary">—</Text>;
    }},
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Manzana', dataIndex: 'manzana', key: 'manzana', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: 'Piso', dataIndex: 'piso', key: 'piso', render: (v: string) => v || <Text type="secondary">—</Text> },
    {
      title: 'Metraje', key: 'metraje',
      render: (_: any, u: Unidad) => (
        <Space direction="vertical" size={0}>
          <Text>{parseFloat(String(u.metraje)) || 0} m² <span style={{ color: '#aaa', fontSize: 11 }}>apto.</span></Text>
          {u.metraje_terraza ? <Text type="secondary" style={{ fontSize: 11 }}>+{parseFloat(String(u.metraje_terraza))} m² terraza</Text> : null}
          {u.metraje_patio ? <Text type="secondary" style={{ fontSize: 11 }}>+{parseFloat(String(u.metraje_patio))} m² patio</Text> : null}
        </Space>
      ),
    },
    { title: 'Parqueos', dataIndex: 'parqueos', key: 'parqueos', render: (v: any) => v != null ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    {
      title: 'Cuartos / Baños', key: 'cuartos_banos',
      render: (_: any, u: Unidad) => {
        const c = (u as any).num_cuartos;
        const b = (u as any).num_banos;
        if (c == null && b == null) return <Text type="secondary">—</Text>;
        return <Text>{c != null ? `${c}c` : '—'} / {b != null ? `${b}b` : '—'}</Text>;
      },
    },
    {
      title: 'Precio', key: 'precio',
      render: (_: any, u: Unidad) => {
        const tieneDetalles = u.precio_reserva || u.precio_separacion || u.precio_inicial || u.cuota_monto || u.contra_entrega;
        const contenidoPopover = tieneDetalles ? (
          <div style={{ minWidth: 180 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 13 }}>Desglose de precios</Text>
            </div>
            {u.precio_reserva && <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Reserva:</Text> <Text style={{ fontSize: 12 }}>{fmt$(u.precio_reserva)}</Text></div>}
            {u.precio_separacion && <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Separación:</Text> <Text style={{ fontSize: 12 }}>{fmt$(u.precio_separacion)}</Text></div>}
            {u.precio_inicial && <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Inicial:</Text> <Text style={{ fontSize: 12 }}>{fmt$(u.precio_inicial)}</Text></div>}
            {u.cuota_monto && <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Cuota:</Text> <Text style={{ fontSize: 12 }}>{fmt$(u.cuota_monto)} × {u.cuota_meses ?? '?'} meses</Text></div>}
            {u.contra_entrega && <div><Text type="secondary" style={{ fontSize: 12 }}>Contra entrega:</Text> <Text style={{ fontSize: 12 }}>{fmt$(u.contra_entrega)}</Text></div>}
          </div>
        ) : null;

        return (
          <Space size={4} align="center">
            <Text strong>{fmt$(u.precio) ?? '—'}</Text>
            {tieneDetalles && (
              <Popover content={contenidoPopover} title={null} trigger="hover" placement="left">
                <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer' }} />
              </Popover>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado',
      render: (v: string, u: Unidad) => {
        const cfg = ESTADO_UNIDAD_CONFIG[v] ?? { label: v, tagColor: 'default' };
        return (
          <Space direction="vertical" size={2}>
            <Tag color={cfg.tagColor}>{cfg.label}</Tag>
            {v === 'bloqueada' && u.tiempo_restante !== undefined && (
              <Text style={{ fontSize: 11, color: u.tiempo_restante < 5 * 3600 ? '#faad14' : '#52c41a' }}>
                <ClockCircleOutlined style={{ marginRight: 3 }} />{formatTiempo(u.tiempo_restante)}
              </Text>
            )}
          </Space>
        );
      },
    },
    ...(canEdit ? [
      { title: 'Bloqueado por', dataIndex: 'bloqueado_por', key: 'bloqueado_por', render: (v: string) => v ? <Tag>{inmoNombre(v)}</Tag> : <Text type="secondary">—</Text> },
      { title: 'Fecha bloqueo', dataIndex: 'fecha_bloqueo', key: 'fecha_bloqueo', render: (v: string) => v ? new Date(v).toLocaleDateString('es-VE') : <Text type="secondary">—</Text> },
      { title: '', key: 'acciones', width: 90, render: (_: any, u: Unidad) => (
        <Space>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => onEditar(u)} /></Tooltip>
          {u.comentario && <Tooltip title={u.comentario}><Button size="small" type="text" style={{ color: '#faad14' }}>💬</Button></Tooltip>}
          <Popconfirm title="¿Eliminar unidad?" okText="Sí" cancelText="No" onConfirm={() => onEliminar(u)}>
            <Tooltip title="Eliminar"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )},
    ] : isAdmin ? [
      { title: 'Bloqueado por', dataIndex: 'bloqueado_por', key: 'bloqueado_por', render: (v: string) => v ? <Tag>{inmoNombre(v)}</Tag> : <Text type="secondary">—</Text> },
      { title: 'Fecha bloqueo', dataIndex: 'fecha_bloqueo', key: 'fecha_bloqueo', render: (v: string) => v ? new Date(v).toLocaleDateString('es-VE') : <Text type="secondary">—</Text> },
    ] : []),
    ...(isInmobiliaria ? [{
      title: '', key: 'bloqueo', width: 120,
      render: (_: any, u: Unidad) => {
        if (u.estado !== 'disponible') return null;
        return <Button size="small" icon={<LockOutlined />} type="primary" ghost onClick={() => onBloquear?.(u)}>Bloquear</Button>;
      },
    }] : []),
    ...(isAdmin && !isInmobiliaria && onCrearBloqueoAdmin ? [{
      title: '', key: 'crear_bloqueo', width: 130,
      render: (_: any, u: Unidad) => {
        if (u.estado !== 'disponible') return null;
        return <Button size="small" icon={<LockOutlined />} type="primary" onClick={() => onCrearBloqueoAdmin(u)}>Crear bloqueo</Button>;
      },
    }] : []),
  ];

  return (
    <Table dataSource={unidades} columns={columnas} rowKey="unidad_id"
      loading={loading} pagination={{ pageSize: 30 }}
      locale={{ emptyText: 'Sin unidades' }}
      scroll={{ x: true }}
      rowClassName={(r) => `row-estado-${r.estado}`}
      size="middle"
    />
  );
};

export default TablaUnidades;
