
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
    setLoading(true);
    setErrorMsg(null);
    setQrCode(null);
    
    try {
      console.log('📡 Calling whatsapp-connect function with action: get_qr');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { userId, action: 'get_qr' }
      });
      
      console.log('📥 Response received:', { data, error });
      
      if (error) {
        console.error('❌ Supabase function error:', error);
        throw error;
      }
      
      if (data?.error) {
        console.error('❌ Function returned error:', data.error);
        throw new Error(data.error);
      }

      console.log('✅ Function success:', data);

      if (data?.success && data.qr_code) {
        console.log('🎯 QR code received, starting polling');
        setQrCode(data.qr_code);
        setPolling(true);
        toast({
          title: "קוד QR מוכן!",
          description: "סרוק את הקוד עם הוואטסאפ שלך.",
        });
      } else {
        console.error('❌ No QR code in response:', data);
        throw new Error(data?.error || 'QR לא התקבל');
      }
    } catch (err: any) {
      console.error('💥 QR code request failed:', err);
      const errorMessage = 'שגיאה בקבלת קוד QR: ' + (err.message || err.toString());
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
      console.log('🔄 Starting connection polling');
      interval = setInterval(async () => {
        try {
          console.log('📡 Checking connection status');
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
        <div className="text-red-600 font-bold">שגיאה: {errorMsg}</div>
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
          <strong>פרטי שגיאה לבדיקה:</strong><br />
          משתמש: {userId}<br />
          זמן: {new Date().toLocaleString('he-IL')}
        </div>
        <Button onClick={getQrCode} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          נסה שוב
        </Button>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="flex flex-col items-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500 mb-2" />
        <span className="text-gray-700 text-sm">טוען קוד...</span>
        <div className="text-xs text-gray-500 mt-2">
          משתמש: {userId}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="p-4 bg-gray-50 rounded-2xl w-fit mx-auto mb-6">
        <img
          src={qrCode}
          alt="WhatsApp QR Code"
          className="w-48 h-48 mx-auto"
        />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">סרוק קוד QR</h2>
      <div className="text-xs text-gray-500 mb-4">
        הקוד מתחדש אוטומטית כל כמה דקות
      </div>
      <Button onClick={getQrCode} variant="outline" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        רענן קוד QR
      </Button>
    </div>
  );
};

export default WhatsAppQrSection;
