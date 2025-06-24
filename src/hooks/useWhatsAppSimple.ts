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
        description: "כעת מחכה לקוד QR",
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

  // Get QR code with FIXED response handling
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
      
      // FIXED: Enhanced debugging of response data
      console.log('📤 Raw QR response from backend:', JSON.stringify(data, null, 2));
      
      // FIXED: Parse stringified JSON response
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
          console.log('✅ Successfully parsed JSON string response');
        } catch (e) {
          console.log('⚠️ Data is string but not valid JSON, treating as raw data');
          parsedData = data;
        }
      }
      
      let qrCode = null;
      let qrCodeUrl = null;
      
      // Check if parsedData itself is the QR string
      if (typeof parsedData === 'string' && parsedData.startsWith('data:image')) {
        qrCode = parsedData;
        qrCodeUrl = parsedData;
        console.log('✅ Found QR as direct string response');
      }
      // Check if parsedData has qr_code field
      else if (parsedData?.qr_code) {
        qrCode = parsedData.qr_code;
        qrCodeUrl = parsedData.qr_code;
        console.log('✅ Found QR in qr_code field');
      }
      // Check other possible fields
      else if (parsedData?.qr_code_url) {
        qrCode = parsedData.qr_code_url;
        qrCodeUrl = parsedData.qr_code_url;
        console.log('✅ Found QR in qr_code_url field');
      }
      else if (parsedData?.base64) {
        qrCode = parsedData.base64;
        qrCodeUrl = parsedData.base64;
        console.log('✅ Found QR in base64 field');
      }
      
      console.log('🔍 FINAL QR detection:', {
        dataType: typeof data,
        dataKeys: typeof parsedData === 'object' ? Object.keys(parsedData || {}) : 'not object',
        foundQrCode: !!qrCode,
        qrLength: qrCode?.length || 0,
        dataPreview: typeof data === 'string' ? data.substring(0, 100) + '...' : 'not string',
        parsedDataType: typeof parsedData
      });
      
      // Return enhanced data with guaranteed QR fields
      return {
        success: !!qrCode,
        qr_code: qrCode,
        qr_code_url: qrCodeUrl,
        already_connected: parsedData?.already_connected || false,
        // Preserve original response for debugging
        _original: data,
        _parsed: parsedData,
        _debug: {
          detectedQrField: qrCode ? 'found' : 'not_found',
          dataType: typeof data,
          parsedDataType: typeof parsedData,
          responseKeys: typeof parsedData === 'object' ? Object.keys(parsedData || {}) : []
        }
      };
    },
    onSuccess: (data) => {
      // Enhanced logging
      console.log('✅ QR mutation success:', {
        success: data.success,
        hasQrCode: !!data.qr_code,
        hasQrCodeUrl: !!data.qr_code_url,
        alreadyConnected: data.already_connected,
        debugInfo: data._debug
      });
      
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