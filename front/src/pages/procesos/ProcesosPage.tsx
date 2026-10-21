import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Tag, Button, Space, Select, message,
  Badge, Tooltip, Grid, Input, Dropdown, Tabs, Modal, Form, InputNumber,
  Radio, Divider, DatePicker, Spin, Table, Row, Col, Drawer, Descriptions,
} from 'antd';
import {
  ReloadOutlined, SwapOutlined, HistoryOutlined,
  SearchOutlined, MoreOutlined, UserOutlined, LockOutlined,
  FieldTimeOutlined, UserAddOutlined, ClockCircleOutlined, UnlockOutlined,
  ArrowLeftOutlined, AppstoreOutlined, InfoCircleOutlined, UserSwitchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { listarTodosProcesos, cambiarEstatus, getMisProcesos, traspasarClienteProceso, type ProcesoEnriquecido } from '../../services/crm.service';
import { getProyectos, getUnidad, getEtapas } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import { extenderBloqueo, getBloquesActivos, bloquearUnidad, liberarBloqueo, getHistorialBloqueos } from '../../services/bloqueos.service';
import { buscarClientesAdmin, getClientesAdmin } from '../../services/clientes.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Proyecto, Proceso, Bloqueo, Cliente, HistorialBloqueo, Unidad, Etapa } from '../../types';
import CambiarEstatusModal, { type ModoNotificacion } from '../../components/common/CambiarEstatusModal';
import HistorialEstatusDrawer from '../../components/common/HistorialEstatusDrawer';
import ModalCrearBloqueoAdmin from '../../components/inventario/ModalCrearBloqueoAdmin';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL, ESTADO_PROCESO_DESCRIPCION, projectGradient } from '../../constants/estados';
import { useAuthContext } from '../../context/AuthContext';
import { clienteFieldNormalizers, clienteFormRules, normalizeClientePayload } from '../../utils/clientesValidation';
import { EstadoCivilSelect, NacionalidadSelect, PaisResidenciaSelect } from '../../components/common/CatalogoClienteFields';
import { confirmarLiberarBloqueo } from '../../components/common/ConfirmarLiberarBloqueo';
import { seleccionarNotificacionBloqueo } from '../../components/common/ConfirmarCrearBloqueo';
import { confirmarExclusividadCliente } from '../../components/common/ConfirmarExclusividadCliente';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type TabProcesos = 'activos' | 'cerrados' | 'desvinculados' | 'historial';

const ESTADOS_ACTIVOS = ['captacion', 'reserva', 'separacion', 'pagos_atrasados', 'inicial', 'contra_entrega'];
const ESTADOS_CERRADOS = ['vendida'];
const UNIDAD_COLLATOR = new Intl.Collator('es', {
  sensitivity: 'variant',
  numeric: true,
});

