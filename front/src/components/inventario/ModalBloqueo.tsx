import { useEffect, useState } from 'react';
import { Alert, DatePicker, Divider, Form, Input, Modal, Radio, Row, Col, Select, Space, Spin, Tag, Typography } from 'antd';
import { LockOutlined, SearchOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Cliente, Unidad } from '../../types';
import { getClientes } from '../../services/clientes.service';
import { clienteFieldNormalizers, clienteFormRules, normalizeClientCedula } from '../../utils/clientesValidation';
import { EstadoCivilSelect, NacionalidadSelect, PaisResidenciaSelect } from '../common/CatalogoClienteFields';

const { Text } = Typography;

interface Props {
  open: boolean;
  unidad: Unidad | null;
  proyectoId: string;
  guardando: boolean;
  onCancel: () => void;
  onBloquear: (omitirCliente: boolean, values?: any) => void;
}

const ModalBloqueo = ({ open, unidad, proyectoId, guardando, onCancel, onBloquear }: Props) => {
  const [form] = Form.useForm();
  const [modoCliente, setModoCliente] = useState<'existente' | 'nuevo'>('existente');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setModoCliente('existente');
      setBusquedaCliente('');
      setClientesEncontrados([]);
      setClienteSeleccionado(null);
    }
  }, [open, form]);

  useEffect(() => {
    if (!open || modoCliente !== 'existente' || !busquedaCliente.trim()) {
      setClientesEncontrados([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoClientes(true);
      try {
        const query = busquedaCliente.trim().toLowerCase();
        const clientes = await getClientes(proyectoId);
        const resultados = (clientes as Cliente[])
          .filter(cliente => {
            const nombreCompleto = `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.toLowerCase();
            const cedula = String(cliente.cedula ?? '').toLowerCase();
            return nombreCompleto.includes(query) || cedula.includes(query);
          })
          .slice(0, 20);
        setClientesEncontrados(resultados);
      } catch (err) {
        console.error('Error buscando clientes:', err);
        setClientesEncontrados([]);
      } finally {
        setBuscandoClientes(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [busquedaCliente, modoCliente, open, proyectoId]);

  const resetClienteFields = () => {
    setClienteSeleccionado(null);
    setClientesEncontrados([]);
    setBusquedaCliente('');
    form.resetFields([
      'cedula',
      'nombres',
      'apellidos',
      'correo',
      'telefono',
      'fecha_nacimiento',
      'estado_civil',
      'nacionalidad',
      'pais_residencia',
    ]);
  };

  const handleSeleccionarCliente = (cedula: string) => {
    const cliente = clientesEncontrados.find(c => c.cedula === cedula);
    setClienteSeleccionado(cliente || null);
    if (!cliente) return;

    form.setFieldsValue({
      cedula: cliente.cedula,
      nombres: cliente.nombres,
      apellidos: cliente.apellidos,
      correo: cliente.correo || '',
      telefono: cliente.telefono || '',
      fecha_nacimiento: cliente.fecha_nacimiento ? dayjs(cliente.fecha_nacimiento) : undefined,
      estado_civil: cliente.estado_civil,
      nacionalidad: cliente.nacionalidad,
      pais_residencia: cliente.pais_residencia,
    });
  };

  const handleSubmit = async () => {
    if (modoCliente === 'existente' && clienteSeleccionado) {
      onBloquear(false, {
        cedula: clienteSeleccionado.cedula,
        nombres: clienteSeleccionado.nombres,
        apellidos: clienteSeleccionado.apellidos,
        correo: clienteSeleccionado.correo,
        telefono: clienteSeleccionado.telefono,
        fecha_nacimiento: clienteSeleccionado.fecha_nacimiento,
        estado_civil: clienteSeleccionado.estado_civil,
        nacionalidad: clienteSeleccionado.nacionalidad,
        pais_residencia: clienteSeleccionado.pais_residencia,
      });
      return;
    }

    try {
      const values = await form.validateFields();
      onBloquear(false, {
        ...values,
        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
      });
    } catch {
      /* validacion fallida */
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <LockOutlined style={{ color: '#faad14' }} />
          Bloquear unidad
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      okText={guardando ? 'Bloqueando...' : 'Crear bloqueo'}
      cancelText="Cancelar"
      confirmLoading={guardando}
      width={600}
      afterClose={() => form.resetFields()}
    >
      {unidad && (
        <div style={{
          background: 'var(--warning-soft-bg)', border: '1px solid var(--warning-soft-border)', borderRadius: 8,
          padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <LockOutlined style={{ color: '#faad14', fontSize: 16 }} />
          <div>
            <Text strong style={{ fontSize: 15 }}>{unidad.id_unidad}</Text>
            <div style={{ marginTop: 2 }}>
              {unidad.tipo && <Tag style={{ marginRight: 4 }}>{unidad.tipo}</Tag>}
              {unidad.metraje && <Text type="secondary" style={{ fontSize: 12 }}>{unidad.metraje} m²</Text>}
              {unidad.precio && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>${parseFloat(String(unidad.precio)).toLocaleString('es-VE')}</Text>}
            </div>
          </div>
        </div>
      )}

      <Form form={form} layout="vertical">
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Asignar cliente</Text>
          <Radio.Group
            value={modoCliente}
            onChange={e => {
              setModoCliente(e.target.value);
              resetClienteFields();
            }}
            buttonStyle="solid"
            style={{ width: '100%' }}
          >
            <Radio.Button value="existente" style={{ width: '50%', textAlign: 'center' }}>
              <SearchOutlined /> Cliente existente
            </Radio.Button>
            <Radio.Button value="nuevo" style={{ width: '50%', textAlign: 'center' }}>
              <UserAddOutlined /> Nuevo cliente
            </Radio.Button>
          </Radio.Group>
        </div>

        {modoCliente === 'existente' && (
          <div>
            <Input
              placeholder="Buscar por nombre o cedula/pasaporte..."
              prefix={<SearchOutlined />}
              value={busquedaCliente}
              onChange={e => {
                setBusquedaCliente(e.target.value);
                setClienteSeleccionado(null);
              }}
              size="large"
              allowClear
              style={{ marginBottom: 12 }}
            />

            {buscandoClientes && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  Buscando clientes...
                </Text>
              </div>
            )}

            {!buscandoClientes && busquedaCliente.trim() && clientesEncontrados.length === 0 && (
              <Alert
                type="info"
                message="No se encontraron clientes"
                description="Intenta con otro nombre o cedula/pasaporte, o crea un nuevo cliente."
                showIcon
                style={{ marginBottom: 12 }}
              />
            )}

            {clientesEncontrados.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  {clientesEncontrados.length} cliente{clientesEncontrados.length !== 1 ? 's' : ''} encontrado{clientesEncontrados.length !== 1 ? 's' : ''}:
                </Text>
                <Select
                  placeholder="Selecciona un cliente..."
                  style={{ width: '100%' }}
                  size="large"
                  value={clienteSeleccionado?.cedula}
                  onChange={handleSeleccionarCliente}
                  options={clientesEncontrados.map(c => ({
                    value: c.cedula,
                    label: `${c.nombres} ${c.apellidos} - ${c.cedula}`,
                  }))}
                />
              </div>
            )}

            {clienteSeleccionado && (
              <div style={{
                background: 'var(--panel-soft-bg)', border: '1px solid #52c41a', borderRadius: 8,
                padding: '10px 14px', marginTop: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <UserOutlined style={{ color: '#52c41a' }} />
                  <Text strong>{clienteSeleccionado.nombres} {clienteSeleccionado.apellidos}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  {clienteSeleccionado.cedula}
                  {clienteSeleccionado.correo && ` · ${clienteSeleccionado.correo}`}
                  {clienteSeleccionado.telefono && ` · ${clienteSeleccionado.telefono}`}
                </Text>
              </div>
            )}
          </div>
        )}

        {modoCliente === 'nuevo' && (
          <div>
            <Alert
              type="info"
              message="Registrar nuevo cliente"
              description="Completa los datos del cliente para crear el bloqueo."
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item name="cedula" label="Cedula / Pasaporte" rules={clienteFormRules.cedula} normalize={normalizeClientCedula}>
              <Input placeholder="12345678 o AB123456" />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="nombres" label="Nombres" rules={clienteFormRules.nombres} normalize={clienteFieldNormalizers.nombre}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="apellidos" label="Apellidos" rules={clienteFormRules.apellidos} normalize={clienteFieldNormalizers.nombre}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="correo" label="Correo" rules={clienteFormRules.correo} normalize={clienteFieldNormalizers.correo}>
                  <Input type="email" placeholder="correo@ejemplo.com" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="telefono" label="Telefono" rules={clienteFormRules.telefono}>
                  <Input inputMode="numeric" placeholder="584120000000" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="estado_civil" label="Estado civil">
              <EstadoCivilSelect />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="nacionalidad" label="Nacionalidad">
                  <NacionalidadSelect />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="pais_residencia" label="Pais de residencia">
                  <PaisResidenciaSelect />
                </Form.Item>
              </Col>
            </Row>
          </div>
        )}

        {modoCliente === 'existente' && !clienteSeleccionado && (
          <Divider style={{ margin: '16px 0 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Selecciona un cliente para crear el bloqueo</Text>
          </Divider>
        )}
      </Form>
    </Modal>
  );
};

export default ModalBloqueo;
