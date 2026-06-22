import { Drawer, Timeline, Tag, Typography, Empty, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Proceso } from '../../types';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL } from '../../constants/estados';

const { Text } = Typography;

interface Props {
  open: boolean;
  proceso: Proceso | null;
  clienteNombre: string;
  onClose: () => void;
}

const HistorialEstatusDrawer = ({ open, proceso, clienteNombre, onClose }: Props) => {
  const historial = proceso ? [...proceso.historial].reverse() : [];

  return (
    <Drawer
      title={
        <div>
          <Text strong>{clienteNombre}</Text>
          {proceso && (
            <div style={{ marginTop: 2 }}>
              <Tag color="geekblue" style={{ margin: 0, fontSize: 12 }}>
                {proceso.unidad_nombre || proceso.unidad_id}
              </Tag>
            </div>
          )}
        </div>
      }
      open={open}
      onClose={onClose}
      size="default"
    >
      {historial.length === 0 ? (
        <Empty description="Sin cambios de estatus aun" />
      ) : (
        <Timeline
          items={historial.map(h => ({
            color: ESTADO_PROCESO_COLOR[h.estatus_nuevo] ?? 'gray',
            children: (
              <div style={{
                background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)',
                borderRadius: 8, padding: '10px 12px', marginBottom: 4,
              }}>
                <Space size={6} style={{ marginBottom: 6 }}>
                  <Tag color={ESTADO_PROCESO_COLOR[h.estatus_anterior] ?? 'default'} style={{ margin: 0 }}>
                    {ESTADO_PROCESO_LABEL[h.estatus_anterior] ?? h.estatus_anterior}
                  </Tag>
                  <Text type="secondary">-&gt;</Text>
                  <Tag color={ESTADO_PROCESO_COLOR[h.estatus_nuevo] ?? 'default'} style={{ margin: 0 }}>
                    {ESTADO_PROCESO_LABEL[h.estatus_nuevo] ?? h.estatus_nuevo}
                  </Tag>
                </Space>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <UserOutlined style={{ color: 'var(--text-muted)', fontSize: 11 }} />
                  <Text style={{ fontSize: 12 }}>{h.ejecutado_por_nombre}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>-</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(h.timestamp).format('DD/MM/YYYY HH:mm')}
                  </Text>
                </div>

                {h.notificacion_enviada ? (
                  <Text type="success" style={{ fontSize: 11 }}>
                    <CheckCircleOutlined style={{ marginRight: 4 }} />Notificacion enviada
                  </Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <CloseCircleOutlined style={{ marginRight: 4 }} />Sin notificacion
                  </Text>
                )}
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
};

export default HistorialEstatusDrawer;
