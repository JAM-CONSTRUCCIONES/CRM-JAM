import { Button, Modal, Space, Typography } from 'antd';
import { TeamOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import type { ModoNotificacion } from './CambiarEstatusModal';

const { Text } = Typography;

export const seleccionarNotificacionBloqueo = (unidadNombre?: string): Promise<ModoNotificacion | undefined> =>
  new Promise(resolve => {
    let instance: ReturnType<typeof Modal.confirm>;
    instance = Modal.confirm({
      title: 'Notificar creación del bloqueo',
      icon: <LockOutlined style={{ color: '#1677ff' }} />,
      width: 460,
      okButtonProps: { style: { display: 'none' } },
      cancelText: 'Cancelar',
      content: (
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={12}>
          <Text>{unidadNombre ? `Selecciona cómo notificar el bloqueo de la unidad ${unidadNombre}.` : 'Selecciona cómo notificar el bloqueo.'}</Text>
          <Button block icon={<TeamOutlined />} onClick={() => { resolve('todos'); instance.destroy(); }} style={{ textAlign: 'left', height: 'auto', padding: '10px 14px', border: '1px solid var(--app-border)' }}>
            <div><div style={{ fontWeight: 500, fontSize: 14 }}>Notificar a todos</div><div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>Cliente, inmobiliaria y administración</div></div>
          </Button>
          <Button block icon={<UserOutlined />} onClick={() => { resolve('admin'); instance.destroy(); }} style={{ textAlign: 'left', height: 'auto', padding: '10px 14px', border: '1px solid var(--app-border)' }}>
            <div><div style={{ fontWeight: 500, fontSize: 14 }}>Solo administración</div><div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>Notificación interna únicamente</div></div>
          </Button>
          <Button block type="text" onClick={() => { resolve(false); instance.destroy(); }} style={{ color: '#8c8c8c', fontSize: 13 }}>Crear sin enviar notificación</Button>
        </Space>
      ),
      onCancel: () => resolve(undefined),
    });
  });
