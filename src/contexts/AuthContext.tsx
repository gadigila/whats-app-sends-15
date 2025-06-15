
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
  signInWithGoogle: () => Promise<void>;
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
    console.log('Setting up auth state listener...');
    
    // Check for existing session first
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check:', session?.user?.email || 'no session');
        
        if (session?.user) {
          await loadUserProfile(session.user);
        }
      } catch (error) {
        console.error('Error checking initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'no session');
        
        if (session?.user) {
          console.log('User authenticated, loading profile...');
          await loadUserProfile(session.user);
        } else {
          console.log('No session, clearing user');
          setUser(null);
        }
        setLoading(false);
      }
    );

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log('Attempting login...');
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        throw error;
      }

      console.log('Login successful');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    console.log('Attempting signup...');
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
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

      console.log('Signup successful');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    console.log('Attempting Google sign in...');
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        console.error('Google sign in error:', error);
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const loadUserProfile = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('Loading profile for user:', supabaseUser.id);
      
      // First check if profile exists
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        // Still set basic user info even if profile fetch fails
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
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
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: newProfile?.name || supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
          trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          isPaid: false,
          whatsappConnected: false,
          billingStatus: 'trial'
        });
      } else {
        console.log('Profile loaded successfully:', profile);
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profile.name || supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
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
      // Set basic user info even if there's an error
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        isPaid: false,
        whatsappConnected: false,
        billingStatus: 'trial'
      });
    }
  };

  const logout = async () => {
    console.log('Logging out...');
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error logging out:', error);
      }
    } finally {
      setUser(null);
      setLoading(false);
    }
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
      signInWithGoogle,
      logout,
      loading,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
