
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppInstance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create WhatsApp instance using Partner API
  const createInstance = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Creating WhatsApp instance for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-partner-login', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('WhatsApp instance created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({
        title: "אינסטנס נוצר בהצלחה",
        description: "כעת תוכל להתחבר לוואטסאפ",
      });
    },
    onError: (error: any) => {
      console.error('Failed to create WhatsApp instance:', error);
      toast({
        title: "שגיאה ביצירת אינסטנס",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Get QR code using Partner API
  const getQrCode = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Getting QR code for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-get-qr', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onError: (error: any) => {
      console.error('Failed to get QR code:', error);
      toast({
        title: "שגיאה בקבלת קוד QR",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Check instance status using Partner API
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
    }
  });

  // Delete instance - now includes WHAPI deletion
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
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast({
        title: "אינסטנס נמחק",
        description: "החיבור לוואטסאפ נותק",
      });
    },
    onError: (error: any) => {
      console.error('Failed to delete instance:', error);
      toast({
        title: "שגיאה במחיקת אינסטנס",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  return {
    createInstance,
    getQrCode,
    checkInstanceStatus,
    deleteInstance
  };
};
