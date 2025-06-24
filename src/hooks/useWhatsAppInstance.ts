import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppInstance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create channel
  const createChannel = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚀 Creating WhatsApp channel...');
      
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
        description: "כעת ניתן לקבל קוד QR",
      });
    },
    onError: (error: any) => {
      console.error('❌ Channel creation failed:', error);
      toast({
        title: "שגיאה ביצירת ערוץ",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Get QR code
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
      console.log('✅ QR response:', data);
      
      if (data.already_connected) {
        queryClient.invalidateQueries({ queryKey: ['user-profile'] });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        toast({
          title: "כבר מחובר!",
          description: `הוואטסאפ ${data.phone} כבר מחובר`,
        });
      } else if (data.qr_code) {
        toast({
          title: "קוד QR מוכן",
          description: "סרוק את הקוד עם הוואטסאפ שלך",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ QR failed:', error);
      toast({
        title: "שגיאה בקבלת קוד QR",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Check instance status (enhanced)
  const checkInstanceStatus = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔍 Checking WhatsApp status...');
      
      const { data, error } = await supabase.functions.invoke('whapi-check-status', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('📊 Status check result:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      if (data.connected && data.changed) {
        toast({
          title: "מחובר בהצלחה! 🎉",
          description: `הוואטסאפ ${data.phone} מחובר ומוכן לשימוש`,
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Status check failed:', error);
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

  // NEW: Start aggressive polling
  const startConnectionPolling = (onConnected: () => void) => {
    console.log('🔄 Starting AGGRESSIVE connection polling...');
    
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes total
    
    const pollInterval = setInterval(async () => {
      attempts++;
      console.log(`🔍 Connection poll attempt ${attempts}/${maxAttempts}`);
      
      try {
        const result = await checkInstanceStatus.mutateAsync();
        
        if (result.connected) {
          console.log('✅ CONNECTION DETECTED! Stopping polling.');
          clearInterval(pollInterval);
          onConnected();
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.log('⏰ Polling timeout reached');
          clearInterval(pollInterval);
          toast({
            title: "זמן המתנה פג",
            description: "לא זוהה חיבור. נסה לרענן את קוד ה-QR",
            variant: "destructive",
          });
        }
        
      } catch (error) {
        console.log(`⚠️ Poll attempt ${attempts} failed:`, error);
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
        }
      }
    }, 3000); // Check every 3 seconds
    
    // Return cleanup function
    return () => {
      console.log('🛑 Stopping connection polling');
      clearInterval(pollInterval);
    };
  };

  return {
    createChannel,
    getQRCode,
    checkInstanceStatus,
    deleteInstance,
    startConnectionPolling,
    isCreatingChannel: createChannel.isPending,
    isGettingQR: getQRCode.isPending,
    isCheckingStatus: checkInstanceStatus.isPending
  };
};