
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  trialEndsAt: Date;
  isPaid: boolean;
  whatsappConnected: boolean;
  instanceId?: string;
  instanceStatus?: string;
  billingStatus?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (supabaseUser: SupabaseUser) => {
    try {
      // Get or create user profile - use raw query to access new columns
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Create profile if it doesn't exist
      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: supabaseUser.id,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
            trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            billing_status: 'trial'
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: newProfile.name || supabaseUser.email!.split('@')[0],
          trialEndsAt: new Date(newProfile.trial_ends_at!),
          isPaid: newProfile.plan === 'paid',
          whatsappConnected: (newProfile as any).instance_status === 'connected',
          instanceId: (newProfile as any).instance_id,
          instanceStatus: (newProfile as any).instance_status,
          billingStatus: (newProfile as any).billing_status
        });
      } else {
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profile.name || supabaseUser.email!.split('@')[0],
          trialEndsAt: new Date(profile.trial_ends_at!),
          isPaid: profile.plan === 'paid',
          whatsappConnected: (profile as any).instance_status === 'connected',
          instanceId: (profile as any).instance_id,
          instanceStatus: (profile as any).instance_status,
          billingStatus: (profile as any).billing_status
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });

    if (error) {
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    }
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      
      // If the update is for WhatsApp connection, refresh the profile
      if ('whatsappConnected' in updates) {
        setTimeout(() => {
          checkSession();
        }, 1000);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      logout,
      loading,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
