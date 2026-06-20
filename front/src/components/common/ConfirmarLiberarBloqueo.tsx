import { Button, Modal, Space, Typography } from 'antd';
import { TeamOutlined, UserOutlined, UnlockOutlined } from '@ant-design/icons';
import type { ModoNotificacion } from './CambiarEstatusModal';

const { Text } = Typography;

interface Options {
  tieneCliente?: boolean;
  onConfirm: (notificar: ModoNotificacion) => Promise<void>;
}

export const confirmarLiberarBloqueo = ({ tieneCliente, onConfirm }: Options) => {
  let instance: ReturnType<typeof Modal.confirm>;

  const confirmar = async (notificar: ModoNotificacion) => {
    await onConfirm(notificar);
    instance.destroy();
  };

  instance = Modal.confirm({
    title: 'Liberar bloqueo',
    icon: <UnlockOutlined style={{ color: '#ff4d4f' }} />,
    width: 460,
    okButtonProps: { style: { display: 'none' } },
    cancelText: 'Cancelar',
    content: (
      <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={12}>
        <Text>La unidad volvera a estar disponible. Selecciona si se enviara notificacion.</Text>
        <Button
          block
          icon={<TeamOutlined />}
          onClick={() => confirmar('todos')}
          style={{ textAlign: 'left', height: 'auto', padding: '10px 14px', border: '1px solid var(--app-border)' }}
        >
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Cliente, inmobiliaria y administracion</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
              {tieneCliente ? 'Se enviara a todos los destinatarios disponibles' : 'No hay cliente asociado; se enviara a inmobiliaria y administracion'}
            </div>
          </div>
        </Button>
        <Button
          block
          icon={<UserOutlined />}
          onClick={() => confirmar('admin')}
          style={{ textAlign: 'left', height: 'auto', padding: '10px 14px', border: '1px solid var(--app-border)' }}
        >
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Solo administracion</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
              Notificacion interna unicamente
            </div>
          </div>
        </Button>
        <Button block type="text" onClick={() => confirmar(false)} style={{ color: '#8c8c8c', fontSize: 13 }}>
          Liberar sin enviar notificacion
        </Button>
      </Space>
    ),
  });
};
