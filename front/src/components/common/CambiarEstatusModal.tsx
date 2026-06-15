import { useState } from 'react';
import { Modal, Select, Space, Typography, Alert, Tag, Divider, Button, Tooltip } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, TeamOutlined, UserOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { Proceso } from '../../types';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL, ESTADO_PROCESO_DESCRIPCION } from '../../constants/estados';

const { Text } = Typography;
const { Option } = Select;

export type ModoNotificacion = false | 'admin' | 'todos';

const TRANSICIONES: Record<string, string[]> = {
  captacion:       ['reserva', 'desvinculado'],
  reserva:         ['separacion', 'desvinculado', 'captacion'],
  separacion:      ['inicial', 'pagos_atrasados', 'desvinculado', 'reserva'],
  inicial:         ['pagos_atrasados', 'contra_entrega', 'desvinculado', 'separacion'],
  pagos_atrasados: ['inicial', 'contra_entrega', 'desvinculado', 'separacion'],
  contra_entrega:  ['vendida', 'desvinculado', 'inicial'],
  vendida:         ['contra_entrega'],
};

const ORDEN_FLUJO: Record<string, number> = {
  captacion: 0,
  reserva: 1,
  separacion: 2,
  inicial: 3,
  pagos_atrasados: 4,
  contra_entrega: 5,
  vendida: 6,
};

interface Props {
  open: boolean;
  proceso: Proceso;
  tieneContacto: boolean;
  onCancel: () => void;
  onConfirm: (estatus: string, notificar: ModoNotificacion) => Promise<void>;
}

