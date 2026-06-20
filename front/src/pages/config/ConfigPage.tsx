import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Button, Drawer, Form, Input, Space,
  Tag, Tooltip, message, Spin, Popconfirm, Alert, Divider, Table,
} from 'antd';
import { EditOutlined, UndoOutlined, SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getEmailTemplates, getEmailTemplate, saveEmailTemplate, resetEmailTemplate,
  type EmailTemplate,
} from '../../services/config.service';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const VARIABLES_PERMITIDAS = ['{cliente}', '{unidad}', '{proyecto}', '{inmobiliaria}'];

const validarVariablesPlantilla = (_: unknown, value?: string) => {
  const texto = String(value || '');
  const variables = texto.match(/\{[^{}\r\n]*\}?/g) || [];
  const invalida = variables.find(v => !VARIABLES_PERMITIDAS.includes(v));
  if (invalida) {
    return Promise.reject(
      new Error(`Variable no valida o incompleta: ${invalida}. Usa ${VARIABLES_PERMITIDAS.join(', ')}`)
    );
  }
  return Promise.resolve();
};

const GRUPOS: Record<string, string[]> = {
  'Bloqueos': ['bloqueo_registrado', 'alerta_vencimiento', 'liberacion_automatica', 'liberacion_manual'],
  'Cambios de estatus': [
    'cambio_estatus_disponible', 'cambio_estatus_bloqueada', 'cambio_estatus_reserva',
    'cambio_estatus_separacion', 'cambio_estatus_inicial', 'cambio_estatus_pagos_atrasados',
    'cambio_estatus_contra_entrega', 'cambio_estatus_vendida', 'cambio_estatus_desvinculado',
  ],
  'Clientes': ['cliente_captado', 'exclusividad_vencida', 'intento_duplicado', 'alerta_separacion_vencida'],
};

const ConfigPage = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmailTemplates();
      setTemplates(data);
    } catch {
      message.error('Error al cargar templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirEditor = async (tipo: string) => {
    setDrawerOpen(true);
    setEditing(null);
    setLoadingEdit(true);
    try {
      const tpl = await getEmailTemplate(tipo);
      setEditing(tpl);
      form.setFieldsValue({ titulo: tpl.titulo, mensaje: tpl.mensaje });
    } catch {
      message.error('Error al cargar template');
      setDrawerOpen(false);
    } finally {
      setLoadingEdit(false);
    }
  };

  const guardar = async (values: { titulo: string; mensaje: string }) => {
    if (!editing) return;
    setSaving(true);
    try {
      await saveEmailTemplate(editing.tipo, values);
      message.success('Template guardado');
      setDrawerOpen(false);
      cargar();
    } catch {
      message.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const restaurar = async (tipo: string) => {
    try {
      await resetEmailTemplate(tipo);
      message.success('Template restaurado al valor por defecto');
      cargar();
    } catch {
      message.error('Error al restaurar');
    }
  };

  const byTipo = Object.fromEntries(templates.map(t => [t.tipo, t]));

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 4 }}>Configuración de correos</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Edita el título y mensaje de cada notificación. Los datos del cliente, unidad y proyecto siempre se incluyen automáticamente.
      </Text>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        Object.entries(GRUPOS).map(([grupo, tipos]) => {
          const rows = tipos.map(tipo => byTipo[tipo]).filter(Boolean);
          return (
            <div key={grupo} style={{ marginBottom: 32 }}>
              <Divider titlePlacement="left" style={{ fontWeight: 600, color: '#1a3c5e' }}>{grupo}</Divider>
              <Table
                dataSource={rows}
                rowKey="tipo"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Notificación',
                    dataIndex: 'label',
                    render: (_: unknown, tpl: EmailTemplate) => (
                      <Space direction="vertical" size={2}>
                        <Space>
                          <Text strong>{tpl.label}</Text>
                          {tpl.modificado_en && (
                            <Tag color="blue" style={{ fontSize: 11 }}>
                              Editado {dayjs(tpl.modificado_en).format('DD/MM/YY')}
                            </Tag>
                          )}
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>{tpl.titulo}</Text>
                      </Space>
                    ),
                  },
                  {
                    title: '',
                    width: 160,
                    render: (_: unknown, tpl: EmailTemplate) => (
                      <Space>
                        <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditor(tpl.tipo)}>
                          Editar
                        </Button>
                        {tpl.modificado_en && (
                          <Popconfirm
                            title="¿Restaurar al texto por defecto?"
                            onConfirm={() => restaurar(tpl.tipo)}
                            okText="Restaurar" cancelText="Cancelar"
                          >
                            <Tooltip title="Restaurar texto original">
                              <Button size="small" icon={<UndoOutlined />} danger />
                            </Tooltip>
                          </Popconfirm>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            </div>
          );
        })
      )}

      {/* ── Editor Drawer ─────────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Editar — ${editing.label}` : 'Cargando...'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>
              Guardar
            </Button>
          </div>
        }
      >
        {loadingEdit ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : editing ? (
          <>
            <Alert
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
              style={{ marginBottom: 20 }}
              message="Variables disponibles"
              description={
                <div>
                  <Text style={{ fontSize: 12 }}>
                    Haz clic en una variable para insertarla en el mensaje:
                  </Text>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(editing.variables || VARIABLES_PERMITIDAS).map(v => (
                      <Tag
                        key={v}
                        style={{ cursor: 'pointer', fontFamily: 'monospace' }}
                        onClick={() => {
                          const field = form.getFieldValue('mensaje') || '';
                          form.setFieldValue('mensaje', field + v);
                        }}
                      >{v}</Tag>
                    ))}
                  </div>
                </div>
              }
            />

            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 20 }}
              message="Datos siempre incluidos"
              description="Debajo del mensaje siempre aparece una tabla con los datos principales de la notificación."
            />

            <Form form={form} layout="vertical" onFinish={guardar}>
              <Form.Item
                name="titulo"
                label="Título del correo"
                rules={[
                  { required: true, message: 'El título es requerido' },
                  { validator: validarVariablesPlantilla },
                ]}
              >
                <Input placeholder="Ej: Nuevo bloqueo registrado" maxLength={120} showCount />
              </Form.Item>
              <Form.Item
                name="mensaje"
                label="Mensaje principal"
                rules={[
                  { required: true, message: 'El mensaje es requerido' },
                  { validator: validarVariablesPlantilla },
                ]}
                extra="Aparece antes de la tabla de datos."
              >
                <TextArea
                  rows={6}
                  placeholder="Escribe el mensaje. Puedes usar {cliente}, {unidad}, {proyecto}..."
                  maxLength={1000}
                  showCount
                />
              </Form.Item>
            </Form>

            <Divider />
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              <strong>Estructura del correo:</strong> encabezado JAM → título → mensaje → tabla de datos → firma.
            </Paragraph>
          </>
        ) : null}
      </Drawer>
    </div>
  );
};

export default ConfigPage;
