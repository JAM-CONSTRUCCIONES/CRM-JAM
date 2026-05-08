import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Usuario } from '../types';
import { getMe, logout as doLogout } from '../services/auth.service';
import { fetchAuthSession } from 'aws-amplify/auth';

interface AuthContextType {
  usuario: Usuario | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsuario = async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      const data = await getMe();
      const username = session.tokens.idToken.payload?.['cognito:username'] as string | undefined;
      setUsuario({ ...data, username });
    } catch {
      setUsuario(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuario(); }, []);

  return (
    <AuthContext.Provider value={{ usuario, loading, refetch: fetchUsuario, logout: doLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  return ctx;
};
