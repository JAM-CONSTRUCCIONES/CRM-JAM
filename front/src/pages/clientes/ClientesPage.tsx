import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Table, Tag, Button, Modal, Form, Input, Select,
  DatePicker, message, Space, Tooltip, Spin, Grid, Alert, Progress,
  Row, Col,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, UserOutlined, HistoryOutlined,
  SwapOutlined, SearchOutlined, EditOutlined, BankOutlined,
  ClockCircleOutlined, DeleteOutlined, ArrowLeftOutlined, AppstoreOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getClientes, getClientesAdmin, buscarClienteAdmin, buscarClientesAdmin,
  registrarCliente, registrarClienteAdmin, actualizarClienteAdmin, transferirClienteInmobiliaria,
  eliminarClienteAdmin, cambiarCedula, exportarClientesProyecto,
} from '../../services/clientes.service';
import { getProcesosCliente, getMisProcesos, cambiarEstatus } from '../../services/crm.service';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import { useAuthContext } from '../../context/AuthContext';
import type { Cliente, Proyecto, Proceso, ClienteProyecto } from '../../types';
import CambiarEstatusModal, { type ModoNotificacion } from '../../components/common/CambiarEstatusModal';
import { confirmarExclusividadCliente } from '../../components/common/ConfirmarExclusividadCliente';
import HistorialEstatusDrawer from '../../components/common/HistorialEstatusDrawer';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL, ESTADO_PROCESO_DESCRIPCION, projectGradient } from '../../constants/estados';
import { clienteFieldNormalizers, clienteFormRules, normalizeClientePayload } from '../../utils/clientesValidation';
import { EstadoCivilSelect, NacionalidadSelect, PaisResidenciaSelect } from '../../components/common/CatalogoClienteFields';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const ESTATUS_CLIENTE_OPTIONS = [
  { value: 'sin_unidad_actual', label: 'Sin unidad actual' },
  { value: 'captacion', label: ESTADO_PROCESO_LABEL.captacion },
  { value: 'reserva', label: ESTADO_PROCESO_LABEL.reserva },
  { value: 'separacion', label: ESTADO_PROCESO_LABEL.separacion },
  { value: 'inicial', label: ESTADO_PROCESO_LABEL.inicial },
  { value: 'pagos_atrasados', label: ESTADO_PROCESO_LABEL.pagos_atrasados },
  { value: 'contra_entrega', label: ESTADO_PROCESO_LABEL.contra_entrega },
  { value: 'vendida', label: ESTADO_PROCESO_LABEL.vendida },
];

// Función para calcular días restantes de exclusividad
const fechaValida = (fecha?: string | null): boolean => !!fecha && dayjs(fecha).isValid();

const formatFecha = (fecha?: string | null, formato = 'DD/MM/YYYY'): string =>
  fechaValida(fecha) ? dayjs(fecha).format(formato) : 'Sin fecha';

const calcularDiasRestantes = (fechaVencimiento?: string | null): number => {
  if (!fechaValida(fechaVencimiento)) return 0;
  const ahora = new Date();
  const vencimiento = new Date(fechaVencimiento as string);
  const diff = vencimiento.getTime() - ahora.getTime();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Number.isFinite(dias) ? dias : 0;
};

// Función para obtener color según días restantes
const getColorExclusividad = (dias: number): string => {
  if (dias <= 0) return '#ff4d4f'; // Rojo - vencida
  if (dias <= 15) return '#faad14'; // Naranja - próxima a vencer
  if (dias <= 30) return '#1677ff'; // Azul - menos de 1 mes
  return '#52c41a'; // Verde - más de 1 mes
};

