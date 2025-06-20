
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppConnect = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Enhanced QR code retrieval with automatic cleanup
  const connectWhatsApp = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔄 Getting QR code with automatic cleanup:', user.id);
      
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
        
        console.log('✅ Enhanced QR result:', data);
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
      
      if (data.token_cleaned) {
        toast({
          title: "טוקן נוקה",
          description: "הטוקן הישן היה לא תקין ונוקה. צור ערוץ חדש",
          variant: "destructive",
        });
      } else if (data.already_connected) {
        toast({
          title: "כבר מחובר!",
          description: "הוואטסאפ שלך כבר מחובר ומוכן לשימוש",
        });
      } else if (data.qr_code) {
        toast({
          title: "קוד QR מוכן",
          description: "סרוק את הקוד כדי להתחבר",
        });
      } else if (data.retry_after) {
        toast({
          title: "הערוץ עדיין מתכונן",
          description: `נסה שוב בעוד ${Math.round(data.retry_after / 1000)} שניות`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Failed to get QR code:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      
      if (error.message) {
        if (error.message.includes('No WhatsApp instance')) {
          errorMessage = "לא נמצא חיבור וואטסאפ. צור חיבור חדש תחילה";
        } else if (error.message.includes('still be initializing')) {
          errorMessage = "הערוץ עדיין מתכונן. נסה שוב בעוד כמה שניות";
        } else if (error.message.includes('timeout')) {
          errorMessage = "פג הזמן הקצוב. נסה ליצור חיבור חדש";
        } else if (error.message.includes('Token invalid')) {
          errorMessage = "הטוקן לא תקין. צור חיבור חדש";
          queryClient.invalidateQueries({ queryKey: ['user-profile'] });
          queryClient.invalidateQueries({ queryKey: ['userProfile'] });
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

  // Enhanced status checking
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
      
      // Provide user feedback based on status
      if (data.status === 'connected') {
        toast({
          title: "מחובר בהצלחה!",
          description: "הוואטסאפ שלך מחובר ומוכן לשימוש",
        });
      } else if (data.status === 'initializing') {
        toast({
          title: "מכין חיבור",
          description: "הערוץ עדיין מתכונן, נסה שוב בעוד רגע",
        });
      }
    }
  });

  return {
    connectWhatsApp,
    checkStatus,
    isConnecting: connectWhatsApp.isPending
  };
};
