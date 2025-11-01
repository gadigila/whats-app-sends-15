import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface RepairResult {
  success: boolean;
  message: string;
  channelId?: string;
  oldId?: string;
  upgraded?: boolean;
  alreadyValid?: boolean;
  error?: string;
}

export const useWhapiRepair = () => {
  const { user } = useAuth();

  const repairChannel = useMutation({
    mutationFn: async (): Promise<RepairResult> => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔧 Starting channel repair for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('repair-whapi-channel', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('🚨 Repair function error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from function');
      }

      console.log('✅ Repair result:', data);
      return data;
    },
    onSuccess: (data) => {
      if (data.alreadyValid) {
        toast({
          title: "Already Valid",
          description: "Your channel ID is already correct!",
        });
      } else if (data.upgraded) {
        toast({
          title: "Channel Repaired & Upgraded!",
          description: `Fixed ID and upgraded to live mode`,
        });
      } else {
        toast({
          title: "Channel ID Repaired",
          description: "Your channel ID has been fixed",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Repair failed:', error);
      toast({
        title: "Repair Failed",
        description: error.message || "Could not repair channel",
        variant: "destructive",
      });
    }
  });

  return {
    repairChannel,
    isRepairing: repairChannel.isPending
  };
};
