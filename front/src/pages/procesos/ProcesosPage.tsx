import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Tag, Button, Space, Select, message,
  Badge, Tooltip, Grid, Input, Dropdown, Tabs, Modal, Form, InputNumber,
  Radio, Divider, DatePicker, Spin, Table,
} from 'antd';
import {
  ReloadOutlined, SwapOutlined, HistoryOutlined,
  SearchOutlined, MoreOutlined, UserOutlined, LockOutlined,
  FieldTimeOutlined, UserAddOutlined, ClockCircleOutlined, UnlockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { listarTodosProcesos, cambiarEstatus, getMisProcesos, type ProcesoEnriquecido } from '../../services/crm.service';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import { extenderBloqueo, getBloquesActivos, bloquearUnidad, liberarBloqueo, getHistorialBloqueos } from '../../services/bloqueos.service';
import { getClientesAdmin } from '../../services/clientes.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Proyecto, Proceso, Bloqueo, Cliente, HistorialBloqueo } from '../../types';
import CambiarEstatusModal, { type ModoNotificacion } from '../../components/common/CambiarEstatusModal';
import HistorialEstatusDrawer from '../../components/common/HistorialEstatusDrawer';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL, ESTADO_PROCESO_DESCRIPCION } from '../../constants/estados';
import { useAuthContext } from '../../context/AuthContext';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const ESTADOS_ACTIVOS = ['captacion', 'reserva', 'separacion', 'inicial'];

const formatTiempo = (seg: number) => {
  if (seg <= 0) return 'Vencido';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return `${h}h ${m}m`;
};

