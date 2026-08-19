import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ClockCircleOutlined, MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  convertirMetaLead,
  gestionarMetaLead,
  getMetaConversacion,
  listarMetaLeads,
  type MetaLead,
  type MetaTimelineItem,
} from '../../services/meta.service';
import { getUsuariosSistema, type UsuarioSistema } from '../../services/sistema.service';
import { getInmobiliarias, type Inmobiliaria } from '../../services/inmobiliarias.service';
import { getProyectos, getUnidades } from '../../services/proyectos.service';
import type { Proyecto, Unidad } from '../../types';

const { Paragraph, Text, Title } = Typography;
const { Search, TextArea } = Input;
const { useBreakpoint } = Grid;

const canalLabel: Record<string, string> = {
  instagram: 'Instagram',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
};

const canalColor: Record<string, string> = {
  instagram: 'magenta',
  messenger: 'blue',
  whatsapp: 'green',
};

const canalInitial: Record<string, string> = {
  instagram: 'IG',
  messenger: 'FB',
  whatsapp: 'WA',
};

const estadoColor: Record<string, string> = {
  nuevo: 'blue',
  en_seguimiento: 'gold',
  convertido: 'green',
  cerrado: 'default',
};

const motivosCierre = [
  'No interesado',
  'No responde',
  'Presupuesto insuficiente',
  'Contacto incorrecto',
  'Duplicado',
  'Compra pospuesta',
  'Otro',
];

const toNumber = (value: unknown) => Number(value || 0);

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getProyectoLabel = (proyectos: Proyecto[], proyectoId?: string) => (
  proyectos.find((proyecto) => proyecto.proyecto_id === proyectoId)?.nombre || proyectoId || '-'
);

const getInmobiliariaLabel = (inmobiliarias: Inmobiliaria[], inmobiliariaId?: string) => (
  inmobiliarias.find((item) => item.pk === inmobiliariaId || item.pk === `INMOBILIARIA#${inmobiliariaId}`)?.nombre
  || inmobiliariaId
  || '-'
);

const timelineColor: Record<string, string> = {
  mensaje: 'blue',
  actividad: 'purple',
  nota: 'gold',
  oportunidad: 'green',
};

