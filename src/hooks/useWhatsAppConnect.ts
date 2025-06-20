
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppConnect = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get QR code for existing channel
  const connectWhatsApp = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔄 Getting QR code for existing channel:', user.id);
      
      try {
        const { data, error } = await supabase.functions.invoke('whapi-get-qr', {
          body: { userId: user.id }
        });
        
        if (error) {
          console.error('🚨 Supabase function error:', error);
          throw error;
        }
        
        if (!data) {
          console.error('🚨 No data returned from get QR');
          throw new Error('No data returned from function');
        }
        
        console.log('✅ QR code result:', data);
        return data;
      } catch (err) {
        console.error('🚨 QR code call failed:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log('QR code retrieved successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      if (data.already_connected) {
        toast({
          title: "כבר מחובר!",
          description: "הוואטסאפ שלך כבר מחובר ומוכן לשימוש",
        });
      } else if (data.qr_code) {
        toast({
          title: "קוד QR מוכן",
          description: "סרוק את הקוד כדי להתחבר",
        });
      }
    },
    onError: (error: any) => {
      console.error('Failed to get QR code:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      
      if (error.message) {
        if (error.message.includes('No WhatsApp instance')) {
          errorMessage = "לא נמצא חיבור וואטסאפ. צור חיבור חדש תחילה";
        } else if (error.message.includes('Failed to get QR')) {
          errorMessage = "שגיאה בקבלת קוד QR";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "שגיאה בקבלת קוד QR",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Check connection status
  const checkStatus = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔍 Checking WhatsApp status for user:', user.id);
      
      try {
        const { data, error } = await supabase.functions.invoke('whapi-check-status', {
          body: { userId: user.id }
        });
        
        if (error) {
          console.error('🚨 Status check error:', error);
          throw error;
        }
        
        console.log('📊 Status check result:', data);
        return data;
      } catch (err) {
        console.error('🚨 Status check call failed:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log('Status check result:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    }
  });

  return {
    connectWhatsApp,
    checkStatus,
    isConnecting: connectWhatsApp.isPending
  };
};
