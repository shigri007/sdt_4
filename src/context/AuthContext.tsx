import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleCode } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: RoleCode[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getMe().then(res => setUser(res.user)).catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    if (res.success) setUser(res.user);
  };

  const logout = () => { api.logout().catch(() => {}).finally(() => setUser(null)); };
  const hasRole = (...roles: RoleCode[]) => Boolean(user && roles.includes(user.role));

  return <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
