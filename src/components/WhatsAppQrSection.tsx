
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppQrSectionProps {
  userId: string;
  onConnected: () => void;
}

const WhatsAppQrSection = ({ userId, onConnected }: WhatsAppQrSectionProps) => {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Get QR code on mount
  useEffect(() => {
    getQrCode();
    // eslint-disable-next-line
  }, []);

  const getQrCode = async () => {
    console.log('🔄 Starting QR code request for user:', userId);
    console.log('📋 Current Supabase URL:', 'https://ifxvwettmgixfbivlzzl.supabase.co');
    
    setLoading(true);
    setErrorMsg(null);
    setQrCode(null);
    
    try {
      console.log('📡 Calling whatsapp-connect function with action: get_qr');
      console.log('📡 Function URL should be:', 'https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/whatsapp-connect');
      
      const requestBody = { userId, action: 'get_qr' };
      console.log('📤 Request body:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: requestBody
      });
      
      console.log('📥 Raw response received:', { data, error });
      console.log('📥 Response data type:', typeof data);
      console.log('📥 Response error type:', typeof error);
      
      if (error) {
        console.error('❌ Supabase function invoke error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      if (data?.error) {
        console.error('❌ Function returned error:', data.error);
        console.error('❌ Full error response:', JSON.stringify(data, null, 2));
        throw new Error(data.error);
      }

      console.log('✅ Function success response:', JSON.stringify(data, null, 2));

      if (data?.success && data.qr_code) {
        console.log('🎯 QR code received successfully, length:', data.qr_code.length);
        console.log('🎯 QR code starts with:', data.qr_code.substring(0, 50));
        setQrCode(data.qr_code);
        setPolling(true);
        toast({
          title: "קוד QR מוכן!",
          description: "סרוק את הקוד עם הוואטסאפ שלך.",
        });
      } else {
        console.error('❌ No QR code in response or success=false');
        console.error('❌ Response structure:', {
          hasSuccess: 'success' in data,
          successValue: data?.success,
          hasQrCode: 'qr_code' in data,
          qrCodeValue: data?.qr_code ? 'EXISTS' : 'MISSING'
        });
        throw new Error(data?.error || 'QR לא התקבל מהשרת');
      }
    } catch (err: any) {
      console.error('💥 QR code request failed completely:', err);
      console.error('💥 Error name:', err.name);
      console.error('💥 Error message:', err.message);
      console.error('💥 Error stack:', err.stack);
      
      let errorMessage = 'שגיאה בקבלת קוד QR: ';
      if (err.message) {
        errorMessage += err.message;
      } else if (typeof err === 'string') {
        errorMessage += err;
      } else {
        errorMessage += 'שגיאה לא ידועה';
      }
      
      setErrorMsg(errorMessage);
      setQrCode(null);
      toast({
        title: "שגיאה בקבלת QR",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Poll for connection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (polling) {
      console.log('🔄 Starting connection polling every 3 seconds');
      interval = setInterval(async () => {
        try {
          console.log('📡 Checking connection status...');
          const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
            body: { userId, action: 'check_status' }
          });
          
          console.log('📥 Status check response:', { data, error });
          
          if (error) {
            console.error('❌ Status check error:', error);
            return;
          }
          
          if (data?.connected) {
            console.log('🎉 WhatsApp connected successfully!');
            setPolling(false);
            setQrCode(null);
            onConnected();
            toast({
              title: "וואטסאפ מחובר!",
              description: "החיבור בוצע בהצלחה.",
            });
          } else {
            console.log('⏳ Still waiting for connection...');
          }
        } catch (err) {
          console.error('💥 Status check failed:', err);
        }
      }, 3000);
    }
    return () => {
      if (interval) {
        console.log('🛑 Stopping connection polling');
        clearInterval(interval);
      }
    };
  }, [polling, userId, onConnected]);

  if (errorMsg) {
    return (
      <div className="text-center space-y-4">
        <div className="text-red-600 font-bold mb-4">שגיאה: {errorMsg}</div>
        <div className="text-sm text-gray-600 bg-red-50 p-4 rounded-lg border border-red-200">
          <strong>פרטי שגיאה לבדיקה:</strong><br />
          <div className="mt-2 space-y-1 text-xs font-mono">
            <div>משתמש: {userId}</div>
            <div>זמן: {new Date().toLocaleString('he-IL')}</div>
            <div>URL: https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/whatsapp-connect</div>
          </div>
        </div>
        <Button onClick={getQrCode} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          נסה שוב
        </Button>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="text-gray-700">טוען קוד QR...</span>
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          משתמש: {userId}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
      <div className="p-4 bg-gray-50 rounded-2xl w-fit mx-auto">
        <img
          src={qrCode}
          alt="WhatsApp QR Code"
          className="w-64 h-64 mx-auto"
          onError={(e) => {
            console.error('🖼️ QR image failed to load:', e);
            setErrorMsg('שגיאה בטעינת תמונת QR');
          }}
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">סרוק קוד QR</h2>
        <p className="text-sm text-gray-600">
          פתח את וואטסאפ ← הגדרות ← מכשירים מקושרים ← קשר מכשיר
        </p>
      </div>
      <Button onClick={getQrCode} variant="outline" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        רענן קוד QR
      </Button>
    </div>
  );
};

export default WhatsAppQrSection;