const ClientesPage = () => {
  const { usuario } = useAuthContext();
  const isAdmin = usuario?.rol !== 'inmobiliaria';
  const canDeleteClientes = usuario?.rol === 'admin';
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Lista plana de clientes del proyecto seleccionado
  const [clientes, setClientes] = useState<ClienteProyecto[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<Proyecto | null>(null);
  const [vista, setVista] = useState<'proyectos' | 'clientes'>('proyectos');
  const [inmoFiltro, setInmoFiltro] = useState<string | undefined>();
  const [estatusFiltro, setEstatusFiltro] = useState<string | undefined>();
  const [modoVista, setModoVista] = useState<'lista' | 'busqueda'>('lista');
  const [tipoBusqueda, setTipoBusqueda] = useState<'nombre' | 'cedula'>('nombre');

  // Drawer de detalle por cédula (admin)
  const [drawerCedula, setDrawerCedula] = useState<string | null>(null);
  const [drawerRegistros, setDrawerRegistros] = useState<(Cliente & { procesos: Proceso[] })[]>([]);
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  // Drawer de detalle simple (inmobiliaria)
  const [drawerCliente, setDrawerCliente] = useState<Cliente | null>(null);
  const [drawerProcesos, setDrawerProcesos] = useState<Proceso[]>([]);

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [formEditar] = Form.useForm();
  const [editarModal, setEditarModal] = useState(false);
  const [editarRegistro, setEditarRegistro] = useState<Cliente | null>(null);
  const [estatusModal, setEstatusModal] = useState<Proceso | null>(null);
  const [estatusCliente, setEstatusCliente] = useState<Cliente | null>(null);
  const [historialProceso, setHistorialProceso] = useState<Proceso | null>(null);
  const [historialNombre, setHistorialNombre] = useState('');
  
  // Modal transferir inmobiliaria
  const [transferirModal, setTransferirModal] = useState(false);
  const [clienteTransferir, setClienteTransferir] = useState<Cliente | null>(null);
  const [procesoTransferir, setProcesoTransferir] = useState<any | null>(null);
  const [formTransferir] = Form.useForm();
  const [transfiriendo, setTransfiriendo] = useState(false);

  // Modal cambiar cédula
  const [cedulaModal, setCedulaModal] = useState(false);
  const [clienteCedula, setClienteCedula] = useState<Cliente | null>(null);
  const [nuevaCedula, setNuevaCedula] = useState('');
  const [cambiandoCedula, setCambiandoCedula] = useState(false);
  const normalizarNuevaCedula = (value: string) => value.trim().toUpperCase();
  const nuevaCedulaNormalizada = normalizarNuevaCedula(nuevaCedula);
  const nuevaCedulaInvalida = !!nuevaCedulaNormalizada && !/^[A-Z0-9]+$/.test(nuevaCedulaNormalizada);

  // Modal eliminar cliente
  const [eliminarModal, setEliminarModal] = useState(false);
  const [clienteEliminar, setClienteEliminar] = useState<Cliente | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Ref para debounce de búsqueda
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const cargar = useCallback(async (proyId?: string, inmoId?: string, token?: string) => {
    if (!proyId) {
      setClientes([]);
      setNextToken(undefined);
      return;
    }
    setLoading(true);
    try {
      if (isAdmin) {
        const data = await getClientesAdmin(
          { proyecto_id: proyId, inmobiliaria_id: inmoId, next_token: token, vista: 'proyecto' }
        );
        setClientes(prev => token ? [...prev, ...data.items] : data.items);
        setNextToken(data.next_token);
      } else {
        const data = await getClientes(proyId, true);
        setClientes(data as ClienteProyecto[]);
      }
    } catch { message.error('Error al cargar clientes'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => {
    getProyectos().then(setProyectos).catch(() => {});
    if (isAdmin) getInmobiliarias().then(setInmobiliarias).catch(() => {});
  }, [isAdmin]);

  const proyectoNombre = (id: string) => proyectos.find(p => p.proyecto_id === id)?.nombre ?? id;
  const inmoNombre = (id: string) => {
    const normalizado = id.replace('INMOBILIARIA#', '');
    return inmobiliarias.find(i =>
      i.pk === id ||
      i.pk === `INMOBILIARIA#${normalizado}` ||
      i.pk.replace('INMOBILIARIA#', '') === normalizado
    )?.nombre ?? id;
  };

  const seleccionarProyecto = (proyecto: Proyecto) => {
    setProyectoSeleccionado(proyecto);
    setProyectoFiltro(proyecto.proyecto_id);
    setVista('clientes');
    setBusqueda('');
    setEstatusFiltro(undefined);
    setModoVista('lista');
    setNextToken(undefined);
    cargar(proyecto.proyecto_id, inmoFiltro);
  };

  const cambiarProyectoFiltro = (proyectoId?: string) => {
    if (!proyectoId) {
      volverAProyectos();
      return;
    }

    setVista('clientes');
    setProyectoFiltro(proyectoId);
    setProyectoSeleccionado(proyectos.find(p => p.proyecto_id === proyectoId) ?? null);
    setNextToken(undefined);

    if (modoVista === 'busqueda' && busqueda.trim().length >= 2) {
      setLoading(true);
      buscarClientesAdmin(
        busqueda,
        tipoBusqueda,
        proyectoId,
        inmoFiltro
      ).then(resultados => {
        setClientes(resultados as ClienteProyecto[]);
        setNextToken(undefined);
      }).catch(() => {
        message.error('Error en la busqueda');
      }).finally(() => {
        setLoading(false);
      });
    } else {
      cargar(proyectoId, inmoFiltro);
    }
  };

  const volverAProyectos = () => {
    setVista('proyectos');
    setProyectoSeleccionado(null);
    setProyectoFiltro(undefined);
    setClientes([]);
    setBusqueda('');
    setEstatusFiltro(undefined);
    setModoVista('lista');
    setNextToken(undefined);
  };

  const handleExportarClientes = async () => {
    if (!proyectoFiltro) return;
    setExportando(true);
    try {
      const result = await exportarClientesProyecto(proyectoFiltro, isAdmin, inmoFiltro);
      message.success(`Descargando ${result.total_clientes} clientes...`);
      const link = document.createElement('a');
      link.href = result.download_url;
      link.download = result.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      message.error(err?.message || 'Error al exportar clientes');
    } finally {
      setExportando(false);
    }
  };

  // Manejar búsqueda con lógica híbrida
  const handleBusqueda = (valor: string) => {
    setBusqueda(valor);
    
    // Limpiar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (proyectoFiltro) {
      setModoVista('lista');
      return;
    }
    
    // Sin búsqueda: volver a modo lista
    if (valor.trim().length === 0) {
      setModoVista('lista');
      setNextToken(undefined);
      cargar(proyectoFiltro, inmoFiltro);
      return;
    }
    
    // Búsqueda muy corta (1 carácter): filtrar localmente sin hacer request
    if (valor.trim().length < 2) {
      setModoVista('lista');
      return;
    }
    
    // Búsqueda >= 2 caracteres: buscar en backend
    setModoVista('busqueda');
    
    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resultados = await buscarClientesAdmin(
          valor,
          tipoBusqueda,
          proyectoFiltro,
          inmoFiltro
        );
        setClientes(resultados as ClienteProyecto[]);
        setNextToken(undefined); // No hay paginación en búsqueda
      } catch {
        message.error('Error en la búsqueda');
      } finally {
        setLoading(false);
      }
    }, 500); // Espera 500ms después de que el usuario deje de escribir
  };

  // Función para re-ejecutar búsqueda cuando cambian los filtros
  // const reejecutarBusqueda = useCallback(() => {
  //   if (modoVista === 'busqueda' && busqueda.trim().length >= 2) {
  //     // Si estamos en modo búsqueda, re-ejecutar la búsqueda con los nuevos filtros
  //     setLoading(true);
  //     buscarClientesAdmin(
  //       busqueda,
  //       tipoBusqueda,
  //       proyectoFiltro,
  //       inmoFiltro
  //     ).then(resultados => {
  //       setClientes(resultados);
  //       setNextToken(undefined);
  //     }).catch(() => {
  //       message.error('Error en la búsqueda');
  //     }).finally(() => {
  //       setLoading(false);
  //     });
  //   } else {
  //     // Si no estamos en búsqueda, cargar normalmente
  //     cargar(proyectoFiltro, inmoFiltro);
  //   }
  // }, [modoVista, busqueda, tipoBusqueda, proyectoFiltro, inmoFiltro, cargar]);

  // Filtro local por búsqueda (solo para búsquedas de 1 carácter)
  const normalizarEstatus = (value?: string) => (value || '').trim().toLowerCase();

  const clienteCoincideBusqueda = (c: ClienteProyecto) => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto || modoVista !== 'lista') return true;
    return (
      c.cedula.toLowerCase().includes(texto) ||
      `${c.nombres} ${c.apellidos}`.toLowerCase().includes(texto) ||
      (c.unidad_nombre || c.unidad_id || '').toLowerCase().includes(texto) ||
      (c.estatus_label || c.estatus || '').toLowerCase().includes(texto)
    );
  };

  const clienteCoincideEstatus = (c: ClienteProyecto) => {
    if (!estatusFiltro) return true;
    const estatus = normalizarEstatus(c.estatus);
    if (estatusFiltro === 'sin_unidad_actual') {
      return estatus === 'sin_unidad' || estatus === 'desvinculado';
    }
    return estatus === normalizarEstatus(estatusFiltro);
  };

  const clientesFiltrados = clientes.filter(c =>
    clienteCoincideBusqueda(c) && clienteCoincideEstatus(c)
  );

  // Abrir drawer de detalle por cédula (admin)
  const valorDetalle = (value?: string | number | null) => {
    const texto = String(value ?? '').trim();
    return texto || 'Sin dato';
  };

  const DetalleCampo = ({ label, value, strong = false }: { label: string; value?: string | number | null; strong?: boolean }) => (
    <div>
      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>{label}</Text>
      <div>
        <Text strong={strong} type={value ? undefined : 'secondary'}>{valorDetalle(value)}</Text>
      </div>
    </div>
  );

  const abrirDetalleCedula = async (cedula: string) => {
    setDrawerCedula(cedula);
    setDrawerRegistros([]);
    setLoadingDrawer(true);
    try {
      const data = await buscarClienteAdmin(cedula);
      // Enriquecer con procesos
      const enriquecidos = await Promise.all(
        data.map(async (c) => {
          try {
            const procs = await getProcesosCliente(c.cedula, c.inmobiliaria_id);
            return { ...c, procesos: procs };
          } catch { return { ...c, procesos: [] }; }
        })
      );
      setDrawerRegistros(enriquecidos);
    } catch { setDrawerRegistros([]); }
    finally { setLoadingDrawer(false); }
  };

  // Abrir drawer simple (inmobiliaria)
  const abrirDrawerInmo = async (cliente: Cliente) => {
    setDrawerCliente(cliente);
    setDrawerProcesos([]);
    try {
      const p = await getMisProcesos(cliente.proyecto_id);
      setDrawerProcesos(p.filter(x => x.cedula === cliente.cedula));
    } catch { setDrawerProcesos([]); }
  };

  const abrirEditar = (registro: Cliente) => {
    setEditarRegistro(registro);
    formEditar.resetFields();
    formEditar.setFieldsValue({
      nombres: registro.nombres ?? '',
      apellidos: registro.apellidos ?? '',
      correo: registro.correo ?? '',
      telefono: registro.telefono ?? '',
      estado_civil: registro.estado_civil ?? null,
      nacionalidad: registro.nacionalidad ?? null,
      pais_residencia: registro.pais_residencia ?? null,
      fecha_nacimiento: registro.fecha_nacimiento ? dayjs(registro.fecha_nacimiento) : null,
    });
    setEditarModal(true);
  };

  const handleEditar = async (values: any) => {
    if (!editarRegistro) return;
    const payload = {
      ...normalizeClientePayload(values),
      fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
    };
    try {
      const respuesta = await actualizarClienteAdmin(editarRegistro.cedula, editarRegistro.proyecto_id, editarRegistro.inmobiliaria_id, payload);
      const datosActualizados = respuesta.cliente ? { ...payload, ...respuesta.cliente } : payload;
      message.success('Cliente actualizado');
      setEditarModal(false);
      setEditarRegistro(null);

      setClientes(prev => prev.map(cliente => (
        cliente.cedula === editarRegistro.cedula &&
        cliente.proyecto_id === editarRegistro.proyecto_id &&
        cliente.inmobiliaria_id === editarRegistro.inmobiliaria_id
          ? { ...cliente, ...datosActualizados }
          : cliente
      )));
      setDrawerRegistros(prev => prev.map(registro => (
        registro.cedula === editarRegistro.cedula &&
        registro.proyecto_id === editarRegistro.proyecto_id &&
        registro.inmobiliaria_id === editarRegistro.inmobiliaria_id
          ? { ...registro, ...datosActualizados }
          : registro
      )));
      setDrawerCliente(prev => (
        prev &&
        prev.cedula === editarRegistro.cedula &&
        prev.proyecto_id === editarRegistro.proyecto_id &&
        prev.inmobiliaria_id === editarRegistro.inmobiliaria_id
          ? { ...prev, ...datosActualizados }
          : prev
      ));

      if (modoVista === 'lista') {
        await cargar(proyectoFiltro, inmoFiltro);
      }
      if (drawerCedula) await abrirDetalleCedula(drawerCedula);
    } catch (err: any) {
      console.error('Error al actualizar cliente:', err);
      // El mensaje ya viene procesado por handleApiError en api.ts
      const errorMessage = err?.message || 'Error al actualizar';
      message.error(errorMessage);
    }
  };

  const handleCambiarEstatus = async (estatus: string, notificar: ModoNotificacion) => {
    if (!estatusModal || !estatusCliente) return;
    try {
      await cambiarEstatus(estatusCliente.cedula, estatusModal.proyecto_id, estatusModal.unidad_id,
        { estatus, inmobiliaria_id: estatusModal.inmobiliaria_id, notificar });
      message.success(`Estatus actualizado a ${ESTADO_PROCESO_LABEL[estatus] ?? estatus}`);
      setEstatusModal(null); setEstatusCliente(null);
      if (drawerCedula) abrirDetalleCedula(drawerCedula);
      cargar(proyectoFiltro, inmoFiltro);
    } catch (err: any) {
      console.error('Error al cambiar estatus:', err);
      // El mensaje ya viene procesado por handleApiError en api.ts
      const errorMessage = err?.message || 'Error al cambiar estatus';
      message.error(errorMessage);
      throw err;
    }
  };

  const handleRegistrar = async (values: any) => {
    try {
      const payload = {
        ...normalizeClientePayload(values),
        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
      };
      if (isAdmin) {
        try {
          await registrarClienteAdmin(payload);
        } catch (err: any) {
          const status = err?.response?.statusCode ?? err?.response?.status;
          const errorMessage = err?.response?.data?.message || err?.message || '';
          const puedeForzar = usuario?.rol === 'admin' || usuario?.rol === 'coordinador';
          if (status === 409 && puedeForzar && errorMessage.toLowerCase().includes('exclusividad')) {
            if (!await confirmarExclusividadCliente(errorMessage)) {
              message.info('Operación cancelada');
              return;
            }
            await registrarClienteAdmin({ ...payload, forzar_admin: true });
          } else {
            throw err;
          }
        }
      } else {
        await registrarCliente(payload);
      }
      message.success(isAdmin ? 'Cliente añadido' : 'Cliente registrado');
      setModalOpen(false); form.resetFields();
      setNextToken(undefined);
      cargar(proyectoFiltro, inmoFiltro);
    } catch (err: any) {
      console.error('Error al registrar cliente:', err);
      // El mensaje ya viene procesado por handleApiError en api.ts
      const errorMessage = err?.message || 'Error al registrar cliente';
      const status = err?.response?.status ?? err?.response?.statusCode;
      
      if (status === 409) {
        message.error(errorMessage);
      } else {
        message.error(errorMessage);
      }
    }
  };

  const abrirTransferir = (cliente: Cliente, proceso?: any) => {
    console.log('[TRANSFERIR] Cliente:', cliente);
    console.log('[TRANSFERIR] Proceso:', proceso);
    console.log('[TRANSFERIR] unidad_id:', proceso?.unidad_id);
    setClienteTransferir(cliente);
    setProcesoTransferir(proceso || null);
    formTransferir.resetFields();
    setTransferirModal(true);
  };

  const abrirCambiarCedula = (cliente: Cliente) => {
    setClienteCedula(cliente);
    setNuevaCedula('');
    setCedulaModal(true);
  };

  const handleCambiarCedula = async () => {
    if (!clienteCedula || !nuevaCedula.trim()) return;
    if (nuevaCedulaInvalida) {
      message.warning('La cedula/pasaporte solo debe contener letras y numeros, sin guiones ni simbolos');
      return;
    }
    setCambiandoCedula(true);
    try {
      await cambiarCedula(clienteCedula.cedula, nuevaCedulaNormalizada);
      message.success('Cambio de cédula iniciado. Actualizando datos en 5 segundos...');
      setCedulaModal(false);
      setClienteCedula(null);
      setNuevaCedula('');
      // Close detail drawer if open
      setDrawerCedula(null);
      setDrawerRegistros([]);
      // Reload list after Step Function completes
      setTimeout(() => {
        setNextToken(undefined);
        cargar(proyectoFiltro, inmoFiltro);
        message.info('Datos actualizados.');
      }, 5000);
    } catch (err: any) {
      message.error(err?.message || 'Error al cambiar la cédula');
    } finally {
      setCambiandoCedula(false);
    }
  };

  const handleTransferir = async (values: { inmobiliaria_destino: string }) => {
    if (!clienteTransferir) return;
    console.log('[TRANSFERIR] Enviando transferencia...');
    console.log('[TRANSFERIR] procesoTransferir:', procesoTransferir);
    console.log('[TRANSFERIR] unidad_id a enviar:', procesoTransferir?.unidad_id);
    setTransfiriendo(true);
    try {
      await transferirClienteInmobiliaria(
        clienteTransferir.cedula,
        clienteTransferir.proyecto_id,
        clienteTransferir.inmobiliaria_id,
        values.inmobiliaria_destino,
        procesoTransferir?.unidad_id
      );
      const mensaje = procesoTransferir 
        ? `Proceso ${procesoTransferir.unidad_nombre || procesoTransferir.unidad_id} transferido exitosamente`
        : 'Cliente transferido exitosamente';
      message.success(mensaje + '. Actualizando datos...');
      setTransferirModal(false);
      setClienteTransferir(null);
      setProcesoTransferir(null);
      // Esperar 5 segundos para que la Step Function complete todos los pasos
      setTimeout(() => {
        if (drawerCedula) {
          abrirDetalleCedula(drawerCedula);
        }
        cargar(proyectoFiltro, inmoFiltro);
        message.info('Datos actualizados.');
      }, 5000);
    } catch (err: any) {
      console.error('Error al transferir:', err);
      const errorMessage = err?.message || 'Error al transferir';
      message.error(errorMessage);
    } finally {
      setTransfiriendo(false);
    }
  };

  const abrirEliminar = (cliente: Cliente & { procesos?: Proceso[] }) => {
    if (!canDeleteClientes) {
      message.warning('Solo admin puede eliminar clientes');
      return;
    }
    console.log('[ELIMINAR] Cliente:', cliente);
    console.log('[ELIMINAR] drawerRegistros:', drawerRegistros);
    
    setClienteEliminar(cliente);
    
    // Recopilar TODOS los procesos de TODOS los registros del cliente
    const todosProcesos: Proceso[] = [];
    drawerRegistros.forEach(reg => {
      if (reg.procesos && reg.procesos.length > 0) {
        todosProcesos.push(...reg.procesos);
      }
    });
    
    console.log('[ELIMINAR] Total procesos a eliminar:', todosProcesos.length);
    setDrawerProcesos(todosProcesos);
    setEliminarModal(true);
  };

  const handleEliminar = async () => {
    if (!clienteEliminar) return;
    if (!canDeleteClientes) {
      message.warning('Solo admin puede eliminar clientes');
      return;
    }
    setEliminando(true);
    try {
      const result = await eliminarClienteAdmin(
        clienteEliminar.cedula,
        clienteEliminar.proyecto_id
      );
      message.success(`${result.message}. ${result.items_eliminados.length} items eliminados.`);
      setEliminarModal(false);
      setClienteEliminar(null);
      // Cerrar drawer si está abierto
      if (drawerCedula) {
        setDrawerCedula(null);
        setDrawerRegistros([]);
      }
      // Recargar lista
      if (modoVista === 'busqueda' && busqueda) {
        handleBusqueda(busqueda);
      } else {
        cargar(proyectoFiltro, inmoFiltro);
      }
    } catch (err: any) {
      console.error('Error al eliminar:', err);
      const errorMessage = err?.message || 'Error al eliminar cliente';
      message.error(errorMessage);
    } finally {
      setEliminando(false);
    }
  };



  const renderEstatusCliente = (r: ClienteProyecto) => {
    if (r.estatus === 'sin_unidad') return <Tag color="orange">Sin unidad</Tag>;
    return (
      <Tooltip title={ESTADO_PROCESO_DESCRIPCION[r.estatus] || r.estatus}>
        <Tag color={ESTADO_PROCESO_COLOR[r.estatus] ?? 'default'}>
          {ESTADO_PROCESO_LABEL[r.estatus] ?? r.estatus_label ?? r.estatus}
        </Tag>
      </Tooltip>
    );
  };

  const columnasProyecto = [
    {
      title: 'Cliente', key: 'cliente',
      render: (_: unknown, r: ClienteProyecto) => (
        <div>
          <Text strong>{r.nombres} {r.apellidos}</Text>
          <br /><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text>
        </div>
      ),
    },
    {
      title: 'Unidad', key: 'unidad',
      render: (_: unknown, r: ClienteProyecto) => (
        r.unidad_nombre || r.unidad_id
          ? <Tag color="geekblue">{r.unidad_nombre || r.unidad_id}</Tag>
          : <Text type="secondary">Sin unidad</Text>
      ),
    },
    {
      title: 'Estatus',
      key: 'estatus',
      render: (_: unknown, r: ClienteProyecto) => renderEstatusCliente(r),
    },
    ...(isAdmin && !isMobile ? [{
      title: 'Inmobiliaria', key: 'inmo',
      render: (_: unknown, r: ClienteProyecto) => inmoNombre(r.inmobiliaria_id),
    }] : []),
    { title: 'Captado', dataIndex: 'fecha_captacion', key: 'fc', render: (v: string) => formatFecha(v) },
    {
      title: '', key: 'acciones', width: 92,
      render: (_: unknown, r: ClienteProyecto) => (
        <Button size="small" type="link" onClick={(e) => {
          e.stopPropagation();
          isAdmin ? abrirDetalleCedula(r.cedula) : abrirDrawerInmo(r);
        }}>
          Ver detalle
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          marginBottom: isMobile ? 10 : 0,
          gap: 12,
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {vista === 'clientes' && (
              <Tooltip title="Volver a proyectos">
                <Button icon={<ArrowLeftOutlined />} onClick={volverAProyectos} />
              </Tooltip>
            )}
            <Title level={4} style={{ margin: 0, wordBreak: 'normal', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
              {vista === 'proyectos' ? 'Clientes' : proyectoSeleccionado?.nombre ?? 'Clientes'}
            </Title>
          </div>
          <Space className="page-toolbar" wrap style={{ width: isMobile ? '100%' : undefined }}>
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
            {vista === 'clientes' && (
              <>
                <Tooltip title="Exportar clientes en Excel">
                  <Button icon={<DownloadOutlined />} onClick={handleExportarClientes} loading={exportando} style={{ flex: isMobile ? '1 1 120px' : undefined }}>
                    Exportar clientes
                  </Button>
                </Tooltip>
                <Tooltip title="Actualizar">
                  <Button icon={<ReloadOutlined />} onClick={() => { setNextToken(undefined); cargar(proyectoFiltro, inmoFiltro); }} loading={loading} />
                </Tooltip>
              </>
            )}
            {((!isAdmin && vista === 'clientes') || isAdmin) && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                form.setFieldsValue({
                  proyecto_id: proyectoFiltro,
                  inmobiliaria_id: inmoFiltro,
                });
                setModalOpen(true);
              }} style={{ flex: isMobile ? '1 1 140px' : undefined }}>
                {isAdmin ? 'Añadir cliente' : 'Registrar cliente'}
              </Button>
            )}
          </Space>
        </div>
        {vista === 'clientes' && (
        <div className="filter-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <Select 
            value={tipoBusqueda} 
            onChange={setTipoBusqueda}
            style={{ width: isMobile ? '100%' : 120 }}
          >
            <Option value="nombre">Por nombre</Option>
            <Option value="cedula">Por cédula</Option>
          </Select>
          <Input 
            prefix={<SearchOutlined />} 
            placeholder={tipoBusqueda === 'nombre' ? 'Buscar por nombre...' : 'Buscar por cédula (ej: V-123)...'}
            style={{ width: isMobile ? '100%' : 240 }} 
            value={busqueda} 
            onChange={e => handleBusqueda(e.target.value)} 
            allowClear 
            onClear={() => handleBusqueda('')} 
          />
          <Select
            allowClear
            placeholder="Estatus"
            style={{ width: isMobile ? '100%' : 190 }}
            value={estatusFiltro}
            onChange={setEstatusFiltro}
            options={ESTATUS_CLIENTE_OPTIONS}
          />
          <Select allowClear showSearch placeholder="Proyecto" style={{ width: isMobile ? '100%' : 220 }}
            value={proyectoFiltro}
            onChange={cambiarProyectoFiltro}
            optionFilterProp="label"
            options={proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
          />
          {isAdmin && (
            <Select allowClear placeholder="Inmobiliaria" style={{ width: isMobile ? '100%' : 180 }}
              value={inmoFiltro}
              onChange={(v) => { 
                setInmoFiltro(v); 
                setNextToken(undefined); 
                
                // Si estamos en modo búsqueda, re-ejecutar con el nuevo filtro
                if (modoVista === 'busqueda' && busqueda.trim().length >= 2) {
                  setLoading(true);
                  buscarClientesAdmin(
                    busqueda,
                    tipoBusqueda,
                    proyectoFiltro,
                    v  // Usar el nuevo valor directamente
                  ).then(resultados => {
                    setClientes(resultados as ClienteProyecto[]);
                    setNextToken(undefined);
                  }).catch(() => {
                    message.error('Error en la búsqueda');
                  }).finally(() => {
                    setLoading(false);
                  });
                } else {
                  cargar(proyectoFiltro, v);
                }
              }}>
              {inmobiliarias.map(i => <Option key={i.pk} value={i.pk}>{i.nombre}</Option>)}
            </Select>
          )}
        </div>
        )}
      </div>

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
                  transition: 'box-shadow 0.2s, transform 0.2s',
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
                  overflow: 'hidden',
                }}>
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <AppstoreOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{p.nombre}</Text>
                  {p.descripcion && (
                    <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: p.descripcion }}>{p.descripcion}</Text>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Banner de modo búsqueda */}
      {vista === 'clientes' && modoVista === 'busqueda' && (
        <Alert
          message={
            <span>
              Mostrando resultados de búsqueda por <strong>{tipoBusqueda === 'nombre' ? 'nombre' : 'cédula'}</strong> para <strong>"{busqueda}"</strong>
              {clientes.length === 100 && ' (máximo 100 resultados)'}
              {clientes.length === 0 && ' - No se encontraron resultados'}
            </span>
          }
          type="info"
          showIcon
          closable
          onClose={() => {
            setBusqueda('');
            setModoVista('lista');
            setNextToken(undefined);
            cargar(proyectoFiltro, inmoFiltro);
          }}
          style={{ marginBottom: 16 }}
        />
      )}

            {/* Tabla/Cards admin */}
      {vista === 'clientes' && isAdmin && (
        <>
          {isMobile ? (
            <div>
              {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</div>}
              {!loading && clientesFiltrados.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Sin clientes</div>}
              {clientesFiltrados.map(r => (
                <div key={`${r.pk}#${r.sk}#${r.unidad_id || 'sin-unidad'}`} onClick={() => abrirDetalleCedula(r.cedula)}
                  style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.16)', marginBottom: 10, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text strong style={{ fontSize: 15 }}>{r.nombres} {r.apellidos}</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text></div>
                    </div>
                    {renderEstatusCliente(r)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {r.unidad_nombre || r.unidad_id ? <Tag color="geekblue">{r.unidad_nombre || r.unidad_id}</Tag> : <Tag>Sin unidad</Tag>}
                    <Text type="secondary" style={{ fontSize: 12 }}>{inmoNombre(r.inmobiliaria_id)}</Text>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table
              dataSource={clientesFiltrados} columns={columnasProyecto}
              rowKey={r => `${r.pk}#${r.sk}#${r.unidad_id || 'sin-unidad'}`} loading={loading}
              pagination={false} locale={{ emptyText: 'Sin clientes' }}
              onRow={r => ({ onClick: () => abrirDetalleCedula(r.cedula), style: { cursor: 'pointer' } })}
              scroll={{ x: true }}
            />
          )}
          {nextToken && modoVista === 'lista' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button onClick={() => cargar(proyectoFiltro, inmoFiltro, nextToken)} loading={loading}>Cargar más</Button>
            </div>
          )}
        </>
      )}

      {/* Tabla/Cards inmobiliaria */}
      {vista === 'clientes' && !isAdmin && (
        isMobile ? (
          <div>
            {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</div>}
            {!loading && clientesFiltrados.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Sin clientes</div>}
            {clientesFiltrados.map(r => (
              <div key={`${r.pk}#${r.sk}#${r.unidad_id || 'sin-unidad'}`} onClick={() => abrirDrawerInmo(r)}
                style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.16)', marginBottom: 10, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{r.nombres} {r.apellidos}</Text>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text></div>
                  </div>
                  {renderEstatusCliente(r)}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.unidad_nombre || r.unidad_id ? <Tag color="geekblue">{r.unidad_nombre || r.unidad_id}</Tag> : <Tag>Sin unidad</Tag>}
                  <Text type="secondary" style={{ fontSize: 12 }}>{proyectoNombre(r.proyecto_id)}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>· Captado {formatFecha(r.fecha_captacion)}</Text>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table
            dataSource={clientesFiltrados} columns={columnasProyecto}
            rowKey={r => `${r.pk}#${r.sk}#${r.unidad_id || 'sin-unidad'}`} loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: false }} locale={{ emptyText: 'Sin clientes' }}
            onRow={r => ({ onClick: () => abrirDrawerInmo(r), style: { cursor: 'pointer' } })}
            scroll={{ x: true }}
          />
        )
      )}

      {/* Modal detalle por cédula — admin */}
      <Modal
        title={drawerCedula ? `${drawerRegistros[0]?.nombres ?? ''} ${drawerRegistros[0]?.apellidos ?? ''}` : ''}
        open={!!drawerCedula}
        onCancel={() => { setDrawerCedula(null); setDrawerRegistros([]); }}
        footer={null}
        width={620}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '16px 24px' } }}
      >
        {loadingDrawer ? (
          <div style={{ textAlign: 'center', paddingTop: 40 }}><Spin /></div>
        ) : drawerRegistros.map((reg, idx) => (
          <div key={`${reg.pk}#${reg.sk}`} style={{ marginBottom: 24 }}>
            {idx === 0 && (
              <>
                {/* Datos personales */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Title level={5} style={{ margin: 0 }}>Datos personales</Title>
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(reg)}>Editar</Button>
                    <Button size="small" icon={<SwapOutlined />} onClick={() => abrirCambiarCedula(reg)}>Cambiar cédula</Button>
                    {canDeleteClientes && (
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => abrirEliminar(reg)}>Eliminar</Button>
                    )}
                  </Space>
                </div>
                <div style={{ background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                  <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>CÉDULA</Text>
                      <div><Text strong>{reg.cedula}</Text></div>
                    </div>
                    {reg.correo && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>CORREO</Text>
                        <div><Text>{reg.correo}</Text></div>
                      </div>
                    )}
                    {reg.telefono && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>TELÉFONO</Text>
                        <div><Text>{reg.telefono}</Text></div>
                      </div>
                    )}
                    {reg.edad && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>EDAD</Text>
                        <div><Text>{reg.edad} años</Text></div>
                      </div>
                    )}
                    {reg.estado_civil && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>ESTADO CIVIL</Text>
                        <div><Text style={{ textTransform: 'capitalize' }}>{reg.estado_civil.replace('_', ' ')}</Text></div>
                      </div>
                    )}
                    {reg.nacionalidad && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>NACIONALIDAD</Text>
                        <div><Text>{reg.nacionalidad}</Text></div>
                      </div>
                    )}
                    {reg.pais_residencia && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>PAÍS RESIDENCIA</Text>
                        <div><Text>{reg.pais_residencia}</Text></div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>Datos completos</Title>
                  <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <DetalleCampo label="Nombres" value={reg.nombres} strong />
                    <DetalleCampo label="Apellidos" value={reg.apellidos} strong />
                    <DetalleCampo label="Documento" value={reg.cedula} strong />
                    <DetalleCampo label="Correo" value={reg.correo} />
                    <DetalleCampo label="Teléfono" value={reg.telefono} />
                    <DetalleCampo label="Fecha nacimiento" value={reg.fecha_nacimiento ? formatFecha(reg.fecha_nacimiento) : null} />
                    <DetalleCampo label="Edad" value={reg.edad ? `${reg.edad} años` : null} />
                    <DetalleCampo label="Estado civil" value={reg.estado_civil?.replace('_', ' ')} />
                    <DetalleCampo label="Nacionalidad" value={reg.nacionalidad} />
                    <DetalleCampo label="País residencia" value={reg.pais_residencia} />
                    <DetalleCampo label="Fecha captación" value={reg.fecha_captacion ? formatFecha(reg.fecha_captacion) : null} />
                    <DetalleCampo label="Vencimiento exclusividad" value={reg.fecha_vencimiento ? formatFecha(reg.fecha_vencimiento) : null} />
                  </div>
                </div>
                <Title level={5} style={{ marginBottom: 12 }}>Registros por proyecto</Title>
              </>
            )}

            {/* Card por registro (proyecto + inmobiliaria) */}
            <div style={{ padding: '12px 14px', background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <Text strong>{proyectoNombre(reg.proyecto_id)}</Text>
                  <br />
                  <Space size={4} style={{ marginTop: 4 }}>
                    <BankOutlined style={{ fontSize: 12, color: 'var(--text-muted)' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>{inmoNombre(reg.inmobiliaria_id)}</Text>
                  </Space>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {reg.exclusividad_activa ? (
                    (() => {
                      const diasRestantes = calcularDiasRestantes(reg.fecha_vencimiento);
                      const color = getColorExclusividad(diasRestantes);
                      const porcentaje = Math.max(0, Math.min(100, (diasRestantes / 90) * 100));
                      return (
                        <div>
                          <Tag color={color} icon={<ClockCircleOutlined />} style={{ marginBottom: 4 }}>
                            {diasRestantes > 0 ? `${diasRestantes} días` : 'Vencida'}
                          </Tag>
                          <div style={{ width: 80 }}>
                            <Progress 
                              percent={porcentaje} 
                              size="small" 
                              strokeColor={color}
                              showInfo={false}
                            />
                          </div>
                          <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
                            Vence: {formatFecha(reg.fecha_vencimiento, 'DD/MM/YY')}
                          </Text>
                        </div>
                      );
                    })()
                  ) : (
                    <Tag color="default">Vencida</Tag>
                  )}
                </div>
              </div>

              {/* Procesos de este registro */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Procesos de venta</Text>
              </div>
              {reg.procesos?.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>Sin procesos</Text>
              ) : (
                reg.procesos?.map(p => {
                  const alertaVencida = p.alerta_reserva_vencida && p.estado === 'pagos_atrasados';
                  const diasEnReserva = p.fecha_reserva
                    ? Math.floor((Date.now() - new Date(p.fecha_reserva).getTime()) / 86400000)
                    : null;
                  const proximoVencer = !alertaVencida && p.estado === 'reserva' && diasEnReserva !== null && diasEnReserva >= 25;
                  
                  // Buscar el nombre de la inmobiliaria del proceso
                  const inmoDelProceso = inmobiliarias.find(i => i.pk === p.inmobiliaria_id);
                  const nombreInmo = inmoDelProceso?.nombre || p.inmobiliaria_id;
                  
                  return (
                    <div key={p.sk} style={{ marginBottom: 6 }}>
                      {alertaVencida && (
                        <div style={{ background: 'var(--danger-soft-bg)', border: '1px solid var(--danger-soft-border)', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>⚠️</span>
                          <span style={{ flex: 1 }}>Reserva vencida (30 dias)</span>
                        </div>
                      )}
                      {proximoVencer && (
                        <div style={{ background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 12, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>⏰</span>
                          <span>Vence en {30 - diasEnReserva!} dia{30 - diasEnReserva! !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Space size={4}>
                          <Tag color="geekblue" style={{ margin: 0 }}>{p.unidad_nombre || p.unidad_id}</Tag>
                          <Tooltip title={ESTADO_PROCESO_DESCRIPCION[p.estado] || p.estado}>
                            <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
                          </Tooltip>
                        </Space>
                      </div>
                      {/* Mostrar inmobiliaria si es diferente a la del registro */}
                      {p.inmobiliaria_id !== reg.inmobiliaria_id && (
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            🏢 {nombreInmo}
                          </Text>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={4}></Space>
                        <Space size={0}>
                          <Button size="small" type="link" icon={<HistoryOutlined />}
                            onClick={() => { setHistorialProceso(p); setHistorialNombre(`${reg.nombres} ${reg.apellidos}`); }}>Historial</Button>
                          <Button size="small" type="link" icon={<BankOutlined />}
                            onClick={() => abrirTransferir(reg, p)}>Transferir</Button>
                        </Space>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </Modal>

      {/* Modal detalle inmobiliaria */}
      <Modal
        title={drawerCliente ? `${drawerCliente.nombres} ${drawerCliente.apellidos}` : ''}
        open={!!drawerCliente}
        onCancel={() => { setDrawerCliente(null); setDrawerProcesos([]); }}
        footer={null}
        width={500}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      >
        {drawerCliente && (
          <div>
            <div style={{ background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>CÉDULA</Text>
                  <div><Text strong>{drawerCliente.cedula}</Text></div>
                </div>
                {drawerCliente.correo && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>CORREO</Text>
                    <div><Text>{drawerCliente.correo}</Text></div>
                  </div>
                )}
                {drawerCliente.telefono && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>TELÉFONO</Text>
                    <div><Text>{drawerCliente.telefono}</Text></div>
                  </div>
                )}
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>PROYECTO</Text>
                  <div><Text>{proyectoNombre(drawerCliente.proyecto_id)}</Text></div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>EXCLUSIVIDAD</Text>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {drawerCliente.exclusividad_activa ? (
                      (() => {
                        const diasRestantes = calcularDiasRestantes(drawerCliente.fecha_vencimiento);
                        const color = getColorExclusividad(diasRestantes);
                        const porcentaje = Math.max(0, Math.min(100, (diasRestantes / 90) * 100));
                        return (
                          <>
                            <Tag color={color} icon={<ClockCircleOutlined />}>
                              {diasRestantes > 0 ? `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restantes` : 'Vencida'}
                            </Tag>
                            <div style={{ flex: 1, maxWidth: 200 }}>
                              <Progress 
                                percent={porcentaje} 
                                size="small" 
                                strokeColor={color}
                                format={() => `${diasRestantes}d`}
                              />
                            </div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Vence: {formatFecha(drawerCliente.fecha_vencimiento)}
                            </Text>
                          </>
                        );
                      })()
                    ) : (
                      <Tag color="default">Vencida</Tag>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>Datos completos</Title>
              <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <DetalleCampo label="Nombres" value={drawerCliente.nombres} strong />
                <DetalleCampo label="Apellidos" value={drawerCliente.apellidos} strong />
                <DetalleCampo label="Documento" value={drawerCliente.cedula} strong />
                <DetalleCampo label="Correo" value={drawerCliente.correo} />
                <DetalleCampo label="Teléfono" value={drawerCliente.telefono} />
                <DetalleCampo label="Fecha nacimiento" value={drawerCliente.fecha_nacimiento ? formatFecha(drawerCliente.fecha_nacimiento) : null} />
                <DetalleCampo label="Edad" value={drawerCliente.edad ? `${drawerCliente.edad} años` : null} />
                <DetalleCampo label="Estado civil" value={drawerCliente.estado_civil?.replace('_', ' ')} />
                <DetalleCampo label="Nacionalidad" value={drawerCliente.nacionalidad} />
                <DetalleCampo label="País residencia" value={drawerCliente.pais_residencia} />
                <DetalleCampo label="Proyecto" value={proyectoNombre(drawerCliente.proyecto_id)} />
                <DetalleCampo label="Fecha captación" value={drawerCliente.fecha_captacion ? formatFecha(drawerCliente.fecha_captacion) : null} />
              </div>
            </div>
            {drawerProcesos.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 8 }}>Procesos de venta</Title>
                {drawerProcesos.map(p => (
                  <div key={p.sk} style={{ padding: '10px 14px', background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8, marginBottom: 8 }}>
                    <Space>
                      <Tag color="geekblue">{p.unidad_nombre || p.unidad_id}</Tag>
                      <Tooltip title={ESTADO_PROCESO_DESCRIPCION[p.estado] || p.estado}>
                        <Tag color={ESTADO_PROCESO_COLOR[p.estado]}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
                      </Tooltip>
                    </Space>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal registro */}
      <Modal title={<Space><UserOutlined /> {isAdmin ? 'Añadir cliente' : 'Registrar cliente'}</Space>}
        open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Registrar" cancelText="Cancelar" width={600}
        centered
        style={{ top: 20 }}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '16px 24px' } }}>
        <Form form={form} layout="vertical" onFinish={handleRegistrar}>
          <Form.Item name="proyecto_id" label="Proyecto" rules={[{ required: true }]}>
            <Select placeholder="Selecciona un proyecto">
              {(isAdmin ? proyectos.map(p => p.proyecto_id) : (usuario?.proyectos ?? proyectos.map(p => p.proyecto_id))).map(id => {
                const p = proyectos.find(x => x.proyecto_id === id);
                return <Option key={id} value={id}>{p?.nombre ?? id}</Option>;
              })}
            </Select>
          </Form.Item>
          {isAdmin && (
            <Form.Item name="inmobiliaria_id" label="Inmobiliaria" rules={[{ required: true, message: 'Selecciona una inmobiliaria' }]}>
              <Select
                placeholder="Selecciona una inmobiliaria"
                showSearch
                optionFilterProp="label"
                options={inmobiliarias.filter(i => i.activo).map(i => ({ value: i.pk, label: i.nombre }))}
              />
            </Form.Item>
          )}
          <Form.Item name="cedula" label="Cédula / Pasaporte" rules={clienteFormRules.cedula}><Input placeholder="12345678 o AB123456" /></Form.Item>
          <Form.Item name="nombres" label="Nombres" rules={clienteFormRules.nombres} normalize={clienteFieldNormalizers.nombre}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={clienteFormRules.apellidos} normalize={clienteFieldNormalizers.nombre}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo" rules={clienteFormRules.correo} normalize={clienteFieldNormalizers.correo}><Input type="email" placeholder="correo@ejemplo.com" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono" rules={clienteFormRules.telefono}><Input inputMode="numeric" placeholder="584120000000" /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="estado_civil" label="Estado civil">
            <EstadoCivilSelect />
          </Form.Item>
          <Form.Item name="nacionalidad" label="Nacionalidad"><NacionalidadSelect /></Form.Item>
          <Form.Item name="pais_residencia" label="País de residencia"><PaisResidenciaSelect /></Form.Item>
        </Form>
      </Modal>

      {/* Modal editar */}
      <Modal title="Editar datos del cliente" open={editarModal}
        onCancel={() => { setEditarModal(false); setEditarRegistro(null); formEditar.resetFields(); }}
        onOk={() => formEditar.submit()}
        okText="Guardar" cancelText="Cancelar" width={520}>
        <Form form={formEditar} layout="vertical" onFinish={handleEditar}>
          <Form.Item name="nombres" label="Nombres" rules={clienteFormRules.nombres} normalize={clienteFieldNormalizers.nombre}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={clienteFormRules.apellidos} normalize={clienteFieldNormalizers.nombre}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo" rules={clienteFormRules.correo} normalize={clienteFieldNormalizers.correo}><Input type="email" placeholder="correo@ejemplo.com" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono" rules={clienteFormRules.telefono}><Input inputMode="numeric" placeholder="584120000000" /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="estado_civil" label="Estado civil">
            <EstadoCivilSelect />
          </Form.Item>
          <Form.Item name="nacionalidad" label="Nacionalidad"><NacionalidadSelect /></Form.Item>
          <Form.Item name="pais_residencia" label="País de residencia"><PaisResidenciaSelect /></Form.Item>
        </Form>
      </Modal>

      {/* Modal estatus */}
      {estatusModal && estatusCliente && (
        <CambiarEstatusModal open proceso={estatusModal}
          tieneContacto={!!(estatusCliente.correo || estatusCliente.telefono)}
          onCancel={() => { setEstatusModal(null); setEstatusCliente(null); }}
          onConfirm={handleCambiarEstatus} />
      )}

      {/* Modal transferir inmobiliaria */}
      <Modal
        title="Transferir cliente a otra inmobiliaria"
        open={transferirModal}
        onCancel={() => { setTransferirModal(false); setClienteTransferir(null); }}
        onOk={() => formTransferir.submit()}
        okText="Transferir"
        cancelText="Cancelar"
        confirmLoading={transfiriendo}
        width={520}
      >
        {clienteTransferir && (
          <>
            <div style={{
              background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 8,
              padding: '12px 14px', marginBottom: 16,
            }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>CLIENTE</Text>
              <Text strong style={{ fontSize: 14 }}>{clienteTransferir.nombres} {clienteTransferir.apellidos}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{clienteTransferir.cedula}</Text>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #ffe7ba' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>PROYECTO</Text>
                <div><Text style={{ fontSize: 13 }}>{proyectoNombre(clienteTransferir.proyecto_id)}</Text></div>
              </div>
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>INMOBILIARIA ACTUAL</Text>
                <div><Text style={{ fontSize: 13 }}>{inmoNombre(clienteTransferir.inmobiliaria_id)}</Text></div>
              </div>
            </div>

            <Alert
              message="⚠️ Importante"
              description="Esta acción transferirá el cliente y todos sus procesos de venta a la nueva inmobiliaria. Los bloqueos activos se recrearán con 48 horas adicionales. La exclusividad se renovará por 90 días."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form form={formTransferir} layout="vertical" onFinish={handleTransferir}>
              <Form.Item
                name="inmobiliaria_destino"
                label="Nueva inmobiliaria"
                rules={[
                  { required: true, message: 'Selecciona la inmobiliaria destino' },
                  {
                    validator: (_, value) => {
                      if (value && value.replace('INMOBILIARIA#', '') === clienteTransferir.inmobiliaria_id.replace('INMOBILIARIA#', '')) {
                        return Promise.reject(new Error('Debe seleccionar una inmobiliaria diferente'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Select placeholder="Selecciona la inmobiliaria destino" showSearch
                  filterOption={(input, option) =>
                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={inmobiliarias
                    .filter(i => i.pk !== clienteTransferir.inmobiliaria_id)
                    .map(i => ({
                      value: i.pk,
                      label: i.nombre,
                    }))}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Modal Eliminar Cliente */}
      <Modal
        open={eliminarModal}
        title={<span><DeleteOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />Eliminar Cliente</span>}
        onCancel={() => { setEliminarModal(false); setClienteEliminar(null); }}
        onOk={handleEliminar}
        okText="Eliminar"
        cancelText="Cancelar"
        confirmLoading={eliminando}
        okButtonProps={{ danger: true }}
        width={520}
      >
        {clienteEliminar && (
          <>
            <Alert
              message="⚠️ Acción Irreversible"
              description={`Esta acción eliminará permanentemente el cliente de TODAS las inmobiliarias (${drawerRegistros.length} registro${drawerRegistros.length !== 1 ? 's' : ''}) y todos sus datos asociados:`}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{
              background: 'var(--danger-soft-bg)', border: '1px solid var(--danger-soft-border)', borderRadius: 8,
              padding: '12px 14px', marginBottom: 16,
            }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>CLIENTE A ELIMINAR</Text>
              <Text strong style={{ fontSize: 14 }}>{clienteEliminar.nombres} {clienteEliminar.apellidos}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Cédula: {clienteEliminar.cedula}</Text>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #ffa39e' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>PROYECTO</Text>
                <div><Text style={{ fontSize: 13 }}>{proyectoNombre(clienteEliminar.proyecto_id)}</Text></div>
              </div>
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>INMOBILIARIAS ({drawerRegistros.length})</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {drawerRegistros.map((reg, idx) => (
                    <Tag key={`${reg.inmobiliaria_id}-${idx}`} color="red" style={{ margin: 0 }}>
                      {inmoNombre(reg.inmobiliaria_id)}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: 12 }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Se eliminarán:</Text>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                <li>{drawerRegistros.length} registro{drawerRegistros.length !== 1 ? 's' : ''} del cliente en {drawerRegistros.length} inmobiliaria{drawerRegistros.length !== 1 ? 's' : ''}</li>
                {drawerProcesos.length > 0 ? (
                  <li>
                    <strong>{drawerProcesos.length}</strong> proceso{drawerProcesos.length !== 1 ? 's' : ''} de venta:
                    <ul style={{ marginTop: 4, fontSize: 12 }}>
                      {drawerProcesos.map((p: any, idx: number) => (
                        <li key={`${p.unidad_id}-${idx}`}>
                          {p.unidad_nombre || p.unidad_id} - <Tag color={ESTADO_PROCESO_COLOR[p.estado as keyof typeof ESTADO_PROCESO_COLOR]} style={{ fontSize: 11 }}>
                            {ESTADO_PROCESO_LABEL[p.estado as keyof typeof ESTADO_PROCESO_LABEL]}
                          </Tag>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li>
                    <Text type="secondary" style={{ fontSize: 12 }}>Este cliente no tiene procesos de venta asociados</Text>
                  </li>
                )}
                <li>Unidades desvinculadas (marcadas como disponibles)</li>
                <li>Bloqueos de unidades (si existen)</li>
                <li>Schedules de vencimiento y alertas</li>
              </ul>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 8 }}>
              <Text type="warning" style={{ fontSize: 12 }}>
                <strong>Nota:</strong> Esta acción no se puede deshacer. Asegúrate de que realmente deseas eliminar este cliente de todas las inmobiliarias.
              </Text>
            </div>
          </>
        )}
      </Modal>

      {/* Drawer historial */}
      <HistorialEstatusDrawer open={!!historialProceso} proceso={historialProceso}
        clienteNombre={historialNombre} onClose={() => setHistorialProceso(null)} />

      {/* Modal cambiar cédula */}
      <Modal
        title="Cambiar cédula del cliente"
        open={cedulaModal}
        onCancel={() => { setCedulaModal(false); setClienteCedula(null); setNuevaCedula(''); }}
        onOk={handleCambiarCedula}
        okText="Cambiar cédula"
        cancelText="Cancelar"
        confirmLoading={cambiandoCedula}
        okButtonProps={{ disabled: !nuevaCedulaNormalizada || nuevaCedulaInvalida || nuevaCedulaNormalizada === clienteCedula?.cedula }}
        width={460}
      >
        {clienteCedula && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div style={{ background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 8, padding: '12px 16px' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>CLIENTE</Text>
              <Text strong>{clienteCedula.nombres} {clienteCedula.apellidos}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Cédula actual: <strong>{clienteCedula.cedula}</strong></Text>
            </div>

            <Alert
              type="warning"
              showIcon
              message="Acción irreversible"
              description="Esta acción actualizará la cédula en todos los registros del cliente: datos personales, procesos de venta y unidades vinculadas. Se ejecuta mediante una Step Function y puede tardar unos segundos."
            />

            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Nueva cédula / pasaporte:</Text>
              <Input
                autoFocus
                placeholder="Ej: 12345678 o AB123456"
                value={nuevaCedula}
                onChange={e => setNuevaCedula(e.target.value.toUpperCase())}
                onPressEnter={handleCambiarCedula}
                status={nuevaCedulaInvalida ? 'error' : undefined}
              />
              {nuevaCedulaInvalida && (
                <Text type="danger" style={{ fontSize: 12 }}>La cedula/pasaporte solo debe contener letras y numeros, sin guiones ni simbolos</Text>
              )}
              {nuevaCedulaNormalizada === clienteCedula.cedula && (
                <Text type="danger" style={{ fontSize: 12 }}>La nueva cédula debe ser diferente a la actual</Text>
              )}
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ClientesPage;
