import { useEffect } from 'react';
import { Modal, Form, Input, Space, Typography, Tag, Divider, Row, Col } from 'antd';
import { DatePicker } from 'antd';
import { LockOutlined, UserOutlined, CheckCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Cliente, Unidad } from '../../types';

const { Text } = Typography;

interface Props {
  open: boolean;
  unidad: Unidad | null;
  clienteEncontrado: Cliente | null;
  buscandoCliente: boolean;
  guardando: boolean;
  onCancel: () => void;
  onBuscar: (cedula: string) => void;
  onBloquear: (omitirCliente: boolean, values?: any) => void;
}

const ModalBloqueo = ({ open, unidad, clienteEncontrado, buscandoCliente, guardando, onCancel, onBuscar, onBloquear }: Props) => {
  const [form] = Form.useForm();

  // Cuando se encuentra un cliente, rellenar el form automáticamente
  useEffect(() => {
    if (clienteEncontrado) {
      form.setFieldsValue({
        cedula:           clienteEncontrado.cedula,
        nombres:          clienteEncontrado.nombres,
        apellidos:        clienteEncontrado.apellidos,
        correo:           clienteEncontrado.correo ?? '',
        telefono:         clienteEncontrado.telefono ?? '',
        fecha_nacimiento: clienteEncontrado.fecha_nacimiento ? dayjs(clienteEncontrado.fecha_nacimiento) : undefined,
      });
    }
  }, [clienteEncontrado, form]);

  const handleCancel = () => { form.resetFields(); onCancel(); };

  const handleBloquear = async (omitir: boolean) => {
    if (omitir) { onBloquear(true); return; }
    try {
      const values = await form.validateFields();
      onBloquear(false, {
        ...values,
        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
      });
    } catch { /* validación falló */ }
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
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Space.Compact>
            <Input.Group compact>
              <Space>
                <button
                  onClick={() => handleBloquear(true)}
                  disabled={guardando}
                  style={{
                    padding: '5px 16px', borderRadius: 6, border: '1px solid #d9d9d9',
                    background: '#fff', cursor: guardando ? 'not-allowed' : 'pointer',
                    fontSize: 14, opacity: guardando ? 0.6 : 1,
                  }}
                >
                  Bloquear sin cliente
                </button>
                <button
                  onClick={() => handleBloquear(false)}
                  disabled={guardando}
                  style={{
                    padding: '5px 16px', borderRadius: 6, border: 'none',
                    background: '#1677ff', color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer',
                    fontSize: 14, fontWeight: 500, opacity: guardando ? 0.6 : 1,
                  }}
                >
                  {guardando ? 'Procesando...' : 'Bloquear con cliente'}
                </button>
              </Space>
            </Input.Group>
          </Space.Compact>
        </Space>
      }
      width={560}
      afterClose={() => form.resetFields()}
    >
      {/* Info de la unidad */}
      {unidad && (
        <div style={{
          background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8,
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
        <Form.Item name="cedula" label="Cédula del cliente" rules={[{ required: true }]}>
          <Input.Search
            placeholder="V-12345678"
            loading={buscandoCliente}
            onSearch={onBuscar}
            enterButton="Buscar"
            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
          />
        </Form.Item>

        {/* Card cliente encontrado */}
        {clienteEncontrado && (
          <div style={{
            background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
            <div>
              <Text strong>{clienteEncontrado.nombres} {clienteEncontrado.apellidos}</Text>
              <div style={{ marginTop: 2 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{clienteEncontrado.cedula}</Text>
                {clienteEncontrado.correo && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{clienteEncontrado.correo}</Text>}
                {clienteEncontrado.telefono && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{clienteEncontrado.telefono}</Text>}
              </div>
            </div>
          </div>
        )}

        <Divider style={{ margin: '4px 0 16px' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Datos del cliente</Text>
        </Divider>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="telefono" label="Teléfono"><Input placeholder="+58 412 0000000" /></Form.Item>
          </Col>
        </Row>
        <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ModalBloqueo;