const CambiarEstatusModal = ({ open, proceso, tieneContacto, onCancel, onConfirm }: Props) => {
  const [nuevoEstatus, setNuevoEstatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const opciones = TRANSICIONES[proceso.estado] ?? [];
  const esRetroceso = !!nuevoEstatus
    && ORDEN_FLUJO[nuevoEstatus] !== undefined
    && ORDEN_FLUJO[proceso.estado] !== undefined
    && ORDEN_FLUJO[nuevoEstatus] < ORDEN_FLUJO[proceso.estado];

  const handleConfirm = async (notificar: ModoNotificacion) => {
    if (!nuevoEstatus) return;
    setLoading(true);
    try {
      await onConfirm(nuevoEstatus, notificar);
      setNuevoEstatus(undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNuevoEstatus(undefined);
    onCancel();
  };

  return (
    <Modal
      title="Cambiar estatus del proceso"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={460}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">

        <div style={{
          background: '#f5f5f5', borderRadius: 8, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Unidad</Text>
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>
            {proceso.unidad_nombre || proceso.unidad_id}
          </Tag>
        </div>

        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
            Transición de estatus
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag color={ESTADO_PROCESO_COLOR[proceso.estado]} style={{ margin: 0, fontSize: 13, padding: '2px 10px' }}>
              {ESTADO_PROCESO_LABEL[proceso.estado] ?? proceso.estado}
            </Tag>
            {esRetroceso ? (
              <ArrowLeftOutlined style={{ color: '#faad14' }} />
            ) : (
              <ArrowRightOutlined style={{ color: '#bfbfbf' }} />
            )}
            {nuevoEstatus ? (
              <Tag
                icon={esRetroceso ? <WarningOutlined /> : undefined}
                color={esRetroceso ? 'warning' : ESTADO_PROCESO_COLOR[nuevoEstatus]}
                style={{ margin: 0, fontSize: 13, padding: '2px 10px' }}
              >
                {ESTADO_PROCESO_LABEL[nuevoEstatus] ?? nuevoEstatus}
              </Tag>
            ) : (
              <Tag style={{ margin: 0, fontSize: 13, padding: '2px 10px', color: '#bfbfbf', borderStyle: 'dashed' }}>
                Selecciona
              </Tag>
            )}
          </div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            Nuevo estatus <Tooltip title="Selecciona el siguiente paso en el proceso de venta"><InfoCircleOutlined style={{ marginLeft: 4, color: '#1677ff' }} /></Tooltip>
          </Text>
          <Select
            style={{ width: '100%' }}
            placeholder="Selecciona el nuevo estatus"
            value={nuevoEstatus}
            onChange={setNuevoEstatus}
          >
            {opciones.map(op => (
              <Option key={op} value={op}>
                <Tooltip title={ESTADO_PROCESO_DESCRIPCION[op]} placement="right">
                  <Tag color={ESTADO_PROCESO_COLOR[op]} style={{ margin: 0 }}>
                    {ESTADO_PROCESO_LABEL[op] ?? op}
                    {ORDEN_FLUJO[op] !== undefined && ORDEN_FLUJO[proceso.estado] !== undefined && ORDEN_FLUJO[op] < ORDEN_FLUJO[proceso.estado] ? ' - correccion' : ''}
                  </Tag>
                </Tooltip>
              </Option>
            ))}
          </Select>
          {opciones.length === 0 && (
            <Alert style={{ marginTop: 8 }} type="warning"
              message="No hay transiciones disponibles desde este estatus." showIcon />
          )}
        </div>

        {nuevoEstatus === 'reserva' && (
          <Alert type="info" showIcon message="La unidad pasará a estado 'No disponible' y se iniciará el proceso de venta." />
        )}
        {nuevoEstatus === 'separacion' && (
          <Alert type="info" showIcon message="El cliente tiene 30 días para completar el pago de separación." />
        )}
        {nuevoEstatus === 'inicial' && (
          <Alert type="success" showIcon message="Separación completada. Cliente comienza a pagar inicial." />
        )}
        {nuevoEstatus === 'vendida' && (
          <Alert type="success" showIcon message="Venta completada. La unidad quedará marcada como vendida definitivamente." />
        )}
        {nuevoEstatus === 'desvinculado' && (
          <Alert type="warning" showIcon message="El proceso se cancelará y la unidad volverá a estar disponible." />
        )}
        {nuevoEstatus === 'pagos_atrasados' && (
          <Alert type="error" showIcon message="El cliente tiene pagos pendientes que requieren seguimiento." />
        )}
        {esRetroceso && (
          <Alert
            type="warning"
            showIcon
            message="Correccion de estatus"
            description={`Estas volviendo de "${ESTADO_PROCESO_LABEL[proceso.estado] ?? proceso.estado}" a "${ESTADO_PROCESO_LABEL[nuevoEstatus] ?? nuevoEstatus}". El flujo se mantiene controlado y se registrara en el historial.`}
          />
        )}

        {nuevoEstatus && (
          <>
            <Divider style={{ margin: '4px 0' }} />
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                ¿Enviar notificación por correo?
              </Text>
              <Space style={{ width: '100%' }} direction="vertical" size={8}>
                <Button
                  block
                  icon={<TeamOutlined />}
                  onClick={() => handleConfirm('todos')}
                  loading={loading}
                  style={{ textAlign: 'left', height: 'auto', padding: '10px 14px', border: '1px solid #d9d9d9' }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>Notificar a todos</div>
                    <div style={{ fontSize: 12, color: '#888', fontWeight: 400, marginTop: 2 }}>
                      {tieneContacto
                        ? 'Cliente, inmobiliaria y administración'
                        : 'Inmobiliaria y administración (cliente sin correo)'}
                    </div>
                  </div>
                </Button>
                <Button
                  block
                  icon={<UserOutlined />}
                  onClick={() => handleConfirm('admin')}
                  loading={loading}
                  style={{ textAlign: 'left', height: 'auto', padding: '10px 14px', border: '1px solid #d9d9d9' }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>Solo administración</div>
                    <div style={{ fontSize: 12, color: '#888', fontWeight: 400, marginTop: 2 }}>
                      Notificación interna únicamente
                    </div>
                  </div>
                </Button>
                <Button
                  block
                  onClick={() => handleConfirm(false)}
                  loading={loading}
                  type="text"
                  style={{ color: '#8c8c8c', fontSize: 13 }}
                >
                  Continuar sin enviar notificación
                </Button>
              </Space>
            </div>
          </>
        )}

      </Space>
    </Modal>
  );
};

export default CambiarEstatusModal;
