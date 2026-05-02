import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Tag, Button, Modal, Form, Input, Select,
  DatePicker, message, Space, Tooltip, Spin, Grid,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, UserOutlined, HistoryOutlined,
  SwapOutlined, SearchOutlined, EditOutlined, EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getClientes, getClientesAdmin, buscarClienteAdmin,
  registrarCliente, actualizarClienteAdmin,
} from '../../services/clientes.service';
import { getProcesosCliente, getMisProcesos, cambiarEstatus } from '../../services/crm.service';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import { useAuthContext } from '../../context/AuthContext';
import type { Cliente, Proyecto, Proceso } from '../../types';
import CambiarEstatusModal, { type ModoNotificacion } from '../../components/common/CambiarEstatusModal';
import HistorialEstatusDrawer from '../../components/common/HistorialEstatusDrawer';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL } from '../../constants/estados';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;
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

  // Filtro local por búsqueda
  const clientesFiltrados = busqueda.trim()
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
    } catch { message.error('Error al actualizar'); }
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
      try {
        const body = await err?.response?.body?.json?.();
        message.error(body?.message || body?.error || 'Error al cambiar estatus');
      } catch {
        message.error('Error al cambiar estatus');
      }
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
      const status = err?.response?.status ?? err?.response?.statusCode;
      try {
        const body = await err?.response?.body?.json?.();
        const msg = body?.message || body?.error;
        if (status === 409) message.error(msg || 'Este cliente tiene exclusividad activa en este proyecto.');
        else message.error(msg || 'Error al registrar cliente');
      } catch {
        if (status === 409) message.error('Este cliente tiene exclusividad activa en este proyecto.');
        else message.error('Error al registrar cliente');
      }
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
      render: (_: unknown, r: Cliente) => r.exclusividad_activa
        ? <Tag color="green">Activa hasta {dayjs(r.fecha_vencimiento).format('DD/MM/YYYY')}</Tag>
        : <Tag>Vencida</Tag>,
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
          <Input prefix={<SearchOutlined />} placeholder="Buscar por nombre o cédula..."
            style={{ width: isMobile ? '100%' : 240 }} value={busqueda} onChange={e => setBusqueda(e.target.value)} allowClear />
          <Select allowClear placeholder="Proyecto" style={{ width: isMobile ? '100%' : 180 }}
            value={proyectoFiltro}
            onChange={(v) => { setProyectoFiltro(v); setNextToken(undefined); cargar(v, inmoFiltro); }}>
            {proyectos.map(p => <Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Option>)}
          </Select>
          {isAdmin && (
            <Select allowClear placeholder="Inmobiliaria" style={{ width: isMobile ? '100%' : 180 }}
              value={inmoFiltro}
              onChange={(v) => { setInmoFiltro(v); setNextToken(undefined); cargar(proyectoFiltro, v); }}>
              {inmobiliarias.map(i => <Option key={i.pk} value={i.pk}>{i.nombre}</Option>)}
            </Select>
          )}
        </div>
      </div>

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
                    {r.registros.map(reg => (
                      <Tag key={`${reg.pk}#${reg.sk}`} color={reg.exclusividad_activa ? 'blue' : 'default'} style={{ margin: 0 }}>
                        {proyectoNombre(reg.proyecto_id)}
                      </Tag>
                    ))}
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
          {nextToken && (
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
                  {r.exclusividad_activa
                    ? <Tag color="green" style={{ margin: 0 }}>Activa</Tag>
                    : <Tag style={{ margin: 0 }}>Vencida</Tag>}
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
                <div>
                  <Text strong>{proyectoNombre(reg.proyecto_id)}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{inmoNombre(reg.inmobiliaria_id)}</Text>
                </div>
                <Tag color={reg.exclusividad_activa ? 'green' : 'default'}>
                  {reg.exclusividad_activa ? `Excl. hasta ${dayjs(reg.fecha_vencimiento).format('DD/MM/YYYY')}` : 'Vencida'}
                </Tag>
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
                  return (
                    <div key={p.sk} style={{ marginBottom: 6 }}>
                      {alertaVencida && (
                        <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '4px 10px', marginBottom: 4, fontSize: 12, color: '#cf1322', display: 'flex', alignItems: 'center', gap: 6 }}>
                          ⚠️ Separación vencida — 30 días sin pago confirmado
                        </div>
                      )}
                      {proximoVencer && (
                        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '4px 10px', marginBottom: 4, fontSize: 12, color: '#d46b08', display: 'flex', alignItems: 'center', gap: 6 }}>
                          ⏰ Vence en {30 - diasEnSeparacion!} día{30 - diasEnSeparacion! !== 1 ? 's' : ''} — pendiente pago de separación
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={4}>
                          <Tag color="geekblue" style={{ margin: 0 }}>{p.unidad_nombre || p.unidad_id}</Tag>
                          <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
                        </Space>
                        <Space size={0}>
                          <Button size="small" type="link" icon={<SwapOutlined />}
                            onClick={() => { setEstatusModal(p); setEstatusCliente(reg); }}>Estatus</Button>
                          <Button size="small" type="link" icon={<HistoryOutlined />}
                            onClick={() => { setHistorialProceso(p); setHistorialNombre(`${reg.nombres} ${reg.apellidos}`); }}>Historial</Button>
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
                  <div style={{ marginTop: 2 }}>
                    {drawerCliente.exclusividad_activa
                      ? <Tag color="green">Activa hasta {dayjs(drawerCliente.fecha_vencimiento).format('DD/MM/YYYY')}</Tag>
                      : <Tag color="default">Vencida</Tag>}
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
                      <Tag color={ESTADO_PROCESO_COLOR[p.estado]}>{ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}</Tag>
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

      {/* Drawer historial */}
      <HistorialEstatusDrawer open={!!historialProceso} proceso={historialProceso}
        clienteNombre={historialNombre} onClose={() => setHistorialProceso(null)} />
    </div>
  );
};

export default ClientesPage;