const ProcesosPage = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { usuario } = useAuthContext();
  const esInmobiliaria = usuario?.rol === 'inmobiliaria';

  // ── Procesos ──────────────────────────────────────────────────────────────
  const [procesos, setProcesos] = useState<ProcesoEnriquecido[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [inmoFiltro, setInmoFiltro] = useState<string | undefined>();
  const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>();
  const [busqueda, setBusqueda] = useState('');
  const [tabActiva, setTabActiva] = useState<'activos' | 'cerrados'>('activos');

  // ── Modales procesos ──────────────────────────────────────────────────────
  const [estatusModal, setEstatusModal] = useState<ProcesoEnriquecido | null>(null);
  const [historialProceso, setHistorialProceso] = useState<Proceso | null>(null);
  const [historialNombre, setHistorialNombre] = useState('');
  const [extenderProcesoModal, setExtenderProcesoModal] = useState<ProcesoEnriquecido | null>(null);
  const [formExtenderProceso] = Form.useForm();
  const [guardandoExtenderProceso, setGuardandoExtenderProceso] = useState(false);

  // ── Bloqueos sin cliente ──────────────────────────────────────────────────
  const [bloqueosSinCliente, setBloqueosSinCliente] = useState<Bloqueo[]>([]);
  const [loadingBloqueos, setLoadingBloqueos] = useState(false);

  // Modal extender bloqueo sin cliente
  const [extenderBloqueoModal, setExtenderBloqueoModal] = useState<Bloqueo | null>(null);
  const [formExtenderBloqueo] = Form.useForm();
  const [guardandoExtenderBloqueo, setGuardandoExtenderBloqueo] = useState(false);

  // Modal asignar cliente a bloqueo
  const [asignarModal, setAsignarModal] = useState<Bloqueo | null>(null);
  const [formAsignar] = Form.useForm();
  const [guardandoAsignar, setGuardandoAsignar] = useState(false);
  const [modoAsignar, setModoAsignar] = useState<'existente' | 'nuevo'>('existente');
  const [clientesInmo, setClientesInmo] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Historial de bloqueos
  const [historialBloqueos, setHistorialBloqueos] = useState<HistorialBloqueo[]>([]);
  const [historialBloqueoNextToken, setHistorialBloqueoNextToken] = useState<string | undefined>();
  const [loadingHistorialBloqueos, setLoadingHistorialBloqueos] = useState(false);

  // ── Carga de datos ────────────────────────────────────────────────────────
  const cargar = useCallback(async (opts: {
    token?: string;
    tab?: 'activos' | 'cerrados';
    proyecto?: string;
    inmo?: string;
    estado?: string;
  } = {}) => {
    const tab = opts.tab ?? tabActiva;
    // Usar el valor de opts si se pasó explícitamente (undefined !== no pasado)
    const proyectoId = 'proyecto' in opts ? opts.proyecto : proyectoFiltro;
    const inmoId = 'inmo' in opts ? opts.inmo : inmoFiltro;
    const estadoId = 'estado' in opts ? opts.estado : estadoFiltro;
    setLoading(true);
    try {
      if (esInmobiliaria) {
        const items = await getMisProcesos(proyectoId);
        setProcesos(items as ProcesoEnriquecido[]);
        setNextToken(undefined);
      } else {
        const data = await listarTodosProcesos({
          proyecto_id: proyectoId,
          inmobiliaria_id: inmoId,
          estado: estadoId,
          // Si hay filtro de estado específico, incluir todos para que el backend filtre exacto
          incluir_cerrados: tab === 'cerrados' || !!estadoId,
          next_token: opts.token,
        });
        setProcesos(prev => opts.token ? [...prev, ...data.items] : data.items);
        setNextToken(data.next_token);
      }
    } catch {
      message.error('Error al cargar procesos');
    } finally {
      setLoading(false);
    }
  }, [tabActiva, proyectoFiltro, inmoFiltro, estadoFiltro, esInmobiliaria]);

  const cargarBloqueosSinCliente = useCallback(async () => {
    if (esInmobiliaria) return;
    setLoadingBloqueos(true);
    try {
      const data = await getBloquesActivos();
      const ahora = Date.now();
      setBloqueosSinCliente(
        data.items
          .filter(b => !b.cliente_cedula)
          .map(b => ({
            ...b,
            // Siempre recalcular desde fecha_liberacion — el campo tiempo_restante
            // del backend puede estar desactualizado (calculado al momento del bloqueo)
            tiempo_restante: Math.max(0, Math.floor(
              (new Date(b.fecha_liberacion).getTime() - ahora) / 1000
            )),
          }))
      );
    } catch { /* silencioso */ }
    finally { setLoadingBloqueos(false); }
  }, [esInmobiliaria]);

  useEffect(() => {
    getProyectos().then(setProyectos).catch(() => {});
    if (!esInmobiliaria) getInmobiliarias().then(setInmobiliarias).catch(() => {});
    cargar();
    cargarBloqueosSinCliente();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const proyectoNombre = (id: string) =>
    proyectos.find(p => p.proyecto_id === id?.replace('PROYECTO#', ''))?.nombre ?? id;

  const inmoNombre = (id: string) => {
    const norm = id?.replace('INMOBILIARIA#', '');
    return inmobiliarias.find(i =>
      i.pk === id || i.pk === `INMOBILIARIA#${norm}` || i.pk.replace('INMOBILIARIA#', '') === norm
    )?.nombre ?? id;
  };

  const nombreCliente = (p: ProcesoEnriquecido) =>
    p.cliente?.nombres ? `${p.cliente.nombres} ${p.cliente.apellidos}` : p.cedula;

  // ── Handlers procesos ─────────────────────────────────────────────────────
  const handleCambiarEstatus = async (estatus: string, notificar: ModoNotificacion) => {
    if (!estatusModal) return;
    try {
      await cambiarEstatus(
        estatusModal.cedula, estatusModal.proyecto_id, estatusModal.unidad_id,
        { estatus, inmobiliaria_id: estatusModal.inmobiliaria_id, notificar }
      );
      message.success(`Estatus actualizado a ${ESTADO_PROCESO_LABEL[estatus] ?? estatus}`);
      setEstatusModal(null);
      cargar();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message;
      message.error(msg || 'Error al cambiar estatus');
      throw err;
    }
  };

  const handleExtenderProceso = async (values: { horas_restantes: number; justificacion: string }) => {
    if (!extenderProcesoModal) return;
    setGuardandoExtenderProceso(true);
    try {
      await extenderBloqueo(extenderProcesoModal.unidad_id, extenderProcesoModal.proyecto_id, {
        horas_extra: values.horas_restantes,
        justificacion: values.justificacion,
      });
      message.success('Tiempo de bloqueo actualizado');
      setExtenderProcesoModal(null);
      formExtenderProceso.resetFields();
      cargar();
    } catch { message.error('Error al extender el bloqueo'); }
    finally { setGuardandoExtenderProceso(false); }
  };

  // ── Handlers bloqueos sin cliente ─────────────────────────────────────────
  const handleExtenderBloqueo = async (values: { horas_restantes: number; justificacion: string }) => {
    if (!extenderBloqueoModal) return;
    setGuardandoExtenderBloqueo(true);
    try {
      await extenderBloqueo(extenderBloqueoModal.unidad_id, extenderBloqueoModal.proyecto_id, {
        horas_extra: values.horas_restantes,
        justificacion: values.justificacion,
      });
      message.success('Tiempo de bloqueo actualizado');
      setExtenderBloqueoModal(null);
      formExtenderBloqueo.resetFields();
      cargarBloqueosSinCliente();
    } catch { message.error('Error al extender el bloqueo'); }
    finally { setGuardandoExtenderBloqueo(false); }
  };

  const abrirAsignarCliente = async (b: Bloqueo) => {
    setAsignarModal(b);
    formAsignar.resetFields();
    setModoAsignar('existente');
    setClienteSeleccionado(null);
    setLoadingClientes(true);
    try {
      const data = await getClientesAdmin({ inmobiliaria_id: b.bloqueado_por });
      const items = Array.isArray(data) ? data : (data as any).items ?? [];
      const vistos = new Set<string>();
      setClientesInmo(items.filter((c: Cliente) => {
        if (vistos.has(c.cedula)) return false;
        vistos.add(c.cedula);
        return true;
      }));
    } catch { setClientesInmo([]); }
    finally { setLoadingClientes(false); }
  };

  const handleSeleccionarCliente = (cedula: string) => {
    const c = clientesInmo.find(x => x.cedula === cedula) ?? null;
    setClienteSeleccionado(c);
    if (c) {
      formAsignar.setFieldsValue({
        cedula: c.cedula, nombres: c.nombres, apellidos: c.apellidos,
        correo: c.correo, telefono: c.telefono,
        fecha_nacimiento: c.fecha_nacimiento ? dayjs(c.fecha_nacimiento) : undefined,
        estado_civil: c.estado_civil, nacionalidad: c.nacionalidad,
        pais_residencia: c.pais_residencia,
      });
    }
  };

  const handleAsignarCliente = async (values: any) => {
    if (!asignarModal) return;
    const payload = modoAsignar === 'existente' && clienteSeleccionado
      ? {
          cedula: clienteSeleccionado.cedula,
          nombres: clienteSeleccionado.nombres,
          apellidos: clienteSeleccionado.apellidos,
          correo: clienteSeleccionado.correo,
          telefono: clienteSeleccionado.telefono,
          fecha_nacimiento: clienteSeleccionado.fecha_nacimiento,
          estado_civil: clienteSeleccionado.estado_civil,
          nacionalidad: clienteSeleccionado.nacionalidad,
          pais_residencia: clienteSeleccionado.pais_residencia,
        }
      : {
          ...values,
          fecha_nacimiento: values.fecha_nacimiento
            ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD')
            : undefined,
        };

    if (!payload.cedula) { message.warning('Selecciona un cliente de la lista'); return; }

    setGuardandoAsignar(true);
    try {
      await bloquearUnidad({
        proyecto_id: asignarModal.proyecto_id,
        unidad_id: asignarModal.unidad_id,
        ...payload,
      });
      message.success('Cliente asignado al bloqueo');
      setAsignarModal(null);
      setClienteSeleccionado(null);
      cargarBloqueosSinCliente();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.response?.statusCode;
      const msg = err?.response?.data?.message || err?.message;
      if (status === 409) message.error(msg || 'Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto');
      else message.error(msg || 'Error al asignar cliente');
    } finally { setGuardandoAsignar(false); }
  };

  const handleLiberar = async (b: Bloqueo) => {
    try {
      await liberarBloqueo(b.unidad_id, b.proyecto_id);
      message.success('Bloqueo liberado');
      cargarBloqueosSinCliente();
      cargar(); // refrescar procesos también
    } catch {
      message.error('Error al liberar bloqueo');
    }
  };

  const cargarHistorialBloqueos = useCallback(async (nextToken?: string) => {
    setLoadingHistorialBloqueos(true);
    try {
      const data = await getHistorialBloqueos(undefined, nextToken);
      const sorted = [...data.items].sort((a, b) =>
        (b.fecha_bloqueo ?? '').localeCompare(a.fecha_bloqueo ?? '')
      );
      setHistorialBloqueos(prev => nextToken ? [...prev, ...sorted] : sorted);
      setHistorialBloqueoNextToken(data.next_token);
    } catch {
      message.error('Error al cargar historial de bloqueos');
    } finally {
      setLoadingHistorialBloqueos(false);
    }
  }, []);

  const limpiarFiltros = () => {
    setProyectoFiltro(undefined);
    setInmoFiltro(undefined);
    setEstadoFiltro(undefined);
    setBusqueda('');
    setNextToken(undefined);
    setTabActiva('activos');
    cargar({ proyecto: undefined, inmo: undefined, estado: undefined, tab: 'activos' });
  };

  // ── Filtrado local ────────────────────────────────────────────────────────
  const procesosVisibles = busqueda.trim()
    ? procesos.filter(p => {
        const nombre = nombreCliente(p).toLowerCase();
        const q = busqueda.toLowerCase();
        return nombre.includes(q) || p.cedula.includes(q) || (p.unidad_nombre ?? '').toLowerCase().includes(q);
      })
    : procesos;

  const procesosActivos = procesosVisibles.filter(p =>
    estadoFiltro ? p.estado === estadoFiltro : ESTADOS_ACTIVOS.includes(p.estado)
  );
  const procesosCerrados = procesosVisibles.filter(p =>
    estadoFiltro ? p.estado === estadoFiltro : !ESTADOS_ACTIVOS.includes(p.estado)
  );

  // Bloqueos sin cliente filtrados por búsqueda/proyecto
  // Solo mostrar cuando NO hay filtro de estado activo
  const bloqueosFiltrados = estadoFiltro ? [] : bloqueosSinCliente.filter(b => {
    if (proyectoFiltro && b.proyecto_id?.replace('PROYECTO#', '') !== proyectoFiltro) return false;
    if (inmoFiltro) {
      const norm = inmoFiltro.replace('INMOBILIARIA#', '');
      if (b.bloqueado_por !== norm && b.bloqueado_por !== inmoFiltro) return false;
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (b.id_unidad || b.unidad_id).toLowerCase().includes(q);
    }
    return true;
  });

  // ── Render helpers ────────────────────────────────────────────────────────
  const alertaInfo = (p: ProcesoEnriquecido) => {
    const vencida = p.alerta_separacion_vencida && p.estado === 'separacion' && !p.pago_confirmado;
    const dias = p.fecha_separacion
      ? Math.floor((Date.now() - new Date(p.fecha_separacion).getTime()) / 86400000)
      : null;
    const proxima = !vencida && p.estado === 'separacion' && dias !== null && dias >= 25;
    return { vencida, proxima, dias };
  };

  const renderTagUnidad = (p: ProcesoEnriquecido) => {
    if (p.estado_unidad !== 'bloqueada') return null;
    const vence = p.fecha_liberacion_unidad ? dayjs(p.fecha_liberacion_unidad).format('DD/MM HH:mm') : null;
    return (
      <Tooltip title={vence ? `Bloqueo vence: ${vence}` : 'Unidad bloqueada'}>
        <Tag icon={<LockOutlined />} color="warning" style={{ margin: 0 }}>Bloqueada</Tag>
      </Tooltip>
    );
  };

  const renderTarjetaProceso = (p: ProcesoEnriquecido) => {
    const { vencida, proxima, dias } = alertaInfo(p);
    const puedeAvanzar = !esInmobiliaria && p.estado !== 'vendida' && p.estado !== 'desvinculado';
    const esBloqueada = p.estado_unidad === 'bloqueada';
    const menuItems = [
      ...(puedeAvanzar ? [{ key: 'estatus', icon: <SwapOutlined />, label: 'Cambiar estatus', onClick: () => setEstatusModal(p) }] : []),
      { key: 'historial', icon: <HistoryOutlined />, label: 'Ver historial', onClick: () => { setHistorialProceso(p); setHistorialNombre(nombreCliente(p)); } },
      ...(esBloqueada && !esInmobiliaria ? [
        { key: 'extender', icon: <FieldTimeOutlined />, label: 'Extender bloqueo', onClick: () => { setExtenderProcesoModal(p); formExtenderProceso.resetFields(); } },
        {
          key: 'liberar', icon: <UnlockOutlined />, label: 'Liberar bloqueo', danger: true,
          onClick: () => Modal.confirm({
            title: '¿Liberar el bloqueo de esta unidad?',
            content: 'La unidad volverá a estar disponible. El proceso de venta continuará.',
            okText: 'Liberar', cancelText: 'Cancelar', okButtonProps: { danger: true },
            onOk: () => handleLiberar({ unidad_id: p.unidad_id, proyecto_id: p.proyecto_id } as Bloqueo),
          }),
        },
      ] : []),
    ];
    return (
      <div key={`${p.pk}#${p.sk}`} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 10, padding: '14px 16px' }}>
        {vencida && (
          <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#cf1322', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ flex: 1 }}>Separación vencida (30 días)</span>
            {puedeAvanzar && <Button size="small" type="link" danger style={{ padding: 0, height: 'auto', fontSize: 11 }} onClick={() => setEstatusModal(p)}>Cambiar estatus</Button>}
          </div>
        )}
        {proxima && (
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#d46b08', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>⏰</span>
            <span>Vence en {30 - dias!} día{30 - dias! !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <Text strong style={{ fontSize: 14 }}>{nombreCliente(p)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{p.cedula}</Text>
            </div>
            <Space size={4} wrap>
              <Tag color="geekblue" style={{ margin: 0 }}>{p.unidad_nombre || p.unidad_id}</Tag>
              <Tooltip title={ESTADO_PROCESO_DESCRIPCION[p.estado] || p.estado}>
                <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
              </Tooltip>
              {renderTagUnidad(p)}
            </Space>
            <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{proyectoNombre(p.proyecto_id)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{inmoNombre(p.inmobiliaria_id)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>Desde {dayjs(p.fecha_inicio).format('DD/MM/YYYY')}</Text>
            </div>
          </div>
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>
    );
  };

  const renderFilaProceso = (p: ProcesoEnriquecido) => {
    const { vencida, proxima } = alertaInfo(p);
    const puedeAvanzar = !esInmobiliaria && p.estado !== 'vendida' && p.estado !== 'desvinculado';
    const esBloqueada = p.estado_unidad === 'bloqueada';
    return (
      <div key={`${p.pk}#${p.sk}`} style={{
        display: 'grid',
        gridTemplateColumns: esInmobiliaria ? '2fr 1.2fr 1.6fr 1.2fr 80px' : '2fr 1.2fr 1.6fr 1.2fr 1.2fr 80px',
        alignItems: 'center', padding: '12px 14px', background: '#fff', borderRadius: 8, marginBottom: 4,
        borderTop: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0',
        borderLeft: vencida ? '3px solid #ff4d4f' : proxima ? '3px solid #faad14' : '1px solid #f0f0f0',
      }}>
        <div>
          <Text strong style={{ fontSize: 13 }}>{nombreCliente(p)}</Text>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>{p.cedula}</Text>
        </div>
        <Tag color="geekblue" style={{ margin: 0 }}>{p.unidad_nombre || p.unidad_id}</Tag>
        <Badge status={vencida ? 'error' : proxima ? 'warning' : 'default'} text={
          <Space size={4}>
            <Tooltip title={ESTADO_PROCESO_DESCRIPCION[p.estado] || p.estado}>
              <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
            </Tooltip>
            {renderTagUnidad(p)}
            {vencida && <Tooltip title="Separación vencida (30 días sin pago)"><span style={{ fontSize: 12, color: '#cf1322' }}>⚠️</span></Tooltip>}
            {proxima && <Tooltip title="Próximo a vencer"><span style={{ fontSize: 12, color: '#d46b08' }}>⏰</span></Tooltip>}
          </Space>
        } />
        <Text style={{ fontSize: 12 }}>{proyectoNombre(p.proyecto_id)}</Text>
        {!esInmobiliaria && <Text style={{ fontSize: 12 }}>{inmoNombre(p.inmobiliaria_id)}</Text>}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {puedeAvanzar && <Tooltip title="Cambiar estatus"><Button size="small" icon={<SwapOutlined />} onClick={() => setEstatusModal(p)} /></Tooltip>}
          {esBloqueada && !esInmobiliaria && <Tooltip title="Extender bloqueo"><Button size="small" icon={<FieldTimeOutlined />} onClick={() => { setExtenderProcesoModal(p); formExtenderProceso.resetFields(); }} /></Tooltip>}
          {esBloqueada && !esInmobiliaria && (
            <Tooltip title="Liberar bloqueo">
              <Button size="small" danger icon={<UnlockOutlined />} onClick={() => Modal.confirm({
                title: '¿Liberar el bloqueo?', content: 'La unidad volverá a estar disponible.',
                okText: 'Liberar', cancelText: 'Cancelar', okButtonProps: { danger: true },
                onOk: () => handleLiberar({ unidad_id: p.unidad_id, proyecto_id: p.proyecto_id } as Bloqueo),
              })} />
            </Tooltip>
          )}
          <Tooltip title="Historial"><Button size="small" icon={<HistoryOutlined />} onClick={() => { setHistorialProceso(p); setHistorialNombre(nombreCliente(p)); }} /></Tooltip>
        </div>
      </div>
    );
  };

  // Fila de bloqueo sin cliente — mismo estilo que proceso
  const renderFilaBloqueo = (b: Bloqueo) => {
    const tiempoOk = b.tiempo_restante ?? 0;
    const colorTiempo = tiempoOk <= 0 ? '#ff4d4f' : tiempoOk < 5 * 3600 ? '#faad14' : '#52c41a';
    const menuItems = [
      { key: 'asignar', icon: <UserAddOutlined />, label: 'Asignar cliente', onClick: () => abrirAsignarCliente(b) },
      { key: 'extender', icon: <FieldTimeOutlined />, label: 'Extender bloqueo', onClick: () => { setExtenderBloqueoModal(b); formExtenderBloqueo.resetFields(); } },
      {
        key: 'liberar', icon: <UnlockOutlined />, label: 'Liberar', danger: true,
        onClick: () => Modal.confirm({
          title: '¿Liberar este bloqueo?',
          content: 'La unidad volverá a estar disponible.',
          okText: 'Liberar', cancelText: 'Cancelar', okButtonProps: { danger: true },
          onOk: () => handleLiberar(b),
        }),
      },
    ];
    if (isMobile) {
      return (
        <div key={b.unidad_id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <Text strong style={{ fontSize: 14 }}>Sin cliente asignado</Text>
                <Tag color="orange" style={{ margin: 0 }}>Sin cliente</Tag>
              </div>
              <Space size={4} wrap>
                <Tag color="geekblue" style={{ margin: 0 }}>{b.id_unidad || b.unidad_id}</Tag>
                <Tag icon={<LockOutlined />} color="warning" style={{ margin: 0 }}>Bloqueada</Tag>
                <Text style={{ fontSize: 12, color: colorTiempo, fontWeight: 600 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />{formatTiempo(tiempoOk)}
                </Text>
              </Space>
              <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{proyectoNombre(b.proyecto_id)}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{inmoNombre(b.bloqueado_por)}</Text>
              </div>
            </div>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </div>
        </div>
      );
    }
    return (
      <div key={b.unidad_id} style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1.6fr 1.2fr 1.2fr 80px',
        alignItems: 'center', padding: '12px 14px', background: '#fff', borderRadius: 8, marginBottom: 4,
        border: '1px solid #f0f0f0',
      }}>
        <div>
          <Text strong style={{ fontSize: 13 }}>Sin cliente asignado</Text>
          <br /><Tag color="orange" style={{ margin: 0, fontSize: 11 }}>Sin cliente</Tag>
        </div>
        <Tag color="geekblue" style={{ margin: 0 }}>{b.id_unidad || b.unidad_id}</Tag>
        <Space size={4}>
          <Tag icon={<LockOutlined />} color="warning" style={{ margin: 0 }}>Bloqueada</Tag>
          <Text style={{ fontSize: 12, color: colorTiempo, fontWeight: 600 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />{formatTiempo(tiempoOk)}
          </Text>
        </Space>
        <Text style={{ fontSize: 12 }}>{proyectoNombre(b.proyecto_id)}</Text>
        <Text style={{ fontSize: 12 }}>{inmoNombre(b.bloqueado_por)}</Text>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Tooltip title="Asignar cliente"><Button size="small" icon={<UserAddOutlined />} onClick={() => abrirAsignarCliente(b)} /></Tooltip>
          <Tooltip title="Extender bloqueo"><Button size="small" icon={<FieldTimeOutlined />} onClick={() => { setExtenderBloqueoModal(b); formExtenderBloqueo.resetFields(); }} /></Tooltip>
          <Tooltip title="Liberar">
            <Button size="small" danger icon={<UnlockOutlined />} onClick={() => Modal.confirm({
              title: '¿Liberar este bloqueo?', content: 'La unidad volverá a estar disponible.',
              okText: 'Liberar', cancelText: 'Cancelar', okButtonProps: { danger: true },
              onOk: () => handleLiberar(b),
            })} />
          </Tooltip>
        </div>
      </div>
    );
  };

  const renderTablaActivos = () => (
    <div>
      {!isMobile && (procesosActivos.length > 0 || bloqueosFiltrados.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: esInmobiliaria ? '2fr 1.2fr 1.6fr 1.2fr 80px' : '2fr 1.2fr 1.6fr 1.2fr 1.2fr 80px',
          padding: '8px 14px', background: '#fafafa', borderRadius: 8,
          marginBottom: 4, fontSize: 11, color: '#8c8c8c', fontWeight: 600, letterSpacing: 0.5,
        }}>
          <span>CLIENTE</span><span>UNIDAD</span><span>ESTATUS</span>
          <span>PROYECTO</span>{!esInmobiliaria && <span>INMOBILIARIA</span>}<span />
        </div>
      )}
      {/* Bloqueos sin cliente primero (destacados) */}
      {!esInmobiliaria && bloqueosFiltrados.map(renderFilaBloqueo)}
      {/* Procesos activos */}
      {isMobile ? procesosActivos.map(renderTarjetaProceso) : procesosActivos.map(renderFilaProceso)}
      {procesosActivos.length === 0 && bloqueosFiltrados.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <UserOutlined style={{ fontSize: 40, marginBottom: 12 }} />
          <div>No hay procesos activos</div>
        </div>
      )}
    </div>
  );

  const renderTablaCerrados = () => (
    <div>
      {!isMobile && procesosCerrados.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: esInmobiliaria ? '2fr 1.2fr 1.6fr 1.2fr 80px' : '2fr 1.2fr 1.6fr 1.2fr 1.2fr 80px',
          padding: '8px 14px', background: '#fafafa', borderRadius: 8,
          marginBottom: 4, fontSize: 11, color: '#8c8c8c', fontWeight: 600, letterSpacing: 0.5,
        }}>
          <span>CLIENTE</span><span>UNIDAD</span><span>ESTATUS</span>
          <span>PROYECTO</span>{!esInmobiliaria && <span>INMOBILIARIA</span>}<span />
        </div>
      )}
      {isMobile ? procesosCerrados.map(renderTarjetaProceso) : procesosCerrados.map(renderFilaProceso)}
      {procesosCerrados.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <UserOutlined style={{ fontSize: 40, marginBottom: 12 }} />
          <div>No hay procesos cerrados</div>
        </div>
      )}
    </div>
  );

  const opcionesEstado = ['captacion', 'reserva', 'separacion', 'inicial', 'pagos_atrasados', 'contra_entrega', 'vendida', 'desvinculado'].map(e => ({
    value: e,
    label: (
      <Tooltip title={ESTADO_PROCESO_DESCRIPCION[e]} placement="right">
        <Tag color={ESTADO_PROCESO_COLOR[e]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[e]}</Tag>
      </Tooltip>
    ),
  }));

  // ── JSX ───────────────────────────────────────────────────────────────────
  // Pantalla de carga inicial
  if (loading && procesos.length === 0 && bloqueosSinCliente.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <Spin size="large" />
        <Text type="secondary">Cargando procesos...</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Procesos de venta</Title>
        <Button icon={<ReloadOutlined />} loading={loading || loadingBloqueos} onClick={() => { cargar(); cargarBloqueosSinCliente(); }}>
          {!isMobile && 'Actualizar'}
        </Button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="Buscar cliente, cédula o unidad..."
          style={{ width: isMobile ? '100%' : 240 }} value={busqueda}
          onChange={e => setBusqueda(e.target.value)} allowClear />
        <Select allowClear placeholder="Proyecto" style={{ width: isMobile ? '100%' : 180 }}
          value={proyectoFiltro} options={proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
          onChange={v => { setProyectoFiltro(v); setNextToken(undefined); cargar({ proyecto: v }); }} />
        {!esInmobiliaria && (
          <Select allowClear placeholder="Inmobiliaria" style={{ width: isMobile ? '100%' : 180 }}
            value={inmoFiltro} options={inmobiliarias.map(i => ({ value: i.pk, label: i.nombre }))}
            onChange={v => { setInmoFiltro(v); setNextToken(undefined); cargar({ inmo: v }); }} />
        )}        <Select allowClear placeholder="Estatus" style={{ width: isMobile ? '100%' : 150 }}
          value={estadoFiltro} options={opcionesEstado}
          onChange={v => {
            setEstadoFiltro(v);
            setNextToken(undefined);
            // Si el estatus seleccionado es cerrado, cambiar tab automáticamente
            const esCerrado = v && !ESTADOS_ACTIVOS.includes(v);
            if (esCerrado && tabActiva !== 'cerrados') {
              setTabActiva('cerrados');
              cargar({ estado: v, tab: 'cerrados' });
            } else if (!esCerrado && tabActiva !== 'activos') {
              setTabActiva('activos');
              cargar({ estado: v, tab: 'activos' });
            } else {
              cargar({ estado: v });
            }
          }} />
        <Button onClick={limpiarFiltros}>Limpiar</Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={tabActiva}
        onChange={key => {
          const t = key as 'activos' | 'cerrados' | 'historial';
          setTabActiva(t as any);
          setNextToken(undefined);
          if (t === 'historial') {
            cargarHistorialBloqueos();
          } else {
            cargar({ tab: t as 'activos' | 'cerrados' });
          }
        }}
        items={[
          {
            key: 'activos',
            label: `Activos (${procesosActivos.length}${bloqueosFiltrados.length > 0 ? ` + ${bloqueosFiltrados.length} sin cliente` : ''})`,
            children: renderTablaActivos(),
          },
          {
            key: 'cerrados',
            label: 'Cerrados',
            children: renderTablaCerrados(),
          },
          ...(!esInmobiliaria ? [{
            key: 'historial',
            label: <span><HistoryOutlined /> Historial bloqueos</span>,
            children: (
              <div>
                <Table
                  dataSource={historialBloqueos}
                  rowKey="sk"
                  loading={loadingHistorialBloqueos}
                  pagination={false}
                  locale={{ emptyText: 'No hay registros en el historial' }}
                  scroll={{ x: true }}
                  columns={[
                    {
                      title: 'Unidad', dataIndex: 'unidad_id', key: 'unidad_id',
                      render: (v: string, r: any) => <Text strong>{[r.torre_nombre, r.unidad_nombre ?? v].filter(Boolean).join(' · ')}</Text>,
                    },
                    {
                      title: 'Proyecto', dataIndex: 'proyecto_id', key: 'proyecto_id',
                      render: (v: string) => proyectoNombre(v),
                    },
                    {
                      title: 'Inmobiliaria', dataIndex: 'inmobiliaria_id', key: 'inmobiliaria_id',
                      render: (v: string, r: any) => <Tag>{r.inmobiliaria_nombre ?? inmoNombre(v)}</Tag>,
                    },
                    {
                      title: 'Bloqueado', dataIndex: 'fecha_bloqueo', key: 'fecha_bloqueo',
                      render: (v: string) => v ? new Date(v).toLocaleString('es-VE') : '—',
                    },
                    {
                      title: 'Liberado', dataIndex: 'fecha_liberacion', key: 'fecha_liberacion',
                      render: (v: string) => v ? new Date(v).toLocaleString('es-VE') : '—',
                    },
                    {
                      title: 'Motivo', dataIndex: 'motivo_liberacion', key: 'motivo_liberacion',
                      render: (v: string) => {
                        if (!v) return <Tag color="warning">Activo</Tag>;
                        const cfg: Record<string, string> = { automatica: 'success', manual: 'blue', venta: 'purple' };
                        return <Tag color={cfg[v] ?? 'default'}>{v}</Tag>;
                      },
                    },
                    {
                      title: 'Liberado por', dataIndex: 'liberado_por', key: 'liberado_por',
                      render: (v: string) => v ?? '—',
                    },
                  ]}
                />
                {historialBloqueoNextToken && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Button onClick={() => cargarHistorialBloqueos(historialBloqueoNextToken)} loading={loadingHistorialBloqueos}>
                      Cargar más
                    </Button>
                  </div>
                )}
              </div>
            ),
          }] : []),
        ]}
      />

      {nextToken && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={() => cargar({ token: nextToken })} loading={loading}>Cargar más</Button>
        </div>
      )}

      {/* Modal cambiar estatus */}
      {estatusModal && (
        <CambiarEstatusModal
          open={!!estatusModal}
          proceso={estatusModal}
          tieneContacto={!!(estatusModal.cliente?.correo || estatusModal.cliente?.telefono)}
          onCancel={() => setEstatusModal(null)}
          onConfirm={handleCambiarEstatus}
        />
      )}

      {/* Drawer historial */}
      <HistorialEstatusDrawer
        open={!!historialProceso}
        proceso={historialProceso}
        clienteNombre={historialNombre}
        onClose={() => { setHistorialProceso(null); setHistorialNombre(''); }}
      />

      {/* Modal extender bloqueo (desde proceso con unidad bloqueada) */}
      <Modal title="Extender bloqueo" open={!!extenderProcesoModal}
        onCancel={() => { setExtenderProcesoModal(null); formExtenderProceso.resetFields(); }}
        onOk={() => formExtenderProceso.submit()} okText="Aplicar" cancelText="Cancelar"
        confirmLoading={guardandoExtenderProceso}>
        {extenderProcesoModal && (
          <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <Text strong>{extenderProcesoModal.unidad_nombre || extenderProcesoModal.unidad_id}</Text>
            {extenderProcesoModal.fecha_liberacion_unidad && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                Vence: {dayjs(extenderProcesoModal.fecha_liberacion_unidad).format('DD/MM/YYYY HH:mm')}
              </div>
            )}
          </div>
        )}
        <Form form={formExtenderProceso} layout="vertical" onFinish={handleExtenderProceso}>
          <Form.Item name="horas_restantes" label="Horas adicionales" initialValue={24}
            rules={[{ required: true, message: 'Requerido' }]}>
            <InputNumber min={0.02} max={168} step={1} style={{ width: '100%' }} addonAfter="horas" />
          </Form.Item>
          <Form.Item name="justificacion" label="Justificación" rules={[{ required: true, message: 'Requerido' }]}>
            <Input.TextArea rows={3} placeholder="Motivo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal extender bloqueo sin cliente */}
      <Modal title="Extender bloqueo sin cliente" open={!!extenderBloqueoModal}
        onCancel={() => { setExtenderBloqueoModal(null); formExtenderBloqueo.resetFields(); }}
        onOk={() => formExtenderBloqueo.submit()} okText="Aplicar" cancelText="Cancelar"
        confirmLoading={guardandoExtenderBloqueo}>
        {extenderBloqueoModal && (
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <Text strong>{extenderBloqueoModal.id_unidad || extenderBloqueoModal.unidad_id}</Text>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Vence: {dayjs(extenderBloqueoModal.fecha_liberacion).format('DD/MM/YYYY HH:mm')}
            </div>
          </div>
        )}
        <Form form={formExtenderBloqueo} layout="vertical" onFinish={handleExtenderBloqueo}>
          <Form.Item name="horas_restantes" label="Horas adicionales" initialValue={24}
            rules={[{ required: true, message: 'Requerido' }]}>
            <InputNumber min={0.02} max={168} step={1} style={{ width: '100%' }} addonAfter="horas" />
          </Form.Item>
          <Form.Item name="justificacion" label="Justificación" rules={[{ required: true, message: 'Requerido' }]}>
            <Input.TextArea rows={3} placeholder="Motivo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal asignar cliente a bloqueo */}
      <Modal title="Asignar cliente al bloqueo" open={!!asignarModal}
        onCancel={() => { setAsignarModal(null); setClienteSeleccionado(null); }}
        onOk={() => {
          if (modoAsignar === 'existente' && !clienteSeleccionado) {
            message.warning('Selecciona un cliente de la lista');
            return;
          }
          formAsignar.submit();
        }}
        okText="Asignar" cancelText="Cancelar" confirmLoading={guardandoAsignar} width={560}>
        {asignarModal && (
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>UNIDAD</Text>
              <div><Text strong>{asignarModal.id_unidad || asignarModal.unidad_id}</Text></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>PROYECTO</Text>
              <div><Text>{proyectoNombre(asignarModal.proyecto_id)}</Text></div>
            </div>
          </div>
        )}
        <Radio.Group value={modoAsignar}
          onChange={e => { setModoAsignar(e.target.value); formAsignar.resetFields(); setClienteSeleccionado(null); }}
          style={{ marginBottom: 16 }} buttonStyle="solid">
          <Radio.Button value="existente"><SearchOutlined /> Cliente existente</Radio.Button>
          <Radio.Button value="nuevo"><UserAddOutlined /> Nuevo cliente</Radio.Button>
        </Radio.Group>

        {modoAsignar === 'existente' ? (
          <div>
            <Select showSearch style={{ width: '100%' }} placeholder="Buscar por nombre o cédula..."
              loading={loadingClientes}
              filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
              onChange={handleSeleccionarCliente}
              options={clientesInmo.map(c => ({ value: c.cedula, label: `${c.nombres} ${c.apellidos} — ${c.cedula}` }))} />
            {clienteSeleccionado && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                <Text strong>{clienteSeleccionado.nombres} {clienteSeleccionado.apellidos}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {clienteSeleccionado.cedula}
                  {clienteSeleccionado.correo && ` · ${clienteSeleccionado.correo}`}
                  {clienteSeleccionado.telefono && ` · ${clienteSeleccionado.telefono}`}
                </Text>
              </div>
            )}
            {clientesInmo.length === 0 && !loadingClientes && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                Esta inmobiliaria no tiene clientes registrados aún.
              </Text>
            )}
            {loadingClientes && <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>}
            <Form form={formAsignar} onFinish={handleAsignarCliente}>
              <Form.Item name="cedula" hidden><Input /></Form.Item>
            </Form>
          </div>
        ) : (
          <Form form={formAsignar} layout="vertical" onFinish={handleAsignarCliente}>
            <Divider style={{ margin: '0 0 16px' }} />
            <Form.Item name="cedula" label="Cédula / Pasaporte" rules={[{ required: true }]}><Input placeholder="V-12345678" /></Form.Item>
            <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
            <Form.Item name="telefono" label="Teléfono"><Input placeholder="+58 412 0000000" /></Form.Item>
            <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="estado_civil" label="Estado civil">
              <Select allowClear placeholder="Selecciona">
                <Select.Option value="soltero">Soltero/a</Select.Option>
                <Select.Option value="casado">Casado/a</Select.Option>
                <Select.Option value="divorciado">Divorciado/a</Select.Option>
                <Select.Option value="viudo">Viudo/a</Select.Option>
                <Select.Option value="union_libre">Unión libre</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="nacionalidad" label="Nacionalidad"><Input /></Form.Item>
            <Form.Item name="pais_residencia" label="País de residencia"><Input /></Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ProcesosPage;
