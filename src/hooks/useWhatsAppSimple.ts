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

  // Get QR code with enhanced response handling
  const getQRCode = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔲 Getting QR code...');
      
      const { data, error } = await supabase.functions.invoke('whapi-get-qr-simple', {
        body: { userId: user.id }
      });
      
      if (error) {
        console.error('❌ Supabase function error:', error);
        throw error;
      }
      
      if (data?.error) {
        console.error('❌ Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      // Enhanced debugging of response data
      console.log('📤 Full QR response:', JSON.stringify(data, null, 2));
      
      // Check all possible QR field names
      const qrCode = data.qr_code || data.qr_code_url || data.base64 || data.qr || data.image;
      const qrCodeUrl = data.qr_code_url || data.qr_code || data.base64 || data.qr || data.image;
      
      console.log('🔍 QR field analysis:', {
        hasQrCode: !!data.qr_code,
        hasQrCodeUrl: !!data.qr_code_url,
        hasBase64: !!data.base64,
        hasQr: !!data.qr,
        hasImage: !!data.image,
        finalQrCode: !!qrCode,
        finalQrCodeUrl: !!qrCodeUrl,
        alreadyConnected: data.already_connected
      });
      
      // Return enhanced data with multiple field options
      return {
        ...data,
        qr_code: qrCode,
        qr_code_url: qrCodeUrl,
        // Add debug info
        _debug: {
          originalResponse: data,
          detectedQrField: qrCode ? 'found' : 'not_found',
          availableFields: Object.keys(data)
        }
      };
    },
    onSuccess: (data) => {
      // Enhanced logging
      const qrCode = data.qr_code || data.qr_code_url || data.base64 || data.qr || data.image;
      
      console.log('✅ QR mutation success:', {
        hasQrCode: !!qrCode,
        hasQrCodeUrl: !!data.qr_code_url,
        alreadyConnected: data.already_connected,
        responseKeys: Object.keys(data),
        debugInfo: data._debug
      });
      
      if (data.already_connected) {
        queryClient.invalidateQueries({ queryKey: ['user-profile'] });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        
        toast({
          title: "כבר מחובר!",
          description: `הוואטסאפ שלך כבר מחובר: ${data.phone || 'מספר לא זמין'}`,
        });
      } else if (qrCode) {
        toast({
          title: "קוד QR מוכן",
          description: "סרוק את הקוד עם הוואטסאפ שלך",
        });
      } else {
        console.warn('⚠️ No QR code found in successful response');
        toast({
          title: "שגיאה",
          description: "לא התקבל קוד QR מהשרת",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ QR code failed:', error);
      
      // Enhanced error handling
      let errorMessage = error.message || "שגיאה לא ידועה";
      let description = "נסה שוב בעוד כמה שניות";
      
      if (errorMessage.includes('still initializing')) {
        description = "הערוץ עדיין נטען, נסה שוב בעוד 30 שניות";
      } else if (errorMessage.includes('Token invalid')) {
        description = "יש ליצור ערוץ חדש";
      } else if (errorMessage.includes('timeout')) {
        description = "פג זמן הבקשה, נסה שוב";
      }
      
      toast({
        title: "שגיאה בקבלת קוד QR",
        description: description,
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