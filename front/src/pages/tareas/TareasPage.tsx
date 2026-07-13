import { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, Empty, Form, Grid, Input, InputNumber, Modal, Row, Select,
  Space, Statistic, Switch, Table, Tag, Typography, message,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EditOutlined, FieldTimeOutlined,
  PlusOutlined, StopOutlined, TeamOutlined, UserAddOutlined,
} from '@ant-design/icons';
import useAuth from '../../hooks/useAuth';
import {
  actualizarTarea, actualizarTrabajador, cancelarTarea, crearTarea, crearTrabajador,
  getTareas, getTrabajadores, type EstadoTarea, type PrioridadTarea,
  type TareaJam, type TrabajadorJam,
} from '../../services/tareas.service';

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

export default function TareasPage() {
  const { usuario } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const puedeAsignar = usuario?.rol === 'admin' || usuario?.rol === 'coordinador';
  const puedeEditarTrabajadores = usuario?.rol === 'admin';

  const [filtros, setFiltros] = useState({ fecha: today(), trabajador_id: '', estado: '', prioridad: '' });
  const [tareas, setTareas] = useState<TareaJam[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorJam[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalTarea, setModalTarea] = useState(false);
  const [modalTrabajador, setModalTrabajador] = useState(false);
  const [editingTarea, setEditingTarea] = useState<TareaJam | null>(null);
  const [editingTrabajador, setEditingTrabajador] = useState<TrabajadorJam | null>(null);
  const [formTarea] = Form.useForm();
  const [formTrabajador] = Form.useForm();

  const resumen = useMemo(() => ({
    total: tareas.length,
    pendientes: tareas.filter(t => t.estado === 'pendiente').length,
    enProgreso: tareas.filter(t => t.estado === 'en_progreso').length,
    completadas: tareas.filter(t => t.estado === 'completada').length,
  }), [tareas]);

  useEffect(() => {
    cargarTrabajadores();
  }, []);

  useEffect(() => {
    cargarTareas();
  }, [filtros.fecha, filtros.trabajador_id, filtros.estado, filtros.prioridad]);

  const cargarTareas = async () => {
    setLoading(true);
    try {
      setTareas(await getTareas({
        fecha: filtros.fecha || undefined,
        trabajador_id: filtros.trabajador_id || undefined,
        estado: filtros.estado as EstadoTarea || undefined,
        prioridad: filtros.prioridad as PrioridadTarea || undefined,
      }));
    } catch (err: any) {
      message.error(err?.message || 'Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  };

  const cargarTrabajadores = async () => {
    try {
      setTrabajadores(await getTrabajadores(true));
    } catch (err: any) {
      message.error(err?.message || 'Error al cargar trabajadores');
    }
  };

  const abrirNuevaTarea = () => {
    setEditingTarea(null);
    formTarea.resetFields();
    formTarea.setFieldsValue({ fecha: filtros.fecha || today(), hora: '08:00', prioridad: 'media', estado: 'pendiente', duracion_minutos: 60 });
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
    } catch (err: any) {
      message.error(err?.message || 'No se pudo guardar la tarea');
    }
  };

  const cambiarEstado = async (tarea: TareaJam, estado: EstadoTarea) => {
    try {
      await actualizarTarea(tarea.tarea_id, { estado });
      message.success('Estado actualizado');
      await cargarTareas();
    } catch (err: any) {
      message.error(err?.message || 'No se pudo actualizar el estado');
    }
  };

  const cancelar = async (tarea: TareaJam) => {
    try {
      await cancelarTarea(tarea.tarea_id);
      message.success('Tarea cancelada');
      await cargarTareas();
    } catch (err: any) {
      message.error(err?.message || 'No se pudo cancelar la tarea');
    }
  };

  const abrirNuevoTrabajador = () => {
    setEditingTrabajador(null);
    formTrabajador.resetFields();
    formTrabajador.setFieldsValue({ activo: true });
    setModalTrabajador(true);
  };

  const abrirEditarTrabajador = (trabajador: TrabajadorJam) => {
    setEditingTrabajador(trabajador);
    formTrabajador.setFieldsValue(trabajador);
    setModalTrabajador(true);
  };

  const guardarTrabajador = async () => {
    const values = await formTrabajador.validateFields();
    try {
      if (editingTrabajador) {
        await actualizarTrabajador(editingTrabajador.trabajador_id, values);
        message.success('Trabajador actualizado');
      } else {
        await crearTrabajador(values);
        message.success('Trabajador creado');
      }
      setModalTrabajador(false);
      await cargarTrabajadores();
    } catch (err: any) {
      message.error(err?.message || 'No se pudo guardar el trabajador');
    }
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
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>Agenda / Tareas</Title>
          <Text type="secondary">Asigna trabajo por dia, hora y trabajador JAM.</Text>
        </div>
        <Space wrap>
          {puedeEditarTrabajadores && (
            <Button icon={<UserAddOutlined />} onClick={abrirNuevoTrabajador}>Trabajador</Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirNuevaTarea} disabled={!puedeAsignar}>
            Nueva tarea
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Tareas" value={resumen.total} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Pendientes" value={resumen.pendientes} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="En progreso" value={resumen.enProgreso} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Completadas" value={resumen.completadas} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={6}>
            <Text type="secondary">Fecha</Text>
            <Input type="date" value={filtros.fecha} onChange={e => setFiltros({ ...filtros, fecha: e.target.value })} />
          </Col>
          <Col xs={24} md={6}>
            <Text type="secondary">Trabajador</Text>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="Todos"
              value={filtros.trabajador_id || undefined}
              onChange={value => setFiltros({ ...filtros, trabajador_id: value || '' })}
              options={trabajadores.filter(t => t.activo).map(t => ({ value: t.trabajador_id, label: t.nombre }))}
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
          <Col xs={24} md={2}>
            <Button block onClick={cargarTareas}>Actualizar</Button>
          </Col>
        </Row>
      </Card>

      {isMobile ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {tareas.length === 0 && <Empty description="No hay tareas para estos filtros" />}
          {tareas.map(tarea => (
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
                  <Button size="small" onClick={() => cambiarEstado(tarea, 'completada')} disabled={!puedeAsignar}>Completar</Button>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      ) : (
        <Table
          rowKey="tarea_id"
          dataSource={tareas}
          columns={tareaColumns}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      )}

      {puedeEditarTrabajadores && (
        <Card title="Trabajadores JAM" style={{ marginTop: 16 }}>
          <Table
            size="small"
            rowKey="trabajador_id"
            dataSource={trabajadores}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            columns={[
              { title: 'Nombre', dataIndex: 'nombre' },
              { title: 'Cargo', dataIndex: 'cargo', render: v => v || '-' },
              { title: 'Telefono', dataIndex: 'telefono', render: v => v || '-' },
              { title: 'Activo', dataIndex: 'activo', render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Activo' : 'Inactivo'}</Tag> },
              { title: 'Acciones', render: (_, item: TrabajadorJam) => <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditarTrabajador(item)} /> },
            ]}
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
              <Form.Item name="trabajador_id" label="Trabajador" rules={[{ required: true, message: 'Selecciona un trabajador' }]}>
                <Select options={trabajadores.filter(t => t.activo).map(t => ({ value: t.trabajador_id, label: t.nombre }))} />
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

      <Modal
        title={editingTrabajador ? 'Editar trabajador' : 'Nuevo trabajador'}
        open={modalTrabajador}
        onCancel={() => setModalTrabajador(false)}
        onOk={guardarTrabajador}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={formTrabajador} layout="vertical">
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="cargo" label="Cargo">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="telefono" label="Telefono">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="correo" label="Correo">
            <Input />
          </Form.Item>
          <Form.Item name="activo" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
