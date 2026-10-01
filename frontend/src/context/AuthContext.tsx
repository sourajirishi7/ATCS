import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleType } from '../types';
import { api } from '../lib/api';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  departmentId?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string; resetCode?: string }>;
  resetPassword: (email: string, resetCode: string, newPassword: string) => Promise<void>;
  quickSwitchRole: (role: RoleType) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('atcs_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await api.get<User>('/auth/me');
          setUser(profile);
        } catch (err) {
          console.warn('Session expired or invalid, logging out...');
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
      localStorage.setItem('atcs_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/register', payload);
      localStorage.setItem('atcs_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    return api.post<{ success: boolean; message: string; resetCode?: string }>('/auth/forgot-password', { email });
  };

  const resetPassword = async (email: string, resetCode: string, newPassword: string) => {
    await api.post('/auth/reset-password', { email, resetCode, newPassword });
  };

  const quickSwitchRole = async (role: RoleType) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/quick-login', { role });
      localStorage.setItem('atcs_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('atcs_token');
    api.clearCache();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        forgotPassword,
        resetPassword,
        quickSwitchRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
