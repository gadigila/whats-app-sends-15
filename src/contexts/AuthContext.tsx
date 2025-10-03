
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  isAuthReady: boolean; // New flag to indicate auth is ready
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
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    console.log('🔐 AuthProvider: Initializing auth...');
    
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state change:', event, session?.user?.email || 'no user');
        
        if (session?.user) {
          const newUser = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || session.user.email!.split('@')[0]
          };
          console.log('🔐 Setting user:', newUser.email);
          setUser(newUser);
        } else {
          console.log('🔐 Clearing user');
          setUser(null);
        }
        
        setLoading(false);
        setIsAuthReady(true);
      }
    );

    // Check for existing session
    const initializeAuth = async () => {
      try {
        console.log('🔐 Checking for existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('🔐 Found existing session for:', session.user.email);
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || session.user.email!.split('@')[0]
          });
        } else {
          console.log('🔐 No existing session found');
        }
      } catch (error) {
        console.error('🔐 Error checking initial session:', error);
      } finally {
        setLoading(false);
        setIsAuthReady(true);
      }
    };

    initializeAuth();

    return () => {
      console.log('🔐 Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log('🔐 Login attempt for:', email);
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('🔐 Login error:', error);
        throw error;
      }
      
      console.log('🔐 Login successful for:', email);
      // Don't set loading to false here - let onAuthStateChange handle it
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    console.log('🔐 Signup attempt for:', email);
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
        console.error('🔐 Signup error:', error);
        throw error;
      }
      
      console.log('🔐 Signup successful for:', email);
      
      // Check if email confirmation is required
      const needsEmailConfirmation = !data.session && data.user;
      
      if (needsEmailConfirmation) {
        console.log('🔐 Email confirmation required');
        setLoading(false);
        return { needsEmailConfirmation: true };
      }
      
      // Don't set loading to false here if session exists - let onAuthStateChange handle it
      return { needsEmailConfirmation: false };
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    console.log('🔐 Google signin attempt');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        console.error('🔐 Google signin error:', error);
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    console.log('🔐 Logout attempt');
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('🔐 Logout error:', error);
      }
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  // Alias for backward compatibility
  const signOut = logout;

  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      signInWithGoogle,
      logout,
      signOut,
      loading,
      isAuthReady,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
