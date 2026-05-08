import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Table, Tag, Button, Modal, Form, Input, Select,
  DatePicker, message, Space, Tooltip, Spin, Grid, Alert, Progress,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, UserOutlined, HistoryOutlined,
  SwapOutlined, SearchOutlined, EditOutlined, EyeOutlined, BankOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getClientes, getClientesAdmin, buscarClienteAdmin, buscarClientesAdmin,
  registrarCliente, actualizarClienteAdmin, transferirClienteInmobiliaria,
} from '../../services/clientes.service';
import { getProcesosCliente, getMisProcesos, cambiarEstatus } from '../../services/crm.service';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import { useAuthContext } from '../../context/AuthContext';
import type { Cliente, Proyecto, Proceso } from '../../types';
import CambiarEstatusModal, { type ModoNotificacion } from '../../components/common/CambiarEstatusModal';
import HistorialEstatusDrawer from '../../components/common/HistorialEstatusDrawer';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL, ESTADO_PROCESO_DESCRIPCION } from '../../constants/estados';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

// Función para calcular días restantes de exclusividad
const calcularDiasRestantes = (fechaVencimiento: string): number => {
  const ahora = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const diff = vencimiento.getTime() - ahora.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Función para obtener color según días restantes
const getColorExclusividad = (dias: number): string => {
  if (dias <= 0) return '#ff4d4f'; // Rojo - vencida
  if (dias <= 15) return '#faad14'; // Naranja - próxima a vencer
  if (dias <= 30) return '#1677ff'; // Azul - menos de 1 mes
  return '#52c41a'; // Verde - más de 1 mes
};

interface ClienteAgrupado {
  cedula: string;
  nombres: string;
  apellidos: string;
  registros: Cliente[];  // uno por proyecto/inmobiliaria
}

function agruparPorCedula(lista: Cliente[]): ClienteAgrupado[] {
  const map = new Map<string, ClienteAgrupado>();
  for (const c of lista) {
    if (!map.has(c.cedula)) {
      map.set(c.cedula, { cedula: c.cedula, nombres: c.nombres, apellidos: c.apellidos, registros: [] });
    }
    map.get(c.cedula)!.registros.push(c);
  }
  return Array.from(map.values());
}

const ClientesPage = () => {
  const { usuario } = useAuthContext();
  const isAdmin = usuario?.rol !== 'inmobiliaria';
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Lista plana de clientes (para inmobiliaria) o agrupada (para admin)
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [inmoFiltro, setInmoFiltro] = useState<string | undefined>();
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
  const [formTransferir] = Form.useForm();
  const [transfiriendo, setTransfiriendo] = useState(false);

  // Ref para debounce de búsqueda
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const cargar = useCallback(async (proyId?: string, inmoId?: string, token?: string) => {
    setLoading(true);
    try {
      if (isAdmin) {
        const data = await getClientesAdmin(
          proyId || inmoId ? { proyecto_id: proyId, inmobiliaria_id: inmoId, next_token: token }
            : { next_token: token }
        );
        setClientes(prev => token ? [...prev, ...data.items] : data.items);
        setNextToken(data.next_token);
      } else {
        const data = await getClientes(proyId);
        setClientes(data);
      }
    } catch { message.error('Error al cargar clientes'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => {
    getProyectos().then(setProyectos).catch(() => {});
    if (isAdmin) getInmobiliarias().then(setInmobiliarias).catch(() => {});
    cargar();
  }, [cargar, isAdmin]);

  const proyectoNombre = (id: string) => proyectos.find(p => p.proyecto_id === id)?.nombre ?? id;
  const inmoNombre = (id: string) => {
    const normalizado = id.replace('INMOBILIARIA#', '');
    return inmobiliarias.find(i =>
      i.pk === id ||
      i.pk === `INMOBILIARIA#${normalizado}` ||
      i.pk.replace('INMOBILIARIA#', '') === normalizado
    )?.nombre ?? id;
  };

  // Manejar búsqueda con lógica híbrida
  const handleBusqueda = (valor: string) => {
    setBusqueda(valor);
    
    // Limpiar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
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
        setClientes(resultados);
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
  const clientesFiltrados = (busqueda.trim().length === 1 && modoVista === 'lista')
    ? clientes.filter(c =>
        c.cedula.toLowerCase().includes(busqueda.toLowerCase()) ||
        `${c.nombres} ${c.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())
      )
    : clientes;

  // Agrupados por cédula para admin
  const agrupados = isAdmin ? agruparPorCedula(clientesFiltrados) : [];

  // Abrir drawer de detalle por cédula (admin)
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
    formEditar.setFieldsValue({
      nombres: registro.nombres, apellidos: registro.apellidos,
      correo: registro.correo, telefono: registro.telefono,
      estado_civil: registro.estado_civil, nacionalidad: registro.nacionalidad,
      pais_residencia: registro.pais_residencia,
      fecha_nacimiento: registro.fecha_nacimiento ? dayjs(registro.fecha_nacimiento) : undefined,
    });
    setEditarModal(true);
  };

  const handleEditar = async (values: any) => {
    if (!editarRegistro) return;
    try {
      await actualizarClienteAdmin(editarRegistro.cedula, editarRegistro.proyecto_id, editarRegistro.inmobiliaria_id, {
        ...values,
        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
      });
      message.success('Cliente actualizado');
      setEditarModal(false);
      if (drawerCedula) abrirDetalleCedula(drawerCedula);
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
      await registrarCliente({ ...values, fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined });
      message.success('Cliente registrado');
      setModalOpen(false); form.resetFields();
      setNextToken(undefined);
      cargar(proyectoFiltro);
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

  const abrirTransferir = (cliente: Cliente) => {
    setClienteTransferir(cliente);
    formTransferir.resetFields();
    setTransferirModal(true);
  };

  const handleTransferir = async (values: { inmobiliaria_destino: string }) => {
    if (!clienteTransferir) return;
    setTransfiriendo(true);
    try {
      await transferirClienteInmobiliaria(
        clienteTransferir.cedula,
        clienteTransferir.proyecto_id,
        clienteTransferir.inmobiliaria_id,
        values.inmobiliaria_destino
      );
      message.success('Transferencia completada exitosamente. Actualizando datos...');
      setTransferirModal(false);
      setClienteTransferir(null);
      // Esperar 5 segundos para que la Step Function complete todos los pasos
      setTimeout(() => {
        if (drawerCedula) {
          abrirDetalleCedula(drawerCedula);
        }
        cargar(proyectoFiltro, inmoFiltro);
        message.info('Datos actualizados. Los bloqueos se han recreado con 48 horas adicionales.');
      }, 5000);
    } catch (err: any) {
      console.error('Error al transferir cliente:', err);
      const errorMessage = err?.message || 'Error al transferir cliente';
      message.error(errorMessage);
    } finally {
      setTransfiriendo(false);
    }
  };

  // ── Columnas tabla admin (agrupada por cédula) ──
  const columnasAdmin = [
    {
      title: 'Cliente', key: 'cliente',
      render: (_: unknown, r: ClienteAgrupado) => (
        <div>
          <Text strong>{r.nombres} {r.apellidos}</Text>
          <br /><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text>
        </div>
      ),
    },
    ...(!isMobile ? [
      {
        title: 'Proyectos', key: 'proyectos',
        render: (_: unknown, r: ClienteAgrupado) => (
          <Space wrap>
            {r.registros.map(reg => (
              <Tag key={`${reg.pk}#${reg.sk}`} color={reg.exclusividad_activa ? 'blue' : 'default'}>
                {proyectoNombre(reg.proyecto_id)}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: 'Inmobiliarias', key: 'inmos',
        render: (_: unknown, r: ClienteAgrupado) => {
          const unicas = [...new Set(r.registros.map(reg => reg.inmobiliaria_id))];
          return <Space wrap>{unicas.map(id => <Tag key={id}>{inmoNombre(id)}</Tag>)}</Space>;
        },
      },
    ] : []),
    {
      title: '', key: 'acciones', width: 48,
      render: (_: unknown, r: ClienteAgrupado) => (
        <EyeOutlined style={{ color: '#1677ff', fontSize: 16 }} onClick={() => abrirDetalleCedula(r.cedula)} />
      ),
    },
  ];

  // ── Columnas tabla inmobiliaria ──
  const columnasInmo = [
    {
      title: 'Cliente', key: 'cliente',
      render: (_: unknown, r: Cliente) => (
        <div>
          <Text strong>{r.nombres} {r.apellidos}</Text>
          <br /><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text>
        </div>
      ),
    },
    { title: 'Proyecto', key: 'proyecto', render: (_: unknown, r: Cliente) => proyectoNombre(r.proyecto_id) },
    {
      title: 'Exclusividad', key: 'excl',
      render: (_: unknown, r: Cliente) => {
        if (!r.exclusividad_activa) {
          return <Tag color="default">Vencida</Tag>;
        }
        const diasRestantes = calcularDiasRestantes(r.fecha_vencimiento);
        const color = getColorExclusividad(diasRestantes);
        return (
          <Tooltip title={`Vence: ${dayjs(r.fecha_vencimiento).format('DD/MM/YYYY HH:mm')}`}>
            <Tag color={color} icon={<ClockCircleOutlined />}>
              {diasRestantes > 0 ? `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}` : 'Vencida'}
            </Tag>
          </Tooltip>
        );
      },
    },
    { title: 'Captado', dataIndex: 'fecha_captacion', key: 'fc', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: '', key: 'acc', render: (_: unknown, r: Cliente) => <Button size="small" type="link" onClick={() => abrirDrawerInmo(r)}>Ver detalle</Button> },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 10 : 0 }}>
          <Title level={4} style={{ margin: 0 }}>Clientes</Title>
          <Space>
            <Tooltip title="Actualizar">
              <Button icon={<ReloadOutlined />} onClick={() => { setNextToken(undefined); cargar(proyectoFiltro, inmoFiltro); }} loading={loading} />
            </Tooltip>
            {!isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                {isMobile ? '' : 'Registrar cliente'}
              </Button>
            )}
          </Space>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
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
          <Select allowClear placeholder="Proyecto" style={{ width: isMobile ? '100%' : 180 }}
            value={proyectoFiltro}
            onChange={(v) => { 
              setProyectoFiltro(v); 
              setNextToken(undefined); 
              
              // Si estamos en modo búsqueda, re-ejecutar con el nuevo filtro
              if (modoVista === 'busqueda' && busqueda.trim().length >= 2) {
                setLoading(true);
                buscarClientesAdmin(
                  busqueda,
                  tipoBusqueda,
                  v,  // Usar el nuevo valor directamente
                  inmoFiltro
                ).then(resultados => {
                  setClientes(resultados);
                  setNextToken(undefined);
                }).catch(() => {
                  message.error('Error en la búsqueda');
                }).finally(() => {
                  setLoading(false);
                });
              } else {
                cargar(v, inmoFiltro);
              }
            }}>
            {proyectos.map(p => <Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Option>)}
          </Select>
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
                    setClientes(resultados);
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
      </div>

      {/* Banner de modo búsqueda */}
      {modoVista === 'busqueda' && (
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

      {/* Tabla/Cards admin — agrupada por cédula */}
      {isAdmin && (
        <>
          {isMobile ? (
            <div>
              {loading && <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Cargando...</div>}
              {!loading && agrupados.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Sin clientes</div>}
              {agrupados.map(r => (
                <div key={r.cedula} onClick={() => abrirDetalleCedula(r.cedula)}
                  style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 10, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text strong style={{ fontSize: 15 }}>{r.nombres} {r.apellidos}</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text></div>
                    </div>
                    <EyeOutlined style={{ color: '#1677ff', fontSize: 18, marginTop: 2 }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {r.registros.map(reg => {
                      const diasRestantes = reg.exclusividad_activa ? calcularDiasRestantes(reg.fecha_vencimiento) : 0;
                      const color = reg.exclusividad_activa ? getColorExclusividad(diasRestantes) : 'default';
                      return (
                        <Tooltip 
                          key={`${reg.pk}#${reg.sk}`}
                          title={
                            reg.exclusividad_activa 
                              ? `${proyectoNombre(reg.proyecto_id)} - ${diasRestantes} días restantes`
                              : `${proyectoNombre(reg.proyecto_id)} - Exclusividad vencida`
                          }
                        >
                          <Tag color={color} style={{ margin: 0 }}>
                            {proyectoNombre(reg.proyecto_id)}
                            {reg.exclusividad_activa && diasRestantes > 0 && (
                              <span style={{ marginLeft: 4, fontSize: 10 }}>({diasRestantes}d)</span>
                            )}
                          </Tag>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table
              dataSource={agrupados} columns={columnasAdmin}
              rowKey="cedula" loading={loading}
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
      {!isAdmin && (
        isMobile ? (
          <div>
            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Cargando...</div>}
            {!loading && clientesFiltrados.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Sin clientes</div>}
            {clientesFiltrados.map(r => (
              <div key={`${r.pk}#${r.sk}`} onClick={() => abrirDrawerInmo(r)}
                style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 10, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{r.nombres} {r.apellidos}</Text>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text></div>
                  </div>
                  {r.exclusividad_activa ? (
                    (() => {
                      const diasRestantes = calcularDiasRestantes(r.fecha_vencimiento);
                      const color = getColorExclusividad(diasRestantes);
                      return (
                        <Tag color={color} icon={<ClockCircleOutlined />} style={{ margin: 0 }}>
                          {diasRestantes > 0 ? `${diasRestantes}d` : 'Vencida'}
                        </Tag>
                      );
                    })()
                  ) : (
                    <Tag style={{ margin: 0 }}>Vencida</Tag>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{proyectoNombre(r.proyecto_id)}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>· Captado {dayjs(r.fecha_captacion).format('DD/MM/YYYY')}</Text>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table
            dataSource={clientesFiltrados} columns={columnasInmo}
            rowKey={r => `${r.pk}#${r.sk}`} loading={loading}
            pagination={{ pageSize: 20 }} locale={{ emptyText: 'Sin clientes' }}
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
                  <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(reg)}>Editar</Button>
                </div>
                <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
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
                <Title level={5} style={{ marginBottom: 12 }}>Registros por proyecto</Title>
              </>
            )}

            {/* Card por registro (proyecto + inmobiliaria) */}
            <div style={{ padding: '12px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <Text strong>{proyectoNombre(reg.proyecto_id)}</Text>
                  <br />
                  <Space size={4} style={{ marginTop: 4 }}>
                    <BankOutlined style={{ fontSize: 12, color: '#888' }} />
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
                            Vence: {dayjs(reg.fecha_vencimiento).format('DD/MM/YY')}
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
                  const alertaVencida = p.alerta_separacion_vencida && p.estado === 'separacion' && !p.pago_confirmado;
                  const diasEnSeparacion = p.fecha_separacion
                    ? Math.floor((Date.now() - new Date(p.fecha_separacion).getTime()) / 86400000)
                    : null;
                  const proximoVencer = !alertaVencida && p.estado === 'separacion' && diasEnSeparacion !== null && diasEnSeparacion >= 25;
                  
                  // Buscar el nombre de la inmobiliaria del proceso
                  const inmoDelProceso = inmobiliarias.find(i => i.id === p.inmobiliaria_id);
                  const nombreInmo = inmoDelProceso?.nombre || p.inmobiliaria_id;
                  
                  return (
                    <div key={p.sk} style={{ marginBottom: 6 }}>
                      {alertaVencida && (
                        <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 12, color: '#cf1322', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>⚠️</span>
                          <span style={{ flex: 1 }}>Separación vencida (30 días)</span>
                        </div>
                      )}
                      {proximoVencer && (
                        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 12, color: '#d46b08', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>⏰</span>
                          <span>Vence en {30 - diasEnSeparacion!} día{30 - diasEnSeparacion! !== 1 ? 's' : ''}</span>
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
                          <Button size="small" type="link" icon={<SwapOutlined />}
                            onClick={() => { setEstatusModal(p); setEstatusCliente(reg); }}>Estatus</Button>
                          <Button size="small" type="link" icon={<HistoryOutlined />}
                            onClick={() => { setHistorialProceso(p); setHistorialNombre(`${reg.nombres} ${reg.apellidos}`); }}>Historial</Button>
                          <Button size="small" type="link" icon={<BankOutlined />}
                            onClick={() => abrirTransferir(reg)}>Transferir</Button>
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
            <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
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
                              Vence: {dayjs(drawerCliente.fecha_vencimiento).format('DD/MM/YYYY')}
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
            {drawerProcesos.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 8 }}>Procesos de venta</Title>
                {drawerProcesos.map(p => (
                  <div key={p.sk} style={{ padding: '10px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 8 }}>
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
      <Modal title={<Space><UserOutlined /> Registrar cliente</Space>}
        open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Registrar" cancelText="Cancelar" width={600}
        centered
        style={{ top: 20 }}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '16px 24px' } }}>
        <Form form={form} layout="vertical" onFinish={handleRegistrar}>
          <Form.Item name="proyecto_id" label="Proyecto" rules={[{ required: true }]}>
            <Select placeholder="Selecciona un proyecto">
              {(usuario?.proyectos ?? proyectos.map(p => p.proyecto_id)).map(id => {
                const p = proyectos.find(x => x.proyecto_id === id);
                return <Option key={id} value={id}>{p?.nombre ?? id}</Option>;
              })}
            </Select>
          </Form.Item>
          <Form.Item name="cedula" label="Cédula / Pasaporte" rules={[{ required: true }]}><Input placeholder="V-12345678" /></Form.Item>
          <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono"><Input placeholder="+58 412 0000000" /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="estado_civil" label="Estado civil">
            <Select allowClear>
              <Option value="soltero">Soltero/a</Option><Option value="casado">Casado/a</Option>
              <Option value="divorciado">Divorciado/a</Option><Option value="viudo">Viudo/a</Option>
              <Option value="union_libre">Unión libre</Option>
            </Select>
          </Form.Item>
          <Form.Item name="nacionalidad" label="Nacionalidad"><Input /></Form.Item>
          <Form.Item name="pais_residencia" label="País de residencia"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* Modal editar */}
      <Modal title="Editar datos del cliente" open={editarModal}
        onCancel={() => setEditarModal(false)} onOk={() => formEditar.submit()}
        okText="Guardar" cancelText="Cancelar" width={520}>
        <Form form={formEditar} layout="vertical" onFinish={handleEditar}>
          <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono"><Input /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="estado_civil" label="Estado civil">
            <Select allowClear>
              <Option value="soltero">Soltero/a</Option><Option value="casado">Casado/a</Option>
              <Option value="divorciado">Divorciado/a</Option><Option value="viudo">Viudo/a</Option>
              <Option value="union_libre">Unión libre</Option>
            </Select>
          </Form.Item>
          <Form.Item name="nacionalidad" label="Nacionalidad"><Input /></Form.Item>
          <Form.Item name="pais_residencia" label="País de residencia"><Input /></Form.Item>
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
              background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8,
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

      {/* Drawer historial */}
      <HistorialEstatusDrawer open={!!historialProceso} proceso={historialProceso}
        clienteNombre={historialNombre} onClose={() => setHistorialProceso(null)} />
    </div>
  );
};

export default ClientesPage;
