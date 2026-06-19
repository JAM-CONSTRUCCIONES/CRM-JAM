import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Divider, Empty, Form, Input, Modal, Row, Select,
  Space, Statistic, Table, Tabs, Tag, Typography, Upload, message,
} from 'antd';
import {
  CopyOutlined, EyeOutlined, HistoryOutlined, MailOutlined, PlusOutlined,
  SaveOutlined, SendOutlined, UploadOutlined,
} from '@ant-design/icons';
import { getProyectos } from '../../services/proyectos.service';
import type { Proyecto } from '../../types';
import {
  enviarCampania, getHistorialCampanias, getTemplatesCampanias,
  getUploadImagenCampania, guardarTemplateCampania, previewCampania,
  type CampaniaHistorial, type PreviewCampania, type TemplateCampania,
} from '../../services/campanias.service';
import { NACIONALIDADES_OPTIONS, PAISES_OPTIONS } from '../../constants/catalogosCliente';
import useAuth from '../../hooks/useAuth';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_TOKEN_RE = /\[imagen:([^\]\s]+)\]/g;

const grupos = [
  { value: 'sin_unidad', label: 'Clientes sin unidad' },
  { value: 'con_unidad', label: 'Clientes con unidad' },
] as const;

const grupoLabel: Record<string, string> = {
  sin_unidad: 'Sin unidad',
  con_unidad: 'Con unidad',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const mensajeToHtml = (mensaje = '') => {
  let html = '';
  let lastIndex = 0;
  const normalized = mensaje.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  normalized.replace(IMAGE_TOKEN_RE, (token, url: string, index: number) => {
    html += escapeHtml(normalized.slice(lastIndex, index)).replace(/\n/g, '<br />');
    html += `<p style="margin:12px 0"><img src="${escapeHtml(url)}" style="max-width:100%;height:auto;border:0" alt="Imagen de campaña" /></p>`;
    lastIndex = index + token.length;
    return token;
  });
  html += escapeHtml(normalized.slice(lastIndex)).replace(/\n/g, '<br />');
  return html || '<span style="color:#999">Sin mensaje todavia.</span>';
};

export default function CampaniasPage() {
  const { usuario } = useAuth();
  const puedeEnviar = usuario?.rol === 'admin' || usuario?.rol === 'coordinador';
  const [form] = Form.useForm();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [preview, setPreview] = useState<PreviewCampania | null>(null);
  const [historial, setHistorial] = useState<CampaniaHistorial[]>([]);
  const [templates, setTemplates] = useState<TemplateCampania[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [editorVisible, setEditorVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const asuntoPreview = Form.useWatch('asunto', form);
  const mensajePreview = Form.useWatch('mensaje', form);

  const proyectosPorId = useMemo(
    () => new Map(proyectos.map(p => [p.proyecto_id, p.nombre])),
    [proyectos],
  );

  useEffect(() => {
    getProyectos()
      .then(setProyectos)
      .catch(() => message.error('Error al cargar proyectos'));
    cargarTemplates();
    cargarHistorial();
  }, []);

  const cargarTemplates = async () => {
    try {
      setTemplates(await getTemplatesCampanias());
    } catch {
      message.error('Error al cargar plantillas');
    }
  };

  const cargarHistorial = async () => {
    try {
      setHistorial(await getHistorialCampanias());
    } catch {
      message.error('Error al cargar historial');
    }
  };

  const iniciarEnBlanco = () => {
    setSelectedTemplateId(undefined);
    setPreview(null);
    setEditorVisible(true);
    form.resetFields();
    form.setFieldsValue({ grupo: 'sin_unidad', mensaje: '' });
  };

  const usarTemplate = (tpl: TemplateCampania) => {
    setSelectedTemplateId(tpl.template_id);
    setPreview(null);
    setEditorVisible(true);
    form.setFieldsValue({
      nombre: tpl.nombre,
      descripcion: tpl.descripcion,
      asunto: tpl.asunto,
      mensaje: tpl.mensaje,
      grupo: 'sin_unidad',
    });
  };

  const insertarImagenEnMensaje = (url: string) => {
    const current = form.getFieldValue('mensaje') || '';
    const token = `[imagen:${url}]`;
    const next = current ? `${current}\n${token}` : token;
    form.setFieldsValue({ mensaje: next });
  };

  const subirImagen = async (file: File) => {
    if (!IMAGE_TYPES.includes(file.type)) {
      message.error('Solo se permiten imagenes JPG, PNG o WEBP');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      message.error('La imagen no puede pesar mas de 5 MB');
      return Upload.LIST_IGNORE;
    }
    setSubiendoImagen(true);
    try {
      const data = await getUploadImagenCampania(file.type);
      const res = await fetch(data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error('No se pudo subir la imagen');
      insertarImagenEnMensaje(data.public_url);
      message.success('Imagen subida e insertada en el mensaje');
    } catch (err: any) {
      message.error(err?.message || 'Error al subir la imagen');
    } finally {
      setSubiendoImagen(false);
    }
    return Upload.LIST_IGNORE;
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

  const payloadFromForm = async () => {
    const values = await form.validateFields();
    return {
      proyecto_id: values.proyecto_id,
      nombre: values.nombre,
      descripcion: values.descripcion || '',
      grupo: values.grupo,
      asunto: values.asunto,
      mensaje: values.mensaje,
      filtros: {
        pais_residencia: values.pais_residencia || undefined,
        nacionalidad: values.nacionalidad || undefined,
      },
    };
  };

  const guardarCambiosTemplate = async () => {
    if (!selectedTemplateId) return;
    const values = await form.validateFields(['nombre', 'descripcion', 'asunto', 'mensaje']);
    try {
      await guardarTemplateCampania(selectedTemplateId, {
        proyecto_id: 'global',
        nombre: values.nombre,
        descripcion: values.descripcion || '',
        asunto: values.asunto,
        mensaje: values.mensaje,
      });
      message.success('Plantilla actualizada');
      await cargarTemplates();
    } catch (err: any) {
      message.error(err?.message || 'Error al guardar plantilla');
    }
  };

  const crearNuevaTemplate = async () => {
    const values = await form.validateFields(['nombre', 'descripcion', 'asunto', 'mensaje']);
    try {
      const templateId = `TPL-${Date.now()}`;
      await guardarTemplateCampania(templateId, {
        proyecto_id: 'global',
        nombre: values.nombre,
        descripcion: values.descripcion || '',
        asunto: values.asunto,
        mensaje: values.mensaje,
      });
      setSelectedTemplateId(templateId);
      message.success('Nueva plantilla creada');
      await cargarTemplates();
    } catch (err: any) {
      message.error(err?.message || 'Error al crear plantilla');
    }
  };

  const handleEnviar = async () => {
    const values = await payloadFromForm();
    if (!preview) {
      message.warning('Primero revisa los destinatarios');
      return;
    }
    Modal.confirm({
      title: 'Enviar campaña',
      content: `Se enviara a ${preview.correos_validos} correo(s) valido(s).`,
      okText: 'Enviar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setEnviando(true);
        try {
          await enviarCampania(values);
          message.success('Campaña enviada');
          setPreview(null);
          await cargarHistorial();
        } catch (err: any) {
          message.error(err?.message || 'Error al enviar campaña');
        } finally {
          setEnviando(false);
        }
      },
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Campañas de correo</Title>
      <Text type="secondary">Envios manuales por proyecto para campañas comerciales o comunicados.</Text>

      <Tabs
        style={{ marginTop: 20 }}
        items={[
          {
            key: 'crear',
            label: <span><MailOutlined /> Campañas</span>,
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="Plantillas">
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={8}>
                      <Card
                        hoverable={puedeEnviar}
                        style={{ height: '100%' }}
                        onClick={puedeEnviar ? iniciarEnBlanco : undefined}
                      >
                        <Space direction="vertical">
                          <PlusOutlined style={{ fontSize: 24 }} />
                          <Title level={5} style={{ margin: 0 }}>Campaña nueva</Title>
                          <Text type="secondary">Abrir una plantilla en blanco para preparar un envio.</Text>
                        </Space>
                      </Card>
                    </Col>
                    {templates.map(tpl => (
                      <Col xs={24} sm={12} lg={8} key={tpl.template_id}>
                        <Card
                          hoverable
                          style={{
                            height: '100%',
                            borderColor: selectedTemplateId === tpl.template_id ? '#1677ff' : undefined,
                          }}
                          onClick={() => usarTemplate(tpl)}
                        >
                          <Card.Meta
                            title={tpl.nombre}
                            description={tpl.descripcion || 'Sin descripcion'}
                          />
                          <Paragraph ellipsis={{ rows: 2 }} style={{ marginTop: 12, marginBottom: 0 }}>
                            {tpl.asunto}
                          </Paragraph>
                        </Card>
                      </Col>
                    ))}
                    {!templates.length && (
                      <Col span={24}>
                        <Empty description="No hay plantillas creadas todavia" />
                      </Col>
                    )}
                  </Row>
                  {!puedeEnviar && (
                    <Alert style={{ marginTop: 16 }} type="info" showIcon message="Tu rol puede ver campañas e historial, pero no crear ni enviar." />
                  )}
                </Card>

                {editorVisible && (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={15}>
                      <Card title={selectedTemplateId ? 'Preparar envio desde plantilla' : 'Preparar envio nuevo'}>
                        <Form
                          form={form}
                          layout="vertical"
                          initialValues={{ grupo: 'sin_unidad' }}
                          onValuesChange={(changed) => {
                            if ('proyecto_id' in changed || 'grupo' in changed || 'pais_residencia' in changed || 'nacionalidad' in changed) setPreview(null);
                          }}
                        >
                          <Row gutter={12}>
                            <Col xs={24} md={12}>
                              <Form.Item name="nombre" label="Titulo" rules={[{ required: true, message: 'Requerido' }]}>
                                <Input placeholder="Ej: Lanzamiento etapa 2" disabled={!puedeEnviar} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                              <Form.Item name="descripcion" label="Descripcion">
                                <Input placeholder="Uso interno de la plantilla o envio" disabled={!puedeEnviar} />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={12}>
                            <Col xs={24} md={12}>
                              <Form.Item name="proyecto_id" label="Proyecto del envio" rules={[{ required: true, message: 'Selecciona un proyecto' }]}>
                                <Select placeholder="Seleccionar proyecto" disabled={!puedeEnviar}>
                                  {proyectos.map(p => <Select.Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Select.Option>)}
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                              <Form.Item name="grupo" label="Grupo de destinatarios" rules={[{ required: true }]}>
                                <Select options={grupos as any} disabled={!puedeEnviar} />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={12}>
                            <Col xs={24} md={12}>
                              <Form.Item name="pais_residencia" label="Pais de residencia">
                                <Select
                                  allowClear
                                  showSearch
                                  options={PAISES_OPTIONS}
                                  placeholder="Opcional"
                                  optionFilterProp="label"
                                  disabled={!puedeEnviar}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                              <Form.Item name="nacionalidad" label="Nacionalidad">
                                <Select
                                  allowClear
                                  showSearch
                                  options={NACIONALIDADES_OPTIONS}
                                  placeholder="Opcional"
                                  optionFilterProp="label"
                                  disabled={!puedeEnviar}
                                />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Divider />

                          <Form.Item name="asunto" label="Asunto" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="Asunto del correo" disabled={!puedeEnviar} />
                          </Form.Item>

                          <Form.Item name="mensaje" label="Mensaje" rules={[{ required: true, message: 'Requerido' }]}>
                            <TextArea
                              rows={9}
                              placeholder="Mensaje de la campaña"
                              disabled={!puedeEnviar}
                            />
                          </Form.Item>

                          <Space wrap>
                            <Upload accept=".jpg,.jpeg,.png,.webp" showUploadList={false} beforeUpload={subirImagen} disabled={!puedeEnviar || subiendoImagen}>
                              <Button icon={<UploadOutlined />} loading={subiendoImagen} disabled={!puedeEnviar}>
                                Subir imagen
                              </Button>
                            </Upload>
                            <Button icon={<EyeOutlined />} onClick={handlePreview} loading={loading}>
                              Revisar destinatarios
                            </Button>
                            <Button icon={<SaveOutlined />} onClick={guardarCambiosTemplate} disabled={!puedeEnviar || !selectedTemplateId}>
                              Guardar cambios
                            </Button>
                            <Button icon={<CopyOutlined />} onClick={crearNuevaTemplate} disabled={!puedeEnviar}>
                              Crear nueva plantilla
                            </Button>
                            <Button type="primary" icon={<SendOutlined />} onClick={handleEnviar} loading={enviando} disabled={!puedeEnviar || !preview}>
                              Enviar campaña
                            </Button>
                          </Space>
                        </Form>
                      </Card>
                    </Col>

                    <Col xs={24} lg={9}>
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Card title="Vista previa">
                          <Title level={5}>{asuntoPreview || 'Sin asunto'}</Title>
                          <div
                            style={{ border: '1px solid var(--app-border)', padding: 12, minHeight: 120, background: 'var(--panel-soft-bg)', color: 'var(--text-main)', borderRadius: 6 }}
                            dangerouslySetInnerHTML={{ __html: mensajeToHtml(mensajePreview) }}
                          />
                        </Card>

                        <Card title="Resumen del envio">
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
                                rowKey={(r, i) => `${r.cedula}-${r.correo}-${r.unidad}-${i}`}
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
                      </Space>
                    </Col>
                  </Row>
                )}
              </Space>
            ),
          },
          {
            key: 'historial',
            label: <span><HistoryOutlined /> Historial</span>,
            children: (
              <Card>
                <Space style={{ marginBottom: 12 }}>
                  <Button onClick={() => cargarHistorial()}>Actualizar</Button>
                </Space>
                <Table
                  rowKey="campania_id"
                  dataSource={historial}
                  columns={[
                    { title: 'Fecha', dataIndex: 'fecha_envio', render: v => new Date(v).toLocaleString() },
                    { title: 'Titulo', dataIndex: 'nombre' },
                    { title: 'Descripcion', dataIndex: 'descripcion', render: v => v || '-' },
                    { title: 'Proyecto', render: (_, r) => r.proyecto_nombre || proyectosPorId.get(r.proyecto_id) || r.proyecto_id || '-' },
                    { title: 'Grupo', dataIndex: 'grupo', render: v => <Tag>{grupoLabel[v] || v}</Tag> },
                    { title: 'Clientes', dataIndex: 'cantidad_destinatarios' },
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
    </div>
  );
}