const compararPorUnidad = (a: ProcesoEnriquecido, b: ProcesoEnriquecido) =>
  UNIDAD_COLLATOR.compare(
    a.unidad_nombre || a.unidad_id || '',
    b.unidad_nombre || b.unidad_id || '',
  );

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

  // ── Vista y navegación ────────────────────────────────────────────────────
  const [vista, setVista] = useState<'proyectos' | 'procesos'>('proyectos');
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<Proyecto | null>(null);

  // ── Procesos ──────────────────────────────────────────────────────────────
  const [procesos, setProcesos] = useState<ProcesoEnriquecido[]>([]);
  const [loading, setLoading] = useState(false);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [inmoFiltro, setInmoFiltro] = useState<string | undefined>();
  const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>();
  const [busqueda, setBusqueda] = useState('');
  const [tabActiva, setTabActiva] = useState<TabProcesos>('activos');
  const procesosCompletosRef = useRef(false);

  // ── Modales procesos ──────────────────────────────────────────────────────
  const [estatusModal, setEstatusModal] = useState<ProcesoEnriquecido | null>(null);
  const [historialProceso, setHistorialProceso] = useState<Proceso | null>(null);
  const [historialNombre, setHistorialNombre] = useState('');
  const [extenderProcesoModal, setExtenderProcesoModal] = useState<ProcesoEnriquecido | null>(null);
  const [formExtenderProceso] = Form.useForm();
  const [guardandoExtenderProceso, setGuardandoExtenderProceso] = useState(false);

  // ── Drawer detalle unidad ─────────────────────────────────────────────────
  const [unidadDrawer, setUnidadDrawer] = useState<Unidad | null>(null);
  const [loadingUnidad, setLoadingUnidad] = useState(false);
  const [etapasDrawer, setEtapasDrawer] = useState<Etapa[]>([]);
  const [drawerProyectoId, setDrawerProyectoId] = useState<string>('');
  const [modalBloqueoAdmin, setModalBloqueoAdmin] = useState(false);
  const [guardandoBloqueoAdmin, setGuardandoBloqueoAdmin] = useState(false);

  const abrirDetalleUnidad = async (unidadId: string, proyectoId: string) => {
    setUnidadDrawer(null);
    setLoadingUnidad(true);
    setDrawerProyectoId(proyectoId);
    try {
      const [unidad, etapas] = await Promise.all([
        getUnidad(proyectoId, unidadId),
        getEtapas(proyectoId).catch(() => [] as Etapa[]),
      ]);
      setUnidadDrawer(unidad ?? null);
      setEtapasDrawer(etapas);
      if (!unidad) message.warning('No se encontraron detalles de la unidad');
    } catch {
      message.error('Error al cargar detalles de la unidad');
    } finally {
      setLoadingUnidad(false);
    }
  };

  const handleCrearBloqueoAdmin = async (payload: any) => {
    if (!unidadDrawer) return;
    const notificar = await seleccionarNotificacionBloqueo(unidadDrawer.id_unidad);
    if (notificar === undefined) return;
    setGuardandoBloqueoAdmin(true);
    try {
      let bloqueoPayload = { ...payload, notificar, proyecto_id: drawerProyectoId, unidad_id: unidadDrawer.unidad_id };
      let result;
      try {
        result = await bloquearUnidad(bloqueoPayload);
      } catch (err: any) {
        const status = err?.response?.statusCode ?? err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || '';
        if (status === 409 && (usuario?.rol === 'admin' || usuario?.rol === 'coordinador') && msg.toLowerCase().includes('exclusividad')) {
          if (await confirmarExclusividadCliente(msg)) {
            bloqueoPayload = { ...bloqueoPayload, forzar_admin: true };
            result = await bloquearUnidad(bloqueoPayload);
          } else {
            message.info('Operación cancelada');
            return;
          }
        } else {
          throw err;
        }
      }
      if (result.advertencia_cliente) message.warning(result.advertencia_cliente);
      message.success(`Unidad ${unidadDrawer.id_unidad} bloqueada`);
      setModalBloqueoAdmin(false);
      // Recargar unidad para reflejar el nuevo estado
      await abrirDetalleUnidad(unidadDrawer.unidad_id, drawerProyectoId);
    } catch (err: any) {
      const s = err?.response?.statusCode ?? err?.response?.status;
      const msg = err?.response?.data?.message || err?.message;
      if (s === 409) message.warning(msg || 'La unidad ya no está disponible');
      else if (s === 429) message.warning(msg || 'No puedes re-bloquear esta unidad antes de 24h');
      else message.error(msg || 'Error al bloquear');
    } finally {
      setGuardandoBloqueoAdmin(false);
    }
  };

  // ── Bloqueos sin cliente ──────────────────────────────────────────────────
  const [bloqueosSinCliente, setBloqueosSinCliente] = useState<Bloqueo[]>([]);
  const [todosBloqueos, setTodosBloqueos] = useState<Bloqueo[]>([]);
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

  // Modal traspasar cliente de un proceso
  const [traspasarModal, setTraspasarModal] = useState<ProcesoEnriquecido | null>(null);
  const [formTraspasar] = Form.useForm();
  const [modoTraspasar, setModoTraspasar] = useState<'existente' | 'nuevo'>('existente');
  const [clientesTraspaso, setClientesTraspaso] = useState<Cliente[]>([]);
  const [clienteTraspaso, setClienteTraspaso] = useState<Cliente | null>(null);
  const [buscandoClientesTraspaso, setBuscandoClientesTraspaso] = useState(false);
  const [guardandoTraspaso, setGuardandoTraspaso] = useState(false);

  // Historial de bloqueos
  const [historialBloqueos, setHistorialBloqueos] = useState<HistorialBloqueo[]>([]);
  const [historialBloqueoNextToken, setHistorialBloqueoNextToken] = useState<string | undefined>();
  const [loadingHistorialBloqueos, setLoadingHistorialBloqueos] = useState(false);

  // ── Carga de datos ────────────────────────────────────────────────────────
  const cargar = useCallback(async (opts: {
    proyecto?: string;
    incluirCerrados?: boolean;
  } = {}) => {
    if (opts.incluirCerrados !== undefined) {
      procesosCompletosRef.current = opts.incluirCerrados;
    }
    // Requerir proyecto seleccionado
    const proyectoId = opts.proyecto ?? proyectoFiltro ?? proyectoSeleccionado?.proyecto_id;
    if (!proyectoId) {
      setProcesos([]);
      return;
    }

    setLoading(true);
    try {
      if (esInmobiliaria) {
        const items = await getMisProcesos(proyectoId);
        const enriched: ProcesoEnriquecido[] = items.map((p: any) => ({
          ...p,
          cliente: p.nombres ? { nombres: p.nombres, apellidos: p.apellidos ?? '' } : undefined,
        }));
        setProcesos(enriched.sort(compararPorUnidad));
      } else {
        // Backend ahora devuelve TODOS los procesos del proyecto
        const data = await listarTodosProcesos({
          proyecto_id: proyectoId,
          incluir_cerrados: opts.incluirCerrados ?? false,
        });
        setProcesos(data.items.sort(compararPorUnidad));
      }
    } catch {
      message.error('Error al cargar procesos');
    } finally {
      setLoading(false);
    }
  }, [proyectoFiltro, esInmobiliaria, proyectoSeleccionado]);

  useEffect(() => {
    const tieneFiltro = Boolean(busqueda.trim() || inmoFiltro || estadoFiltro);
    if (!proyectoSeleccionado || !tieneFiltro || procesosCompletosRef.current) return;
    cargar({ incluirCerrados: true });
  }, [busqueda, inmoFiltro, estadoFiltro, proyectoSeleccionado, cargar]);

  const cargarBloqueosSinCliente = useCallback(async () => {
    setLoadingBloqueos(true);
    try {
      const data = await getBloquesActivos();
      const ahora = Date.now();
      const conTiempo = data.items.map(b => ({
        ...b,
        tiempo_restante: Math.max(0, Math.floor(
          (new Date(b.fecha_liberacion).getTime() - ahora) / 1000
        )),
      }));
      setTodosBloqueos(conTiempo);
      setBloqueosSinCliente(conTiempo.filter(b => !b.cliente_cedula));
    } catch { /* silencioso */ }
    finally { setLoadingBloqueos(false); }
  }, [esInmobiliaria]);

  useEffect(() => {
    getProyectos().then(setProyectos).catch(() => {});
    if (!esInmobiliaria) getInmobiliarias().then(setInmobiliarias).catch(() => {});
    // No cargar procesos automáticamente, esperar selección de proyecto
  }, [esInmobiliaria]);

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

  const PASO_ANTERIOR: Record<string, string> = {
    reserva:        'captacion',
    pagos_atrasados:'reserva',
    separacion:     'pagos_atrasados',
    inicial:        'separacion',
    contra_entrega: 'inicial',
    vendida:        'contra_entrega',
  };

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
          ...normalizeClientePayload(values),
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
      if (status === 409) message.warning(msg || 'Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto');
      else message.error(msg || 'Error al asignar cliente');
    } finally { setGuardandoAsignar(false); }
  };

  const handleLiberar = async (b: Bloqueo, notificar: ModoNotificacion) => {
    try {
      await liberarBloqueo(b.unidad_id, b.proyecto_id, notificar);
      message.success('Bloqueo liberado');
      cargarBloqueosSinCliente();
      cargar(); // refrescar procesos también
    } catch {
      message.error('Error al liberar bloqueo');
    }
  };

  const buscarCandidatosTraspaso = async (query = '') => {
    if (!traspasarModal) return;
    setBuscandoClientesTraspaso(true);
    try {
      let items: Cliente[] = [];
      if (query.trim().length >= 2) {
        const [porNombre, porCedula] = await Promise.all([
          buscarClientesAdmin(query.trim(), 'nombre', traspasarModal.proyecto_id, traspasarModal.inmobiliaria_id).catch(() => []),
          buscarClientesAdmin(query.trim(), 'cedula', traspasarModal.proyecto_id, traspasarModal.inmobiliaria_id).catch(() => []),
        ]);
        items = [...porNombre, ...porCedula];
      } else {
        const data = await getClientesAdmin({
          proyecto_id: traspasarModal.proyecto_id,
          inmobiliaria_id: traspasarModal.inmobiliaria_id,
          limit: 200,
        });
        items = data.items ?? [];
      }
      const vistos = new Set<string>();
      setClientesTraspaso(items.filter(c => {
        if (c.cedula === traspasarModal.cedula || vistos.has(c.cedula)) return false;
        vistos.add(c.cedula);
        return true;
      }));
    } catch {
      setClientesTraspaso([]);
    } finally {
      setBuscandoClientesTraspaso(false);
    }
  };

  const abrirTraspasarCliente = (proceso: ProcesoEnriquecido) => {
    setTraspasarModal(proceso);
    setModoTraspasar('existente');
    setClienteTraspaso(null);
    setClientesTraspaso([]);
    formTraspasar.resetFields();
  };

  useEffect(() => {
    if (traspasarModal) buscarCandidatosTraspaso();
    // La carga se dispara solamente al abrir otro proceso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traspasarModal]);

  const handleTraspasarCliente = async (values: any) => {
    if (!traspasarModal) return;
    if (modoTraspasar === 'existente' && !clienteTraspaso) {
      message.warning('Selecciona el cliente destino');
      return;
    }

    const payload: any = {
      inmobiliaria_id: traspasarModal.inmobiliaria_id,
      tipo_destino: modoTraspasar,
      justificacion: values.justificacion?.trim(),
    };
    if (modoTraspasar === 'existente') {
      payload.cedula_destino = clienteTraspaso!.cedula;
    } else {
      const normalizado = normalizeClientePayload(values);
      payload.cliente = {
        cedula: normalizado.cedula,
        nombres: normalizado.nombres,
        apellidos: normalizado.apellidos,
        correo: normalizado.correo,
        telefono: normalizado.telefono,
        fecha_nacimiento: values.fecha_nacimiento
          ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD')
          : undefined,
        estado_civil: values.estado_civil,
        nacionalidad: values.nacionalidad,
        pais_residencia: values.pais_residencia,
      };
    }

    setGuardandoTraspaso(true);
    try {
      const result = await traspasarClienteProceso(
        traspasarModal.cedula,
        traspasarModal.proyecto_id,
        traspasarModal.unidad_id,
        payload,
      );
      message.success(result.message);
      if (result.advertencia) message.warning(result.advertencia);
      setTraspasarModal(null);
      setClienteTraspaso(null);
      formTraspasar.resetFields();
      await Promise.all([cargar(), cargarBloqueosSinCliente()]);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'No se pudo traspasar el cliente');
    } finally {
      setGuardandoTraspaso(false);
    }
  };

  const abrirLiberarBloqueo = (b: Bloqueo) => confirmarLiberarBloqueo({
    tieneCliente: !!b.cliente_cedula,
    onConfirm: (notificar) => handleLiberar(b, notificar),
  });

  const cargarHistorialBloqueos = useCallback(async (nextToken?: string) => {
    setLoadingHistorialBloqueos(true);
    try {
      const proyectoId = proyectoFiltro ?? proyectoSeleccionado?.proyecto_id;
      const data = await getHistorialBloqueos(undefined, nextToken, proyectoId);
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
  }, [proyectoFiltro, proyectoSeleccionado]);

  const limpiarFiltros = () => {
    setInmoFiltro(undefined);
    setEstadoFiltro(undefined);
    setBusqueda('');
    procesosCompletosRef.current = false;
    setTabActiva('activos');
  };

  const seleccionarProyecto = (p: Proyecto) => {
    setProyectoSeleccionado(p);
    setProyectoFiltro(p.proyecto_id);
    setVista('procesos');
    // Limpiar filtros previos
    setInmoFiltro(undefined);
    setEstadoFiltro(undefined);
    setBusqueda('');
    procesosCompletosRef.current = false;
    setTabActiva('activos');
    // Cargar procesos del proyecto
    cargar({ proyecto: p.proyecto_id, incluirCerrados: true });
    cargarBloqueosSinCliente();
  };

  const cambiarProyectoFiltro = (proyectoId?: string) => {
    if (!proyectoId) {
      volverAProyectos();
      return;
    }

    setVista('procesos');
    setProyectoFiltro(proyectoId);
    setProyectoSeleccionado(proyectos.find(p => p.proyecto_id === proyectoId) ?? null);
    setTabActiva('activos');
    cargar({ proyecto: proyectoId, incluirCerrados: true });
    cargarBloqueosSinCliente();
  };

  const volverAProyectos = () => {
    setVista('proyectos');
    setProyectoSeleccionado(null);
    setProyectoFiltro(undefined);
    setProcesos([]);
    setBloqueosSinCliente([]);
    setTodosBloqueos([]);
    limpiarFiltros();
  };

  // ── Filtrado local ────────────────────────────────────────────────────────
  // Aplicar todos los filtros localmente
  let procesosFiltrados = procesos;

  // Filtro por inmobiliaria
  if (inmoFiltro) {
    const inmoNorm = inmoFiltro.replace('INMOBILIARIA#', '');
    procesosFiltrados = procesosFiltrados.filter(p => {
      const pInmo = p.inmobiliaria_id?.replace('INMOBILIARIA#', '');
      return pInmo === inmoNorm;
    });
  }

  // Filtro por estado
  if (estadoFiltro) {
    procesosFiltrados = procesosFiltrados.filter(p => p.estado === estadoFiltro);
  }

  // Filtro por búsqueda de texto
  if (busqueda.trim()) {
    const q = busqueda.toLowerCase();
    procesosFiltrados = procesosFiltrados.filter(p => {
      const nombre = nombreCliente(p).toLowerCase();
      return nombre.includes(q) || p.cedula.includes(q) || (p.unidad_nombre ?? '').toLowerCase().includes(q);
    });
  }

  // Separar por listas visibles
  const procesosActivos = procesosFiltrados.filter(p =>
    ESTADOS_ACTIVOS.includes(p.estado)
  );
  const procesosCerrados = procesosFiltrados.filter(p =>
    ESTADOS_CERRADOS.includes(p.estado)
  );
  const procesosDesvinculados = procesosFiltrados.filter(p =>
    p.estado === 'desvinculado'
  );

  // Bloqueos sin cliente filtrados por búsqueda/proyecto
  // Solo mostrar cuando NO hay filtro de estado activo
  const proyectoBloqueosFiltro = proyectoFiltro ?? proyectoSeleccionado?.proyecto_id;
  const mostrarBloqueosActivos = !estadoFiltro || estadoFiltro === 'captacion';
  const procesosPorUnidad = new Set(
    procesosFiltrados.map(p => `${p.proyecto_id?.replace('PROYECTO#', '')}#${p.unidad_id}`)
  );
  const bloqueosBase = estadoFiltro === 'captacion' ? todosBloqueos : bloqueosSinCliente;
  const bloqueosFiltrados = mostrarBloqueosActivos ? bloqueosBase.filter(b => {
    if (proyectoBloqueosFiltro && b.proyecto_id?.replace('PROYECTO#', '') !== proyectoBloqueosFiltro) return false;
    const key = `${b.proyecto_id?.replace('PROYECTO#', '')}#${b.unidad_id}`;
    if (procesosPorUnidad.has(key)) return false;
    if (inmoFiltro) {
      const norm = inmoFiltro.replace('INMOBILIARIA#', '');
      if (b.bloqueado_por !== norm && b.bloqueado_por !== inmoFiltro) return false;
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (b.id_unidad || b.unidad_id).toLowerCase().includes(q);
    }
    return true;
  }) : [];

  // ── Render helpers ────────────────────────────────────────────────────────
  const alertaInfo = (p: ProcesoEnriquecido) => {
    const vencida = p.alerta_reserva_vencida && p.estado === 'pagos_atrasados';
    const dias = p.fecha_reserva
      ? Math.floor((Date.now() - new Date(p.fecha_reserva).getTime()) / 86400000)
      : null;
    const proxima = !vencida && p.estado === 'reserva' && dias !== null && dias >= 25;
    return { vencida, proxima, dias };
  };

  const isUnidadBloqueada = (p: ProcesoEnriquecido) =>
    p.estado_unidad === 'bloqueada' ||
    p.estado === 'captacion' ||  // captacion always means unit is blocked
    todosBloqueos.some(b =>
      b.unidad_id === p.unidad_id &&
      b.proyecto_id?.replace('PROYECTO#', '') === p.proyecto_id?.replace('PROYECTO#', '')
    );

  const getFechaLiberacion = (p: ProcesoEnriquecido) =>
    p.fecha_liberacion_unidad ||
    todosBloqueos.find(b => b.unidad_id === p.unidad_id)?.fecha_liberacion;

  const renderTagUnidad = (p: ProcesoEnriquecido) => {
    const esBloq = isUnidadBloqueada(p);
    if (!esBloq) return null;
    const fechaLib = getFechaLiberacion(p);
    const vence = fechaLib ? dayjs(fechaLib).format('DD/MM HH:mm') : null;
    return (
      <Tooltip title={vence ? `Bloqueo vence: ${vence}` : 'Unidad bloqueada'}>
        <Tag icon={<LockOutlined />} color="warning" style={{ margin: 0 }}>Bloqueada</Tag>
      </Tooltip>
    );
  };

  const renderTarjetaProceso = (p: ProcesoEnriquecido) => {
    const { vencida, proxima, dias } = alertaInfo(p);
    const esBloqueada = isUnidadBloqueada(p);
    const puedeAvanzar = !esInmobiliaria && p.estado !== 'desvinculado';
    const puedeVerDetalleUnidad = !(esInmobiliaria && p.estado === 'desvinculado');
    
    // Calcular tiempo restante si está bloqueada
    let tiempoRestante = 0;
    let colorTiempo = '#52c41a';
    const fechaLib = getFechaLiberacion(p);
    if (esBloqueada && fechaLib) {
      tiempoRestante = Math.max(0, Math.floor((new Date(fechaLib).getTime() - Date.now()) / 1000));
      colorTiempo = tiempoRestante <= 0 ? '#ff4d4f' : tiempoRestante < 5 * 3600 ? '#faad14' : '#52c41a';
    }
    
    const pasoAtras = PASO_ANTERIOR[p.estado];
    const menuItems = [
      ...(puedeVerDetalleUnidad ? [{ key: 'detalles', icon: <InfoCircleOutlined />, label: 'Ver detalles de unidad', onClick: () => abrirDetalleUnidad(p.unidad_id, p.proyecto_id) }] : []),
      ...(puedeAvanzar ? [{ key: 'estatus', icon: <SwapOutlined />, label: 'Cambiar estatus', onClick: () => setEstatusModal(p) }] : []),
      ...(!esInmobiliaria && p.estado !== 'desvinculado' ? [{
        key: 'traspasar-cliente', icon: <UserSwitchOutlined />, label: 'Traspasar cliente',
        onClick: () => abrirTraspasarCliente(p),
      }] : []),
      ...(!isMobile && !esInmobiliaria && pasoAtras ? [{
        key: 'retroceder', icon: <ArrowLeftOutlined />, label: `Retroceder a ${ESTADO_PROCESO_LABEL[pasoAtras] ?? pasoAtras}`,
        onClick: () => Modal.confirm({
          title: '¿Retroceder estado?',
          content: `El proceso volverá de "${ESTADO_PROCESO_LABEL[p.estado]}" a "${ESTADO_PROCESO_LABEL[pasoAtras] ?? pasoAtras}".`,
          okText: 'Sí, retroceder', cancelText: 'Cancelar',
          onOk: async () => {
            try {
              await cambiarEstatus(p.cedula, p.proyecto_id, p.unidad_id, { estatus: pasoAtras, inmobiliaria_id: p.inmobiliaria_id, notificar: false });
              message.success(`Retrocedido a ${ESTADO_PROCESO_LABEL[pasoAtras] ?? pasoAtras}`);
              cargar();
            } catch (err: any) {
              message.error(err?.response?.data?.message || 'Error al retroceder estatus');
            }
          },
        }),
      }] : []),
      ...(!esInmobiliaria ? [{ key: 'historial', icon: <HistoryOutlined />, label: 'Ver historial', onClick: () => { setHistorialProceso(p); setHistorialNombre(nombreCliente(p)); } }] : []),
      ...(esBloqueada && !esInmobiliaria ? [
        { key: 'extender', icon: <FieldTimeOutlined />, label: 'Extender bloqueo', onClick: () => { setExtenderProcesoModal(p); formExtenderProceso.resetFields(); } },
        {
          key: 'liberar', icon: <UnlockOutlined />, label: 'Liberar bloqueo', danger: true,
          onClick: () => abrirLiberarBloqueo({ unidad_id: p.unidad_id, proyecto_id: p.proyecto_id, cliente_cedula: p.cedula } as Bloqueo),
        },
      ] : []),
    ];
    return (
      <div key={`${p.pk}#${p.sk}`} style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 10, padding: '14px 16px' }}>
        {vencida && (
          <div style={{ background: 'var(--danger-soft-bg)', border: '1px solid var(--danger-soft-border)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#ff7875', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ flex: 1 }}>Reserva vencida (30 dias)</span>
            {puedeAvanzar && <Button size="small" type="link" danger style={{ padding: 0, height: 'auto', fontSize: 11 }} onClick={() => setEstatusModal(p)}>Cambiar estatus</Button>}
          </div>
        )}
        {proxima && (
          <div style={{ background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#d46b08', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>⏰</span>
            <span>Vence en {30 - dias!} día{30 - dias! !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <Text strong style={{ fontSize: 14 }}>{nombreCliente(p)}</Text>
              {p.cliente?.nombres && <Text type="secondary" style={{ fontSize: 12 }}>{p.cedula}</Text>}
            </div>
            <Space size={4} wrap>
              <Tag
                color="geekblue"
                style={{ margin: 0, cursor: puedeVerDetalleUnidad ? 'pointer' : 'default' }}
                icon={puedeVerDetalleUnidad ? <InfoCircleOutlined /> : undefined}
                onClick={puedeVerDetalleUnidad ? () => abrirDetalleUnidad(p.unidad_id, p.proyecto_id) : undefined}
              >{p.unidad_nombre || p.unidad_id}</Tag>
              <Tooltip title={ESTADO_PROCESO_DESCRIPCION[p.estado] || p.estado}>
                <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
              </Tooltip>
              {renderTagUnidad(p)}
              {esBloqueada && fechaLib && (
                <Text style={{ fontSize: 12, color: colorTiempo, fontWeight: 600 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />{formatTiempo(tiempoRestante)}
                </Text>
              )}
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
    const esBloqueada = isUnidadBloqueada(p);
    const puedeAvanzar = !esInmobiliaria && p.estado !== 'desvinculado';
    const puedeVerDetalleUnidad = !(esInmobiliaria && p.estado === 'desvinculado');
    
    // Calcular tiempo restante si está bloqueada
    let tiempoRestante = 0;
    let colorTiempo = '#52c41a';
    const fechaLib = getFechaLiberacion(p);
    if (esBloqueada && fechaLib) {
      tiempoRestante = Math.max(0, Math.floor((new Date(fechaLib).getTime() - Date.now()) / 1000));
      colorTiempo = tiempoRestante <= 0 ? '#ff4d4f' : tiempoRestante < 5 * 3600 ? '#faad14' : '#52c41a';
    }
    
    return (
      <div key={`${p.pk}#${p.sk}`} style={{
        display: 'grid',
        gridTemplateColumns: esInmobiliaria ? '1.2fr 2fr 1.6fr 80px' : '1.2fr 2fr 1.6fr 1.2fr 80px',
        alignItems: 'center', padding: '12px 14px', background: 'var(--panel-bg)', borderRadius: 8, marginBottom: 4,
        borderTop: '1px solid var(--app-border)', borderRight: '1px solid var(--app-border)', borderBottom: '1px solid var(--app-border)',
        borderLeft: vencida ? '3px solid #ff4d4f' : proxima ? '3px solid #faad14' : '1px solid var(--app-border)',
      }}>
        <Tag color="geekblue" style={{ margin: 0 }}>{p.unidad_nombre || p.unidad_id}</Tag>
        <div>
          <Text strong style={{ fontSize: 13 }}>{nombreCliente(p)}</Text>
          {p.cliente?.nombres && <><br /><Text type="secondary" style={{ fontSize: 11 }}>{p.cedula}</Text></>}
        </div>
        <Badge status={vencida ? 'error' : proxima ? 'warning' : 'default'} text={
          <Space size={4}>
            <Tooltip title={ESTADO_PROCESO_DESCRIPCION[p.estado] || p.estado}>
              <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
            </Tooltip>
            {renderTagUnidad(p)}
            {esBloqueada && fechaLib && (
              <Text style={{ fontSize: 12, color: colorTiempo, fontWeight: 600 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />{formatTiempo(tiempoRestante)}
              </Text>
            )}
            {vencida && <Tooltip title="Reserva vencida (30 dias sin separacion)"><span style={{ fontSize: 12, color: '#cf1322' }}>⚠️</span></Tooltip>}
            {proxima && <Tooltip title="Próximo a vencer"><span style={{ fontSize: 12, color: '#d46b08' }}>⏰</span></Tooltip>}
          </Space>
        } />
        {!esInmobiliaria && <Text style={{ fontSize: 12 }}>{inmoNombre(p.inmobiliaria_id)}</Text>}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {puedeVerDetalleUnidad && (
            <Tooltip title="Ver detalles de unidad"><Button size="small" icon={<InfoCircleOutlined />} onClick={() => abrirDetalleUnidad(p.unidad_id, p.proyecto_id)} /></Tooltip>
          )}
          {puedeAvanzar && <Tooltip title="Cambiar estatus"><Button size="small" icon={<SwapOutlined />} onClick={() => setEstatusModal(p)} /></Tooltip>}
          {!esInmobiliaria && p.estado !== 'desvinculado' && (
            <Tooltip title="Traspasar cliente">
              <Button size="small" icon={<UserSwitchOutlined />} onClick={() => abrirTraspasarCliente(p)} />
            </Tooltip>
          )}
          {esBloqueada && !esInmobiliaria && <Tooltip title="Extender bloqueo"><Button size="small" icon={<FieldTimeOutlined />} onClick={() => { setExtenderProcesoModal(p); formExtenderProceso.resetFields(); }} /></Tooltip>}
          {esBloqueada && !esInmobiliaria && (
            <Tooltip title="Liberar bloqueo">
              <Button size="small" danger icon={<UnlockOutlined />} onClick={() => abrirLiberarBloqueo({ unidad_id: p.unidad_id, proyecto_id: p.proyecto_id, cliente_cedula: p.cedula } as Bloqueo)} />
            </Tooltip>
          )}
          {!esInmobiliaria && <Tooltip title="Historial"><Button size="small" icon={<HistoryOutlined />} onClick={() => { setHistorialProceso(p); setHistorialNombre(nombreCliente(p)); }} /></Tooltip>}
        </div>
      </div>
    );
  };

  // Fila de bloqueo sin cliente — mismo estilo que proceso
  const renderFilaBloqueo = (b: Bloqueo) => {
    const tiempoOk = b.tiempo_restante ?? 0;
    const colorTiempo = tiempoOk <= 0 ? '#ff4d4f' : tiempoOk < 5 * 3600 ? '#faad14' : '#52c41a';
    const tieneCliente = !!b.cliente_cedula;
    const menuItems = !esInmobiliaria ? [
      ...(!tieneCliente ? [{ key: 'asignar', icon: <UserAddOutlined />, label: 'Asignar cliente', onClick: () => abrirAsignarCliente(b) }] : []),
      { key: 'extender', icon: <FieldTimeOutlined />, label: 'Extender bloqueo', onClick: () => { setExtenderBloqueoModal(b); formExtenderBloqueo.resetFields(); } },
      {
        key: 'liberar', icon: <UnlockOutlined />, label: 'Liberar', danger: true,
        onClick: () => abrirLiberarBloqueo(b),
      },
    ] : [];
    if (isMobile) {
      return (
        <div key={b.unidad_id} style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <Text strong style={{ fontSize: 14 }}>{tieneCliente ? b.cliente_cedula : 'Sin cliente asignado'}</Text>
                <Tag color={tieneCliente ? 'blue' : 'orange'} style={{ margin: 0 }}>{tieneCliente ? 'Cliente asignado' : 'Sin cliente'}</Tag>
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
            {!esInmobiliaria && (
              <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                <Button size="small" icon={<MoreOutlined />} />
              </Dropdown>
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={b.unidad_id} style={{
        display: 'grid',
        gridTemplateColumns: esInmobiliaria ? '1.2fr 2fr 1.6fr 80px' : '1.2fr 2fr 1.6fr 1.2fr 80px',
        alignItems: 'center', padding: '12px 14px', background: 'var(--panel-bg)', borderRadius: 8, marginBottom: 4,
        border: '1px solid var(--app-border)',
      }}>
        <Tag color="geekblue" style={{ margin: 0 }}>{b.id_unidad || b.unidad_id}</Tag>
        <div>
          <Text strong style={{ fontSize: 13 }}>{tieneCliente ? b.cliente_cedula : 'Sin cliente asignado'}</Text>
          <br /><Tag color={tieneCliente ? 'blue' : 'orange'} style={{ margin: 0, fontSize: 11 }}>{tieneCliente ? 'Cliente asignado' : 'Sin cliente'}</Tag>
        </div>
        <Space size={4}>
          <Tag icon={<LockOutlined />} color="warning" style={{ margin: 0 }}>Bloqueada</Tag>
          <Text style={{ fontSize: 12, color: colorTiempo, fontWeight: 600 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />{formatTiempo(tiempoOk)}
          </Text>
        </Space>
        {!esInmobiliaria && <Text style={{ fontSize: 12 }}>{inmoNombre(b.bloqueado_por)}</Text>}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {!esInmobiliaria && !tieneCliente && <Tooltip title="Asignar cliente"><Button size="small" icon={<UserAddOutlined />} onClick={() => abrirAsignarCliente(b)} /></Tooltip>}
          {!esInmobiliaria && <Tooltip title="Extender bloqueo"><Button size="small" icon={<FieldTimeOutlined />} onClick={() => { setExtenderBloqueoModal(b); formExtenderBloqueo.resetFields(); }} /></Tooltip>}
          {!esInmobiliaria && (
            <Tooltip title="Liberar">
              <Button size="small" danger icon={<UnlockOutlined />} onClick={() => abrirLiberarBloqueo(b)} />
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  const renderTablaActivos = () => (
    <div>
      {!isMobile && (procesosActivos.length > 0 || bloqueosFiltrados.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: esInmobiliaria ? '1.2fr 2fr 1.6fr 80px' : '1.2fr 2fr 1.6fr 1.2fr 80px',
          padding: '8px 14px', background: 'var(--panel-soft-bg)', borderRadius: 8,
          marginBottom: 4, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5,
        }}>
          <span>UNIDAD</span><span>CLIENTE</span><span>ESTATUS</span>
          {!esInmobiliaria && <span>INMOBILIARIA</span>}<span />
        </div>
      )}
      {/* Bloqueos sin cliente primero (destacados) */}
      {bloqueosFiltrados.map(renderFilaBloqueo)}
      {/* Procesos activos */}
      {isMobile ? procesosActivos.map(renderTarjetaProceso) : procesosActivos.map(renderFilaProceso)}
      {procesosActivos.length === 0 && bloqueosFiltrados.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
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
          gridTemplateColumns: esInmobiliaria ? '1.2fr 2fr 1.6fr 80px' : '1.2fr 2fr 1.6fr 1.2fr 80px',
          padding: '8px 14px', background: 'var(--panel-soft-bg)', borderRadius: 8,
          marginBottom: 4, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5,
        }}>
          <span>UNIDAD</span><span>CLIENTE</span><span>ESTATUS</span>
          {!esInmobiliaria && <span>INMOBILIARIA</span>}<span />
        </div>
      )}
      {isMobile ? procesosCerrados.map(renderTarjetaProceso) : procesosCerrados.map(renderFilaProceso)}
      {procesosCerrados.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <UserOutlined style={{ fontSize: 40, marginBottom: 12 }} />
          <div>No hay procesos cerrados</div>
        </div>
      )}
    </div>
  );

  const renderTablaDesvinculados = () => (
    <div>
      {!isMobile && procesosDesvinculados.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: esInmobiliaria ? '1.2fr 2fr 1.6fr 80px' : '1.2fr 2fr 1.6fr 1.2fr 80px',
          padding: '8px 14px', background: 'var(--panel-soft-bg)', borderRadius: 8,
          marginBottom: 4, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5,
        }}>
          <span>UNIDAD</span><span>CLIENTE</span><span>ESTATUS</span>
          {!esInmobiliaria && <span>INMOBILIARIA</span>}<span />
        </div>
      )}
      {isMobile ? procesosDesvinculados.map(renderTarjetaProceso) : procesosDesvinculados.map(renderFilaProceso)}
      {procesosDesvinculados.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <UserOutlined style={{ fontSize: 40, marginBottom: 12 }} />
          <div>No hay procesos desvinculados</div>
        </div>
      )}
    </div>
  );

  const opcionesEstado = ['captacion', 'reserva', 'separacion', 'inicial', 'pagos_atrasados', 'contra_entrega', 'vendida', 'desvinculado'].map(e => ({
    value: e,
    label: (
      <Tooltip title={ESTADO_PROCESO_DESCRIPCION[e]} placement="right">
        <Tag color={ESTADO_PROCESO_COLOR[e]} style={{ margin: 0 }}>
          {e === 'captacion' ? 'Captacion/Bloqueos' : ESTADO_PROCESO_LABEL[e]}
        </Tag>
      </Tooltip>
    ),
  }));

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {vista === 'procesos' && (
            <Tooltip title="Volver a proyectos">
              <Button icon={<ArrowLeftOutlined />} onClick={volverAProyectos} />
            </Tooltip>
          )}
          <Title level={4} style={{ margin: 0 }}>
            {vista === 'proyectos' ? 'Proyectos' : proyectoSeleccionado?.nombre ?? 'Procesos de venta'}
          </Title>
        </div>
        <Space wrap style={{ width: isMobile ? '100%' : undefined }}>
          {vista === 'proyectos' && (
            <Select
              allowClear
              showSearch
              placeholder="Seleccionar proyecto"
              value={proyectoFiltro}
              onChange={cambiarProyectoFiltro}
              optionFilterProp="label"
              style={{ width: isMobile ? '100%' : 260 }}
              options={proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
            />
          )}
          {vista === 'procesos' && (
            <Button icon={<ReloadOutlined />} loading={loading || loadingBloqueos} onClick={() => { cargar(); cargarBloqueosSinCliente(); }}>
              {!isMobile && 'Actualizar'}
            </Button>
          )}
        </Space>
      </div>

      {/* Vista proyectos */}
      {vista === 'proyectos' && (
        <Row gutter={[20, 20]}>
          {proyectos.map(p => (
            <Col key={p.proyecto_id} xs={24} sm={12} md={8} lg={6}>
              <div 
                style={{ 
                  borderRadius: 16, 
                  overflow: 'hidden', 
                  cursor: 'pointer', 
                  background: 'var(--panel-bg)', 
                  border: '1px solid var(--app-border)', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', 
                  transition: 'box-shadow 0.2s, transform 0.2s' 
                }}
                onClick={() => seleccionarProyecto(p)}
                onMouseEnter={e => { 
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; 
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; 
                }}
                onMouseLeave={e => { 
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; 
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; 
                }}
              >
                <div style={{ 
                  height: 160, 
                  background: p.imagen_url ? undefined : projectGradient(p.nombre), 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  position: 'relative', 
                  overflow: 'hidden' 
                }}>
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <AppstoreOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{p.nombre}</Text>
                  {p.descripcion ? (
                    <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: p.descripcion }}>{p.descripcion}</Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>Sin descripción</Text>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Vista procesos */}
      {vista === 'procesos' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Select
              allowClear
              showSearch
              placeholder="Proyecto"
              value={proyectoFiltro}
              onChange={cambiarProyectoFiltro}
              optionFilterProp="label"
              style={{ width: isMobile ? '100%' : 220 }}
              options={proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
            />
            <Input prefix={<SearchOutlined />} placeholder="Buscar cliente, cédula o unidad..."
              style={{ width: isMobile ? '100%' : 240 }} value={busqueda}
              onChange={e => setBusqueda(e.target.value)} allowClear />
            {!esInmobiliaria && (
              <Select allowClear placeholder="Inmobiliaria" style={{ width: isMobile ? '100%' : 180 }}
                value={inmoFiltro} options={inmobiliarias.map(i => ({ value: i.pk, label: i.nombre }))}
                onChange={v => setInmoFiltro(v)} />
            )}
            <Select allowClear placeholder="Estatus" style={{ width: isMobile ? '100%' : 150 }}
              value={estadoFiltro} options={opcionesEstado}
              onChange={v => {
                setEstadoFiltro(v);
                const siguienteTab: TabProcesos = v === 'desvinculado'
                  ? 'desvinculados'
                  : v && ESTADOS_CERRADOS.includes(v)
                    ? 'cerrados'
                    : 'activos';
                // Cambiar a la lista que corresponde al estatus seleccionado.
                if (tabActiva !== siguienteTab) {
                  setTabActiva(siguienteTab);
                  if (!procesosCompletosRef.current && siguienteTab !== 'activos') {
                    cargar({ incluirCerrados: true });
                  }
                }
              }} />
            <Button onClick={limpiarFiltros}>Limpiar</Button>
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={tabActiva}
            onChange={key => {
              const t = key as TabProcesos;
              setTabActiva(t);
              if (t === 'historial') {
                cargarHistorialBloqueos();
              } else if (!procesosCompletosRef.current && t !== 'activos') {
                cargar({ incluirCerrados: true });
              }
            }}
            items={[
              {
                key: 'activos',
                label: `Activos (${procesosActivos.length})`,
                children: renderTablaActivos(),
              },
              {
                key: 'cerrados',
                label: `Cerrados (${procesosCerrados.length})`,
                children: renderTablaCerrados(),
              },
              {
                key: 'desvinculados',
                label: `Desvinculados (${procesosDesvinculados.length})`,
                children: renderTablaDesvinculados(),
              },
              ...(!esInmobiliaria ? [{
                key: 'historial',
                label: <span><HistoryOutlined /> Historial bloqueos</span>,
                children: (
                  <div>
                    {isMobile ? (
                      <div>
                        {loadingHistorialBloqueos && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Cargando historial...</div>}
                        {!loadingHistorialBloqueos && historialBloqueos.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No hay registros en el historial</div>}
                        {historialBloqueos.map(item => {
                          const motivo = item.motivo_liberacion;
                          const cfg: Record<string, string> = { automatica: 'success', manual: 'blue', venta: 'purple' };
                          return (
                            <div key={item.sk} style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', marginBottom: 10, padding: '14px 16px' }}>
                              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                  <Text strong>{[item.torre_nombre, item.unidad_nombre ?? item.unidad_id].filter(Boolean).join(' · ')}</Text>
                                  {motivo ? <Tag color={cfg[motivo] ?? 'default'} style={{ margin: 0 }}>{motivo}</Tag> : <Tag color="warning" style={{ margin: 0 }}>Activo</Tag>}
                                </div>
                                <Text type="secondary">{proyectoNombre(item.proyecto_id)}</Text>
                                <Tag style={{ width: 'fit-content' }}>{item.inmobiliaria_nombre ?? inmoNombre(item.inmobiliaria_id)}</Tag>
                                <Text type="secondary">Bloqueado: {item.fecha_bloqueo ? new Date(item.fecha_bloqueo).toLocaleString('es-VE') : '—'}</Text>
                                <Text type="secondary">Liberado: {item.fecha_liberacion ? new Date(item.fecha_liberacion).toLocaleString('es-VE') : '—'}</Text>
                                <Text type="secondary">Liberado por: {item.liberado_por ?? '—'}</Text>
                              </Space>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
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
                    )}
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
        </>
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
          <div style={{ background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <Text strong>{extenderProcesoModal.unidad_nombre || extenderProcesoModal.unidad_id}</Text>
            {extenderProcesoModal.fecha_liberacion_unidad && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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
          <div style={{ background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <Text strong>{extenderBloqueoModal.id_unidad || extenderBloqueoModal.unidad_id}</Text>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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

      {/* Modal traspasar cliente de un proceso */}
      <Modal
        title="Traspasar cliente"
        open={!!traspasarModal}
        onCancel={() => {
          setTraspasarModal(null);
          setClienteTraspaso(null);
          formTraspasar.resetFields();
        }}
        onOk={() => formTraspasar.submit()}
        okText="Confirmar traspaso"
        cancelText="Cancelar"
        confirmLoading={guardandoTraspaso}
        width={600}
      >
        {traspasarModal && (
          <>
            <div style={{ background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <Row gutter={[12, 8]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>CLIENTE ACTUAL</Text>
                  <div><Text strong>{nombreCliente(traspasarModal)}</Text></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{traspasarModal.cedula}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>UNIDAD Y ESTADO</Text>
                  <div><Text strong>{traspasarModal.unidad_nombre || traspasarModal.unidad_id}</Text></div>
                  <Tag color={ESTADO_PROCESO_COLOR[traspasarModal.estado]}>
                    {ESTADO_PROCESO_LABEL[traspasarModal.estado] ?? traspasarModal.estado}
                  </Tag>
                </Col>
              </Row>
            </div>

            <Radio.Group
              value={modoTraspasar}
              onChange={e => {
                setModoTraspasar(e.target.value);
                setClienteTraspaso(null);
                formTraspasar.resetFields();
              }}
              buttonStyle="solid"
              style={{ marginBottom: 16 }}
            >
              <Radio.Button value="existente"><SearchOutlined /> Cliente existente</Radio.Button>
              <Radio.Button value="nuevo"><UserAddOutlined /> Nuevo cliente</Radio.Button>
            </Radio.Group>

            <Form form={formTraspasar} layout="vertical" onFinish={handleTraspasarCliente}>
              {modoTraspasar === 'existente' ? (
                <Form.Item label="Cliente destino" required>
                  <Select
                    showSearch
                    filterOption={false}
                    loading={buscandoClientesTraspaso}
                    placeholder="Buscar por nombre o cédula..."
                    onSearch={buscarCandidatosTraspaso}
                    onChange={cedula => setClienteTraspaso(
                      clientesTraspaso.find(c => c.cedula === cedula) ?? null
                    )}
                    options={clientesTraspaso.map(c => ({
                      value: c.cedula,
                      label: `${c.nombres} ${c.apellidos} — ${c.cedula}`,
                    }))}
                    notFoundContent={buscandoClientesTraspaso ? <Spin size="small" /> : 'Sin resultados'}
                  />
                </Form.Item>
              ) : (
                <>
                  <Form.Item name="cedula" label="Cédula / Pasaporte" rules={clienteFormRules.cedula}>
                    <Input placeholder="12345678 o AB123456" />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="nombres" label="Nombres" rules={clienteFormRules.nombres} normalize={clienteFieldNormalizers.nombre}>
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="apellidos" label="Apellidos" rules={clienteFormRules.apellidos} normalize={clienteFieldNormalizers.nombre}>
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="correo" label="Correo" rules={clienteFormRules.correo} normalize={clienteFieldNormalizers.correo}>
                        <Input type="email" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="telefono" label="Teléfono" rules={clienteFormRules.telefono}>
                        <Input inputMode="numeric" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item name="estado_civil" label="Estado civil"><EstadoCivilSelect /></Form.Item>
                  <Form.Item name="nacionalidad" label="Nacionalidad"><NacionalidadSelect /></Form.Item>
                  <Form.Item name="pais_residencia" label="País de residencia"><PaisResidenciaSelect /></Form.Item>
                </>
              )}

              <Form.Item
                name="justificacion"
                label="Justificación"
                rules={[
                  { required: true, message: 'Ingresa el motivo del traspaso' },
                  { min: 5, message: 'Ingresa al menos 5 caracteres' },
                ]}
              >
                <Input.TextArea rows={3} placeholder="Motivo administrativo del cambio de cliente..." />
              </Form.Item>
            </Form>

            <Text type="warning" style={{ fontSize: 12 }}>
              El estado y las fechas del proceso se conservarán. Esta acción quedará registrada en el historial.
            </Text>
          </>
        )}
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
          <div style={{ background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
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
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--panel-soft-bg)', border: '1px solid #52c41a', borderRadius: 8 }}>
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
            <Form.Item name="cedula" label="Cédula / Pasaporte" rules={clienteFormRules.cedula}><Input placeholder="12345678 o AB123456" /></Form.Item>
            <Form.Item name="nombres" label="Nombres" rules={clienteFormRules.nombres} normalize={clienteFieldNormalizers.nombre}><Input /></Form.Item>
            <Form.Item name="apellidos" label="Apellidos" rules={clienteFormRules.apellidos} normalize={clienteFieldNormalizers.nombre}><Input /></Form.Item>
            <Form.Item name="correo" label="Correo" rules={clienteFormRules.correo} normalize={clienteFieldNormalizers.correo}><Input type="email" placeholder="correo@ejemplo.com" /></Form.Item>
            <Form.Item name="telefono" label="Teléfono" rules={clienteFormRules.telefono}><Input inputMode="numeric" placeholder="584120000000" /></Form.Item>
            <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="estado_civil" label="Estado civil">
              <EstadoCivilSelect />
            </Form.Item>
            <Form.Item name="nacionalidad" label="Nacionalidad"><NacionalidadSelect /></Form.Item>
            <Form.Item name="pais_residencia" label="País de residencia"><PaisResidenciaSelect /></Form.Item>
          </Form>
        )}
      </Modal>

      {/* ── Drawer: Detalle de unidad ─────────────────────────────────── */}
      <Drawer
        title={unidadDrawer ? `Unidad ${unidadDrawer.id_unidad}` : 'Detalle de unidad'}
        open={loadingUnidad || unidadDrawer !== null}
        onClose={() => setUnidadDrawer(null)}
        width={isMobile ? '100%' : 480}
        extra={unidadDrawer && (
          <Tag color={
            unidadDrawer.estado === 'disponible' ? 'green' :
            unidadDrawer.estado === 'bloqueada' ? 'orange' : 'red'
          }>{unidadDrawer.estado.toUpperCase()}</Tag>
        )}
      >
        {loadingUnidad ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : unidadDrawer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Identificación */}
            <Descriptions title="Identificación" bordered size="small" column={1}>
              <Descriptions.Item label="ID Unidad">{unidadDrawer.id_unidad}</Descriptions.Item>
              {unidadDrawer.tipo && <Descriptions.Item label="Tipo">{unidadDrawer.tipo}</Descriptions.Item>}
              {unidadDrawer.etapa_id && etapasDrawer.find(e => e.etapa_id === unidadDrawer.etapa_id) && (
                <Descriptions.Item label="Etapa">
                  <Tag color="blue">{etapasDrawer.find(e => e.etapa_id === unidadDrawer.etapa_id)?.nombre}</Tag>
                </Descriptions.Item>
              )}
              {unidadDrawer.piso && <Descriptions.Item label="Piso">{unidadDrawer.piso}</Descriptions.Item>}
              {unidadDrawer.manzana && <Descriptions.Item label="Bloque">{unidadDrawer.manzana}</Descriptions.Item>}
            </Descriptions>

            {/* Estado de bloqueo */}
            {unidadDrawer.estado === 'bloqueada' && (
              <Descriptions title="Bloqueo activo" bordered size="small" column={1}>
                {unidadDrawer.bloqueado_por && (
                  <Descriptions.Item label="Inmobiliaria">
                    {inmoNombre(unidadDrawer.bloqueado_por)}
                  </Descriptions.Item>
                )}
                {unidadDrawer.cliente_cedula && (
                  <Descriptions.Item label="Cédula cliente">{unidadDrawer.cliente_cedula}</Descriptions.Item>
                )}
                {unidadDrawer.fecha_bloqueo && (
                  <Descriptions.Item label="Inicio bloqueo">
                    {dayjs(unidadDrawer.fecha_bloqueo).format('DD/MM/YYYY HH:mm')}
                  </Descriptions.Item>
                )}
                {unidadDrawer.fecha_liberacion && (
                  <Descriptions.Item label="Vence">
                    {dayjs(unidadDrawer.fecha_liberacion).format('DD/MM/YYYY HH:mm')}
                  </Descriptions.Item>
                )}
                {unidadDrawer.tiempo_restante != null && (
                  <Descriptions.Item label="Tiempo restante">
                    <Tag color={unidadDrawer.tiempo_restante <= 0 ? 'red' : unidadDrawer.tiempo_restante < 3600 ? 'orange' : 'green'}>
                      {formatTiempo(unidadDrawer.tiempo_restante)}
                    </Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}

            {/* Dimensiones */}
            <Descriptions title="Dimensiones" bordered size="small" column={1}>
              <Descriptions.Item label="Metraje">{unidadDrawer.metraje} m²</Descriptions.Item>
              {unidadDrawer.metraje_terraza != null && (
                <Descriptions.Item label="Terraza">{unidadDrawer.metraje_terraza} m²</Descriptions.Item>
              )}
              {unidadDrawer.metraje_patio != null && (
                <Descriptions.Item label="Patio">{unidadDrawer.metraje_patio} m²</Descriptions.Item>
              )}
              {unidadDrawer.num_cuartos != null && (
                <Descriptions.Item label="Habitaciones">{unidadDrawer.num_cuartos}</Descriptions.Item>
              )}
              {unidadDrawer.num_banos != null && (
                <Descriptions.Item label="Baños">{unidadDrawer.num_banos}</Descriptions.Item>
              )}
              {unidadDrawer.parqueos != null && (
                <Descriptions.Item label="Parqueos">{unidadDrawer.parqueos}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Precios */}
            <Descriptions title="Precios" bordered size="small" column={1}>
              <Descriptions.Item label="Precio base">
                ${Number(unidadDrawer.precio).toLocaleString()}
              </Descriptions.Item>
              {unidadDrawer.precio_reserva != null && (
                <Descriptions.Item label="Precio reserva">
                  ${Number(unidadDrawer.precio_reserva).toLocaleString()}
                </Descriptions.Item>
              )}
              {unidadDrawer.precio_separacion != null && (
                <Descriptions.Item label="Precio separación">
                  ${Number(unidadDrawer.precio_separacion).toLocaleString()}
                </Descriptions.Item>
              )}
              {unidadDrawer.precio_inicial != null && (
                <Descriptions.Item label="Precio inicial">
                  ${Number(unidadDrawer.precio_inicial).toLocaleString()}
                </Descriptions.Item>
              )}
              {unidadDrawer.cuota_monto != null && (
                <Descriptions.Item label="Cuota mensual">
                  ${Number(unidadDrawer.cuota_monto).toLocaleString()} × {unidadDrawer.cuota_meses} meses
                </Descriptions.Item>
              )}
              {unidadDrawer.contra_entrega != null && (
                <Descriptions.Item label="Contra entrega">
                  ${Number(unidadDrawer.contra_entrega).toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Comentario */}
            {!esInmobiliaria && unidadDrawer.comentario && (
              <Descriptions title="Notas" bordered size="small" column={1}>
                <Descriptions.Item label="Comentario">{unidadDrawer.comentario}</Descriptions.Item>
              </Descriptions>
            )}

            {/* Botón bloquear (solo admin, solo disponible) */}
            {!esInmobiliaria && unidadDrawer.estado === 'disponible' && (
              <Button
                type="primary"
                icon={<LockOutlined />}
                block
                onClick={() => setModalBloqueoAdmin(true)}
              >
                Crear bloqueo
              </Button>
            )}

          </div>
        ) : null}
      </Drawer>

      {/* ── Modal crear bloqueo admin (desde drawer unidad) ──────────────── */}
      <ModalCrearBloqueoAdmin
        open={modalBloqueoAdmin}
        unidad={unidadDrawer}
        proyectoId={drawerProyectoId}
        inmobiliarias={inmobiliarias}
        guardando={guardandoBloqueoAdmin}
        onCancel={() => setModalBloqueoAdmin(false)}
        onBloquear={handleCrearBloqueoAdmin}
      />

    </div>
  );
};

export default ProcesosPage;
