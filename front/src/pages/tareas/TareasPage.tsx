import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Card, Col, Empty, Form, Grid, Input, InputNumber, Modal, Row, Select,
  Space, Spin, Statistic, Table, Tag, Typography, message,
} from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, EditOutlined, FieldTimeOutlined,
  LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined, StopOutlined, TeamOutlined,
} from '@ant-design/icons';
import useAuth from '../../hooks/useAuth';
import {
  actualizarTarea, cancelarTarea, crearTarea, getTareas,
  type EstadoTarea, type PrioridadTarea, type TareaJam,
} from '../../services/tareas.service';
import { getUsuariosSistema, type UsuarioSistema } from '../../services/sistema.service';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const estadoLabel: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const estadoColor: Record<EstadoTarea, string> = {
  pendiente: 'gold',
  en_progreso: 'blue',
  completada: 'green',
  cancelada: 'red',
};

const prioridadColor: Record<PrioridadTarea, string> = {
  baja: 'default',
  media: 'processing',
  alta: 'error',
};

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (date: string) => date ? date.split('-').reverse().join('/') : '-';

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const parseDateKey = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const endOfMonthKey = (monthStart: string) => {
  const date = parseDateKey(monthStart);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

const shiftMonth = (date: string, diff: number) => {
  const parsed = parseDateKey(date);
  return toDateKey(new Date(parsed.getFullYear(), parsed.getMonth() + diff, 1));
};

const monthTitle = (date: string) =>
  parseDateKey(date).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });

const dayTitle = (date: string) =>
  parseDateKey(date).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });

const shortDayTitle = (date: string) =>
  parseDateKey(date).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });

const calendarDays = (monthStart: string) => {
  const firstDay = parseDateKey(monthStart);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: toDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === firstDay.getMonth(),
      isToday: toDateKey(date) === today(),
    };
  });
};

