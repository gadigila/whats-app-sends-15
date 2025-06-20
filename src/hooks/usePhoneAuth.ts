
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface PhoneAuthResult {
  success: boolean;
  code_required?: boolean;
  message: string;
  phone?: string;
  error?: string;
}

export const usePhoneAuth = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const authenticateWithPhone = useMutation({
    mutationFn: async (phoneNumber: string): Promise<PhoneAuthResult> => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('📱 Starting phone authentication for:', phoneNumber);
      
      try {
        const { data, error } = await supabase.functions.invoke('whapi-phone-auth', {
          body: { 
            userId: user.id, 
            phoneNumber: phoneNumber 
          }
        });
        
        if (error) {
          console.error('🚨 Phone auth error:', error);
          throw error;
        }
        
        console.log('📱 Phone auth result:', data);
        return data;
      } catch (err) {
        console.error('🚨 Phone auth call failed:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log('Phone authentication result:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      if (data.success && !data.code_required) {
        toast({
          title: "התחברות הצליחה!",
          description: "הוואטסאפ שלך מחובר בהצלחה דרך הטלפון",
        });
      } else if (data.code_required) {
        toast({
          title: "קוד אימות נשלח",
          description: "בדוק את הטלפון שלך וזין את הקוד",
        });
      }
    },
    onError: (error: any) => {
      console.error('Failed phone authentication:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      
      if (error.message) {
        if (error.message.includes('No WhatsApp instance')) {
          errorMessage = "לא נמצא חיבור וואטסאפ. צור חיבור חדש תחילה";
        } else if (error.message.includes('Phone authentication failed')) {
          errorMessage = "מספר הטלפון שגוי או לא רשום בוואטסאפ";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "שגיאה באימות בטלפון",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  return {
    authenticateWithPhone,
    isAuthenticating: authenticateWithPhone.isPending
  };
};
