import { Modal } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

export const confirmarExclusividadCliente = (mensaje: string): Promise<boolean> =>
  new Promise(resolve => {
    let instance: ReturnType<typeof Modal.confirm>;
    instance = Modal.confirm({
      title: 'Cliente con exclusividad',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: `${mensaje} ¿Deseas continuar?`,
      okText: 'Sí, continuar',
      cancelText: 'No',
      onOk: () => {
        resolve(true);
        instance.destroy();
      },
      onCancel: () => resolve(false),
    });
  });
