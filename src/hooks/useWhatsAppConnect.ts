
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppConnect = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Unified connection flow - handles everything automatically
  const connectWhatsApp = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔄 Starting WhatsApp connection for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-unified-connect', {
        body: { userId: user.id }
      });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      console.log('✅ Connection flow result:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('WhatsApp connection successful:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      if (data.already_connected) {
        toast({
          title: "כבר מחובר!",
          description: "הוואטסאפ שלך כבר מחובר ומוכן לשימוש",
        });
      } else if (data.qr_code) {
        toast({
          title: "מוכן לחיבור",
          description: "סרוק את קוד ה-QR כדי להתחבר",
        });
      }
    },
    onError: (error: any) => {
      console.error('Failed to connect WhatsApp:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      
      if (error.message) {
        if (error.message.includes('Failed to create')) {
          errorMessage = "שגיאה ביצירת חיבור חדש";
        } else if (error.message.includes('Failed to get QR')) {
          errorMessage = "שגיאה בקבלת קוד QR";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "שגיאה בחיבור לוואטסאפ",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Check connection status
  const checkStatus = useMutation({
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
