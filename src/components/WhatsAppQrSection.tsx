
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
    setLoading(true);
    setErrorMsg(null);
    setQrCode(null);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { userId, action: 'get_qr' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success && data.qr_code) {
        setQrCode(data.qr_code);
        setPolling(true);
        toast({
          title: "קוד QR מוכן!",
          description: "סרוק את הקוד עם הוואטסאפ שלך.",
        });
      } else {
        throw new Error(data?.error || 'QR לא התקבל');
      }
    } catch (err: any) {
      setErrorMsg('שגיאה בקבלת קוד QR: ' + (err.message || ''));
      setQrCode(null);
    } finally {
      setLoading(false);
    }
  };

  // Poll for connection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (polling) {
      interval = setInterval(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
            body: { userId, action: 'check_status' }
          });
          if (error) return;
          if (data?.connected) {
            setPolling(false);
            setQrCode(null);
            onConnected();
            toast({
              title: "וואטסאפ מחובר!",
              description: "החיבור בוצע בהצלחה.",
            });
          }
        } catch {
          // silently fail
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [polling, userId, onConnected]);

  if (errorMsg) {
    return (
      <div className="text-center space-y-4">
        <div className="text-red-600 font-bold">שגיאה: {errorMsg}</div>
        <Button onClick={getQrCode} disabled={loading}>
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
      <Button onClick={getQrCode} variant="outline" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        רענן קוד QR
      </Button>
    </div>
  );
};
export default WhatsAppQrSection;
