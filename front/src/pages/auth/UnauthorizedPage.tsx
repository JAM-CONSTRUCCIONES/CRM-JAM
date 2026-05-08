import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  return (
    <Result
      status="403"
      title="Sin acceso"
      subTitle="No tienes permisos para ver esta página."
      extra={<Button type="primary" onClick={() => navigate('/dashboard')}>Volver al inicio</Button>}
    />
  );
};

export default UnauthorizedPage;