export default function TareasPage() {
  const { usuario } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isSmallMobile = !screens.sm;
  const puedeAsignar = usuario?.rol === 'admin' || usuario?.rol === 'coordinador';

  const [fechaSeleccionada, setFechaSeleccionada] = useState(today());
  const [filtros, setFiltros] = useState({ trabajador_id: '', estado: '', prioridad: '' });
  const [tareas, setTareas] = useState<TareaJam[]>([]);
  const [usuariosJam, setUsuariosJam] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalTarea, setModalTarea] = useState(false);
  const [editingTarea, setEditingTarea] = useState<TareaJam | null>(null);
  const [formTarea] = Form.useForm();

  const mesVisible = `${fechaSeleccionada.slice(0, 7)}-01`;
  const fechaHasta = useMemo(() => endOfMonthKey(mesVisible), [mesVisible]);
  const diasCalendario = useMemo(() => calendarDays(mesVisible), [mesVisible]);

  const usuariosAsignables = useMemo(
    () => usuariosJam.filter(u => u.activo),
    [usuariosJam],
  );

  const usuarioOptions = useMemo(
    () => usuariosAsignables.map(u => ({
      value: u.pk.replace('USUARIO#', ''),
      label: `${u.nombre || u.cognito_username} (${u.rol})`,
    })),
    [usuariosAsignables],
  );

  const tareasPorFecha = useMemo(() => tareas.reduce<Record<string, TareaJam[]>>((acc, tarea) => {
    if (!acc[tarea.fecha]) acc[tarea.fecha] = [];
    acc[tarea.fecha].push(tarea);
    return acc;
  }, {}), [tareas]);

  const tareasDelDia = useMemo(
    () => [...(tareasPorFecha[fechaSeleccionada] ?? [])].sort((a, b) => a.hora.localeCompare(b.hora)),
    [fechaSeleccionada, tareasPorFecha],
  );

  const resumen = useMemo(() => ({
    total: tareas.length,
    pendientes: tareas.filter(t => t.estado === 'pendiente').length,
    enProgreso: tareas.filter(t => t.estado === 'en_progreso').length,
    delDia: tareasDelDia.length,
  }), [tareas, tareasDelDia.length]);

  const cargarTareas = useCallback(async () => {
    setLoading(true);
    try {
      setTareas(await getTareas({
        fecha_desde: mesVisible,
        fecha_hasta: fechaHasta,
        trabajador_id: filtros.trabajador_id || undefined,
        estado: filtros.estado as EstadoTarea || undefined,
        prioridad: filtros.prioridad as PrioridadTarea || undefined,
      }));
    } catch (err: unknown) {
      message.error(errorMessage(err, 'Error al cargar tareas'));
    } finally {
      setLoading(false);
    }
  }, [fechaHasta, filtros.estado, filtros.prioridad, filtros.trabajador_id, mesVisible]);

  const cargarUsuariosJam = useCallback(async () => {
    try {
      setUsuariosJam(await getUsuariosSistema());
    } catch (err: unknown) {
      message.error(errorMessage(err, 'Error al cargar usuarios JAM'));
    }
  }, []);

  useEffect(() => {
    cargarUsuariosJam();
  }, [cargarUsuariosJam]);

  useEffect(() => {
    cargarTareas();
  }, [cargarTareas]);

  const abrirNuevaTarea = () => {
    setEditingTarea(null);
    formTarea.resetFields();
    formTarea.setFieldsValue({ fecha: fechaSeleccionada, hora: '08:00', prioridad: 'media', estado: 'pendiente', duracion_minutos: 60 });
    setModalTarea(true);
  };

  const abrirEditarTarea = (tarea: TareaJam) => {
    setEditingTarea(tarea);
    formTarea.setFieldsValue(tarea);
    setModalTarea(true);
  };

  const guardarTarea = async () => {
    const values = await formTarea.validateFields();
    try {
      if (editingTarea) {
        await actualizarTarea(editingTarea.tarea_id, values);
        message.success('Tarea actualizada');
      } else {
        await crearTarea(values);
        message.success('Tarea creada');
      }
      setModalTarea(false);
      await cargarTareas();
    } catch (err: unknown) {
      message.error(errorMessage(err, 'No se pudo guardar la tarea'));
    }
  };

  const cambiarEstado = async (tarea: TareaJam, estado: EstadoTarea) => {
    try {
      await actualizarTarea(tarea.tarea_id, { estado });
      message.success('Estado actualizado');
      await cargarTareas();
    } catch (err: unknown) {
      message.error(errorMessage(err, 'No se pudo actualizar el estado'));
    }
  };

  const cancelar = async (tarea: TareaJam) => {
    try {
      await cancelarTarea(tarea.tarea_id);
      message.success('Tarea cancelada');
      await cargarTareas();
    } catch (err: unknown) {
      message.error(errorMessage(err, 'No se pudo cancelar la tarea'));
    }
  };

  const cambiarMes = (diff: number) => {
    setFechaSeleccionada(shiftMonth(mesVisible, diff));
  };

  const irAHoy = () => {
    setFechaSeleccionada(today());
  };

  const tareaColumns = [
    { title: 'Hora', dataIndex: 'hora', width: 90 },
    {
      title: 'Tarea',
      render: (_: unknown, item: TareaJam) => (
        <Space direction="vertical" size={2}>
          <Text strong>{item.titulo}</Text>
          {item.descripcion && <Text type="secondary">{item.descripcion}</Text>}
        </Space>
      ),
    },
    { title: 'Trabajador', dataIndex: 'trabajador_nombre' },
    { title: 'Duracion', dataIndex: 'duracion_minutos', render: (v?: number) => v ? `${v} min` : '-' },
    { title: 'Estado', dataIndex: 'estado', render: (v: EstadoTarea) => <Tag color={estadoColor[v]}>{estadoLabel[v]}</Tag> },
    { title: 'Prioridad', dataIndex: 'prioridad', render: (v: PrioridadTarea) => <Tag color={prioridadColor[v]}>{v}</Tag> },
    {
      title: 'Acciones',
      render: (_: unknown, item: TareaJam) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditarTarea(item)} disabled={!puedeAsignar} />
          <Button size="small" icon={<ClockCircleOutlined />} onClick={() => cambiarEstado(item, 'en_progreso')} disabled={!puedeAsignar || item.estado === 'en_progreso'} />
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => cambiarEstado(item, 'completada')} disabled={!puedeAsignar || item.estado === 'completada'} />
          <Button size="small" danger icon={<StopOutlined />} onClick={() => cancelar(item)} disabled={usuario?.rol !== 'admin' || item.estado === 'cancelada'} />
        </Space>
      ),
    },
  ];

  return (
    <div className="agenda-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>Agenda / Tareas</Title>
          <Text type="secondary">Planifica el trabajo por dia, hora y usuario JAM desde una vista de calendario.</Text>
        </div>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirNuevaTarea} disabled={!puedeAsignar}>
            Nueva tarea
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Tareas del mes" value={resumen.total} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Pendientes" value={resumen.pendientes} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="En progreso" value={resumen.enProgreso} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={`Dia ${formatDate(fechaSeleccionada)}`} value={resumen.delDia} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={6}>
            <Text type="secondary">Usuario JAM</Text>
            <Select
              allowClear
              showSearch
              style={{ width: '100%' }}
              placeholder="Todos"
              value={filtros.trabajador_id || undefined}
              onChange={value => setFiltros({ ...filtros, trabajador_id: value || '' })}
              options={usuarioOptions}
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} md={5}>
            <Text type="secondary">Estado</Text>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="Todos"
              value={filtros.estado || undefined}
              onChange={value => setFiltros({ ...filtros, estado: value || '' })}
              options={Object.entries(estadoLabel).map(([value, label]) => ({ value, label }))}
            />
          </Col>
          <Col xs={24} md={5}>
            <Text type="secondary">Prioridad</Text>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="Todas"
              value={filtros.prioridad || undefined}
              onChange={value => setFiltros({ ...filtros, prioridad: value || '' })}
              options={['baja', 'media', 'alta'].map(value => ({ value, label: value }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text type="secondary">Mes visible</Text>
            <Input type="month" value={fechaSeleccionada.slice(0, 7)} onChange={e => setFechaSeleccionada(`${e.target.value}-01`)} />
          </Col>
          <Col xs={24} md={4}>
            <Button block icon={<ReloadOutlined />} onClick={cargarTareas}>Actualizar</Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card bodyStyle={{ padding: isMobile ? 12 : 24 }}>
            <div style={{
              display: 'flex',
              alignItems: isSmallMobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              flexDirection: isSmallMobile ? 'column' : 'row',
              gap: 10,
              marginBottom: 14,
            }}>
              <Space style={{ minWidth: 0 }}>
                <CalendarOutlined />
                <Text strong style={{ textTransform: 'capitalize', fontSize: isMobile ? 16 : 18 }}>
                  {monthTitle(mesVisible)}
                </Text>
              </Space>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isSmallMobile ? '40px 1fr 40px' : 'auto auto auto',
                gap: 8,
                width: isSmallMobile ? '100%' : undefined,
              }}>
                <Button aria-label="Mes anterior" size={isMobile ? 'small' : 'middle'} icon={<LeftOutlined />} onClick={() => cambiarMes(-1)} />
                <Button size={isMobile ? 'small' : 'middle'} onClick={irAHoy}>Hoy</Button>
                <Button aria-label="Mes siguiente" size={isMobile ? 'small' : 'middle'} icon={<RightOutlined />} onClick={() => cambiarMes(1)} />
              </div>
            </div>
            <Spin spinning={loading}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: isMobile ? 4 : 6,
                marginBottom: 8,
              }}>
                {(isSmallMobile ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']).map((day, index) => (
                  <Text key={`${day}-${index}`} type="secondary" style={{ textAlign: 'center', fontSize: isMobile ? 11 : 12, fontWeight: 600 }}>{day}</Text>
                ))}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: isMobile ? 4 : 6,
              }}>
                {diasCalendario.map(day => {
                  const dayTasks = tareasPorFecha[day.key] ?? [];
                  const selected = day.key === fechaSeleccionada;
                  const activeBorder = selected ? '2px solid var(--action-bg)' : day.isToday ? '1px solid var(--action-border)' : '1px solid var(--app-border)';
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setFechaSeleccionada(day.key)}
                      style={{
                        minHeight: isSmallMobile ? 48 : isMobile ? 62 : 104,
                        aspectRatio: isSmallMobile ? '1 / 1' : undefined,
                        border: activeBorder,
                        borderRadius: isMobile ? 7 : 8,
                        padding: isMobile ? 5 : 8,
                        background: selected ? 'var(--action-soft-hover)' : 'var(--panel-bg)',
                        color: day.isCurrentMonth ? 'var(--text-main)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: selected ? '0 0 0 1px rgba(22, 119, 255, 0.12)' : undefined,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <Text strong={day.isToday || selected} style={{ color: 'inherit', fontSize: isMobile ? 13 : 14, lineHeight: 1 }}>{day.day}</Text>
                        {!isMobile && dayTasks.length > 0 && <Badge count={dayTasks.length} size="small" />}
                      </div>
                      {isMobile && dayTasks.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: isSmallMobile ? 8 : 10, minWidth: 0 }}>
                          {dayTasks.slice(0, 3).map(tarea => (
                            <span
                              key={tarea.tarea_id}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: tarea.estado === 'completada' ? '#52c41a' : tarea.estado === 'en_progreso' ? '#1677ff' : tarea.estado === 'cancelada' ? '#ff4d4f' : '#faad14',
                                flex: '0 0 auto',
                              }}
                            />
                          ))}
                          {dayTasks.length > 3 && <Text type="secondary" style={{ fontSize: 10, lineHeight: 1 }}>+{dayTasks.length - 3}</Text>}
                        </div>
                      )}
                      {!isMobile && dayTasks.slice(0, 2).map(tarea => (
                        <div key={tarea.tarea_id} style={{ marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tag color={estadoColor[tarea.estado]} style={{ marginInlineEnd: 4 }}>{tarea.hora}</Tag>
                          <Text style={{ fontSize: 12 }}>{tarea.titulo}</Text>
                        </div>
                      ))}
                      {!isMobile && dayTasks.length > 2 && (
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                          +{dayTasks.length - 2} mas
                        </Text>
                      )}
                    </button>
                  );
                })}
              </div>
              {isMobile && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  border: '1px solid var(--app-border)',
                  borderRadius: 8,
                  background: 'var(--panel-soft-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                  <Text strong style={{ textTransform: 'capitalize' }}>{shortDayTitle(fechaSeleccionada)}</Text>
                  <Tag color={tareasDelDia.length > 0 ? 'blue' : 'default'} style={{ margin: 0 }}>
                    {tareasDelDia.length} tarea{tareasDelDia.length === 1 ? '' : 's'}
                  </Tag>
                </div>
              )}
            </Spin>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card
            title={<span style={{ textTransform: 'capitalize' }}>{dayTitle(fechaSeleccionada)}</span>}
            extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={abrirNuevaTarea} disabled={!puedeAsignar}>Nueva</Button>}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {tareasDelDia.length === 0 && <Empty description="No hay tareas para este dia" />}
              {tareasDelDia.map(tarea => (
                <Card key={tarea.tarea_id} size="small">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <Text strong>{tarea.hora} - {tarea.titulo}</Text>
                      <Tag color={estadoColor[tarea.estado]}>{estadoLabel[tarea.estado]}</Tag>
                    </div>
                    <Text type="secondary"><TeamOutlined /> {tarea.trabajador_nombre}</Text>
                    {tarea.descripcion && <Text>{tarea.descripcion}</Text>}
                    <Space wrap>
                      <Tag color={prioridadColor[tarea.prioridad]}>{tarea.prioridad}</Tag>
                      {tarea.duracion_minutos && <Tag icon={<FieldTimeOutlined />}>{tarea.duracion_minutos} min</Tag>}
                    </Space>
                    <Space wrap>
                      <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditarTarea(tarea)} disabled={!puedeAsignar}>Editar</Button>
                      <Button aria-label="Marcar en progreso" size="small" icon={<ClockCircleOutlined />} onClick={() => cambiarEstado(tarea, 'en_progreso')} disabled={!puedeAsignar || tarea.estado === 'en_progreso'} />
                      <Button size="small" icon={<CheckCircleOutlined />} onClick={() => cambiarEstado(tarea, 'completada')} disabled={!puedeAsignar || tarea.estado === 'completada'}>Completar</Button>
                      {isMobile && usuario?.rol === 'admin' && (
                        <Button size="small" danger icon={<StopOutlined />} onClick={() => cancelar(tarea)} disabled={tarea.estado === 'cancelada'}>Cancelar tarea</Button>
                      )}
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {!isMobile && (
        <Card title="Detalle del dia seleccionado" style={{ marginTop: 16 }}>
          <Table
            rowKey="tarea_id"
            dataSource={tareasDelDia}
            columns={tareaColumns}
            loading={loading}
            pagination={false}
          />
        </Card>
      )}

      <Modal
        title={editingTarea ? 'Editar tarea' : 'Nueva tarea'}
        open={modalTarea}
        onCancel={() => setModalTarea(false)}
        onOk={guardarTarea}
        okText="Guardar"
        cancelText="Cancelar"
        width={760}
      >
        <Form form={formTarea} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={14}>
              <Form.Item name="titulo" label="Titulo" rules={[{ required: true, message: 'Requerido' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="trabajador_id" label="Usuario JAM" rules={[{ required: true, message: 'Selecciona un usuario JAM' }]}>
                <Select
                  showSearch
                  options={usuarioOptions}
                  optionFilterProp="label"
                  placeholder="Seleccionar usuario"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="fecha" label="Fecha" rules={[{ required: true, message: 'Requerido' }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="hora" label="Hora" rules={[{ required: true, message: 'Requerido' }]}>
                <Input type="time" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="duracion_minutos" label="Duracion">
                <InputNumber min={1} style={{ width: '100%' }} addonAfter="min" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="estado" label="Estado">
                <Select options={Object.entries(estadoLabel).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="prioridad" label="Prioridad">
                <Select options={['baja', 'media', 'alta'].map(value => ({ value, label: value }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descripcion" label="Descripcion">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
