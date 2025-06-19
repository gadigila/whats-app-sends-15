
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, Smartphone } from 'lucide-react';
import { useWhatsAppConnect } from '@/hooks/useWhatsAppConnect';

interface WhatsAppConnectorProps {
  userId: string;
  onConnected: () => void;
}

const WhatsAppConnector = ({ userId, onConnected }: WhatsAppConnectorProps) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const { connectWhatsApp, checkStatus, isConnecting } = useWhatsAppConnect();

  const handleConnect = async () => {
    try {
      const result = await connectWhatsApp.mutateAsync();
      
      if (result.already_connected) {
        onConnected();
        return;
      }
      
      if (result.qr_code) {
        setQrCode(result.qr_code);
        setPolling(true);
      }
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  // Poll for connection status when QR is displayed
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (polling && qrCode) {
      interval = setInterval(async () => {
        try {
          const result = await checkStatus.mutateAsync();
          
          if (result.connected || result.status === 'connected') {
            setPolling(false);
            setQrCode(null);
            onConnected();
          }
        } catch (error) {
          console.error('Status check failed:', error);
        }
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [polling, qrCode, checkStatus, onConnected]);

  // Loading state
  if (isConnecting) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <h3 className="text-lg font-semibold">מתחבר לוואטסאפ...</h3>
            <p className="text-gray-600 text-sm">
              זה עשוי לקחת כמה שניות
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // QR Code display
  if (qrCode) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-6">
          <div className="p-4 bg-white rounded-2xl shadow-lg border w-fit mx-auto">
            <img
              src={qrCode}
              alt="WhatsApp QR Code"
              className="w-80 h-80 mx-auto rounded-lg"
              style={{
                maxWidth: '90vw',
                height: 'auto',
                aspectRatio: '1/1',
                imageRendering: 'crisp-edges'
              }}
            />
          </div>
          
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">סרוק עם הוואטסאפ שלך</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>1. פתח וואטסאפ בטלפון</p>
              <p>2. לך להגדרות ← מכשירים מקושרים</p>
              <p>3. לחץ "קשר מכשיר" וסרוק</p>
            </div>
            
            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mt-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                מחכה לסריקה...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial connect button
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
          <Smartphone className="h-12 w-12 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          חבר וואטסאפ
        </h3>
        <p className="text-gray-600 mb-6">
          חבר את הוואטסאפ שלך כדי להתחיל לשלוח הודעות לקבוצות
        </p>
        <Button
          onClick={handleConnect}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
          disabled={isConnecting}
        >
          התחבר עכשיו
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnector;
