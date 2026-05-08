import { Result } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

interface Props {
  titulo?: string;
}

const UnderConstruction = ({ titulo }: Props) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <Result
      icon={<ToolOutlined style={{ color: '#faad14' }} />}
      title={titulo ?? 'Página en construcción'}
      subTitle="Este módulo estará disponible próximamente."
    />
  </div>
);

export default UnderConstruction;
