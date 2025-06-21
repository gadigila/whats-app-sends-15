
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppSimple = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create channel with 90-second wait
  const createChannel = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚀 Creating WhatsApp channel (will take 90 seconds)...');
      
      const { data, error } = await supabase.functions.invoke('whapi-create-channel', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Channel created:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      toast({
        title: "ערוץ נוצר בהצלחה",
        description: "כעת תוכל לקבל קוד QR",
      });
    },
    onError: (error: any) => {
      console.error('❌ Channel creation failed:', error);
      toast({
        title: "שגיאה ביצירת ערוץ",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Get QR code with retry logic
  const getQRCode = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔲 Getting QR code...');
      
      const { data, error } = await supabase.functions.invoke('whapi-get-qr-simple', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ QR code received:', { hasQR: !!data.qr_code, alreadyConnected: data.already_connected });
      
      if (data.already_connected) {
        queryClient.invalidateQueries({ queryKey: ['user-profile'] });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        
        toast({
          title: "כבר מחובר!",
          description: "הוואטסאפ שלך כבר מחובר ומוכן לשימוש",
        });
      } else if (data.qr_code) {
        toast({
          title: "קוד QR מוכן",
          description: "סרוק את הקוד עם הוואטסאפ שלך",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ QR code failed:', error);
      toast({
        title: "שגיאה בקבלת קוד QR",
        description: error.message || "נסה שוב בעוד כמה שניות",
        variant: "destructive",
      });
    }
  });

  return {
    createChannel,
    getQRCode,
    isCreatingChannel: createChannel.isPending,
    isGettingQR: getQRCode.isPending
  };
};
