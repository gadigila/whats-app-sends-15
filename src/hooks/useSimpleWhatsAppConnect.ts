
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useSimpleWhatsAppConnect = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connect = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚀 Simple WhatsApp Connect');
      
      const { data, error } = await supabase.functions.invoke('whapi-simple-connect', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (!data) throw new Error('No data returned');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      if (data.already_connected) {
        toast({
          title: "כבר מחובר!",
          description: `מחובר למספר ${data.phone}`,
        });
      } else if (data.qr_code) {
        toast({
          title: "סרוק את הקוד",
          description: "השתמש באפליקציית WhatsApp לסריקה",
        });
      }
    },
    onError: (error: any) => {
      console.error('Connection failed:', error);
      toast({
        title: "שגיאה בחיבור",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔌 Simple WhatsApp Disconnect');
      
      const { data, error } = await supabase.functions.invoke('whapi-simple-disconnect', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast({
        title: "נותק בהצלחה",
        description: "WhatsApp נותק מהמערכת",
      });
    },
    onError: (error: any) => {
      console.error('Disconnect failed:', error);
      toast({
        title: "שגיאה בניתוק",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  return {
    connect,
    disconnect,
    isConnecting: connect.isPending,
    isDisconnecting: disconnect.isPending
  };
};
