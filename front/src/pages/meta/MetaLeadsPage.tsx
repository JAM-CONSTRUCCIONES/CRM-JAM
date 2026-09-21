import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
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
  Tabs,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { ClockCircleOutlined, DownloadOutlined, MessageOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
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
import { actualizarTarea, crearTarea, getTareas, type TareaJam } from '../../services/tareas.service';
import type { Proyecto, Unidad } from '../../types';

const { Paragraph, Text, Title } = Typography;
const { Search, TextArea } = Input;
const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;

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

const SIN_ASIGNAR = '__sin_asignar__';

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

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const nextHourKey = () => {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
};

const isTareaVencida = (tarea: TareaJam) => {
  if (!['pendiente', 'en_progreso'].includes(tarea.estado)) return false;
  const date = new Date(`${tarea.fecha}T${tarea.hora}:00`);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
};

const hasAdsOrigin = (lead?: MetaLead | null) => Boolean(
  lead && (
    lead.campaign_id ||
    lead.campaign_name ||
    lead.adset_id ||
    lead.adset_name ||
    lead.ad_id ||
    lead.ad_name ||
    lead.form_id ||
    lead.form_name ||
    lead.referral_source ||
    lead.referral_type ||
    lead.referral_url ||
    lead.ctwa_clid
  ),
);

const adsOriginLabel = (lead: MetaLead) => (
  lead.campaign_name ||
  lead.ad_name ||
  lead.form_name ||
  lead.campaign_id ||
  lead.ad_id ||
  lead.form_id ||
  lead.referral_type ||
  lead.referral_source ||
  'Meta Ads'
);

const conversionesLead = (lead: MetaLead) => {
  const historial = lead.historial_conversiones?.length || 0;
  return historial || (lead.estado === 'convertido' ? 1 : 0);
};

const idWithName = (name?: string, id?: string) => {
  if (name && id) return `${name} (${id})`;
  return name || id || '';
};

const nombreContacto = (lead: MetaLead) =>
  (lead.nombre_manual || '').trim()
  || (lead.contact_profile_name || '').trim()
  || (lead.contact_username ? `@${lead.contact_username}` : '')
  || lead.external_contact_id;

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

type MetaReportRow = {
  key: string;
  nombre: string;
  leads: number;
  ventas: number;
  tasa: number;
};

export default function MetaLeadsPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [canal, setCanal] = useState<string>();
  const [estado, setEstado] = useState<string>();
  const [responsableFiltro, setResponsableFiltro] = useState<string>();
  const [inmobiliariaFiltro, setInmobiliariaFiltro] = useState<string>();
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState<string | null>(null);
  const [fechaHasta, setFechaHasta] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<MetaLead | null>(null);
  const [timeline, setTimeline] = useState<MetaTimelineItem[]>([]);
  const [tareasLead, setTareasLead] = useState<TareaJam[]>([]);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [tareasLoading, setTareasLoading] = useState(false);
  const [tareaOpen, setTareaOpen] = useState(false);
  const [savingTarea, setSavingTarea] = useState(false);
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
  const [tareaForm] = Form.useForm();
  const estadoGestion = Form.useWatch('estado', form);

  const stats = useMemo(() => {
    const totalMensajes = leads.reduce((acc, lead) => acc + toNumber(lead.mensajes_totales), 0);
    const pendientes = leads.filter((lead) => (lead.estado || 'nuevo') === 'nuevo').length;
    const instagram = leads.filter((lead) => lead.channel === 'instagram').length;
    const messenger = leads.filter((lead) => lead.channel === 'messenger').length;
    const whatsapp = leads.filter((lead) => lead.channel === 'whatsapp').length;
    return { totalMensajes, pendientes, instagram, messenger, whatsapp };
  }, [leads]);

  const resumenTareas = useMemo(() => {
    const pendientes = tareasLead.filter((tarea) => ['pendiente', 'en_progreso'].includes(tarea.estado));
    const vencidas = pendientes.filter(isTareaVencida);
    return { pendientes: pendientes.length, vencidas: vencidas.length };
  }, [tareasLead]);

  const leadsFiltrados = useMemo(() => {
    const text = busqueda.trim().toLowerCase();
    return leads.filter((lead) => {
      // Filtro de fecha por primer_mensaje_en o creado_en
      if (fechaDesde || fechaHasta) {
        const fecha = lead.primer_mensaje_en || lead.creado_en || '';
        if (fechaDesde && fecha < fechaDesde) return false;
        if (fechaHasta && fecha > fechaHasta + 'T23:59:59') return false;
      }
      if (!text) return true;
      return [
        lead.external_contact_id,
        lead.nombre_manual,
        lead.contact_profile_name,
        lead.contact_username,
        lead.account_alias,
        lead.ultimo_mensaje_texto,
        lead.responsable_nombre,
        lead.inmobiliaria_nombre,
        lead.fuente,
        lead.campaign_name,
        lead.campaign_id,
        lead.ad_name,
        lead.ad_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [busqueda, leads, fechaDesde, fechaHasta]);

  const reporteMeta = useMemo(() => {
    const buildRows = (getName: (lead: MetaLead) => string) => {
      const groups = new Map<string, MetaReportRow>();
      leadsFiltrados.forEach((lead) => {
        const nombre = getName(lead) || 'Sin dato';
        const key = nombre.toLowerCase();
        const row = groups.get(key) || {
          key,
          nombre,
          leads: 0,
          ventas: 0,
          tasa: 0,
        };
        row.leads += 1;
        row.ventas += conversionesLead(lead);
        row.tasa = row.leads ? (row.ventas / row.leads) * 100 : 0;
        groups.set(key, row);
      });
      return Array.from(groups.values()).sort((a, b) => b.leads - a.leads || b.ventas - a.ventas);
    };

    const leadsCaptados = leadsFiltrados.length;
    const ventasGeneradas = leadsFiltrados.reduce((acc, lead) => acc + conversionesLead(lead), 0);

    return {
      leadsCaptados,
      ventasGeneradas,
      tasaConversion: leadsCaptados ? (ventasGeneradas / leadsCaptados) * 100 : 0,
      porFuente: buildRows((lead) => lead.fuente || canalLabel[lead.channel] || lead.channel || 'Meta'),
      porVendedor: buildRows((lead) => lead.responsable_nombre || 'Sin vendedor'),
      porInmobiliaria: buildRows((lead) => lead.inmobiliaria_nombre || 'Sin inmobiliaria'),
      porCampania: buildRows((lead) => (hasAdsOrigin(lead) ? adsOriginLabel(lead) : 'Sin campania registrada')),
      porEstado: buildRows((lead) => lead.estado || 'nuevo'),
    };
  }, [leadsFiltrados]);

  useEffect(() => {
    cargarLeads();
  }, [canal, estado, responsableFiltro, inmobiliariaFiltro]);

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
      const data = await listarMetaLeads({
        canal,
        estado,
        responsable_id: responsableFiltro,
        inmobiliaria_id: inmobiliariaFiltro,
      });
      setLeads(data.items || []);
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar los leads Meta');
    } finally {
      setLoading(false);
    }
  };

  const cargarTareasLead = async (lead: MetaLead) => {
    setTareasLoading(true);
    try {
      const data = await getTareas({
        relacion_tipo: 'meta_lead',
        relacion_id: lead.pk,
      });
      setTareasLead(data || []);
    } catch (error: any) {
      message.warning(error?.message || 'No se pudieron cargar las tareas del lead');
    } finally {
      setTareasLoading(false);
    }
  };

  const abrirConversacion = async (lead: MetaLead) => {
    setSelectedLead(lead);
    setConversationLoading(true);
    try {
      const data = await getMetaConversacion(lead.pk);
      setSelectedLead(data.lead || lead);
      setTimeline(data.timeline || []);
      await cargarTareasLead(data.lead || lead);
      form.setFieldsValue({
        estado: data.lead?.estado || lead.estado || 'nuevo',
        responsable_id: data.lead?.responsable_id || lead.responsable_id,
        inmobiliaria_id: data.lead?.inmobiliaria_id || lead.inmobiliaria_id,
        motivo_cierre: data.lead?.motivo_cierre || lead.motivo_cierre,
        nota: '',
      });
    } catch (error: any) {
      setTimeline([]);
      setTareasLead([]);
      message.error(error?.message || 'No se pudo cargar la conversacion');
    } finally {
      setConversationLoading(false);
    }
  };

  const abrirNuevaTareaLead = () => {
    if (!selectedLead) return;
    tareaForm.resetFields();
    tareaForm.setFieldsValue({
      titulo: 'Dar seguimiento a lead Meta',
      descripcion: selectedLead.ultimo_mensaje_texto || '',
      trabajador_id: selectedLead.responsable_id?.replace('USUARIO#', '') || undefined,
      fecha: todayKey(),
      hora: nextHourKey(),
      prioridad: 'media',
      recordatorio_minutos_antes: 60,
    });
    setTareaOpen(true);
  };

  const guardarTareaLead = async () => {
    if (!selectedLead) return;
    const values = await tareaForm.validateFields();
    setSavingTarea(true);
    try {
      await crearTarea({
        ...values,
        estado: 'pendiente',
        relacion_tipo: 'meta_lead',
        relacion_id: selectedLead.pk,
        relacion_nombre: `${canalLabel[selectedLead.channel] || selectedLead.channel} - ${selectedLead.external_contact_id}`,
      });
      await gestionarMetaLead(selectedLead.pk, {
        nota: `Tarea creada: ${values.titulo} (${values.fecha} ${values.hora})`,
      });
      message.success('Tarea creada para el lead');
      setTareaOpen(false);
      await abrirConversacion(selectedLead);
      await cargarLeads();
    } catch (error: any) {
      message.error(error?.message || 'No se pudo crear la tarea');
    } finally {
      setSavingTarea(false);
    }
  };

  const completarTareaLead = async (tarea: TareaJam) => {
    if (!selectedLead) return;
    setTareasLoading(true);
    try {
      await actualizarTarea(tarea.tarea_id, { estado: 'completada' });
      await gestionarMetaLead(selectedLead.pk, {
        nota: `Tarea completada: ${tarea.titulo}`,
      });
      message.success('Tarea completada');
      await abrirConversacion(selectedLead);
      await cargarLeads();
    } catch (error: any) {
      message.error(error?.message || 'No se pudo completar la tarea');
    } finally {
      setTareasLoading(false);
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

  const irAMensajes = (leadPk?: string) => {
    if (leadPk) {
      navigate(`/meta-inbox?lead=${encodeURIComponent(leadPk)}`);
    } else {
      navigate('/meta-inbox');
    }
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

  const reportColumns = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      ellipsis: true,
      render: (value: string) => value || <Text type="secondary">Sin dato</Text>,
    },
    {
      title: 'Leads',
      dataIndex: 'leads',
      width: 90,
      align: 'right' as const,
    },
    {
      title: 'Ventas',
      dataIndex: 'ventas',
      width: 90,
      align: 'right' as const,
    },
    {
      title: 'Tasa',
      dataIndex: 'tasa',
      width: 90,
      align: 'right' as const,
      render: (value: number) => formatPercent(value || 0),
    },
  ];

  const columns = [
    {
      title: 'Canal',
      dataIndex: 'channel',
      width: 110,
      render: (value: string) => (
        <Tag color={canalColor[value] || 'default'} bordered={false} style={{ background: 'transparent' }}>
          {canalLabel[value] || value || 'Meta'}
        </Tag>
      ),
    },
    {
      title: 'Contacto',
      dataIndex: 'external_contact_id',
      render: (_: string, lead: MetaLead) => (
        <Space direction="vertical" size={0}>
          <Text strong>{nombreContacto(lead)}</Text>
          {nombreContacto(lead) !== lead.external_contact_id && (
            <Text type="secondary" className="text-xs">{lead.external_contact_id}</Text>
          )}
          <Text type="secondary" className="text-xs">{lead.account_alias}</Text>
        </Space>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 110,
      render: (value: string) => (
        <Tag color={estadoColor[value || 'nuevo'] || 'default'} bordered={false} style={{ background: 'transparent' }}>
          {value || 'nuevo'}
        </Tag>
      ),
    },
    {
      title: 'Responsable',
      dataIndex: 'responsable_nombre',
      width: 180,
      render: (value: string) => value || <Text type="secondary">Sin asignar</Text>,
    },
    {
      title: 'Inmobiliaria',
      dataIndex: 'inmobiliaria_nombre',
      width: 180,
      render: (value: string) => value || <Text type="secondary">Sin asignar</Text>,
    },
    {
      title: 'Origen',
      key: 'origen_meta',
      width: 190,
      render: (_: unknown, lead: MetaLead) => (
        hasAdsOrigin(lead) ? (
          <Space direction="vertical" size={0}>
            <Tag color="purple" bordered={false} style={{ background: 'transparent' }}>Meta Ads</Tag>
            <Text className="text-xs" ellipsis>{adsOriginLabel(lead)}</Text>
          </Space>
        ) : (
          <Text type="secondary">{lead.fuente || 'Meta'}</Text>
        )
      ),
    },
    {
      title: 'Mensajes',
      dataIndex: 'mensajes_totales',
      width: 90,
      align: 'right' as const,
      render: (value: unknown) => toNumber(value),
    },
    {
      title: 'Registrado',
      dataIndex: 'creado_en',
      width: 160,
      render: formatDate,
    },
    {
      title: '',
      key: 'acciones',
      width: 110,
      render: (_: unknown, lead: MetaLead) => (
        <Button type="link" onClick={() => abrirConversacion(lead)}>
          Administrar
        </Button>
      ),
    },
  ];

  const exportarCSV = () => {
    if (!leadsFiltrados.length) {
      message.warning('No hay leads para exportar con los filtros actuales');
      return;
    }
    const headers = [
      'Canal', 'Nombre', 'Numero / ID', 'Cuenta',
      'Estado', 'Motivo cierre',
      'Responsable', 'Inmobiliaria',
      'Fuente', 'Campana', 'Anuncio', 'Formulario',
      'Mensajes', 'Primer mensaje', 'Ultimo mensaje',
      'Cliente cedula', 'Proyecto', 'Fecha conversion',
      'Registrado',
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = leadsFiltrados.map((l) => [
      canalLabel[l.channel] || l.channel,
      nombreContacto(l),
      l.external_contact_id,
      l.account_alias,
      l.estado || 'nuevo',
      l.motivo_cierre || '',
      l.responsable_nombre || '',
      l.inmobiliaria_nombre || '',
      l.fuente || (canalLabel[l.channel] || l.channel),
      l.campaign_name || l.campaign_id || '',
      l.ad_name || l.ad_id || '',
      l.form_name || l.form_id || '',
      String(toNumber(l.mensajes_totales)),
      l.primer_mensaje_en ? new Date(l.primer_mensaje_en).toLocaleString('es-DO') : '',
      l.ultimo_mensaje_en ? new Date(l.ultimo_mensaje_en).toLocaleString('es-DO') : '',
      l.cliente_cedula || '',
      l.proyecto_id || '',
      l.convertido_en ? new Date(l.convertido_en).toLocaleString('es-DO') : '',
      l.creado_en ? new Date(l.creado_en).toLocaleString('es-DO') : '',
    ].map(escape));
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-meta-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`${leadsFiltrados.length} leads exportados`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Title level={2} className="!mb-1">Leads Meta</Title>
          <Text type="secondary">Bandeja de conversaciones y oportunidades creadas desde canales Meta.</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={exportarCSV} disabled={!leadsFiltrados.length}>
            Exportar
          </Button>
          <Button icon={<ReloadOutlined />} onClick={cargarLeads} loading={loading}>
            Actualizar
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Estos son leads preliminares"
        description="Un lead Meta se crea con el identificador externo del contacto. Para convertirlo en cliente formal falta completar datos como cedula, proyecto e inmobiliaria."
      />

      <Tabs
        items={[
          {
            key: 'gestion',
            label: 'Gestion',
            children: (
              <Space direction="vertical" size={16} className="w-full">
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
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="Responsable"
                        className="w-full md:w-64"
                        value={responsableFiltro}
                        onChange={setResponsableFiltro}
                        options={[
                          { value: SIN_ASIGNAR, label: 'Sin responsable' },
                          ...usuarios.map((usuario) => ({
                            value: usuario.pk,
                            label: usuario.nombre || usuario.cognito_username || usuario.pk,
                          })),
                        ]}
                      />
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="Inmobiliaria"
                        className="w-full md:w-64"
                        value={inmobiliariaFiltro}
                        onChange={setInmobiliariaFiltro}
                        options={[
                          { value: SIN_ASIGNAR, label: 'Sin inmobiliaria' },
                          ...inmobiliarias.map((inmobiliaria) => ({
                            value: inmobiliaria.pk,
                            label: inmobiliaria.nombre,
                          })),
                        ]}
                      />
                    </Space>
                    <Space wrap>
                      <Search
                        allowClear
                        placeholder="Buscar contacto, mensaje o responsable"
                        className="w-full lg:w-72"
                        value={busqueda}
                        onChange={(event) => setBusqueda(event.target.value)}
                      />
                      <RangePicker
                        allowClear
                        placeholder={['Desde', 'Hasta']}
                        onChange={(dates) => {
                          setFechaDesde(dates?.[0] ? dates[0].format('YYYY-MM-DD') : null);
                          setFechaHasta(dates?.[1] ? dates[1].format('YYYY-MM-DD') : null);
                        }}
                        presets={[
                          { label: 'Hoy', value: [dayjs(), dayjs()] },
                          { label: 'Esta semana', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
                          { label: 'Este mes', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                          { label: 'Mes pasado', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                          { label: 'Últimos 30 días', value: [dayjs().subtract(30, 'day'), dayjs()] },
                          { label: 'Últimos 90 días', value: [dayjs().subtract(90, 'day'), dayjs()] },
                        ]}
                      />
                    </Space>
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
                    scroll={{ x: 1310 }}
                    locale={{ emptyText: <Empty description="Sin leads Meta registrados" /> }}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'dashboard',
            label: 'Dashboard',
            children: (
              <Space direction="vertical" size={16} className="w-full">
                {/* Filtro de fecha — solo aplica al dashboard */}
                <div className="flex flex-wrap items-center gap-3">
                  <Text strong>Periodo:</Text>
                  <RangePicker
                    allowClear
                    placeholder={['Desde', 'Hasta']}
                    onChange={(dates) => {
                      setFechaDesde(dates?.[0] ? dates[0].format('YYYY-MM-DD') : null);
                      setFechaHasta(dates?.[1] ? dates[1].format('YYYY-MM-DD') : null);
                    }}
                    presets={[
                      { label: 'Hoy', value: [dayjs(), dayjs()] },
                      { label: 'Esta semana', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
                      { label: 'Este mes', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                      { label: 'Mes pasado', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                      { label: 'Últimos 30 días', value: [dayjs().subtract(30, 'day'), dayjs()] },
                      { label: 'Últimos 90 días', value: [dayjs().subtract(90, 'day'), dayjs()] },
                    ]}
                  />
                </div>

                {/* KPIs por canal */}
                <div className="grid gap-3 md:grid-cols-3">
                  <Card>
                    <Statistic title="Instagram" value={leadsFiltrados.filter(l => l.channel === 'instagram').length} />
                  </Card>
                  <Card>
                    <Statistic title="Messenger" value={leadsFiltrados.filter(l => l.channel === 'messenger').length} />
                  </Card>
                  <Card>
                    <Statistic title="WhatsApp" value={leadsFiltrados.filter(l => l.channel === 'whatsapp').length} />
                  </Card>
                </div>

                {/* Charts principales */}
                <div className="grid gap-3 xl:grid-cols-2">
                  <Card title="Leads por fuente" size="small">
                    {reporteMeta.porFuente.length ? (
                      <ResponsiveContainer width="100%" height={Math.max(120, reporteMeta.porFuente.length * 32)}>
                        <BarChart data={reporteMeta.porFuente} layout="vertical" margin={{ left: 8, right: 32 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--app-border, #e5e7eb)" />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={130} />
                          <RTooltip />
                          <Bar dataKey="leads" name="Leads" fill="#1677ff" radius={[0, 4, 4, 0]} maxBarSize={22} />
                          <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" />}
                  </Card>

                  <Card title="Leads por vendedor" size="small">
                    {reporteMeta.porVendedor.length ? (
                      <ResponsiveContainer width="100%" height={Math.max(120, reporteMeta.porVendedor.length * 32)}>
                        <BarChart data={reporteMeta.porVendedor} layout="vertical" margin={{ left: 8, right: 32 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--app-border, #e5e7eb)" />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={130} />
                          <RTooltip />
                          <Bar dataKey="leads" name="Leads" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={22} />
                          <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" />}
                  </Card>

                  <Card title="Leads por inmobiliaria" size="small">
                    {reporteMeta.porInmobiliaria.length ? (
                      <ResponsiveContainer width="100%" height={Math.max(120, reporteMeta.porInmobiliaria.length * 32)}>
                        <BarChart data={reporteMeta.porInmobiliaria} layout="vertical" margin={{ left: 8, right: 32 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--app-border, #e5e7eb)" />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={130} />
                          <RTooltip />
                          <Bar dataKey="leads" name="Leads" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={22} />
                          <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" />}
                  </Card>

                  <Card title="Leads por estado" size="small">
                    {reporteMeta.porEstado.length ? (
                      <ResponsiveContainer width="100%" height={Math.max(120, reporteMeta.porEstado.length * 32)}>
                        <BarChart data={reporteMeta.porEstado} layout="vertical" margin={{ left: 8, right: 32 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--app-border, #e5e7eb)" />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={130} />
                          <RTooltip />
                          <Bar dataKey="leads" name="Leads" radius={[0, 4, 4, 0]} maxBarSize={22}>
                            {reporteMeta.porEstado.map((entry, index) => {
                              const colors: Record<string, string> = { nuevo: '#1677ff', en_seguimiento: '#f59e0b', convertido: '#22c55e', cerrado: '#9ca3af' };
                              return <Cell key={index} fill={colors[entry.nombre] || '#64748b'} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" />}
                  </Card>
                </div>

                {/* Tablas de detalle */}
                <div className="grid gap-3 xl:grid-cols-2">
                  <Card title="Detalle por fuente" size="small">
                    <Table<MetaReportRow>
                      size="small"
                      rowKey="key"
                      dataSource={reporteMeta.porFuente}
                      columns={reportColumns}
                      pagination={false}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" /> }}
                    />
                  </Card>
                  <Card title="Detalle por vendedor" size="small">
                    <Table<MetaReportRow>
                      size="small"
                      rowKey="key"
                      dataSource={reporteMeta.porVendedor}
                      columns={reportColumns}
                      pagination={false}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" /> }}
                    />
                  </Card>
                  <Card title="Detalle por inmobiliaria" size="small">
                    <Table<MetaReportRow>
                      size="small"
                      rowKey="key"
                      dataSource={reporteMeta.porInmobiliaria}
                      columns={reportColumns}
                      pagination={false}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" /> }}
                    />
                  </Card>
                  <Card title="Resultados por campania" size="small">
                    <Table<MetaReportRow>
                      size="small"
                      rowKey="key"
                      dataSource={reporteMeta.porCampania}
                      columns={reportColumns}
                      pagination={false}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" /> }}
                    />
                  </Card>
                </div>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={selectedLead ? (
          <Space direction="vertical" size={0}>
            <Space>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--action-soft-hover)] text-xs font-semibold text-[var(--action-bg)]">
                {canalInitial[selectedLead.channel] || 'MT'}
              </span>
              <span>Conversacion Meta</span>
              <Tag color={canalColor[selectedLead.channel] || 'default'} bordered={false} style={{ background: 'transparent' }}>
                {canalLabel[selectedLead.channel] || selectedLead.channel}
              </Tag>
            </Space>
            <Text type="secondary" className="text-xs">{nombreContacto(selectedLead)}</Text>
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
          setTareasLead([]);
          setTareaOpen(false);
          form.resetFields();
          tareaForm.resetFields();
        }}
        width={isMobile ? '100%' : 720}
      >
        {selectedLead && (
          <Space direction="vertical" size={16} className="w-full">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Canal">
                <Tag color={canalColor[selectedLead.channel] || 'default'} bordered={false} style={{ background: 'transparent' }}>
                  {canalLabel[selectedLead.channel] || selectedLead.channel}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Contacto">
                <Space direction="vertical" size={0}>
                  <Text>{nombreContacto(selectedLead)}</Text>
                  {nombreContacto(selectedLead) !== selectedLead.external_contact_id && (
                    <Text type="secondary" className="text-xs">{selectedLead.external_contact_id}</Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={estadoColor[selectedLead.estado || 'nuevo'] || 'default'} bordered={false} style={{ background: 'transparent' }}>
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
                  <Button size="small" icon={<MessageOutlined />} onClick={() => irAMensajes(selectedLead?.pk)}>
                    Ver mensajes
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {hasAdsOrigin(selectedLead) && (
              <Card size="small" title="Origen publicitario">
                <Descriptions column={1} size="small" bordered>
                  {(selectedLead.campaign_name || selectedLead.campaign_id) && (
                    <Descriptions.Item label="Campania">
                      {idWithName(selectedLead.campaign_name, selectedLead.campaign_id)}
                    </Descriptions.Item>
                  )}
                  {(selectedLead.adset_name || selectedLead.adset_id) && (
                    <Descriptions.Item label="Conjunto">
                      {idWithName(selectedLead.adset_name, selectedLead.adset_id)}
                    </Descriptions.Item>
                  )}
                  {(selectedLead.ad_name || selectedLead.ad_id) && (
                    <Descriptions.Item label="Anuncio">
                      {idWithName(selectedLead.ad_name, selectedLead.ad_id)}
                    </Descriptions.Item>
                  )}
                  {(selectedLead.form_name || selectedLead.form_id) && (
                    <Descriptions.Item label="Formulario">
                      {idWithName(selectedLead.form_name, selectedLead.form_id)}
                    </Descriptions.Item>
                  )}
                  {(selectedLead.referral_source || selectedLead.referral_type) && (
                    <Descriptions.Item label="Referral">
                      <Space direction="vertical" size={0}>
                        {selectedLead.referral_type && <Text>{selectedLead.referral_type}</Text>}
                        {selectedLead.referral_source && <Text type="secondary">{selectedLead.referral_source}</Text>}
                      </Space>
                    </Descriptions.Item>
                  )}
                  {selectedLead.referral_url && (
                    <Descriptions.Item label="URL">
                      <a href={selectedLead.referral_url} target="_blank" rel="noreferrer">
                        {selectedLead.referral_url}
                      </a>
                    </Descriptions.Item>
                  )}
                  {selectedLead.ctwa_clid && (
                    <Descriptions.Item label="CTWA CLID">{selectedLead.ctwa_clid}</Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            <Card
              size="small"
              title={
                <Space>
                  <span>Tareas y recordatorios</span>
                  <Tag color={resumenTareas.vencidas ? 'red' : resumenTareas.pendientes ? 'gold' : 'default'}>
                    {resumenTareas.vencidas ? `${resumenTareas.vencidas} vencida(s)` : `${resumenTareas.pendientes} pendiente(s)`}
                  </Tag>
                </Space>
              }
              extra={
                <Space wrap>
                  <Button size="small" onClick={() => selectedLead && cargarTareasLead(selectedLead)} loading={tareasLoading}>
                    Actualizar
                  </Button>
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={abrirNuevaTareaLead}>
                    Crear tarea
                  </Button>
                </Space>
              }
            >
              {tareasLead.length ? (
                <Table
                  size="small"
                  pagination={false}
                  loading={tareasLoading}
                  rowKey="tarea_id"
                  dataSource={tareasLead}
                  columns={[
                    {
                      title: 'Tarea',
                      render: (_, tarea) => (
                        <Space direction="vertical" size={0}>
                          <Text strong>{tarea.titulo}</Text>
                          {tarea.descripcion && <Text type="secondary" className="text-xs">{tarea.descripcion}</Text>}
                        </Space>
                      ),
                    },
                    {
                      title: 'Responsable',
                      dataIndex: 'trabajador_nombre',
                      width: 160,
                    },
                    {
                      title: 'Vence',
                      width: 150,
                      render: (_, tarea) => (
                        <Space direction="vertical" size={0}>
                          <Text>{`${tarea.fecha} ${tarea.hora}`}</Text>
                          {isTareaVencida(tarea) && <Tag color="red">Vencida</Tag>}
                        </Space>
                      ),
                    },
                    {
                      title: 'Estado',
                      dataIndex: 'estado',
                      width: 120,
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    {
                      title: '',
                      width: 120,
                      render: (_, tarea) => (
                        <Button
                          size="small"
                          type={tarea.estado === 'completada' ? 'default' : 'primary'}
                          disabled={tarea.estado === 'completada' || tarea.estado === 'cancelada'}
                          onClick={() => completarTareaLead(tarea)}
                        >
                          Lista
                        </Button>
                      ),
                    },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin tareas de seguimiento" />
              )}
            </Card>

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
                  <Button icon={<MessageOutlined />} onClick={() => irAMensajes(selectedLead?.pk)}>
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
        title="Crear tarea de seguimiento"
        open={tareaOpen}
        onCancel={() => setTareaOpen(false)}
        onOk={guardarTareaLead}
        okText="Crear tarea"
        cancelText="Cancelar"
        confirmLoading={savingTarea}
        width={640}
      >
        <Form form={tareaForm} layout="vertical">
          <Form.Item
            name="titulo"
            label="Titulo"
            rules={[{ required: true, message: 'Ingresa el titulo de la tarea' }]}
          >
            <Input placeholder="Ej: Dar seguimiento a lead Meta" />
          </Form.Item>
          <Form.Item
            name="trabajador_id"
            label="Responsable"
            rules={[{ required: true, message: 'Selecciona un responsable' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Seleccionar usuario"
              options={usuarios.map((usuario) => ({
                value: usuario.pk.replace('USUARIO#', ''),
                label: `${usuario.nombre || usuario.cognito_username} (${usuario.rol})`,
              }))}
            />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item
              name="fecha"
              label="Fecha"
              rules={[{ required: true, message: 'Selecciona fecha' }]}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item
              name="hora"
              label="Hora"
              rules={[{ required: true, message: 'Selecciona hora' }]}
            >
              <Input type="time" />
            </Form.Item>
            <Form.Item name="prioridad" label="Prioridad">
              <Select
                options={[
                  { value: 'baja', label: 'Baja' },
                  { value: 'media', label: 'Media' },
                  { value: 'alta', label: 'Alta' },
                ]}
              />
            </Form.Item>
            <Form.Item name="recordatorio_minutos_antes" label="Recordatorio">
              <Select
                allowClear
                placeholder="Sin recordatorio"
                options={[
                  { value: 30, label: '30 minutos antes' },
                  { value: 60, label: '1 hora antes' },
                  { value: 1440, label: '1 dia antes' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="descripcion" label="Descripcion">
            <TextArea rows={3} maxLength={500} showCount placeholder="Detalle para el seguimiento" />
          </Form.Item>
        </Form>
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
