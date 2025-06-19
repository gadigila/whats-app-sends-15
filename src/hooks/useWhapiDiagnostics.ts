
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DiagnosticsResult {
  timestamp: string
  userId: string
  database: any
  whapi: any
  endpoints: any
  recommendations: string[]
}

export const useWhapiDiagnostics = () => {
  const { user } = useAuth();

  const runDiagnostics = useMutation({
    mutationFn: async (): Promise<DiagnosticsResult> => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔬 Running WHAPI diagnostics for user:', user.id);
      
      try {
        const { data, error } = await supabase.functions.invoke('whapi-diagnostics', {
          body: { userId: user.id }
        });

        if (error) {
          console.error('🚨 Supabase function error:', error);
          throw error;
        }

        if (!data) {
          console.error('🚨 No data returned from diagnostics function');
          throw new Error('No data returned from function');
        }

        console.log('📊 Diagnostics result:', data);
        return data;
      } catch (err) {
        console.error('🚨 Diagnostics call failed:', err);
        throw err;
      }
    }
  });

  return {
    runDiagnostics,
    isRunning: runDiagnostics.isPending
  };
};
