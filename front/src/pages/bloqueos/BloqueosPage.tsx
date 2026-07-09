import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Tag, Button, Space,
  Modal, Form, InputNumber, Input, message, Badge, Tabs,
  DatePicker, Select, Divider, Radio, Dropdown, Grid, Spin, Alert,
} from 'antd';
import {
  UnlockOutlined, ClockCircleOutlined, ReloadOutlined, FieldTimeOutlined,
  HistoryOutlined, UserAddOutlined, SearchOutlined, MoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBloquesActivos, liberarBloqueo, extenderBloqueo, getHistorialBloqueos, bloquearUnidad } from '../../services/bloqueos.service';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import { buscarClientesAdmin } from '../../services/clientes.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Bloqueo, Proyecto, HistorialBloqueo, Cliente } from '../../types';
import { clienteFieldNormalizers, clienteFormRules, normalizeClientePayload } from '../../utils/clientesValidation';
import { EstadoCivilSelect, NacionalidadSelect, PaisResidenciaSelect } from '../../components/common/CatalogoClienteFields';
import { confirmarLiberarBloqueo } from '../../components/common/ConfirmarLiberarBloqueo';
import type { ModoNotificacion } from '../../components/common/CambiarEstatusModal';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const formatTiempo = (segundos: number) => {
  if (segundos <= 0) return 'Vencido';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h}h ${m}m`;
};

const tiempoColor = (segundos?: number) => {
  if (!segundos || segundos <= 0) return 'error';
  if (segundos < 5 * 3600) return 'warning';
  return 'success';
};

const BloqueosPage = () => {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [historial, setHistorial] = useState<HistorialBloqueo[]>([]);
  const [historialNextToken, setHistorialNextToken] = useState<string | undefined>();
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [modalExtender, setModalExtender] = useState(false);
  const [bloqueoSeleccionado, setBloqueoSeleccionado] = useState<Bloqueo | null>(null);
  const [form] = Form.useForm();
  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [modalAsignarCliente, setModalAsignarCliente] = useState(false);
  const [bloqueoSinCliente, setBloqueoSinCliente] = useState<Bloqueo | null>(null);
  const [formCliente] = Form.useForm();
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [modoAsignar, setModoAsignar] = useState<'existente' | 'nuevo'>('existente');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesInmo, setClientesInmo] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [b, p, inmos] = await Promise.all([getBloquesActivos(), getProyectos(), getInmobiliarias()]);
      const ahora = Date.now();
      const enriquecidos = b.items.map(item => ({
        ...item,
        // Siempre recalcular desde fecha_liberacion para que refleje el tiempo real
        tiempo_restante: Math.max(0, Math.floor(
          (new Date(item.fecha_liberacion).getTime() - ahora) / 1000
        )),
      }));
      setBloqueos(enriquecidos);
      setProyectos(p);
      setInmobiliarias(inmos);
    } catch {
      message.error('Error al cargar bloqueos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const [h, inmos] = await Promise.all([getHistorialBloqueos(undefined, undefined, proyectoFiltro), getInmobiliarias()]);
      const sorted = [...h.items].sort((a, b) =>
        (b.fecha_bloqueo ?? '').localeCompare(a.fecha_bloqueo ?? '')
      );
      setHistorial(sorted);
      setHistorialNextToken(h.next_token);
      setInmobiliarias(inmos);
    } catch {
      message.error('Error al cargar historial');
    } finally {
      setLoadingHistorial(false);
    }
  }, [proyectoFiltro]);

  const cargarMasHistorial = useCallback(async () => {
    if (!historialNextToken) return;
    setLoadingHistorial(true);
    try {
      const h = await getHistorialBloqueos(undefined, historialNextToken, proyectoFiltro);
      setHistorial(prev => [...prev, ...h.items].sort((a, b) =>
        (b.fecha_bloqueo ?? '').localeCompare(a.fecha_bloqueo ?? '')
      ));
      setHistorialNextToken(h.next_token);
    } catch {
      message.error('Error al cargar más historial');
    } finally {
      setLoadingHistorial(false);
    }
  }, [historialNextToken, proyectoFiltro]);

  const handleLiberar = async (b: Bloqueo, notificar: ModoNotificacion) => {
    try {
      await liberarBloqueo(b.unidad_id, b.proyecto_id, notificar);
      message.success('Bloqueo liberado');
      cargar();
    } catch {
      message.error('Error al liberar bloqueo');
    }
  };

  const abrirLiberarBloqueo = (b: Bloqueo) => confirmarLiberarBloqueo({
    tieneCliente: !!b.cliente_cedula,
    onConfirm: (notificar) => handleLiberar(b, notificar),
  });

  const abrirExtender = (b: Bloqueo) => {
    setBloqueoSeleccionado(b);
    form.resetFields();
    setModalExtender(true);
  };

  const abrirAsignarCliente = (b: Bloqueo) => {
    setBloqueoSinCliente(b);
    formCliente.resetFields();
    setModoAsignar('existente');
    setBusquedaCliente('');
    setClientesInmo([]);
    setClienteSeleccionado(null);
    setModalAsignarCliente(true);
  };

  useEffect(() => {
    const texto = busquedaCliente.trim();
    if (!bloqueoSinCliente || modoAsignar !== 'existente' || texto.length < 2) {
      setClientesInmo([]);
      setLoadingClientes(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingClientes(true);
      try {
        const [porNombre, porCedula] = await Promise.all([
          buscarClientesAdmin(texto, 'nombre', bloqueoSinCliente.proyecto_id, bloqueoSinCliente.bloqueado_por),
          buscarClientesAdmin(texto, 'cedula', bloqueoSinCliente.proyecto_id, bloqueoSinCliente.bloqueado_por),
        ]);
        const vistos = new Set<string>();
        const combinados = [...(porNombre || []), ...(porCedula || [])].filter((c: Cliente) => {
          if (!c.cedula || vistos.has(c.cedula)) return false;
          vistos.add(c.cedula);
          return true;
        });
        setClientesInmo(combinados);
      } catch {
        setClientesInmo([]);
      } finally {
        setLoadingClientes(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [busquedaCliente, bloqueoSinCliente, modoAsignar]);

  const handleSeleccionarCliente = (cedula: string) => {
    const c = clientesInmo.find(x => x.cedula === cedula) ?? null;
    setClienteSeleccionado(c);
    if (c) {
      formCliente.setFieldsValue({
        cedula: c.cedula,
        nombres: c.nombres,
        apellidos: c.apellidos,
        correo: c.correo,
        telefono: c.telefono,
        fecha_nacimiento: c.fecha_nacimiento ? dayjs(c.fecha_nacimiento) : undefined,
        estado_civil: c.estado_civil,
        nacionalidad: c.nacionalidad,
        pais_residencia: c.pais_residencia,
      });
    }
  };

  const handleAsignarCliente = async (values: any) => {
    if (!bloqueoSinCliente) return;
    // En modo existente, tomar datos del cliente seleccionado
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

    if (!payload.cedula) {
      message.warning('Selecciona un cliente de la lista');
      return;
    }

    setGuardandoCliente(true);
    try {
      await bloquearUnidad({
        proyecto_id: bloqueoSinCliente.proyecto_id,
        unidad_id: bloqueoSinCliente.unidad_id,
        ...payload,
      });
      message.success('Cliente asignado al bloqueo');
      setModalAsignarCliente(false);
      setClienteSeleccionado(null);
      cargar();
    } catch (err: any) {
      console.error('Error al asignar cliente:', err);
      // El mensaje ya viene procesado por handleApiError en api.ts
      const errorMessage = err?.message || 'Error al asignar cliente';
      message.error(errorMessage);
    } finally {
      setGuardandoCliente(false);
    }
  };

  const handleExtender = async (values: { horas_restantes: number; justificacion: string }) => {
    if (!bloqueoSeleccionado) return;
    try {
      await extenderBloqueo(bloqueoSeleccionado.unidad_id, bloqueoSeleccionado.proyecto_id, { horas_extra: values.horas_restantes, justificacion: values.justificacion });
      message.success(`Tiempo de bloqueo actualizado a ${values.horas_restantes} horas`);
      setModalExtender(false);
      cargar();
    } catch {
      message.error('Error al actualizar tiempo de bloqueo');
    }
  };

  const proyectoNombre = (id: string) => {
    const clean = id?.replace('PROYECTO#', '');
    return proyectos.find(p => p.proyecto_id === clean)?.nombre ?? clean ?? id;
  };

  const inmoNombre = (id: string) => {
    const inmo = inmobiliarias.find(i => i.pk === id || i.pk === `INMOBILIARIA#${id}` || id === i.pk.replace('INMOBILIARIA#', ''));
    return inmo?.nombre ?? id;
  };

  const columns = [
    {
      title: 'Unidad', dataIndex: 'id_unidad', key: 'id_unidad',
      render: (v: string, r: Bloqueo) => (
        <Text strong>{[r.torre_nombre, v || r.unidad_id].filter(Boolean).join(' · ')}</Text>
      ),
    },
    ...(!isMobile ? [
      { title: 'Proyecto', dataIndex: 'proyecto_id', key: 'proyecto_id', render: (v: string) => proyectoNombre(v) },
      { title: 'Bloqueado por', dataIndex: 'bloqueado_por', key: 'bloqueado_por', render: (v: string) => <Tag>{inmoNombre(v)}</Tag> },
      {
        title: 'Cliente', dataIndex: 'cliente_cedula', key: 'cliente_cedula',
        render: (v: string, r: any) => v
          ? <span><Tag color="green">Con cliente</Tag>{r.cliente_nombre && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>{r.cliente_nombre}</Text>}</span>
          : <Tag color="orange">Sin cliente</Tag>,
      },
      { title: 'Vence', dataIndex: 'fecha_liberacion', key: 'fecha_liberacion', render: (v: string) => new Date(v).toLocaleString('es-VE') },
    ] : []),
    {
      title: 'Tiempo', dataIndex: 'tiempo_restante', key: 'tiempo_restante',
      render: (v: number) => (
        <Badge status={tiempoColor(v)} text={
          <Text style={{ color: v < 5 * 3600 ? (v <= 0 ? '#ff4d4f' : '#faad14') : '#52c41a', fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />{formatTiempo(v)}
          </Text>
        } />
      ),
    },
    {
      title: '', key: 'acciones', width: 48,
      render: (_: unknown, record: Bloqueo) => {
        const items = [
          ...(!record.cliente_cedula ? [{ key: 'asignar', icon: <UserAddOutlined />, label: 'Asignar cliente', onClick: () => abrirAsignarCliente(record) }] : []),
          { key: 'extender', icon: <FieldTimeOutlined />, label: 'Cambiar tiempo', onClick: () => abrirExtender(record) },
          {
            key: 'liberar', icon: <UnlockOutlined />, label: 'Liberar', danger: true,
            onClick: () => abrirLiberarBloqueo(record),
          },
        ];
        return <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight"><Button size="small" icon={<MoreOutlined />} /></Dropdown>;
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Bloqueos</Title>
        <Space wrap>
          <Select allowClear placeholder="Filtrar por proyecto" style={{ width: isMobile ? '100%' : 200 }}
            value={proyectoFiltro} onChange={setProyectoFiltro}>
            {proyectos.map(p => <Select.Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Select.Option>)}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading}>{!isMobile && 'Actualizar'}</Button>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="activos"
        onChange={key => { if (key === 'historial') cargarHistorial(); }}
        items={[
          {
            key: 'activos',
            label: `Activos (${bloqueos.filter(b => !proyectoFiltro || b.proyecto_id === proyectoFiltro || b.proyecto_id?.replace('PROYECTO#','') === proyectoFiltro).length})`,
            children: isMobile ? (
              <div>
                {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</div>}
                {!loading && bloqueos.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No hay bloqueos activos</div>}
                {bloqueos.filter(b => !proyectoFiltro || b.proyecto_id === proyectoFiltro || b.proyecto_id?.replace('PROYECTO#','') === proyectoFiltro).map(b => {
                  const tiempoOk = b.tiempo_restante ?? 0;
                  const color = tiempoOk <= 0 ? '#ff4d4f' : tiempoOk < 5 * 3600 ? '#faad14' : '#52c41a';
                  const menuItems = [
                    ...(!b.cliente_cedula ? [{ key: 'asignar', icon: <UserAddOutlined />, label: 'Asignar cliente', onClick: () => abrirAsignarCliente(b) }] : []),
                    { key: 'extender', icon: <FieldTimeOutlined />, label: 'Cambiar tiempo', onClick: () => abrirExtender(b) },
                    { key: 'liberar', icon: <UnlockOutlined />, label: 'Liberar', danger: true, onClick: () => abrirLiberarBloqueo(b) },
                  ];
                  return (
                    <div key={b.unidad_id} style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <Text strong style={{ fontSize: 15 }}>{[b.torre_nombre, b.id_unidad || b.unidad_id].filter(Boolean).join(' · ')}</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>{proyectoNombre(b.proyecto_id)}</Text></div>
                        </div>
                        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                          <Button size="small" icon={<MoreOutlined />} />
                        </Dropdown>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {b.cliente_cedula ? <Tag color="green">Con cliente</Tag> : <Tag color="orange">Sin cliente</Tag>}
                        </div>
                        <Text style={{ fontSize: 13, color, fontWeight: 600 }}>
                          <ClockCircleOutlined style={{ marginRight: 4 }} />{formatTiempo(tiempoOk)}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table
                dataSource={bloqueos.filter(b => !proyectoFiltro || b.proyecto_id === proyectoFiltro || b.proyecto_id?.replace('PROYECTO#','') === proyectoFiltro)}
                columns={columns}
                rowKey="unidad_id"
                loading={loading}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                locale={{ emptyText: 'No hay bloqueos activos' }}
                scroll={{ x: true }}
              />
            ),
          },
          {
            key: 'historial',
            label: <span><HistoryOutlined /> Historial</span>,
            children: (
              <>
                {isMobile ? (
                  <div>
                    {loadingHistorial && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Cargando historial...</div>}
                    {!loadingHistorial && historial.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No hay registros en el historial</div>}
                    {historial.map(item => {
                      const motivo = item.motivo_liberacion;
                      const cfg: Record<string, string> = { automatica: 'success', manual: 'blue', venta: 'purple' };
                      const inmo = inmobiliarias.find(i => i.pk === item.inmobiliaria_id || i.pk === `INMOBILIARIA#${item.inmobiliaria_id}`);
                      return (
                        <div key={item.sk} style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', marginBottom: 10, padding: '14px 16px' }}>
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <Text strong>{[item.torre_nombre, item.unidad_nombre ?? item.unidad_id].filter(Boolean).join(' · ')}</Text>
                              {motivo ? <Tag color={cfg[motivo] ?? 'default'} style={{ margin: 0 }}>{motivo}</Tag> : <Tag color="warning" style={{ margin: 0 }}>Activo</Tag>}
                            </div>
                            <Text type="secondary">{proyectoNombre(item.proyecto_id)}</Text>
                            <Tag style={{ width: 'fit-content' }}>{item.inmobiliaria_nombre ?? inmo?.nombre ?? item.inmobiliaria_id}</Tag>
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
                  dataSource={historial}
                  rowKey="sk"
                  loading={loadingHistorial}
                  pagination={{ pageSize: 20, showSizeChanger: false }}
                  locale={{ emptyText: 'No hay registros en el historial' }}
                  columns={[
                    { title: 'Unidad', dataIndex: 'unidad_id', key: 'unidad_id', render: (v: string, r: any) => (
                      <Text strong>{[r.torre_nombre, r.unidad_nombre ?? v].filter(Boolean).join(' · ')}</Text>
                    )},
                    { title: 'Proyecto', dataIndex: 'proyecto_id', key: 'proyecto_id', render: (v: string) => proyectoNombre(v) },
                    { title: 'Inmobiliaria', dataIndex: 'inmobiliaria_id', key: 'inmobiliaria_id', render: (v: string, r: any) => {
                      const inmo = inmobiliarias.find(i => i.pk === v || i.pk === `INMOBILIARIA#${v}`);
                      return <Tag>{r.inmobiliaria_nombre ?? inmo?.nombre ?? v}</Tag>;
                    }},
                    { title: 'Bloqueado', dataIndex: 'fecha_bloqueo', key: 'fecha_bloqueo', render: (v: string) => new Date(v).toLocaleString('es-VE') },
                    { title: 'Liberado', dataIndex: 'fecha_liberacion', key: 'fecha_liberacion', render: (v: string) => v ? new Date(v).toLocaleString('es-VE') : '—' },
                    {
                      title: 'Motivo',
                      dataIndex: 'motivo_liberacion',
                      key: 'motivo_liberacion',
                      render: (v: string) => {
                        if (!v) return <Tag color="warning">Activo</Tag>;
                        const cfg: Record<string, string> = { automatica: 'success', manual: 'blue', venta: 'purple' };
                        return <Tag color={cfg[v] ?? 'default'}>{v}</Tag>;
                      },
                    },
                    { title: 'Liberado por', dataIndex: 'liberado_por', key: 'liberado_por', render: (v: string) => v ?? '—' },
                  ]}
                />
                )}
                {historialNextToken && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Button onClick={cargarMasHistorial} loading={loadingHistorial}>
                      Cargar más
                    </Button>
                  </div>
                )}
              </>
            ),
          },
        ]}
      />

      <Modal
        title="Establecer tiempo restante"
        open={modalExtender}
        onCancel={() => setModalExtender(false)}
        onOk={() => form.submit()}
        okText="Aplicar"
        cancelText="Cancelar"
      >
        {bloqueoSeleccionado && (
          <div style={{
            background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>UNIDAD</Text>
              <div><Text strong>{bloqueoSeleccionado.id_unidad || bloqueoSeleccionado.unidad_id}</Text></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>VENCE ACTUALMENTE</Text>
              <div><Text>{new Date(bloqueoSeleccionado.fecha_liberacion).toLocaleString('es-VE')}</Text></div>
            </div>
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handleExtender}>
          <Form.Item 
            name="horas_restantes" 
            label="Tiempo restante deseado" 
            initialValue={1} 
            rules={[
              { required: true, message: 'El tiempo restante es requerido' },
              {
                validator: (_, value) => {
                  if (value === null || value === undefined) {
                    return Promise.reject(new Error('El tiempo restante es requerido'));
                  }
                  if (value < 0.02) {
                    return Promise.reject(new Error('Mínimo 1 minuto (0.02 horas)'));
                  }
                  if (value > 168) {
                    return Promise.reject(new Error('Máximo 168 horas (7 días)'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
            help="Establece cuánto tiempo quieres que quede desde ahora hasta la liberación"
          >
            <InputNumber 
              min={0.02} 
              max={168} 
              step={0.1}
              style={{ width: '100%' }} 
              addonAfter="horas"
              placeholder="Ej: 0.1 (6 min), 1 (1 hora), 24 (1 día)"
            />
          </Form.Item>
          <div style={{ marginBottom: 16, padding: 8, background: 'var(--panel-soft-bg)', borderRadius: 4, fontSize: 12 }}>
            <Text type="secondary">
              💡 <strong>Ejemplos:</strong><br/>
              • 0.1 horas = 6 minutos (para probar notificaciones)<br/>
              • 1 hora = 1 hora<br/>
              • 24 horas = 1 día<br/>
              • 48 horas = 2 días (tiempo normal)
            </Text>
          </div>
          <Form.Item name="justificacion" label="Justificación" rules={[{ required: true, message: 'La justificación es requerida' }]}>
            <Input.TextArea rows={3} placeholder="Motivo del cambio de tiempo..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Asignar cliente al bloqueo"
        open={modalAsignarCliente}
        onCancel={() => { setModalAsignarCliente(false); setClienteSeleccionado(null); }}
        onOk={() => {
          if (modoAsignar === 'existente' && !clienteSeleccionado) {
            message.warning('Selecciona un cliente de la lista');
            return;
          }
          formCliente.submit();
        }}
        okText="Asignar"
        cancelText="Cancelar"
        confirmLoading={guardandoCliente}
        width={580}
      >
        {bloqueoSinCliente && (
          <div style={{
            background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>UNIDAD</Text>
              <div><Text strong>{bloqueoSinCliente.id_unidad || bloqueoSinCliente.unidad_id}</Text></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>PROYECTO</Text>
              <div><Text>{proyectoNombre(bloqueoSinCliente.proyecto_id)}</Text></div>
            </div>
          </div>
        )}

        <Radio.Group
          value={modoAsignar}
          onChange={e => { setModoAsignar(e.target.value); formCliente.resetFields(); setClienteSeleccionado(null); }}
          style={{ marginBottom: 16 }}
          buttonStyle="solid"
        >
          <Radio.Button value="existente"><SearchOutlined /> Cliente existente</Radio.Button>
          <Radio.Button value="nuevo"><UserAddOutlined /> Nuevo cliente</Radio.Button>
        </Radio.Group>

        {modoAsignar === 'existente' ? (
          <div>
            <Input
              placeholder="Buscar por nombre, cedula o pasaporte..."
              prefix={<SearchOutlined />}
              value={busquedaCliente}
              onChange={e => {
                setBusquedaCliente(e.target.value);
                setClienteSeleccionado(null);
                formCliente.resetFields(['cedula']);
              }}
              allowClear
              style={{ marginBottom: 12 }}
            />
            {loadingClientes && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  Buscando clientes...
                </Text>
              </div>
            )}
            {!loadingClientes && busquedaCliente.trim().length >= 2 && clientesInmo.length === 0 && (
              <Alert
                type="info"
                message="No se encontraron clientes"
                description="Intenta con otro nombre, cedula o pasaporte, o registra un cliente nuevo."
                showIcon
                style={{ marginBottom: 12 }}
              />
            )}
            {clientesInmo.length > 0 && (
              <Select
                style={{ width: '100%' }}
                placeholder="Selecciona un cliente..."
                value={clienteSeleccionado?.cedula}
                onChange={handleSeleccionarCliente}
                options={clientesInmo.map(c => ({
                  value: c.cedula,
                  label: `${c.nombres} ${c.apellidos} - ${c.cedula}`,
                }))}
              />
            )}
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
            {!busquedaCliente.trim() && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                Escribe al menos 2 caracteres para buscar clientes de esta inmobiliaria.
              </Text>
            )}
            {/* Form oculto para submit con la cédula del cliente seleccionado */}
            <Form form={formCliente} onFinish={handleAsignarCliente}>
              <Form.Item name="cedula" hidden><Input /></Form.Item>
            </Form>
          </div>
        ) : (
          <Form form={formCliente} layout="vertical" onFinish={handleAsignarCliente}>
            <Divider style={{ margin: '0 0 16px' }} />
            <Form.Item name="cedula" label="Cédula / Pasaporte" rules={clienteFormRules.cedula}>
              <Input placeholder="12345678 o AB123456" />
            </Form.Item>
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
    </div>
  );
};

export default BloqueosPage;
