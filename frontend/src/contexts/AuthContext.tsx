import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, auth as authApi } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  trialEndsAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperadmin: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const profile = user;
  const isSuperadmin = user?.role === 'SUPERADMIN';
  const trialEndsMs = user?.trialEndsAt ? new Date(user.trialEndsAt).getTime() : 0;
  const trialDaysLeft = user?.trialEndsAt ? Math.max(0, Math.ceil((trialEndsMs - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const trialActive = isSuperadmin || (!!user?.isActive && (!user?.trialEndsAt || trialEndsMs > Date.now()));

  const refreshProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const profile = await authApi.me();
      setUser(profile);
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);
      return { error: null };
    } catch (err: any) {
      return { error: err.response?.data?.error ? new Error(err.response.data.error) : err };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const response = await authApi.register({ email, password, fullName });
      setUser(response.user);
      return { error: null };
    } catch (err: any) {
      return { error: err.response?.data?.error ? new Error(err.response.data.error) : err };
    }
  };

  const signOut = async () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isSuperadmin, trialActive, trialDaysLeft, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
