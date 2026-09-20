import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { ClockCircleOutlined, FileOutlined, LinkOutlined, PictureOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import {
  convertirMetaLead,
  enviarMetaMensaje,
  gestionarMetaLead,
  getMetaConversacion,
  listarMetaLeads,
  type MetaLead,
  type MetaMensaje,
  type MetaTimelineItem,
} from '../../services/meta.service';
import { getInmobiliarias, type Inmobiliaria } from '../../services/inmobiliarias.service';
import { getProyectos, getUnidades } from '../../services/proyectos.service';
import { getUsuariosSistema, type UsuarioSistema } from '../../services/sistema.service';
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

const estadoColor: Record<string, string> = {
  nuevo: 'blue',
  en_seguimiento: 'gold',
  convertido: 'green',
  cerrado: 'default',
};

const mensajeEstadoColor: Record<string, string> = {
  enviado: 'green',
  delivered: 'cyan',
  read: 'blue',
  pendiente_configuracion: 'orange',
  fallido: 'red',
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const toNumber = (value: unknown) => Number(value || 0);

const quickReplies = [
  'Hola, gracias por escribirnos. En breve uno de nuestros asesores te asistira.',
  'Con gusto. Para ayudarte mejor, puedes indicarnos tu nombre y el proyecto de interes?',
  'Perfecto, vamos a revisar la informacion y te damos seguimiento por este medio.',
];

const motivosCierre = [
  'No interesado',
  'No responde',
  'Presupuesto insuficiente',
  'Contacto incorrecto',
  'Duplicado',
  'Compra pospuesta',
  'Otro',
];

const METHODICA_WHATSAPP_ONBOARDING_URL = 'https://auth.methodicatechnology.com/admin/configuracion/mensajeria';
const JAM_WHATSAPP_WEBHOOK_URL = 'https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/webhooks/whatsapp';
const JAM_META_INBOX_URL = 'https://d12nm0khvt8zd9.cloudfront.net/meta-inbox';

const attachmentsOf = (mensaje: MetaMensaje) => {
  if (mensaje.attachments?.length) return mensaje.attachments;
  if (mensaje.media) {
    return [{
      type: mensaje.media.type,
      id: mensaje.media.id,
      mime_type: mensaje.media.mime_type,
      filename: mensaje.media.filename,
      caption: mensaje.media.caption,
      public_url: mensaje.media.public_url,
      storage_status: mensaje.media.storage_status,
    }];
  }
  return [];
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

export default function MetaInboxPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<MetaLead | null>(null);
  const [mensajes, setMensajes] = useState<MetaMensaje[]>([]);
  const [timeline, setTimeline] = useState<MetaTimelineItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [canal, setCanal] = useState<string>();
  const [busqueda, setBusqueda] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [savingConversion, setSavingConversion] = useState(false);
  const [sending, setSending] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();
  const mensajesPanelRef = useRef<HTMLDivElement | null>(null);
  const estadoGestion = Form.useWatch('estado', form);

  const conversaciones = useMemo(() => {
    const text = busqueda.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesCanal = !canal || lead.channel === canal;
      if (!matchesCanal) return false;
      if (!text) return true;
      return [
        lead.external_contact_id,
        lead.ultimo_mensaje_texto,
        lead.responsable_nombre,
        lead.inmobiliaria_nombre,
        lead.account_alias,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [busqueda, canal, leads]);

  const stats = useMemo(() => ({
    nuevos: leads.filter((lead) => (lead.estado || 'nuevo') === 'nuevo').length,
    sinResponder: leads.filter((lead) => toNumber(lead.mensajes_recibidos) > toNumber(lead.mensajes_enviados)).length,
  }), [leads]);
  const whatsappOnboardingUrl = useMemo(() => {
    const params = new URLSearchParams({
      tenant: 'jam',
      clientName: 'JAM Construcciones',
      targetWebhookUrl: JAM_WHATSAPP_WEBHOOK_URL,
      returnUrl: JAM_META_INBOX_URL,
    });
    return `${METHODICA_WHATSAPP_ONBOARDING_URL}?${params.toString()}`;
  }, []);

  useEffect(() => {
    cargarLeads();
    cargarAsignables();
  }, []);

  const cargarLeads = async () => {
    setLoadingLeads(true);
    try {
      const data = await listarMetaLeads();
      setLeads(data.items || []);
      if (!selectedLead && data.items?.length) {
        await abrirConversacion(data.items[0], false);
      }
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar las conversaciones Meta');
    } finally {
      setLoadingLeads(false);
    }
  };

  const cargarAsignables = async () => {
    try {
      const [usuariosData, inmobiliariasData, proyectosData] = await Promise.all([
        getUsuariosSistema(),
        getInmobiliarias(),
        getProyectos(),
      ]);
      setUsuarios((usuariosData || []).filter((usuario) => usuario.activo));
      setInmobiliarias((inmobiliariasData || []).filter((item) => item.activo));
      setProyectos((proyectosData || []).filter((proyecto) => proyecto.activo));
    } catch {
      message.warning('No se pudieron cargar responsables, inmobiliarias o proyectos');
    }
  };

  const abrirConversacion = async (lead: MetaLead, clearText = true) => {
    setSelectedLead(lead);
    if (clearText) setRespuesta('');
    setLoadingConversation(true);
    try {
      const data = await getMetaConversacion(lead.pk);
      const currentLead = data.lead || lead;
      setSelectedLead(currentLead);
      setMensajes(data.mensajes || []);
      setTimeline(data.timeline || []);
      form.setFieldsValue({
        estado: currentLead.estado || 'nuevo',
        responsable_id: currentLead.responsable_id,
        inmobiliaria_id: currentLead.inmobiliaria_id,
        motivo_cierre: currentLead.motivo_cierre,
      });
    } catch (error: any) {
      setMensajes([]);
      setTimeline([]);
      message.error(error?.message || 'No se pudo abrir la conversacion');
    } finally {
      setLoadingConversation(false);
    }
  };

  const guardarGestionRapida = async () => {
    if (!selectedLead) return;
    const values = form.getFieldsValue();
    if (values.estado === 'cerrado' && !values.motivo_cierre) {
      message.warning('Selecciona el motivo de cierre');
      return;
    }
    const responsable = usuarios.find((usuario) => usuario.pk === values.responsable_id);
    const inmobiliaria = inmobiliarias.find((item) => item.pk === values.inmobiliaria_id);
    setSavingLead(true);
    try {
      const result = await gestionarMetaLead(selectedLead.pk, {
        estado: values.estado,
        responsable_id: values.responsable_id || '',
        responsable_nombre: responsable?.nombre || '',
        inmobiliaria_id: values.inmobiliaria_id || '',
        inmobiliaria_nombre: inmobiliaria?.nombre || '',
        motivo_cierre: values.estado === 'cerrado' ? values.motivo_cierre : undefined,
      });
      setSelectedLead(result.lead);
      await cargarLeads();
      message.success('Lead actualizado');
    } catch (error: any) {
      message.error(error?.message || 'No se pudo actualizar el lead');
    } finally {
      setSavingLead(false);
    }
  };

  const enviarRespuesta = async () => {
    if (!selectedLead) return;
    const texto = respuesta.trim();
    if (!texto) {
      message.warning('Escribe una respuesta');
      return;
    }
    setSending(true);
    try {
      const result = await enviarMetaMensaje(selectedLead.pk, { texto });
      setRespuesta('');
      await abrirConversacion(selectedLead, false);
      await cargarLeads();
      if (result.sent) {
        message.success('Mensaje enviado');
      } else if (result.status === 'pendiente_configuracion') {
        message.warning('Mensaje registrado. Falta token o aprobacion de Meta para enviarlo real.');
      } else {
        message.warning('Mensaje registrado, pero Meta rechazo el envio real.');
      }
    } catch (error: any) {
      message.error(error?.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
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

  const irAHistorialMensajes = () => {
    mensajesPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      await abrirConversacion(result.lead, false);
      message.success(result.proceso ? 'Bloqueo registrado desde lead Meta' : 'Cliente registrado desde lead Meta');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || 'No se pudo convertir el lead');
    } finally {
      setSavingConversion(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-3 overflow-hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Title level={2} className="!mb-1">Inbox Meta</Title>
          <Text type="secondary">Responde conversaciones de Instagram, Messenger y WhatsApp desde una sola bandeja.</Text>
        </div>
        <Space wrap>
          <Tag color="blue">{stats.nuevos} nuevos</Tag>
          <Tag color="orange">{stats.sinResponder} por responder</Tag>
          <Button icon={<LinkOutlined />} href={whatsappOnboardingUrl} target="_blank" rel="noreferrer">
            Conectar WhatsApp
          </Button>
          <Button icon={<ReloadOutlined />} onClick={cargarLeads} loading={loadingLeads}>
            Actualizar
          </Button>
        </Space>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <Card ref={mensajesPanelRef} className="min-h-0 overflow-hidden" bodyStyle={{ height: '100%', padding: 0 }}>
          <div className="border-b border-[var(--app-border)] p-3">
            <Space direction="vertical" className="w-full">
              <Search
                allowClear
                placeholder="Buscar conversacion"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
              <Select
                allowClear
                placeholder="Todos los canales"
                value={canal}
                onChange={setCanal}
                options={[
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'messenger', label: 'Messenger' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                ]}
              />
            </Space>
          </div>
          <div className="h-[calc(100%-112px)] overflow-y-auto">
            {loadingLeads && !conversaciones.length ? (
              <div className="grid h-full place-items-center">
                <Spin />
              </div>
            ) : conversaciones.length ? (
              conversaciones.map((lead) => {
                const active = selectedLead?.pk === lead.pk;
                const pending = toNumber(lead.mensajes_recibidos) > toNumber(lead.mensajes_enviados);
                return (
                  <button
                    key={lead.pk}
                    type="button"
                    onClick={() => abrirConversacion(lead)}
                    className={`block w-full border-b border-[var(--app-border)] px-3 py-3 text-left transition hover:bg-[var(--panel-soft-bg)] ${
                      active ? 'bg-[var(--action-soft-hover)]' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Space size={8}>
                        <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--panel-soft-bg)] text-xs font-semibold">
                          {lead.channel === 'instagram' ? 'IG' : lead.channel === 'messenger' ? 'FB' : 'WA'}
                        </span>
                        <div>
                          <Text strong className="block max-w-[180px] truncate">{lead.external_contact_id}</Text>
                          <Text type="secondary" className="block max-w-[180px] truncate text-xs">
                            {lead.account_alias || canalLabel[lead.channel] || 'Meta'}
                          </Text>
                        </div>
                      </Space>
                      {pending && <Tag color="orange">Nuevo</Tag>}
                    </div>
                    <Paragraph ellipsis={{ rows: 2 }} className="!mb-1 !mt-2 text-sm">
                      {lead.ultimo_mensaje_texto || 'Sin mensaje de texto'}
                    </Paragraph>
                    <div className="flex items-center justify-between gap-2">
                      <Tag color={canalColor[lead.channel] || 'default'}>{canalLabel[lead.channel] || lead.channel}</Tag>
                      <Text type="secondary" className="text-xs">{formatDate(lead.ultimo_mensaje_en)}</Text>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="grid h-full place-items-center p-4">
                <Empty description="Sin conversaciones" />
              </div>
            )}
          </div>
        </Card>

        <Card className="min-h-0 overflow-hidden" bodyStyle={{ height: '100%', padding: 0 }}>
          {selectedLead ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-[var(--app-border)] px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <Space wrap>
                    <Title level={4} className="!mb-0">{selectedLead.external_contact_id}</Title>
                    <Tag color={canalColor[selectedLead.channel] || 'default'}>
                      {canalLabel[selectedLead.channel] || selectedLead.channel}
                    </Tag>
                    <Tag color={estadoColor[selectedLead.estado || 'nuevo'] || 'default'}>
                      {selectedLead.estado || 'nuevo'}
                    </Tag>
                  </Space>
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => abrirConversacion(selectedLead)} loading={loadingConversation}>
                    Recargar
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--panel-soft-bg)] p-4">
                {loadingConversation ? (
                  <div className="grid h-full place-items-center">
                    <Spin />
                  </div>
                ) : mensajes.length ? (
                  <div className="space-y-3">
                    {mensajes.map((mensaje) => {
                      const incoming = mensaje.direction === 'incoming';
                      return (
                        <div key={`${mensaje.pk}-${mensaje.sk}`} className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[82%] rounded-md border px-3 py-2 shadow-sm ${
                            incoming
                              ? 'border-[var(--app-border)] bg-[var(--panel-bg)]'
                              : 'border-[var(--action-border)] bg-[var(--action-soft-hover)]'
                          }`}>
                            <Paragraph className="!mb-1 whitespace-pre-wrap">
                              {mensaje.text || 'Evento sin texto'}
                            </Paragraph>
                            {attachmentsOf(mensaje).length > 0 && (
                              <div className="mb-2 space-y-1">
                                {attachmentsOf(mensaje).map((attachment, index) => {
                                  const type = attachment.type || 'archivo';
                                  const icon = type === 'image' || type === 'sticker' ? <PictureOutlined /> : <FileOutlined />;
                                  const label = attachment.filename || attachment.title || attachment.caption || type;
                                  const href = attachment.public_url || attachment.url;
                                  return (
                                    <div key={`${type}-${index}`} className="rounded-md border border-[var(--app-border)] bg-[var(--panel-bg)] px-2 py-1 text-sm">
                                      <Space size={6} wrap>
                                        {icon}
                                        <Text>{label}</Text>
                                        {href && (
                                          <a href={href} target="_blank" rel="noreferrer">
                                            <LinkOutlined /> Abrir
                                          </a>
                                        )}
                                        {attachment.mime_type && <Text type="secondary" className="text-xs">{attachment.mime_type}</Text>}
                                        {attachment.storage_status && <Tag>{attachment.storage_status}</Tag>}
                                      </Space>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <Space size={6} wrap>
                              <Text type="secondary" className="text-xs">{formatDate(mensaje.event_timestamp)}</Text>
                              <Text type="secondary" className="text-xs">{incoming ? 'recibido' : 'enviado'}</Text>
                              {!incoming && mensaje.message_status && (
                                <Tag color={mensajeEstadoColor[mensaje.message_status] || 'orange'}>
                                  {mensaje.message_status}
                                </Tag>
                              )}
                            </Space>
                            {(mensaje.meta_error || mensaje.error_message) && (
                              <Paragraph type="secondary" className="!mb-0 !mt-1 text-xs">
                                {mensaje.meta_error || mensaje.error_message}
                              </Paragraph>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid h-full place-items-center">
                    <Empty description="Sin mensajes" />
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--app-border)] bg-[var(--panel-bg)] p-3">
                <Space direction="vertical" className="w-full">
                  <TextArea
                    rows={isMobile ? 3 : 4}
                    maxLength={4000}
                    showCount
                    value={respuesta}
                    onChange={(event) => setRespuesta(event.target.value)}
                    placeholder={`Responder por ${canalLabel[selectedLead.channel] || 'Meta'}`}
                    onPressEnter={(event) => {
                      if (!event.shiftKey) {
                        event.preventDefault();
                        enviarRespuesta();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Text type="secondary" className="text-xs">Enter envia. Shift + Enter agrega linea.</Text>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={sending}
                      disabled={!respuesta.trim()}
                      onClick={enviarRespuesta}
                    >
                      Enviar mensaje
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply) => (
                      <Button key={reply} size="small" onClick={() => setRespuesta(reply)}>
                        {reply.slice(0, 38)}...
                      </Button>
                    ))}
                  </div>
                </Space>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center">
              <Empty description="Selecciona una conversacion" />
            </div>
          )}
        </Card>

        <Card className="min-h-0 overflow-y-auto" title="Lead">
          {selectedLead ? (
            <Space direction="vertical" size={16} className="w-full">
              <div>
                <Text type="secondary">Responsable</Text>
                <Paragraph strong className="!mb-0">
                  {selectedLead.responsable_nombre || 'Sin asignar'}
                </Paragraph>
              </div>
              <div>
                <Text type="secondary">Inmobiliaria</Text>
                <Paragraph strong className="!mb-0">
                  {selectedLead.inmobiliaria_nombre || 'Sin asignar'}
                </Paragraph>
              </div>
              {selectedLead.estado === 'convertido' ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <Text strong className="text-green-700">Cliente registrado</Text>
                  <Paragraph className="!mb-0 !mt-1 text-sm">
                    Cedula: {selectedLead.cliente_cedula || '-'}
                  </Paragraph>
                  <Space className="mt-2" size={8} wrap>
                    <Button className="p-0" size="small" type="link" onClick={irAHistorialMensajes}>
                      Ver historial de mensajes
                    </Button>
                    <Button size="small" onClick={abrirConversion}>
                      Registrar otra oportunidad
                    </Button>
                  </Space>
                </div>
              ) : (
                <Button block onClick={abrirConversion}>
                  Registrar cliente o bloqueo
                </Button>
              )}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Text strong>Oportunidades registradas</Text>
                  <Tag>{selectedLead.historial_conversiones?.length || 0}</Tag>
                </div>
                {selectedLead.historial_conversiones?.length ? (
                  <div className="space-y-2">
                    {selectedLead.historial_conversiones.map((item, index) => (
                      <div
                        key={`${item.convertido_en || index}-${item.unidad_id || 'sin-unidad'}`}
                        className="rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-3"
                      >
                        <Space direction="vertical" size={2} className="w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <Tag color={item.con_unidad ? 'geekblue' : 'default'}>
                              {item.con_unidad ? 'Bloqueo' : 'Sin unidad'}
                            </Tag>
                            <Text strong>{getProyectoLabel(proyectos, item.proyecto_id)}</Text>
                          </div>
                          <Text className="text-sm">
                            Unidad: {item.unidad_nombre || item.unidad_id || 'Sin unidad'}
                          </Text>
                          <Text type="secondary" className="text-xs">
                            Cliente {item.cedula || '-'} · {getInmobiliariaLabel(inmobiliarias, item.inmobiliaria_id)}
                          </Text>
                          <Text type="secondary" className="text-xs">
                            {formatDate(item.convertido_en)} · {item.usuario_nombre || 'Sistema'}
                          </Text>
                        </Space>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin oportunidades registradas" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-[var(--app-border)] p-2">
                  <Text type="secondary" className="text-xs">Recibidos</Text>
                  <div className="text-lg font-semibold">{toNumber(selectedLead.mensajes_recibidos)}</div>
                </div>
                <div className="rounded-md border border-[var(--app-border)] p-2">
                  <Text type="secondary" className="text-xs">Enviados</Text>
                  <div className="text-lg font-semibold">{toNumber(selectedLead.mensajes_enviados)}</div>
                </div>
              </div>

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
                  <div className="rounded-md border border-[var(--app-border)] bg-gray-50 p-2">
                    <Text type="secondary" className="text-xs">Ultimo motivo de cierre</Text>
                    <div>{selectedLead.motivo_cierre}</div>
                    <Button className="mt-1 p-0" size="small" type="link" onClick={irAHistorialMensajes}>
                      Ver historial de mensajes
                    </Button>
                  </div>
                )}
                <Form.Item label="Responsable" name="responsable_id">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Seleccionar"
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
                    placeholder="Seleccionar"
                    options={inmobiliarias.map((inmobiliaria) => ({
                      value: inmobiliaria.pk,
                      label: inmobiliaria.nombre,
                    }))}
                  />
                </Form.Item>
                <Button block type="primary" loading={savingLead} onClick={guardarGestionRapida}>
                  Guardar cambios
                </Button>
              </Form>

              <div>
                  <Text type="secondary">Actividad reciente</Text>
                <div className="mt-2 space-y-2">
                  {timeline.slice(-6).reverse().map((item) => (
                    <div key={item.id} className="rounded-md border border-[var(--app-border)] p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Space size={6}>
                          <ClockCircleOutlined />
                          <Text strong className="text-sm">{item.titulo}</Text>
                        </Space>
                        <Tag color={timelineColor[item.categoria] || 'default'}>{item.categoria}</Tag>
                      </div>
                      <Paragraph ellipsis={{ rows: 2 }} className="!mb-1 text-sm">
                        {item.detalle || '-'}
                      </Paragraph>
                      <Text type="secondary" className="text-xs">
                        {formatDate(item.fecha)} - {item.usuario_nombre || 'Sistema'}
                      </Text>
                    </div>
                  ))}
                  {!timeline.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin actividad" />}
                </div>
              </div>
            </Space>
          ) : (
            <Empty description="Sin lead seleccionado" />
          )}
        </Card>
      </div>

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
