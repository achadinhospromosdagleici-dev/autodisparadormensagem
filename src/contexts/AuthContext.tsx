import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  trial_started_at: string;
  trial_ends_at: string;
  notes: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isSuperadmin: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = async (userId: string) => {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        (supabase as any).from('profiles').select('*').eq('id', userId).maybeSingle(),
        (supabase as any).from('user_roles').select('role').eq('user_id', userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data as UserProfile);
      const roles = (rolesRes.data || []) as Array<{ role: string }>;
      setIsSuperadmin(roles.some(r => r.role === 'superadmin'));
    } catch (err) {
      console.error('[Auth] Error loading profile/role:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Setup listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer to avoid deadlock
        setTimeout(() => fetchProfileAndRole(session.user.id), 0);
      } else {
        setProfile(null);
        setIsSuperadmin(false);
        setLoading(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsSuperadmin(false);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileAndRole(user.id);
  };

  // Trial computation
  const trialEndsMs = profile ? new Date(profile.trial_ends_at).getTime() : 0;
  const trialDaysLeft = profile ? Math.max(0, Math.ceil((trialEndsMs - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const trialActive = isSuperadmin || (!!profile && profile.is_active && trialEndsMs > Date.now());

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isSuperadmin,
        trialActive,
        trialDaysLeft,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
