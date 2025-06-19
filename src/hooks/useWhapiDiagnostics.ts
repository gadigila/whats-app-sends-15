
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
      
      console.log('🔬 Running WHAPI diagnostics...');
      
      const { data, error } = await supabase.functions.invoke('whapi-diagnostics', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Diagnostics error:', error);
        throw error;
      }

      console.log('📊 Diagnostics result:', data);
      return data;
    }
  });

  return {
    runDiagnostics,
    isRunning: runDiagnostics.isPending
  };
};
