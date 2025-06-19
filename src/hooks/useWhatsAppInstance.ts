
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppInstance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check instance status
  const checkInstanceStatus = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await supabase.functions.invoke('whapi-check-status', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('Instance status:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    }
  });

  // Delete instance
  const deleteInstance = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Deleting WhatsApp instance for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-delete-instance', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      console.log('Instance deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast({
        title: "נותק בהצלחה",
        description: "החיבור לוואטסאפ נותק",
      });
    },
    onError: (error: any) => {
      console.error('Failed to delete instance:', error);
      toast({
        title: "שגיאה בניתוק",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Legacy compatibility methods (deprecated but kept for backward compatibility)
  const getQrCode = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await supabase.functions.invoke('whapi-get-qr', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    }
  });

  const manualStatusSync = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await supabase.functions.invoke('whapi-manual-status-sync', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    }
  });

  return {
    checkInstanceStatus,
    deleteInstance,
    getQrCode,
    manualStatusSync
  };
};
