
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhapiWebhook = () => {
  const { user } = useAuth();

  // Fix webhook for existing channel
  const fixWebhook = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔧 Fixing webhook for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-fix-webhook', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Webhook fix result:', data);
      toast({
        title: "Webhook תוקן!",
        description: "ה-Webhook הוגדר בהצלחה לערוץ הקיים",
      });
    },
    onError: (error: any) => {
      console.error('❌ Webhook fix failed:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      
      if (error.message?.includes('Invalid token')) {
        errorMessage = "הטוקן לא תקין. צור חיבור חדש";
      } else if (error.message?.includes('No WhatsApp instance')) {
        errorMessage = "לא נמצא ערוץ וואטסאפ";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "שגיאה בתיקון Webhook",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Validate webhook configuration
  const validateWebhook = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔍 Validating webhook for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-validate-webhook', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('🔍 Webhook validation result:', data);
      
      if (data.webhook_valid) {
        toast({
          title: "Webhook תקין",
          description: "ה-Webhook מוגדר נכון ופעיל",
        });
      } else {
        toast({
          title: "Webhook לא מוגדר",
          description: "ה-Webhook לא מוגדר או שגוי. השתמש בכפתור התיקון",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Webhook validation failed:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      
      if (error.message?.includes('Invalid token')) {
        errorMessage = "הטוקן לא תקין. צור חיבור חדש";
      } else if (error.message?.includes('No WhatsApp instance')) {
        errorMessage = "לא נמצא ערוץ וואטסאפ";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "שגיאה בבדיקת Webhook",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  return {
    fixWebhook,
    validateWebhook,
    isFixing: fixWebhook.isPending,
    isValidating: validateWebhook.isPending
  };
};
