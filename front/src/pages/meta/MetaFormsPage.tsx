import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import Table from '../../components/common/ResponsiveTable';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  listarMetaFormularios,
  type MetaFormSubmission,
} from '../../services/meta.service';

const { Paragraph, Text, Title } = Typography;
const { Search } = Input;

const idWithName = (name?: string, id?: string) => {
  if (name && id) return `${name} (${id})`;
  return name || id || '-';
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const fieldRows = (item?: MetaFormSubmission | null) => {
  if (!item?.field_map) return [];
  return Object.entries(item.field_map).map(([name, values]) => ({
    name,
    value: Array.isArray(values) ? values.join(', ') : String(values || ''),
  }));
};

export default function MetaFormsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MetaFormSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<MetaFormSubmission | null>(null);

  const stats = useMemo(() => {
    const vinculados = items.filter((item) => item.lead_pk).length;
    const conTelefono = items.filter((item) => item.telefono_normalizado || item.telefono).length;
    return { total: items.length, vinculados, conTelefono };
  }, [items]);

  const cargar = async (nextCursor = '', append = false) => {
    setLoading(true);
    try {
      const data = await listarMetaFormularios({
        q: search.trim() || undefined,
        limit: 50,
        cursor: nextCursor || undefined,
      });
      setItems((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []));
      setCursor(data.next_cursor || '');
      setHasMore(Boolean(data.has_more));
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar los formularios Meta');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirLead = (leadPk?: string) => {
    if (!leadPk) return;
    navigate(`/meta-leads?lead=${encodeURIComponent(leadPk)}`);
  };

  const columns = [
    {
      title: 'Fecha',
      dataIndex: 'event_timestamp',
      width: 170,
      render: (value: string) => <Text>{formatDate(value)}</Text>,
    },
    {
      title: 'Contacto',
      key: 'contacto',
      render: (_: unknown, item: MetaFormSubmission) => (
        <Space direction="vertical" size={0}>
          <Text strong>{item.nombre || item.telefono_normalizado || item.correo || item.leadgen_id}</Text>
          <Text type="secondary" className="text-xs">
            {[item.telefono_normalizado || item.telefono, item.correo].filter(Boolean).join(' | ') || 'Sin contacto directo'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Formulario',
      key: 'formulario',
      render: (_: unknown, item: MetaFormSubmission) => (
        <Space direction="vertical" size={0}>
          <Text>{item.form_name || item.form_id || '-'}</Text>
          <Text type="secondary" className="text-xs">{item.platform || item.account_alias || 'Meta'}</Text>
        </Space>
      ),
    },
    {
      title: 'Campaña',
      key: 'campania',
      render: (_: unknown, item: MetaFormSubmission) => (
        <Space direction="vertical" size={0}>
          <Text>{item.campaign_name || item.campaign_id || '-'}</Text>
          <Text type="secondary" className="text-xs">{item.ad_name || item.ad_id || ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 150,
      render: (_: unknown, item: MetaFormSubmission) => (
        <Space direction="vertical" size={4}>
          <Tag color={item.lead_pk ? 'green' : 'default'}>
            {item.lead_pk ? 'Vinculado' : 'Sin lead'}
          </Tag>
          {item.fetch_status && item.fetch_status !== 'ok' && (
            <Tag color="gold">{item.fetch_status}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '',
      key: 'acciones',
      width: 105,
      render: (_: unknown, item: MetaFormSubmission) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(item)}>
          Ver
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Title level={3} className="!mb-1">Formularios Meta</Title>
          <Text type="secondary">Respuestas recibidas desde formularios de campañas Meta.</Text>
        </div>
        <Space className="page-toolbar" wrap>
          <Search
            allowClear
            placeholder="Buscar contacto, campaña, anuncio o respuesta"
            className="w-full sm:w-80"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onSearch={() => cargar()}
          />
          <Button icon={<ReloadOutlined />} onClick={() => cargar()} loading={loading}>
            Actualizar
          </Button>
        </Space>
      </div>

      <div className="form-summary grid gap-3 md:grid-cols-3">
        <Card size="small">
          <Text type="secondary">Formularios cargados</Text>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </Card>
        <Card size="small">
          <Text type="secondary">Con WhatsApp/teléfono</Text>
          <div className="text-2xl font-semibold">{stats.conTelefono}</div>
        </Card>
        <Card size="small">
          <Text type="secondary">Vinculados a lead</Text>
          <div className="text-2xl font-semibold">{stats.vinculados}</div>
        </Card>
      </div>

      <Table
        rowKey="pk"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={false}
        scroll={{ x: 980 }}
        locale={{ emptyText: <Empty description="Sin formularios recibidos" /> }}
      />

      {hasMore && (
        <div className="flex justify-center">
          <Button onClick={() => cargar(cursor, true)} loading={loading}>
            Cargar mas
          </Button>
        </div>
      )}

      <Drawer
        title="Detalle del formulario"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width={720}
        extra={
          selected?.lead_pk ? (
            <Button type="primary" onClick={() => abrirLead(selected.lead_pk)}>
              Abrir lead
            </Button>
          ) : null
        }
      >
        {selected && (
          <Space direction="vertical" size={16} className="w-full">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Fecha">{formatDate(selected.event_timestamp)}</Descriptions.Item>
              <Descriptions.Item label="Leadgen ID">{selected.leadgen_id}</Descriptions.Item>
              <Descriptions.Item label="Contacto">
                {[selected.nombre, selected.telefono_normalizado || selected.telefono, selected.correo]
                  .filter(Boolean)
                  .join(' | ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Formulario">{idWithName(selected.form_name, selected.form_id)}</Descriptions.Item>
              <Descriptions.Item label="Campaña">{idWithName(selected.campaign_name, selected.campaign_id)}</Descriptions.Item>
              <Descriptions.Item label="Conjunto">{idWithName(selected.adset_name, selected.adset_id)}</Descriptions.Item>
              <Descriptions.Item label="Anuncio">{idWithName(selected.ad_name, selected.ad_id)}</Descriptions.Item>
              <Descriptions.Item label="Plataforma">{selected.platform || selected.account_alias || '-'}</Descriptions.Item>
              <Descriptions.Item label="Lead relacionado">{selected.lead_pk || '-'}</Descriptions.Item>
            </Descriptions>

            <div>
              <Text strong>Respuestas</Text>
              <div className="mt-2 space-y-2">
                {fieldRows(selected).length ? fieldRows(selected).map((row) => (
                  <div key={row.name} className="rounded-md border border-[var(--app-border)] p-3">
                    <Text type="secondary" className="block text-xs">{row.name}</Text>
                    <Paragraph className="!mb-0">{row.value || '-'}</Paragraph>
                  </div>
                )) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin respuestas disponibles" />
                )}
              </div>
            </div>

            {selected.fetch_error && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <Text strong>Estado de consulta Graph</Text>
                <Paragraph className="!mb-0">{selected.fetch_error}</Paragraph>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
}
