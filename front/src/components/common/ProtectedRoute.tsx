import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import useAuth from '../../hooks/useAuth';
import type { Rol } from '../../types';

interface Props {
  children: React.ReactNode;
  roles?: Rol[];
}

const ProtectedRoute = ({ children, roles }: Props) => {
  const { usuario, loading } = useAuth();

  if (loading) return <Spin fullscreen />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.mfa_required) return <Navigate to="/mfa-setup" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
