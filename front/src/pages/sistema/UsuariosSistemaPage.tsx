import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Tag, Space,
  Popconfirm, Typography, Select, Tooltip, message, Grid, Dropdown, Avatar,
} from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined, MoreOutlined, QrcodeOutlined } from '@ant-design/icons';
import QRCode from 'qrcode';
import {
  getUsuariosSistema, crearUsuarioSistema, actualizarUsuarioSistema,
  deshabilitarUsuarioSistema, habilitarUsuarioSistema, eliminarUsuarioSistema,
  type UsuarioSistema,
} from '../../services/sistema.service';
import { useAuthContext } from '../../context/AuthContext';
import type { RolInterno } from '../../types';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const ROL_LABELS: Record<RolInterno, string> = {
  admin: 'Admin',
  coordinador: 'Coordinador',
  supervisor: 'Supervisor',
};

const ROL_COLORS: Record<RolInterno, string> = {
  admin: 'red',
  coordinador: 'blue',
  supervisor: 'purple',
};

type ModalMode = 'crear' | 'editar';

const UsuariosSistemaPage = () => {
  const { usuario: usuarioActual } = useAuthContext();
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [modo, setModo] = useState<ModalMode>('crear');
  const [editando, setEditando] = useState<UsuarioSistema | null>(null);
  const [form] = Form.useForm();
  const { md } = useBreakpoint();
  const isMobile = !md;
  const isAdmin = usuarioActual?.rol === 'admin';

  // Modal QR para MFA setup del nuevo usuario
  const [mfaModal, setMfaModal] = useState(false);
  const [mfaQrUrl, setMfaQrUrl] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaUsername, setMfaUsername] = useState('');

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try { setUsuarios(await getUsuariosSistema()); }
    catch { message.error('Error al cargar usuarios'); }
    finally { setLoading(false); }
  };

  const abrirCrear = () => {
    setModo('crear');
    setEditando(null);
    form.resetFields();
    setModal(true);
  };

  const abrirEditar = (u: UsuarioSistema) => {
    setModo('editar');
    setEditando(u);
    form.setFieldsValue({ nombre: u.nombre, rol: u.rol });
    setModal(true);
  };

  const handleGuardar = async (values: any) => {
    try {
      if (modo === 'crear') {
        const res = await crearUsuarioSistema(values);
        setModal(false);
        await cargar();
        // Si el backend devuelve mfa_secret, mostrar QR al admin
        if (res?.mfa_secret) {
          const uri = `otpauth://totp/JAM:${encodeURIComponent(values.username)}?secret=${res.mfa_secret}&issuer=JAM%20Construcciones`;
          const qr = await QRCode.toDataURL(uri);
          setMfaQrUrl(qr);
          setMfaSecret(res.mfa_secret);
          setMfaUsername(values.username);
          setMfaModal(true);
        } else {
          message.success('Usuario creado');
        }
      } else if (editando) {
        await actualizarUsuarioSistema(editando.pk, isAdmin ? { nombre: values.nombre, rol: values.rol } : { nombre: values.nombre });
        message.success('Usuario actualizado');
        setModal(false);
        await cargar();
      }
    } catch (err: any) {
      console.error('Error al guardar usuario:', err);
      // El mensaje ya viene procesado por handleApiError en api.ts
      const errorMessage = err?.message || 'Error al guardar';
      message.error(errorMessage);
    }
  };

  const esSelf = (u: UsuarioSistema) => u.pk === `USUARIO#${usuarioActual?.sub}`;

  const handleToggle = async (u: UsuarioSistema) => {
    if (!isAdmin) {
      message.warning('Solo admin puede habilitar o deshabilitar usuarios');
      return;
    }
    try {
      if (u.activo) {
        await deshabilitarUsuarioSistema(u.pk);
        message.success('Usuario deshabilitado');
      } else {
        await habilitarUsuarioSistema(u.pk);
        message.success('Usuario habilitado');
      }
      await cargar();
    } catch {
      message.error('Error al cambiar estado');
    }
  };

  const handleEliminar = async (u: UsuarioSistema) => {
    try {
      await eliminarUsuarioSistema(u.pk);
      message.success('Usuario eliminado');
      await cargar();
    } catch {
      message.error('Error al eliminar');
    }
  };

  const columns = [
    {
      title: 'Usuario',
      key: 'usuario',
      render: (_: any, u: UsuarioSistema) => (
        <Space>
          <Avatar src={u.foto_url} style={{ background: 'var(--action-bg)', fontWeight: 700 }}>
            {(u.nombre || u.cognito_username || 'U').charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ display: 'block' }}>{u.nombre || u.cognito_username}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{u.cognito_username}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Rol', dataIndex: 'rol', key: 'rol',
      render: (v: RolInterno) => <Tag color={ROL_COLORS[v]}>{ROL_LABELS[v]}</Tag>,
    },
    ...(!isMobile ? [{
      title: 'Estado', dataIndex: 'activo', key: 'activo',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    }] : []),
    {
      title: '', key: 'acciones', width: isMobile ? 48 : 130,
      render: (_: any, u: UsuarioSistema) => {
        const self = esSelf(u);
        if (isMobile) {
          const items = [
            { key: 'editar', icon: <EditOutlined />, label: 'Editar', onClick: () => abrirEditar(u) },
            ...(isAdmin ? [{
              key: 'toggle', icon: u.activo ? <StopOutlined /> : <CheckOutlined />,
              label: u.activo ? 'Deshabilitar' : 'Habilitar', danger: u.activo,
              disabled: self,
              onClick: () => !self && handleToggle(u),
            }] : []),
            ...(isAdmin ? [{
              key: 'eliminar', icon: <DeleteOutlined />, label: 'Eliminar', danger: true,
              disabled: self,
              onClick: () => {
                if (self) return;
                Modal.confirm({
                  title: '¿Eliminar usuario?', okText: 'Eliminar',
                  cancelText: 'Cancelar', okButtonProps: { danger: true },
                  onOk: () => handleEliminar(u),
                });
              },
            }] : []),
          ];
          return <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight"><Button size="small" icon={<MoreOutlined />} /></Dropdown>;
        }
        return (
          <Space>
            <Tooltip title="Editar">
              <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(u)} />
            </Tooltip>
            {isAdmin && (
              <Tooltip title={self ? 'No puedes modificar tu propio estado' : (u.activo ? 'Deshabilitar' : 'Habilitar')}>
                <Popconfirm
                  title={u.activo ? 'Deshabilitar usuario?' : 'Habilitar usuario?'}
                  okText="Si" cancelText="No"
                  onConfirm={() => handleToggle(u)}
                  disabled={self}
                >
                  <Button size="small" danger={u.activo} disabled={self} icon={u.activo ? <StopOutlined /> : <CheckOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
            {isAdmin && (
              <Tooltip title={self ? 'No puedes eliminarte a ti mismo' : 'Eliminar'}>
                <Popconfirm
                  title="Eliminar usuario permanentemente?"
                  okText="Si" cancelText="No"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleEliminar(u)}
                  disabled={self}
                >
                  <Button size="small" danger disabled={self} icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Usuarios del sistema</Title>
        <Space>
          <Tooltip title="Actualizar">
            <Button aria-label="Actualizar usuarios" icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrear}>
            Nuevo usuario
          </Button>
        </Space>
      </div>

      {isMobile ? (
        <div>
          {loading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Cargando usuarios...</div>}
          {!loading && usuarios.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No hay usuarios registrados</div>}
          {usuarios.map(u => {
            const self = esSelf(u);
            const items = [
              { key: 'editar', icon: <EditOutlined />, label: 'Editar', onClick: () => abrirEditar(u) },
              ...(isAdmin ? [{
                key: 'toggle', icon: u.activo ? <StopOutlined /> : <CheckOutlined />,
                label: u.activo ? 'Deshabilitar' : 'Habilitar', danger: u.activo,
                disabled: self,
                onClick: () => !self && handleToggle(u),
              }] : []),
              ...(isAdmin ? [{
                key: 'eliminar', icon: <DeleteOutlined />, label: 'Eliminar', danger: true,
                disabled: self,
                onClick: () => {
                  if (self) return;
                  Modal.confirm({
                    title: '¿Eliminar usuario?', okText: 'Eliminar',
                    cancelText: 'Cancelar', okButtonProps: { danger: true },
                    onOk: () => handleEliminar(u),
                  });
                },
              }] : []),
            ];
            return (
              <div key={u.pk} style={{ background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--app-border)', marginBottom: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                    <Avatar src={u.foto_url} style={{ background: 'var(--action-bg)', fontWeight: 700, flexShrink: 0 }}>
                      {(u.nombre || u.cognito_username || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{ display: 'block' }}>{u.nombre || u.cognito_username}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{u.cognito_username}</Text>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Tag color={ROL_COLORS[u.rol]}>{ROL_LABELS[u.rol]}</Tag>
                        <Tag color={u.activo ? 'green' : 'red'}>{u.activo ? 'Activo' : 'Inactivo'}</Tag>
                      </div>
                    </div>
                  </div>
                  <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
                    <Button size="small" icon={<MoreOutlined />} />
                  </Dropdown>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Table
          dataSource={usuarios} columns={columns}
          rowKey="pk" loading={loading} pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ x: true }}
        />
      )}

      <Modal
        title={modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        okText={modo === 'crear' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={handleGuardar}>
          <Form.Item name="nombre" label="Nombre visible" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: Juan Perez" />
          </Form.Item>
          {modo === 'crear' && (
            <>
              <Form.Item name="username" label="Nombre de usuario" rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="Sin espacios ni correo" />
              </Form.Item>
              <Form.Item
                name="password" label="Contraseña"
                rules={[{ required: true, message: 'Requerido' }, { min: 8, message: 'Mínimo 8 caracteres' }]}
                extra="Mínimo 8 caracteres, al menos 1 mayúscula, 1 número y 1 carácter especial (ej: !@#$)"
              >
                <Input.Password placeholder="Ej: MiClave1!" />
              </Form.Item>
              <Form.Item
                name="correo" label="Correo"
                rules={[{ type: 'email', message: 'Correo invalido' }]}
              >
                <Input placeholder="correo@ejemplo.com" />
              </Form.Item>
            </>
          )}
          <Form.Item name="rol" label="Rol" rules={[{ required: true, message: 'Requerido' }]}>
            <Select placeholder="Selecciona un rol" disabled={modo === 'editar' && (!isAdmin || editando?.pk === `USUARIO#${usuarioActual?.sub}`)}>
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="coordinador">Coordinador</Select.Option>
              <Select.Option value="supervisor">Supervisor</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal QR — se muestra al admin tras crear un usuario interno */}
      <Modal
        title={<span><QrcodeOutlined /> Configuración MFA requerida</span>}
        open={mfaModal}
        onOk={() => setMfaModal(false)}
        onCancel={() => setMfaModal(false)}
        okText="Entendido"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={420}
      >
        <p style={{ marginBottom: 8 }}>
          El usuario <strong>{mfaUsername}</strong> debe escanear este QR con Google Authenticator o Authy
          antes de su primer login.
        </p>
        {mfaQrUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
            <img src={mfaQrUrl} alt="QR MFA" style={{ width: 180, height: 180 }} />
          </div>
        )}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4, letterSpacing: 1 }}>CLAVE MANUAL</div>
          <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{mfaSecret}</code>
        </div>
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>
          Una vez configurado el autenticador, el usuario podrá hacer login normalmente.
        </p>
      </Modal>
    </div>
  );
};

export default UsuariosSistemaPage;
