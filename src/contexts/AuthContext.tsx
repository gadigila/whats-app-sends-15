
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
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Check initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          if (session?.user) {
            console.log('Found existing session, loading profile...');
            await loadUserProfile(session.user);
          } else {
            console.log('No existing session found');
            setUser(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (mounted) {
        if (session?.user && event === 'SIGNED_IN') {
          console.log('User signed in, loading profile...');
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setUser(null);
        }
        setLoading(false);
      }
    });

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('Loading profile for user:', supabaseUser.id);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        // Set fallback user even on error
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: supabaseUser.email!.split('@')[0],
          trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          isPaid: false,
          whatsappConnected: false,
          billingStatus: 'trial'
        });
        return;
      }

      if (!profile) {
        console.log('No profile found, creating new profile...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: supabaseUser.id,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'משתמש חדש',
            trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            billing_status: 'trial',
            instance_status: 'disconnected'
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          // Set fallback user even on error
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.email!.split('@')[0],
            trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            isPaid: false,
            whatsappConnected: false,
            billingStatus: 'trial'
          });
          return;
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: newProfile.name || supabaseUser.email!.split('@')[0],
          trialEndsAt: new Date(newProfile.trial_ends_at!),
          isPaid: newProfile.plan === 'paid',
          whatsappConnected: newProfile.instance_status === 'connected',
          instanceId: newProfile.instance_id,
          instanceStatus: newProfile.instance_status,
          billingStatus: newProfile.billing_status
        });
      } else {
        console.log('Profile loaded successfully');
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profile.name || supabaseUser.email!.split('@')[0],
          trialEndsAt: new Date(profile.trial_ends_at!),
          isPaid: profile.plan === 'paid',
          whatsappConnected: profile.instance_status === 'connected',
          instanceId: profile.instance_id,
          instanceStatus: profile.instance_status,
          billingStatus: profile.billing_status
        });
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      // Always set a fallback user to prevent loading loop
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: supabaseUser.email!.split('@')[0],
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        isPaid: false,
        whatsappConnected: false,
        billingStatus: 'trial'
      });
    }
  };

  const login = async (email: string, password: string) => {
    console.log('Attempting login...');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    console.log('Attempting signup...');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    console.log('Logging out...');
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
    }
  };

  console.log('Auth state - Loading:', loading, 'User:', user?.email || 'none');

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
