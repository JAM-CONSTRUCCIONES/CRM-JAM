import { useEffect, useState } from 'react';
import {
  Button, Modal, Form, Input, Tag, Space, Popconfirm,
  Typography, Tooltip, Select, message, Row, Col, Avatar, Badge, Upload, Grid,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, CheckOutlined,
  DeleteOutlined, UserOutlined, TeamOutlined, MailOutlined, ReloadOutlined,
  LinkOutlined, EyeOutlined, UploadOutlined, BankOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  getInmobiliarias, crearInmobiliaria, actualizarInmobiliaria,
  deshabilitarInmobiliaria, habilitarInmobiliaria, eliminarInmobiliaria,
  getUsuariosInmobiliaria, crearUsuarioInmobiliaria,
  deshabilitarUsuario, habilitarUsuario, eliminarUsuarioInmobiliaria,
  getPresignedImagenInmobiliaria,
  type Inmobiliaria, type UsuarioInmo,
} from '../../services/inmobiliarias.service';
import { getProyectos } from '../../services/proyectos.service';
import type { Proyecto } from '../../types';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type ModalMode = 'crear' | 'editar';

const INMO_COLORS = ['#1677ff','#7c3aed','#f5576c','#00b96b','#fa8c16','#08979c'];

const inmoColor = (nombre: string) => {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return INMO_COLORS[Math.abs(hash) % INMO_COLORS.length];
};

const InmobiliariasPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalInmo, setModalInmo] = useState(false);
  const [modoInmo, setModoInmo] = useState<ModalMode>('crear');
  const [inmoEditando, setInmoEditando] = useState<Inmobiliaria | null>(null);
  const [formInmo] = Form.useForm();
  const [imagenFile, setImagenFile] = useState<UploadFile | null>(null);
  const [uploadingImagen, setUploadingImagen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inmoSeleccionada, setInmoSeleccionada] = useState<Inmobiliaria | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioInmo[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [formUsuario] = Form.useForm();

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [inmos, projs] = await Promise.all([getInmobiliarias(), getProyectos()]);
      setInmobiliarias(inmos); setProyectos(projs);
    } catch { message.error('Error al cargar datos'); }
    finally { setLoading(false); }
  };

  const abrirCrear = () => {
    setModoInmo('crear'); setInmoEditando(null);
    formInmo.resetFields(); setImagenFile(null); setModalInmo(true);
  };

  const abrirEditar = (inmo: Inmobiliaria, e: React.MouseEvent) => {
    e.stopPropagation();
    setModoInmo('editar'); setInmoEditando(inmo);
    formInmo.setFieldsValue({ nombre: inmo.nombre, correos: inmo.correos, proyectos: inmo.proyectos });
    setImagenFile(null); setModalInmo(true);
  };

  const handleGuardarInmo = async (values: { nombre: string; correos: string[]; proyectos: string[] }) => {
    try {
      setUploadingImagen(true);

      const uploadImagen = async (inmoId: string) => {
        if (!imagenFile?.originFileObj) return undefined;
        const contentType = imagenFile.originFileObj.type || 'image/jpeg';
        const { upload_url, public_url } = await getPresignedImagenInmobiliaria(inmoId, contentType);
        const res = await fetch(upload_url, { method: 'PUT', body: imagenFile.originFileObj, headers: { 'Content-Type': contentType } });
        if (!res.ok) throw new Error(`Error subiendo imagen: ${res.status}`);
        // Usar la URL tal cual viene del backend (ya incluye ?v=timestamp para cache busting)
        return public_url;
      };

      if (modoInmo === 'crear') {
        const inmo = await crearInmobiliaria(values);
        const id = inmo.pk.replace('INMOBILIARIA#', '');
        const imagen_url = await uploadImagen(id);
        if (imagen_url) await actualizarInmobiliaria(inmo.pk, { imagen_url });
        message.success('Inmobiliaria creada');
      } else if (inmoEditando) {
        const imagen_url = await uploadImagen(inmoEditando.pk.replace('INMOBILIARIA#', ''));
        await actualizarInmobiliaria(inmoEditando.pk, { ...values, ...(imagen_url ? { imagen_url } : {}) });
        message.success('Inmobiliaria actualizada');
      }
      setModalInmo(false); setImagenFile(null); await cargar();
    } catch { message.error('Error al guardar'); }
    finally { setUploadingImagen(false); }
  };

  const handleToggleInmo = async (inmo: Inmobiliaria, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (inmo.activo) {
        await deshabilitarInmobiliaria(inmo.pk); message.success('Inmobiliaria deshabilitada');
      } else {
        await habilitarInmobiliaria(inmo.pk); message.success('Inmobiliaria habilitada');
      }
      await cargar();
    } catch { message.error('Error al cambiar estado'); }
  };

  const handleEliminarInmo = async (inmo: Inmobiliaria) => {
    try {
      await eliminarInmobiliaria(inmo.pk); message.success('Inmobiliaria eliminada');
      await cargar();
    } catch (err: any) {
      console.error('Error al eliminar inmobiliaria:', err);
      // El mensaje ya viene procesado por handleApiError en api.ts
      const errorMessage = err?.message || 'Error al eliminar';
      message.error(errorMessage);
    }
  };

  const abrirUsuarios = async (inmo: Inmobiliaria) => {
    setInmoSeleccionada(inmo); setDrawerOpen(true); setLoadingUsuarios(true);

    try {
      setUsuarios(await getUsuariosInmobiliaria(inmo.pk));
    } catch { message.error('Error al cargar usuarios'); }
    finally { setLoadingUsuarios(false); }
  };

  const handleCrearUsuario = async (values: { username: string; password: string; nombre?: string }) => {
    if (!inmoSeleccionada) return;
    try {
      await crearUsuarioInmobiliaria(inmoSeleccionada.pk, values);
      message.success('Usuario creado');
      setModalUsuario(false); formUsuario.resetFields();
      setUsuarios(await getUsuariosInmobiliaria(inmoSeleccionada.pk));
    } catch { message.error('Error al crear usuario'); }
  };

  const handleToggleUsuario = async (u: UsuarioInmo) => {
    if (!inmoSeleccionada) return;
    try {
      if (u.activo) {
        await deshabilitarUsuario(inmoSeleccionada.pk, u.pk);
      } else {
        await habilitarUsuario(inmoSeleccionada.pk, u.pk);
      }
      setUsuarios(await getUsuariosInmobiliaria(inmoSeleccionada.pk));
    } catch { message.error('Error al cambiar estado'); }
  };

  const handleEliminarUsuario = async (u: UsuarioInmo) => {
    if (!inmoSeleccionada) return;
    try {
      await eliminarUsuarioInmobiliaria(inmoSeleccionada.pk, u.pk);
      setUsuarios(await getUsuariosInmobiliaria(inmoSeleccionada.pk));
    } catch { message.error('Error al eliminar'); }
  };

  const color = inmoSeleccionada ? inmoColor(inmoSeleccionada.nombre) : '#1677ff';

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        marginBottom: 24,
        gap: 12,
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <Title level={4} style={{ margin: 0, wordBreak: 'normal', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
          Inmobiliarias
        </Title>
        <Space wrap style={{ width: isMobile ? '100%' : undefined }}>
          <Tooltip title="Copiar enlace de registro global">
            <Button
              icon={<LinkOutlined />}
              style={{ flex: isMobile ? '1 1 140px' : undefined }}
              onClick={() => {
                const url = `${window.location.origin}/captura-global`;
                navigator.clipboard.writeText(url);
                message.success('Enlace de registro global copiado');
              }}
            >
              Enlace global
            </Button>
          </Tooltip>
          <Tooltip title="Actualizar">
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrear} style={{ flex: isMobile ? '1 1 150px' : undefined }}>
            Nueva inmobiliaria
          </Button>
        </Space>
      </div>

      {/* Cards */}
      <Row gutter={[16, 16]}>
        {inmobiliarias.map(inmo => {
          const c = inmoColor(inmo.nombre);
          return (
            <Col key={inmo.pk} xs={24} sm={12} md={8} lg={6}>
              <div
                style={{
                  borderRadius: 14, overflow: 'hidden',
                  background: 'var(--panel-bg)', border: '1px solid var(--app-border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  opacity: inmo.activo ? 1 : 0.65,
                  transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = c;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--app-border)';
                }}
              >
                {/* Imagen / banner */}
                <div style={{
                  height: 140, background: inmo.imagen_url ? undefined : `linear-gradient(135deg, ${c}cc 0%, ${c}66 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {inmo.imagen_url
                    ? <img src={inmo.imagen_url} alt={inmo.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <BankOutlined style={{ fontSize: 44, color: 'rgba(255,255,255,0.55)' }} />
                  }
                  {/* Botones de acción sobre la imagen */}
                  <div style={{ position: 'absolute', top: 8, right: 8 }} onClick={e => e.stopPropagation()}>
                    <Space size={4}>
                      <Tooltip title="Editar">
                        <Button size="small" type="text" icon={<EditOutlined />}
                          style={{ color: '#fff', background: 'rgba(0,0,0,0.28)', borderRadius: 6 }}
                          onClick={e => abrirEditar(inmo, e)} />
                      </Tooltip>
                      <Popconfirm
                        title={inmo.activo ? '¿Deshabilitar inmobiliaria?' : '¿Habilitar inmobiliaria?'}
                        okText="Sí" cancelText="No"
                        onConfirm={e => handleToggleInmo(inmo, e as any)}
                      >
                        <Tooltip title={inmo.activo ? 'Deshabilitar' : 'Habilitar'}>
                          <Button size="small" type="text" danger={inmo.activo}
                            style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 6, color: inmo.activo ? '#ff7875' : '#95de64' }}
                            icon={inmo.activo ? <StopOutlined /> : <CheckOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                      <Popconfirm title="¿Eliminar inmobiliaria?" okText="Sí" cancelText="No" okButtonProps={{ danger: true }}
                        onConfirm={() => handleEliminarInmo(inmo)}>
                        <Tooltip title="Eliminar">
                          <Button size="small" type="text" danger
                            style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 6 }}
                            icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                  {/* Badge estado */}
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <Badge
                      status={inmo.activo ? 'success' : 'error'}
                      text={<Text style={{ fontSize: 11, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                        {inmo.activo ? 'Activa' : 'Inactiva'}
                      </Text>}
                    />
                  </div>
                </div>

                <div style={{ padding: '14px 16px 14px' }}>
                  {/* Nombre */}
                  <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>{inmo.nombre}</Text>

                  {/* Proyectos */}
                  {inmo.proyectos?.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {inmo.proyectos.map(id => {
                        const p = proyectos.find(p => p.proyecto_id === id);
                        return <Tag key={id} style={{ margin: 0, fontSize: 11 }}>{p?.nombre || id}</Tag>;
                      })}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Sin proyectos asignados</Text>
                  )}

                  {/* Footer */}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Botón Ver Usuarios */}
                    <Button
                      type="default"
                      icon={<TeamOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirUsuarios(inmo);
                      }}
                      block
                      style={{
                        height: 36,
                        borderColor: c,
                        color: c,
                        fontWeight: 500,
                      }}
                    >
                      Ver usuarios
                    </Button>
                    
                    {/* Otros botones */}
                    <Space size={4} style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tooltip title="Ver inventario como esta inmobiliaria">
                        <Button
                          size="small"
                          type="text"
                          icon={<EyeOutlined />}
                          onClick={e => {
                            e.stopPropagation();
                            const id = inmo.pk.replace('INMOBILIARIA#', '');
                            navigate(`/inventario?preview_inmo=${id}`);
                          }}
                          style={{ fontSize: 12, color: '#722ed1' }}
                        >
                          Ver como inmo
                        </Button>
                      </Tooltip>
                      <Tooltip title="Copiar enlace de registro para clientes">
                        <Button
                          size="small"
                          type="text"
                          icon={<LinkOutlined />}
                          onClick={e => {
                            e.stopPropagation();
                            const id = inmo.pk.replace('INMOBILIARIA#', '');
                            const url = `${window.location.origin}/captura?inmo=${id}`;
                            navigator.clipboard.writeText(url);
                            message.success('Enlace copiado');
                          }}
                          style={{ fontSize: 12, color: '#1677ff' }}
                        >
                          Copiar enlace
                        </Button>
                      </Tooltip>
                    </Space>
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
        {!loading && inmobiliarias.length === 0 && (
          <Col span={24}>
            <div style={{ textAlign: 'center', padding: 60 }}>
              <TeamOutlined style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 12 }} />
              <div><Text type="secondary">No hay inmobiliarias registradas</Text></div>
            </div>
          </Col>
        )}
      </Row>

      {/* Modal inmobiliaria */}
      <Modal
        title={modoInmo === 'crear' ? 'Nueva inmobiliaria' : 'Editar inmobiliaria'}
        open={modalInmo}
        onCancel={() => { setModalInmo(false); setImagenFile(null); }}
        onOk={() => formInmo.submit()}
        okText={modoInmo === 'crear' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
        width={520}
        confirmLoading={uploadingImagen}
      >
        <Form form={formInmo} layout="vertical" onFinish={handleGuardarInmo}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: Inmobiliaria XYZ" />
          </Form.Item>
          <Form.Item name="correos" label="Correos de notificación">
            <Select mode="tags" placeholder="Escribe un correo y presiona Enter" tokenSeparators={[',']} />
          </Form.Item>
          <Form.Item name="proyectos" label="Proyectos asignados">
            <Select mode="multiple" placeholder="Selecciona proyectos">
              {proyectos.map(p => (
                <Select.Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Imagen (opcional)">
            {inmoEditando?.imagen_url && !imagenFile && (
              <img src={inmoEditando.imagen_url} alt="portada actual"
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
            )}
            <Upload
              onChange={({ fileList }) => setImagenFile(fileList[0] ?? null)}
              maxCount={1}
              accept="image/jpeg,image/png,image/webp"
              beforeUpload={() => false}
              fileList={imagenFile ? [imagenFile] : []}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>
                {inmoEditando?.imagen_url && !imagenFile ? 'Cambiar imagen' : 'Seleccionar imagen'}
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal usuarios */}
      <Modal
        open={drawerOpen}
        onCancel={() => { setDrawerOpen(false); setInmoSeleccionada(null); }}
        footer={null}
        width={560}
        title={null}
        styles={{ body: { padding: 0 } }}
      >
        {inmoSeleccionada && (
          <>
            {/* Header */}
            <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--app-border)' }}>
              <div style={{ height: 4, background: color, borderRadius: 2, marginBottom: 16 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {inmoSeleccionada.imagen_url ? (
                    <img src={inmoSeleccionada.imagen_url} alt={inmoSeleccionada.nombre}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <Avatar size={48} style={{ background: `${color}20`, color, fontWeight: 700, fontSize: 20 }}>
                      {inmoSeleccionada.nombre.charAt(0).toUpperCase()}
                    </Avatar>
                  )}
                  <div>
                    <Text strong style={{ fontSize: 16, display: 'block' }}>{inmoSeleccionada.nombre}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}</Text>
                  </div>
                </div>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setModalUsuario(true)}>
                  Nuevo usuario
                </Button>
              </div>
              {inmoSeleccionada.correos?.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <MailOutlined style={{ color: 'var(--text-muted)', fontSize: 12 }} />
                  {inmoSeleccionada.correos.map(c => (
                    <Tag key={c} style={{ margin: 0, fontSize: 11 }}>{c}</Tag>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de usuarios */}
            <div style={{ padding: '12px 24px 24px', maxHeight: 420, overflowY: 'auto' }}>
              {loadingUsuarios ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Text type="secondary">Cargando usuarios...</Text>
                </div>
              ) : usuarios.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <UserOutlined style={{ fontSize: 36, color: 'var(--text-muted)', marginBottom: 8 }} />
                  <div><Text type="secondary">No hay usuarios registrados</Text></div>
                </div>
              ) : (
                usuarios.map(u => (
                  <div key={u.pk} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0', borderBottom: '1px solid var(--app-border)',
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Avatar size={36} style={{ background: u.activo ? `${color}20` : 'var(--panel-soft-bg)', color: u.activo ? color : 'var(--text-muted)', fontWeight: 600 }}>
                        {(u.nombre || u.cognito_username).charAt(0).toUpperCase()}
                      </Avatar>
                      <div>
                        <Text strong style={{ fontSize: 13, display: 'block' }}>{u.nombre || u.cognito_username}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{u.cognito_username}</Text>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Badge status={u.activo ? 'success' : 'error'} />
                      <Popconfirm
                        title={u.activo ? '¿Deshabilitar?' : '¿Habilitar?'}
                        okText="Sí" cancelText="No"
                        onConfirm={() => handleToggleUsuario(u)}
                      >
                        <Tooltip title={u.activo ? 'Deshabilitar' : 'Habilitar'}>
                          <Button size="small" type="text" danger={u.activo}
                            icon={u.activo ? <StopOutlined /> : <CheckOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                      <Popconfirm title="¿Eliminar usuario?" okText="Sí" cancelText="No" okButtonProps={{ danger: true }}
                        onConfirm={() => handleEliminarUsuario(u)}>
                        <Tooltip title="Eliminar">
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Modal nuevo usuario */}
      <Modal
        title="Nuevo usuario"
        open={modalUsuario}
        onCancel={() => { setModalUsuario(false); formUsuario.resetFields(); }}
        onOk={() => formUsuario.submit()}
        okText="Crear"
        cancelText="Cancelar"
      >
        <Form form={formUsuario} layout="vertical" onFinish={handleCrearUsuario}>
          <Form.Item name="nombre" label="Nombre visible">
            <Input placeholder="Ej: Vendedor Norte" />
          </Form.Item>
          <Form.Item name="username" label="Nombre de usuario" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: VendedorXYZ (sin espacios ni correo)" />
          </Form.Item>
          <Form.Item name="correo" label="Correo"
            rules={[{ required: true, message: 'Requerido' }, { type: 'email', message: 'Correo inválido' }]}>
            <Input placeholder="correo@ejemplo.com" />
          </Form.Item>
          <Form.Item name="password" label="Contraseña temporal"
            rules={[{ required: true, message: 'Requerido' }, { min: 8, message: 'Mínimo 8 caracteres' }]}
            extra="Mínimo 8 caracteres, al menos 1 mayúscula, 1 número y 1 carácter especial (ej: !@#$)">
            <Input.Password placeholder="Ej: MiClave1!" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InmobiliariasPage;
