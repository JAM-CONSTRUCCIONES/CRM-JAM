import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Divider, Form, Input, Modal, Row, Select,
  Space, Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd';
import {
  EyeOutlined, HistoryOutlined, MailOutlined, SaveOutlined, SendOutlined,
} from '@ant-design/icons';
import { getProyectos } from '../../services/proyectos.service';
import type { Proyecto } from '../../types';
import {
  enviarCampania, getHistorialCampanias, getTemplatesCampanias,
  guardarTemplateCampania, previewCampania,
  type CampaniaHistorial, type PreviewCampania, type TemplateCampania,
} from '../../services/campanias.service';
import useAuth from '../../hooks/useAuth';

const { Title, Text } = Typography;
const { TextArea } = Input;

const grupos = [
  { value: 'sin_unidad', label: 'Clientes sin unidad' },
  { value: 'con_unidad', label: 'Clientes con unidad' },
  { value: 'todos', label: 'Todos los clientes del proyecto' },
] as const;

const grupoLabel: Record<string, string> = {
  sin_unidad: 'Sin unidad',
  con_unidad: 'Con unidad',
  todos: 'Todos',
};

export default function CampaniasPage() {
  const { usuario } = useAuth();
  const puedeEnviar = usuario?.rol === 'admin' || usuario?.rol === 'coordinador';
  const [form] = Form.useForm();
  const [tplForm] = Form.useForm();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoId, setProyectoId] = useState<string>();
  const [preview, setPreview] = useState<PreviewCampania | null>(null);
  const [historial, setHistorial] = useState<CampaniaHistorial[]>([]);
  const [templates, setTemplates] = useState<TemplateCampania[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);

  useEffect(() => {
    getProyectos().then(items => {
      setProyectos(items);
      if (items[0]) setProyectoId(items[0].proyecto_id);
    }).catch(() => message.error('Error al cargar proyectos'));
  }, []);

  useEffect(() => {
    if (!proyectoId) return;
    form.setFieldsValue({ proyecto_id: proyectoId, grupo: form.getFieldValue('grupo') || 'sin_unidad' });
    cargarHistorial();
    cargarTemplates();
    setPreview(null);
  }, [proyectoId]);

  const proyectoNombre = useMemo(
    () => proyectos.find(p => p.proyecto_id === proyectoId)?.nombre ?? '',
    [proyectos, proyectoId],
  );

  const cargarHistorial = async () => {
    if (!proyectoId) return;
    try {
      setHistorial(await getHistorialCampanias(proyectoId));
    } catch {
      message.error('Error al cargar historial');
    }
  };

  const cargarTemplates = async () => {
    if (!proyectoId) return;
    try {
      setTemplates(await getTemplatesCampanias(proyectoId));
    } catch {
      message.error('Error al cargar plantillas');
    }
  };

  const handlePreview = async () => {
    const values = await form.validateFields(['proyecto_id', 'grupo', 'pais_residencia', 'nacionalidad']);
    setLoading(true);
    try {
      const data = await previewCampania({
        proyecto_id: values.proyecto_id,
        grupo: values.grupo,
        filtros: {
          pais_residencia: values.pais_residencia || undefined,
          nacionalidad: values.nacionalidad || undefined,
        },
      });
      setPreview(data);
    } catch (err: any) {
      message.error(err?.message || 'Error al calcular destinatarios');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviar = async () => {
    const values = await form.validateFields();
    if (!preview) {
      message.warning('Primero revisa los destinatarios');
      return;
    }
    Modal.confirm({
      title: 'Enviar campania',
      content: `Se enviara a ${preview.correos_validos} correo(s) valido(s). Esta accion no es automatica ni programada.`,
      okText: 'Enviar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setEnviando(true);
        try {
          await enviarCampania({
            proyecto_id: values.proyecto_id,
            nombre: values.nombre,
            grupo: values.grupo,
            asunto: values.asunto,
            mensaje: values.mensaje,
            imagen_url: values.imagen_url,
            filtros: {
              pais_residencia: values.pais_residencia || undefined,
              nacionalidad: values.nacionalidad || undefined,
            },
          });
          message.success('Campania enviada');
          setPreview(null);
          await cargarHistorial();
        } catch (err: any) {
          message.error(err?.message || 'Error al enviar campania');
        } finally {
          setEnviando(false);
        }
      },
    });
  };

  const aplicarTemplate = (templateId: string) => {
    const tpl = templates.find(t => t.template_id === templateId);
    if (!tpl) return;
    form.setFieldsValue({
      asunto: tpl.asunto,
      mensaje: tpl.mensaje,
      imagen_url: tpl.imagen_url,
    });
  };

  const abrirGuardarTemplate = async () => {
    const values = await form.validateFields(['nombre', 'asunto', 'mensaje']);
    tplForm.setFieldsValue({
      nombre: values.nombre,
      asunto: values.asunto,
      mensaje: values.mensaje,
      imagen_url: form.getFieldValue('imagen_url'),
    });
    setTemplateModal(true);
  };

  const guardarTemplate = async () => {
    const values = await tplForm.validateFields();
    if (!proyectoId) return;
    try {
      await guardarTemplateCampania(`TPL-${Date.now()}`, {
        proyecto_id: proyectoId,
        nombre: values.nombre,
        asunto: values.asunto,
        mensaje: values.mensaje,
        imagen_url: values.imagen_url || '',
      });
      message.success('Plantilla guardada');
      setTemplateModal(false);
      await cargarTemplates();
    } catch (err: any) {
      message.error(err?.message || 'Error al guardar plantilla');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Campanias de correo</Title>
      <Text type="secondary">Envios manuales por proyecto para campanias comerciales o comunicados.</Text>

      <Tabs
        style={{ marginTop: 20 }}
        items={[
          {
            key: 'crear',
            label: <span><MailOutlined /> Crear campania</span>,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={15}>
                  <Card>
                    <Form
                      form={form}
                      layout="vertical"
                      initialValues={{ grupo: 'sin_unidad' }}
                      onValuesChange={(changed) => {
                        if ('grupo' in changed || 'pais_residencia' in changed || 'nacionalidad' in changed) setPreview(null);
                      }}
                    >
                      <Row gutter={12}>
                        <Col xs={24} md={12}>
                          <Form.Item name="proyecto_id" label="Proyecto" rules={[{ required: true }]}>
                            <Select value={proyectoId} onChange={setProyectoId} placeholder="Seleccionar proyecto">
                              {proyectos.map(p => <Select.Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Select.Option>)}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="grupo" label="Grupo de destinatarios" rules={[{ required: true }]}>
                            <Select options={grupos as any} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={12}>
                        <Col xs={24} md={12}>
                          <Form.Item name="pais_residencia" label="Pais de residencia">
                            <Input placeholder="Opcional" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="nacionalidad" label="Nacionalidad">
                            <Input placeholder="Opcional" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider />

                      <Row gutter={12}>
                        <Col xs={24} md={12}>
                          <Form.Item name="nombre" label="Nombre de campania" rules={[{ required: true }]}>
                            <Input placeholder="Ej: Lanzamiento etapa 2" disabled={!puedeEnviar} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="Usar plantilla">
                            <Select
                              allowClear
                              placeholder="Seleccionar plantilla"
                              onChange={aplicarTemplate}
                              disabled={!templates.length || !puedeEnviar}
                            >
                              {templates.map(t => <Select.Option key={t.template_id} value={t.template_id}>{t.nombre}</Select.Option>)}
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item name="asunto" label="Asunto" rules={[{ required: true }]}>
                        <Input placeholder="Asunto del correo" disabled={!puedeEnviar} />
                      </Form.Item>

                      <Form.Item name="imagen_url" label="Imagen en el cuerpo del correo">
                        <Input placeholder="URL de imagen, opcional" disabled={!puedeEnviar} />
                      </Form.Item>

                      <Form.Item name="mensaje" label="Mensaje" rules={[{ required: true }]}>
                        <TextArea rows={8} placeholder="Mensaje de la campania" disabled={!puedeEnviar} />
                      </Form.Item>

                      <Space wrap>
                        <Button icon={<EyeOutlined />} onClick={handlePreview} loading={loading}>
                          Revisar destinatarios
                        </Button>
                        <Button icon={<SaveOutlined />} onClick={abrirGuardarTemplate} disabled={!puedeEnviar}>
                          Guardar como plantilla
                        </Button>
                        <Button type="primary" icon={<SendOutlined />} onClick={handleEnviar} loading={enviando} disabled={!puedeEnviar || !preview}>
                          Enviar campania
                        </Button>
                      </Space>
                      {!puedeEnviar && (
                        <Alert style={{ marginTop: 16 }} type="info" showIcon message="Tu rol puede ver campanias e historial, pero no crear ni enviar." />
                      )}
                    </Form>
                  </Card>
                </Col>

                <Col xs={24} lg={9}>
                  <Card title="Resumen de destinatarios">
                    {preview ? (
                      <Space direction="vertical" style={{ width: '100%' }} size={16}>
                        <Row gutter={12}>
                          <Col span={12}><Statistic title="Clientes" value={preview.total_clientes} /></Col>
                          <Col span={12}><Statistic title="Correos validos" value={preview.correos_validos} /></Col>
                          <Col span={12}><Statistic title="Sin correo" value={preview.sin_correo} /></Col>
                          <Col span={12}><Statistic title="Correo invalido" value={preview.correos_invalidos} /></Col>
                        </Row>
                        <Table
                          size="small"
                          rowKey={(r) => `${r.cedula}-${r.correo}-${r.unidad}`}
                          dataSource={preview.destinatarios.slice(0, 8)}
                          pagination={false}
                          columns={[
                            { title: 'Cliente', render: (_, r) => `${r.nombres} ${r.apellidos}`.trim() || r.cedula },
                            { title: 'Correo', dataIndex: 'correo' },
                          ]}
                        />
                        {preview.destinatarios.length > 8 && <Text type="secondary">Mostrando 8 de {preview.destinatarios.length} destinatarios.</Text>}
                      </Space>
                    ) : (
                      <Text type="secondary">Selecciona proyecto, grupo y presiona "Revisar destinatarios".</Text>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'historial',
            label: <span><HistoryOutlined /> Historial</span>,
            children: (
              <Card>
                <Space style={{ marginBottom: 12 }}>
                  <Select value={proyectoId} onChange={setProyectoId} style={{ width: 260 }}>
                    {proyectos.map(p => <Select.Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Select.Option>)}
                  </Select>
                  <Button onClick={cargarHistorial}>Actualizar</Button>
                </Space>
                <Table
                  rowKey="campania_id"
                  dataSource={historial}
                  columns={[
                    { title: 'Fecha', dataIndex: 'fecha_envio', render: v => new Date(v).toLocaleString() },
                    { title: 'Campania', dataIndex: 'nombre' },
                    { title: 'Proyecto', render: () => proyectoNombre },
                    { title: 'Grupo', dataIndex: 'grupo', render: v => <Tag>{grupoLabel[v] || v}</Tag> },
                    { title: 'Enviados', dataIndex: 'correos_enviados' },
                    { title: 'Omitidos', render: (_, r) => (r.clientes_sin_correo || 0) + (r.correos_invalidos || 0) },
                    { title: 'Usuario', dataIndex: 'enviado_por' },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Guardar plantilla"
        open={templateModal}
        onOk={guardarTemplate}
        onCancel={() => setTemplateModal(false)}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={tplForm} layout="vertical">
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="asunto" label="Asunto" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="imagen_url" label="Imagen URL"><Input /></Form.Item>
          <Form.Item name="mensaje" label="Mensaje" rules={[{ required: true }]}><TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