export default function MetaLeadsPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [canal, setCanal] = useState<string>();
  const [estado, setEstado] = useState<string>();
  const [busqueda, setBusqueda] = useState('');
  const [selectedLead, setSelectedLead] = useState<MetaLead | null>(null);
  const [timeline, setTimeline] = useState<MetaTimelineItem[]>([]);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [savingConversion, setSavingConversion] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();
  const estadoGestion = Form.useWatch('estado', form);

  const stats = useMemo(() => {
    const totalMensajes = leads.reduce((acc, lead) => acc + toNumber(lead.mensajes_totales), 0);
    const pendientes = leads.filter((lead) => (lead.estado || 'nuevo') === 'nuevo').length;
    const instagram = leads.filter((lead) => lead.channel === 'instagram').length;
    const messenger = leads.filter((lead) => lead.channel === 'messenger').length;
    const whatsapp = leads.filter((lead) => lead.channel === 'whatsapp').length;
    return { totalMensajes, pendientes, instagram, messenger, whatsapp };
  }, [leads]);

  const leadsFiltrados = useMemo(() => {
    const text = busqueda.trim().toLowerCase();
    if (!text) return leads;
    return leads.filter((lead) =>
      [
        lead.external_contact_id,
        lead.account_alias,
        lead.ultimo_mensaje_texto,
        lead.responsable_nombre,
        lead.inmobiliaria_nombre,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text)),
    );
  }, [busqueda, leads]);

  useEffect(() => {
    cargarLeads();
  }, [canal, estado]);

  useEffect(() => {
    cargarAsignables();
  }, []);

  const cargarAsignables = async () => {
    try {
      const [usuariosData, inmobiliariasData, proyectosData] = await Promise.all([
        getUsuariosSistema(),
        getInmobiliarias(),
        getProyectos(),
      ]);
      setUsuarios((usuariosData || []).filter((usuario) => usuario.activo));
      setInmobiliarias((inmobiliariasData || []).filter((inmobiliaria) => inmobiliaria.activo));
      setProyectos((proyectosData || []).filter((proyecto) => proyecto.activo));
    } catch {
      message.warning('No se pudieron cargar usuarios o inmobiliarias para asignar');
    }
  };

  const cargarLeads = async () => {
    setLoading(true);
    try {
      const data = await listarMetaLeads({ canal, estado });
      setLeads(data.items || []);
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar los leads Meta');
    } finally {
      setLoading(false);
    }
  };

  const abrirConversacion = async (lead: MetaLead) => {
    setSelectedLead(lead);
    setConversationLoading(true);
    try {
      const data = await getMetaConversacion(lead.pk);
      setTimeline(data.timeline || []);
      form.setFieldsValue({
        estado: data.lead?.estado || lead.estado || 'nuevo',
        responsable_id: data.lead?.responsable_id || lead.responsable_id,
        inmobiliaria_id: data.lead?.inmobiliaria_id || lead.inmobiliaria_id,
        motivo_cierre: data.lead?.motivo_cierre || lead.motivo_cierre,
        nota: '',
      });
    } catch (error: any) {
      setTimeline([]);
      message.error(error?.message || 'No se pudo cargar la conversacion');
    } finally {
      setConversationLoading(false);
    }
  };

  const guardarGestion = async () => {
    if (!selectedLead) return;
    const values = form.getFieldsValue();
    if (values.estado === 'cerrado' && !values.motivo_cierre) {
      message.warning('Selecciona el motivo de cierre');
      return;
    }
    const responsable = usuarios.find((usuario) => usuario.pk === values.responsable_id);
    const inmobiliaria = inmobiliarias.find((item) => item.pk === values.inmobiliaria_id);
    const payload = {
      estado: values.estado,
      nota: String(values.nota || '').trim(),
      responsable_id: values.responsable_id || '',
      responsable_nombre: responsable?.nombre || '',
      inmobiliaria_id: values.inmobiliaria_id || '',
      inmobiliaria_nombre: inmobiliaria?.nombre || '',
      motivo_cierre: values.estado === 'cerrado' ? values.motivo_cierre : undefined,
    };
    if (!payload.estado && !payload.nota && !payload.responsable_id && !payload.inmobiliaria_id) {
      message.warning('Selecciona estado, responsable, inmobiliaria o escribe una nota');
      return;
    }
    setSavingLead(true);
    try {
      const result = await gestionarMetaLead(selectedLead.pk, payload);
      setSelectedLead(result.lead);
      form.setFieldsValue({
        estado: result.lead.estado || 'nuevo',
        responsable_id: result.lead.responsable_id,
        inmobiliaria_id: result.lead.inmobiliaria_id,
        motivo_cierre: result.lead.motivo_cierre,
        nota: '',
      });
      await cargarLeads();
      const data = await getMetaConversacion(selectedLead.pk);
      setTimeline(data.timeline || []);
      message.success('Lead Meta actualizado');
    } catch (error: any) {
      message.error(error?.message || 'No se pudo actualizar el lead');
    } finally {
      setSavingLead(false);
    }
  };

  const abrirConversion = () => {
    if (!selectedLead) return;
    convertForm.setFieldsValue({
      inmobiliaria_id: selectedLead.inmobiliaria_id,
      telefono: selectedLead.channel === 'whatsapp' ? selectedLead.external_contact_id : '',
    });
    setUnidades([]);
    setConvertOpen(true);
  };

  const irAMensajes = () => {
    navigate('/meta-inbox');
  };

  const cargarUnidadesProyecto = async (proyectoId?: string) => {
    convertForm.setFieldsValue({ unidad_id: undefined });
    setUnidades([]);
    if (!proyectoId) return;
    setLoadingUnidades(true);
    try {
      const data = await getUnidades(proyectoId, { limit: 200 });
      setUnidades(data || []);
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar las unidades');
    } finally {
      setLoadingUnidades(false);
    }
  };

  const guardarConversion = async () => {
    if (!selectedLead) return;
    try {
      const values = await convertForm.validateFields();
      setSavingConversion(true);
      const result = await convertirMetaLead(selectedLead.pk, {
        ...values,
        inmobiliaria_id: String(values.inmobiliaria_id || '').replace('INMOBILIARIA#', ''),
      });
      setSelectedLead(result.lead);
      setConvertOpen(false);
      convertForm.resetFields();
      await cargarLeads();
      const data = await getMetaConversacion(selectedLead.pk);
      setTimeline(data.timeline || []);
      message.success(result.proceso ? 'Bloqueo registrado desde lead Meta' : 'Cliente registrado desde lead Meta');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || 'No se pudo convertir el lead');
    } finally {
      setSavingConversion(false);
    }
  };

  const columns = [
    {
      title: 'Canal',
      dataIndex: 'channel',
      width: 130,
      render: (value: string) => (
        <Tag color={canalColor[value] || 'default'}>
          {canalLabel[value] || value || 'Meta'}
        </Tag>
      ),
    },
    {
      title: 'Contacto',
      dataIndex: 'external_contact_id',
      render: (_: string, lead: MetaLead) => (
        <Space direction="vertical" size={0}>
          <Text strong>{lead.external_contact_id}</Text>
          <Text type="secondary" className="text-xs">{lead.account_alias}</Text>
        </Space>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 110,
      render: (value: string) => <Tag>{value || 'nuevo'}</Tag>,
    },
    {
      title: 'Responsable',
      dataIndex: 'responsable_nombre',
      width: 180,
      render: (value: string) => value || <Text type="secondary">Sin asignar</Text>,
    },
    {
      title: 'Ultimo mensaje',
      dataIndex: 'ultimo_mensaje_texto',
      ellipsis: true,
      render: (value: string) => value || <Text type="secondary">Sin texto</Text>,
    },
    {
      title: 'Mensajes',
      dataIndex: 'mensajes_totales',
      width: 100,
      align: 'right' as const,
      render: (value: unknown) => toNumber(value),
    },
    {
      title: 'Actualizado',
      dataIndex: 'ultimo_mensaje_en',
      width: 180,
      render: formatDate,
    },
    {
      title: '',
      key: 'acciones',
      width: 120,
      render: (_: unknown, lead: MetaLead) => (
        <Button type="link" onClick={() => abrirConversacion(lead)}>
          Ver mensajes
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Title level={2} className="!mb-1">Leads Meta</Title>
          <Text type="secondary">Bandeja de conversaciones y oportunidades creadas desde canales Meta.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={cargarLeads} loading={loading}>
          Actualizar
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="Estos son leads preliminares"
        description="Un lead Meta se crea con el identificador externo del contacto. Para convertirlo en cliente formal falta completar datos como cedula, proyecto e inmobiliaria."
      />

      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <Statistic title="Leads Meta" value={leads.length} />
        </Card>
        <Card>
          <Statistic title="Nuevos" value={stats.pendientes} />
        </Card>
        <Card>
          <Statistic title="Mensajes registrados" value={stats.totalMensajes} />
        </Card>
        <Card>
          <Statistic title="Instagram" value={stats.instagram} />
        </Card>
        <Card>
          <Statistic title="Messenger / WhatsApp" value={stats.messenger + stats.whatsapp} />
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Space wrap>
            <Select
              allowClear
              placeholder="Canal"
              className="w-full md:w-56"
              value={canal}
              onChange={setCanal}
              options={[
                { value: 'instagram', label: 'Instagram' },
                { value: 'messenger', label: 'Messenger' },
                { value: 'whatsapp', label: 'WhatsApp' },
              ]}
            />
            <Select
              allowClear
              placeholder="Estado"
              className="w-full md:w-56"
              value={estado}
              onChange={setEstado}
              options={[
                { value: 'nuevo', label: 'Nuevo' },
                { value: 'en_seguimiento', label: 'En seguimiento' },
                { value: 'convertido', label: 'Convertido' },
                { value: 'cerrado', label: 'Cerrado' },
              ]}
            />
          </Space>
          <Search
            allowClear
            placeholder="Buscar contacto, mensaje o responsable"
            className="w-full lg:w-80"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: undefined, label: 'Todos', count: leads.length },
            { key: 'instagram', label: 'Instagram', count: stats.instagram },
            { key: 'messenger', label: 'Messenger', count: stats.messenger },
            { key: 'whatsapp', label: 'WhatsApp', count: stats.whatsapp },
          ].map((item) => (
            <Button
              key={item.label}
              size="small"
              type={canal === item.key ? 'primary' : 'default'}
              onClick={() => setCanal(item.key)}
            >
              {item.label} ({item.count})
            </Button>
          ))}
        </div>

        <Table
          rowKey="pk"
          loading={loading}
          columns={columns}
          dataSource={leadsFiltrados}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty description="Sin leads Meta registrados" /> }}
        />
      </Card>

      <Drawer
        title={selectedLead ? (
          <Space direction="vertical" size={0}>
            <Space>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--action-soft-hover)] text-xs font-semibold text-[var(--action-bg)]">
                {canalInitial[selectedLead.channel] || 'MT'}
              </span>
              <span>Conversacion Meta</span>
              <Tag color={canalColor[selectedLead.channel] || 'default'}>
                {canalLabel[selectedLead.channel] || selectedLead.channel}
              </Tag>
            </Space>
            <Text type="secondary" className="text-xs">{selectedLead.external_contact_id}</Text>
          </Space>
        ) : 'Conversacion Meta'}
        open={!!selectedLead}
        extra={selectedLead && (
          <Button size="small" icon={<ReloadOutlined />} onClick={() => abrirConversacion(selectedLead)} loading={conversationLoading}>
            Actualizar
          </Button>
        )}
        onClose={() => {
          setSelectedLead(null);
          setTimeline([]);
          form.resetFields();
        }}
        width={isMobile ? '100%' : 720}
      >
        {selectedLead && (
          <Space direction="vertical" size={16} className="w-full">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Canal">
                <Tag color={canalColor[selectedLead.channel] || 'default'}>
                  {canalLabel[selectedLead.channel] || selectedLead.channel}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Contacto">{selectedLead.external_contact_id}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={estadoColor[selectedLead.estado || 'nuevo'] || 'default'}>
                  {selectedLead.estado || 'nuevo'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Responsable">
                {selectedLead.responsable_nombre || <Text type="secondary">Sin asignar</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Inmobiliaria">
                {selectedLead.inmobiliaria_nombre || <Text type="secondary">Sin asignar</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Mensajes">{toNumber(selectedLead.mensajes_totales)}</Descriptions.Item>
              <Descriptions.Item label="Historial">
                <Space wrap>
                  <Button size="small" icon={<ClockCircleOutlined />} onClick={() => setHistorialOpen(true)}>
                    Ver historial
                  </Button>
                  <Button size="small" icon={<MessageOutlined />} onClick={irAMensajes}>
                    Ver mensajes
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Card
              size="small"
              title={
                <Space>
                  <span>Oportunidades registradas</span>
                  <Tag>{selectedLead.historial_conversiones?.length || 0}</Tag>
                </Space>
              }
            >
              {selectedLead.historial_conversiones?.length ? (
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(item, index) => `${item.convertido_en || index}-${item.unidad_id || 'sin-unidad'}`}
                  dataSource={selectedLead.historial_conversiones}
                  columns={[
                    {
                      title: 'Fecha',
                      dataIndex: 'convertido_en',
                      render: (value?: string) => <Text>{formatDate(value)}</Text>,
                    },
                    {
                      title: 'Proyecto',
                      dataIndex: 'proyecto_id',
                      render: (value?: string) => <Text strong>{getProyectoLabel(proyectos, value)}</Text>,
                    },
                    {
                      title: 'Unidad',
                      render: (_, item) => (
                        item.con_unidad
                          ? <Tag color="geekblue">{item.unidad_nombre || item.unidad_id}</Tag>
                          : <Tag>Sin unidad</Tag>
                      ),
                    },
                    {
                      title: 'Cliente',
                      dataIndex: 'cedula',
                      render: (value?: string) => value || '-',
                    },
                    {
                      title: 'Inmobiliaria',
                      dataIndex: 'inmobiliaria_id',
                      render: (value?: string) => getInmobiliariaLabel(inmobiliarias, value),
                    },
                    {
                      title: 'Usuario',
                      dataIndex: 'usuario_nombre',
                      render: (value?: string) => value || 'Sistema',
                    },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin oportunidades registradas" />
              )}
            </Card>

            <Card title="Gestion del lead" size="small">
              <Form form={form} layout="vertical">
                <Form.Item label="Estado" name="estado">
                  <Select
                    options={[
                      { value: 'nuevo', label: 'Nuevo' },
                      { value: 'en_seguimiento', label: 'En seguimiento' },
                      { value: 'convertido', label: 'Convertido', disabled: !selectedLead.cliente_cedula },
                      { value: 'cerrado', label: 'Cerrado' },
                    ]}
                  />
                </Form.Item>
                {estadoGestion === 'cerrado' && (
                  <Form.Item
                    label="Motivo de cierre"
                    name="motivo_cierre"
                    rules={[{ required: true, message: 'Selecciona el motivo' }]}
                  >
                    <Select
                      placeholder="Seleccionar motivo"
                      options={motivosCierre.map((motivo) => ({ value: motivo, label: motivo }))}
                    />
                  </Form.Item>
                )}
                {selectedLead.motivo_cierre && (
                  <div className="mb-3 rounded-md border border-[var(--app-border)] bg-gray-50 p-2">
                    <Text type="secondary" className="text-xs">Ultimo motivo de cierre</Text>
                    <div>{selectedLead.motivo_cierre}</div>
                  </div>
                )}
                <Form.Item label="Responsable interno" name="responsable_id">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Seleccionar responsable"
                    options={usuarios.map((usuario) => ({
                      value: usuario.pk,
                      label: `${usuario.nombre || usuario.cognito_username} (${usuario.rol})`,
                    }))}
                  />
                </Form.Item>
                <Form.Item label="Inmobiliaria" name="inmobiliaria_id">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Seleccionar inmobiliaria"
                    options={inmobiliarias.map((inmobiliaria) => ({
                      value: inmobiliaria.pk,
                      label: inmobiliaria.nombre,
                    }))}
                  />
                </Form.Item>
                <Form.Item label="Nota interna" name="nota">
                  <TextArea rows={3} maxLength={500} showCount placeholder="Agregar observacion de seguimiento" />
                </Form.Item>
                <Button type="primary" loading={savingLead} onClick={guardarGestion}>
                  Guardar gestion
                </Button>
                <Button
                  className="ml-2"
                  onClick={abrirConversion}
                >
                  Registrar cliente o bloqueo
                </Button>
              </Form>
            </Card>

            <Card
              title={
                <Space>
                  <span>Historial del lead</span>
                  <Tag>{timeline.length}</Tag>
                </Space>
              }
              size="small"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Text type="secondary">
                  {timeline.length ? 'Historial disponible para revision.' : 'Sin historial registrado.'}
                </Text>
                <Space wrap>
                  <Button icon={<ClockCircleOutlined />} onClick={() => setHistorialOpen(true)}>
                    Ver historial
                  </Button>
                  <Button icon={<MessageOutlined />} onClick={irAMensajes}>
                    Ver mensajes
                  </Button>
                </Space>
              </div>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="Historial del lead"
        open={historialOpen}
        onCancel={() => setHistorialOpen(false)}
        footer={null}
        width={760}
      >
        {timeline.length ? (
          <Space direction="vertical" className="max-h-[68vh] w-full overflow-y-auto pr-1">
            {timeline.slice().reverse().map((item) => (
              <div key={item.id} className="rounded-md border border-[var(--app-border)] p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <Space size={8}>
                    <ClockCircleOutlined />
                    <Text strong>{item.titulo}</Text>
                  </Space>
                  <Tag color={timelineColor[item.categoria] || 'default'}>
                    {item.categoria}
                  </Tag>
                </div>
                <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'ver mas' }} className="!mb-1 !mt-1 whitespace-pre-wrap">
                  {item.detalle || '-'}
                </Paragraph>
                <Text type="secondary" className="text-xs">
                  {formatDate(item.fecha)} - {item.usuario_nombre || 'Sistema'}
                </Text>
              </div>
            ))}
          </Space>
        ) : (
          <Empty description="Sin historial registrado" />
        )}
      </Modal>

      <Modal
        title="Registrar cliente o bloqueo desde Meta"
        open={convertOpen}
        onCancel={() => setConvertOpen(false)}
        onOk={guardarConversion}
        okText="Registrar"
        confirmLoading={savingConversion}
        width={720}
      >
        <Form form={convertForm} layout="vertical">
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item
              name="cedula"
              label="Cedula / Pasaporte"
              rules={[{ required: true, message: 'Ingresa cedula o pasaporte' }]}
            >
              <Input placeholder="Ej: 00112345678" />
            </Form.Item>
            <Form.Item
              name="proyecto_id"
              label="Proyecto"
              rules={[{ required: true, message: 'Selecciona un proyecto' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Seleccionar proyecto"
                onChange={cargarUnidadesProyecto}
                options={proyectos.map((proyecto) => ({
                  value: proyecto.proyecto_id,
                  label: proyecto.nombre,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="nombres"
              label="Nombres"
              rules={[{ required: true, message: 'Ingresa nombres' }]}
            >
              <Input placeholder="Nombres del cliente" />
            </Form.Item>
            <Form.Item
              name="apellidos"
              label="Apellidos"
              rules={[{ required: true, message: 'Ingresa apellidos' }]}
            >
              <Input placeholder="Apellidos del cliente" />
            </Form.Item>
            <Form.Item
              name="inmobiliaria_id"
              label="Inmobiliaria"
              rules={[{ required: true, message: 'Selecciona una inmobiliaria' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Seleccionar inmobiliaria"
                options={inmobiliarias.map((inmobiliaria) => ({
                  value: inmobiliaria.pk,
                  label: inmobiliaria.nombre,
                }))}
              />
            </Form.Item>
            <Form.Item name="unidad_id" label="Unidad de interes">
              <Select
                allowClear
                showSearch
                loading={loadingUnidades}
                optionFilterProp="label"
                placeholder="Opcional"
                options={unidades
                  .filter((unidad) => unidad.estado === 'disponible')
                  .map((unidad) => ({
                    value: unidad.unidad_id,
                    label: unidad.id_unidad || unidad.unidad_id,
                  }))}
              />
            </Form.Item>
            <Form.Item name="correo" label="Correo">
              <Input type="email" placeholder="correo@ejemplo.com" />
            </Form.Item>
            <Form.Item name="telefono" label="Telefono">
              <Input inputMode="numeric" placeholder="8490000000" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
