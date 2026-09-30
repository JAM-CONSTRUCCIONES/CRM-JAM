import { Drawer, Form, Input, Button, Space, Popconfirm, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { Etapa } from '../../types';

const { Text } = Typography;

interface Props {
  open: boolean;
  etapas: Etapa[];
  etapaEditando: Etapa | null;
  onClose: () => void;
  onGuardar: (values: any) => void;
  onEliminar: (etapaId: string) => void;
  onEditar: (etapa: Etapa) => void;
  onCancelarEdicion: () => void;
  canDelete?: boolean;
}

const DrawerEtapas = ({ open, etapas, etapaEditando, onClose, onGuardar, onEliminar, onEditar, onCancelarEdicion, canDelete }: Props) => {
  const [form] = Form.useForm();

  const handleGuardar = (values: any) => {
    onGuardar(values);
    form.resetFields();
  };

  return (
    <Drawer
      title="Gestionar etapas"
      open={open}
      onClose={() => { onClose(); form.resetFields(); }}
      width={380}
    >
      {/* Formulario crear/editar */}
      <div style={{
        background: etapaEditando ? 'var(--warning-soft-bg)' : 'var(--panel-soft-bg)',
        border: `1px solid ${etapaEditando ? 'var(--warning-soft-border)' : '#52c41a'}`,
        borderRadius: 8, padding: '14px 16px', marginBottom: 24,
      }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
          {etapaEditando ? `Editando: ${etapaEditando.nombre}` : 'Nueva etapa'}
        </Text>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGuardar}
          initialValues={etapaEditando ? { nombre: etapaEditando.nombre } : {}}
        >
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
            <Input placeholder="Ej: Etapa 1" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={etapaEditando ? <EditOutlined /> : <PlusOutlined />}>
              {etapaEditando ? 'Actualizar' : 'Crear'}
            </Button>
            {etapaEditando && (
              <Button onClick={() => { onCancelarEdicion(); form.resetFields(); }}>Cancelar</Button>
            )}
          </Space>
        </Form>
      </div>

      {/* Lista de etapas */}
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
        {etapas.length} etapa{etapas.length !== 1 ? 's' : ''} registrada{etapas.length !== 1 ? 's' : ''}
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {etapas.map(e => (
          <div
            key={e.etapa_id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'var(--panel-soft-bg)',
              border: `1px solid ${etapaEditando?.etapa_id === e.etapa_id ? '#faad14' : 'var(--app-border)'}`,
              borderRadius: 8, transition: 'border-color 0.2s',
            }}
          >
            <Space size={10}>
              <Text strong style={{ fontSize: 13 }}>{e.nombre}</Text>
            </Space>
            <Space size={4}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => { onEditar(e); form.setFieldsValue({ nombre: e.nombre }); }}
              />
              {canDelete && (
                <Popconfirm title="¿Eliminar etapa?" okText="Sí" cancelText="No" onConfirm={() => onEliminar(e.etapa_id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </Space>
          </div>
        ))}
      </Space>
    </Drawer>
  );
};

export default DrawerEtapas;
