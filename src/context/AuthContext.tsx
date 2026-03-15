import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi, setSessionId, type AuthUser } from '../api/client';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  register: (data: { email: string; password: string; name: string; companyName: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.getSession()
      .then(res => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setSessionId(res.sessionId);
    setUser(res.user);
  };

  const demoLogin = async () => {
    const res = await authApi.demoLogin();
    setSessionId(res.sessionId);
    setUser(res.user);
  };

  const register = async (data: { email: string; password: string; name: string; companyName: string }) => {
    const res = await authApi.register(data);
    setSessionId(res.sessionId);
    setUser(res.user);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    setSessionId(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, demoLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
