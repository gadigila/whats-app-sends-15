
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface RecoveryResult {
  success: boolean
  qr_code?: string
  message: string
  instance_id?: string
  recovery_steps: string[]
  error?: string
  retry_after?: number
}

export const useWhapiRecovery = () => {
  const { user } = useAuth();

  const runRecovery = useMutation({
    mutationFn: async (forceNew: boolean = false): Promise<RecoveryResult> => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚑 Running WHAPI auto recovery for user:', user.id, 'forceNew:', forceNew);
      
      try {
        const { data, error } = await supabase.functions.invoke('whapi-auto-recovery', {
          body: { 
            userId: user.id, 
            forceNewInstance: forceNew 
          }
        });

        if (error) {
          console.error('🚨 Recovery function error:', error);
          throw error;
        }

        if (!data) {
          console.error('🚨 No data returned from recovery function');
          throw new Error('No data returned from function');
        }

        console.log('🔧 Recovery result:', data);
        return data;
      } catch (err) {
        console.error('🚨 Recovery call failed:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log('✅ Recovery completed:', data.recovery_steps);
      
      if (data.qr_code) {
        toast({
          title: "QR Code Ready!",
          description: "Scan with WhatsApp to connect",
        });
      } else if (data.success && data.message.includes('already connected')) {
        toast({
          title: "Already Connected",
          description: "WhatsApp is already connected",
        });
      } else if (data.retry_after) {
        toast({
          title: "Initializing...",
          description: `Please wait ${data.retry_after} seconds`,
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Recovery failed:', error);
      toast({
        title: "Recovery Failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    }
  });

  const forceNewInstance = useMutation({
    mutationFn: async (): Promise<RecoveryResult> => {
      return runRecovery.mutateAsync(true);
    }
  });

  return {
    runRecovery,
    forceNewInstance,
    isLoading: runRecovery.isPending || forceNewInstance.isPending
  };
};
