import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Space, Typography, Tag, Divider, Row, Col, Radio, DatePicker, Spin, Alert } from 'antd';
import { LockOutlined, BankOutlined, UserOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Unidad, Cliente } from '../../types';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import { buscarClientesAdmin } from '../../services/clientes.service';
import { clienteFieldNormalizers, clienteFormRules } from '../../utils/clientesValidation';

const { Text } = Typography;

interface Props {
  open: boolean;
  unidad: Unidad | null;
  proyectoId: string; // Agregado para tener el proyecto_id
  inmobiliarias: Inmobiliaria[];
  onCancel: () => void;
  onBloquear: (values: {
    inmobiliaria_id: string;
    cedula?: string;
    nombres?: string;
    apellidos?: string;
    correo?: string;
    telefono?: string;
    fecha_nacimiento?: string;
    estado_civil?: string;
    nacionalidad?: string;
    pais_residencia?: string;
  }) => void;
  guardando: boolean;
}

const ModalCrearBloqueoAdmin = ({ open, unidad, proyectoId, inmobiliarias, onCancel, onBloquear, guardando }: Props) => {
  const [form] = Form.useForm();
  
  // Estado del flujo
  const [inmobiliariaSeleccionada, setInmobiliariaSeleccionada] = useState<string | null>(null);
  const [modoCliente, setModoCliente] = useState<'existente' | 'nuevo' | 'sin_cliente'>('existente');
  
  // Búsqueda de clientes
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Limpiar estado al abrir/cerrar
  useEffect(() => {
    if (open) {
      form.resetFields();
      setInmobiliariaSeleccionada(null);
      setModoCliente('existente');
      setBusquedaCliente('');
      setClientesEncontrados([]);
      setClienteSeleccionado(null);
    }
  }, [open, form]);

  // Buscar clientes cuando cambia la búsqueda
  useEffect(() => {
    if (!inmobiliariaSeleccionada || !busquedaCliente.trim() || modoCliente !== 'existente') {
      setClientesEncontrados([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoClientes(true);
      try {
        // Detectar si es búsqueda por cédula o nombre
        const esCedula = /^[VEJPvejp]-?\d+/.test(busquedaCliente.trim());
        const tipo = esCedula ? 'cedula' : 'nombre';
        
        const resultados = await buscarClientesAdmin(
          busquedaCliente.trim(),
          tipo,
          proyectoId,
          inmobiliariaSeleccionada
        );
        
        setClientesEncontrados(resultados || []);
      } catch (err) {
        console.error('Error buscando clientes:', err);
        setClientesEncontrados([]);
      } finally {
        setBuscandoClientes(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [busquedaCliente, inmobiliariaSeleccionada, modoCliente, proyectoId]);

  const handleSeleccionarCliente = (cedula: string) => {
    const cliente = clientesEncontrados.find(c => c.cedula === cedula);
    setClienteSeleccionado(cliente || null);
    
    if (cliente) {
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
    }
  };

  const handleSubmit = async () => {
    if (!inmobiliariaSeleccionada) {
      return;
    }

    try {
      const values = await form.validateFields();
      
      // Si es sin cliente, solo enviar inmobiliaria
      if (modoCliente === 'sin_cliente') {
        onBloquear({ inmobiliaria_id: inmobiliariaSeleccionada });
        return;
      }

      // Si es cliente existente, usar los datos del cliente seleccionado
      if (modoCliente === 'existente' && clienteSeleccionado) {
        onBloquear({
          inmobiliaria_id: inmobiliariaSeleccionada,
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

      // Si es nuevo cliente, usar los datos del formulario
      onBloquear({
        inmobiliaria_id: inmobiliariaSeleccionada,
        ...values,
        fecha_nacimiento: values.fecha_nacimiento
          ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD')
          : undefined,
      });
    } catch (err) {
      // Validación falló
    }
  };

  const inmobiliariaActual = inmobiliarias.find(i => 
    i.pk === inmobiliariaSeleccionada || 
    i.pk === `INMOBILIARIA#${inmobiliariaSeleccionada}` ||
    i.pk.replace('INMOBILIARIA#', '') === inmobiliariaSeleccionada
  );

  return (
    <Modal
      title={
        <Space>
          <LockOutlined style={{ color: '#1677ff' }} />
          Crear bloqueo manual
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={guardando ? 'Bloqueando...' : 'Crear bloqueo'}
      cancelText="Cancelar"
      confirmLoading={guardando}
      width={600}
      afterClose={() => form.resetFields()}
    >
      {/* Info de la unidad */}
      {unidad && (
        <div style={{
          background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8,
          padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <LockOutlined style={{ color: '#1677ff', fontSize: 16 }} />
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

      {/* Alerta de privilegios admin */}
      <Alert
        type="info"
        message="Privilegios de administrador"
        description="Como admin, puedes saltarte las restricciones de exclusividad y asignar cualquier cliente a cualquier inmobiliaria."
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        {/* PASO 1: Seleccionar inmobiliaria */}
        <Form.Item 
          name="inmobiliaria_id" 
          label={<Text strong>1. Seleccionar inmobiliaria</Text>}
          rules={[{ required: true, message: 'Selecciona una inmobiliaria' }]}
        >
          <Select
            placeholder="Buscar inmobiliaria..."
            showSearch
            size="large"
            suffixIcon={<BankOutlined />}
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={inmobiliarias
              .filter(i => i.activo)
              .map(i => ({
                value: i.pk.replace('INMOBILIARIA#', ''),
                label: i.nombre,
              }))}
            onChange={(value) => {
              setInmobiliariaSeleccionada(value);
              setClienteSeleccionado(null);
              setClientesEncontrados([]);
              setBusquedaCliente('');
              form.resetFields(['cedula', 'nombres', 'apellidos', 'correo', 'telefono', 'fecha_nacimiento', 'estado_civil', 'nacionalidad', 'pais_residencia']);
            }}
          />
        </Form.Item>

        {/* Mostrar inmobiliaria seleccionada */}
        {inmobiliariaActual && (
          <div style={{
            background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8,
            padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <BankOutlined style={{ color: '#52c41a', fontSize: 14 }} />
            <Text style={{ fontSize: 13 }}>
              <Text strong>{inmobiliariaActual.nombre}</Text> seleccionada
            </Text>
          </div>
        )}

        {/* PASO 2: Modo de cliente (solo si hay inmobiliaria seleccionada) */}
        {inmobiliariaSeleccionada && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>2. Asignar cliente</Text>
              <Radio.Group 
                value={modoCliente} 
                onChange={e => {
                  setModoCliente(e.target.value);
                  setClienteSeleccionado(null);
                  setClientesEncontrados([]);
                  setBusquedaCliente('');
                  form.resetFields(['cedula', 'nombres', 'apellidos', 'correo', 'telefono', 'fecha_nacimiento', 'estado_civil', 'nacionalidad', 'pais_residencia']);
                }}
                buttonStyle="solid"
                style={{ width: '100%' }}
              >
                <Radio.Button value="existente" style={{ width: '33.33%', textAlign: 'center' }}>
                  <SearchOutlined /> Cliente existente
                </Radio.Button>
                <Radio.Button value="nuevo" style={{ width: '33.33%', textAlign: 'center' }}>
                  <UserAddOutlined /> Nuevo cliente
                </Radio.Button>
                <Radio.Button value="sin_cliente" style={{ width: '33.33%', textAlign: 'center' }}>
                  <LockOutlined /> Sin cliente
                </Radio.Button>
              </Radio.Group>
            </div>

            {/* Modo: Cliente existente */}
            {modoCliente === 'existente' && (
              <div>
                <Input
                  placeholder="Buscar por nombre o cédula (ej: Juan Pérez o V-12345678)..."
                  prefix={<SearchOutlined />}
                  value={busquedaCliente}
                  onChange={e => setBusquedaCliente(e.target.value)}
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
                    description="Intenta con otro nombre o cédula, o crea un nuevo cliente."
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
                        label: `${c.nombres} ${c.apellidos} — ${c.cedula}`,
                      }))}
                    />
                  </div>
                )}

                {/* Mostrar cliente seleccionado */}
                {clienteSeleccionado && (
                  <div style={{
                    background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8,
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

            {/* Modo: Nuevo cliente */}
            {modoCliente === 'nuevo' && (
              <div>
                <Alert
                  type="info"
                  message="Registrar nuevo cliente"
                  description="Completa los datos del cliente para crear el bloqueo."
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <Form.Item name="cedula" label="Cédula / Pasaporte" rules={clienteFormRules.cedula}>
                  <Input inputMode="numeric" placeholder="12345678" />
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
                    <Form.Item name="telefono" label="Teléfono" rules={clienteFormRules.telefono}>
                      <Input inputMode="numeric" placeholder="584120000000" />
                    </Form.Item>
                  </Col>
                </Row>
                
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
                
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="nacionalidad" label="Nacionalidad">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="pais_residencia" label="País de residencia">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            )}

            {/* Modo: Sin cliente */}
            {modoCliente === 'sin_cliente' && (
              <Alert
                type="warning"
                message="Bloqueo sin cliente"
                description="Se creará un bloqueo temporal sin cliente asignado. Podrás asignar un cliente más tarde desde la vista de Procesos."
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default ModalCrearBloqueoAdmin;
