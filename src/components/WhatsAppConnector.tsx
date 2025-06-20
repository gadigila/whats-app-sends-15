
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, Smartphone, AlertCircle } from 'lucide-react';
import { useWhatsAppConnect } from '@/hooks/useWhatsAppConnect';

interface WhatsAppConnectorProps {
  userId: string;
  onConnected: () => void;
}

const WhatsAppConnector = ({ userId, onConnected }: WhatsAppConnectorProps) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { connectWhatsApp, checkStatus, isConnecting } = useWhatsAppConnect();

  console.log('🔄 WhatsAppConnector state:', {
    userId,
    qrCode: !!qrCode,
    polling,
    error,
    isConnecting
  });

  const handleConnect = async () => {
    try {
      setError(null);
      console.log('🔄 Starting WhatsApp connection...');
      
      const result = await connectWhatsApp.mutateAsync();
      console.log('📱 Connection result:', result);
      
      if (result.already_connected) {
        console.log('✅ Already connected!');
        onConnected();
        return;
      }
      
      if (result.qr_code) {
        console.log('📱 QR code received, starting polling...');
        setQrCode(result.qr_code);
        setPolling(true);
      } else {
        setError('לא ניתן לקבל קוד QR. נסה שוב מאוחר יותר.');
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
      setError(`שגיאה בחיבור: ${error.message || 'שגיאה לא ידועה'}`);
    }
  };

  // Poll for connection status when QR is displayed
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (polling && qrCode) {
      console.log('🔄 Starting status polling...');
      
      interval = setInterval(async () => {
        try {
          console.log('🔍 Checking connection status...');
          const result = await checkStatus.mutateAsync();
          console.log('📊 Status check result:', result);
          
          if (result.connected || result.status === 'connected' || result.status === 'authenticated') {
            console.log('🎉 Connection successful!');
            setPolling(false);
            setQrCode(null);
            onConnected();
          }
        } catch (error) {
          console.error('❌ Status check failed:', error);
          // Continue polling even on status check errors
        }
      }, 3000);
    }
    
    return () => {
      if (interval) {
        console.log('🛑 Stopping status polling');
        clearInterval(interval);
      }
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
            <p className="text-gray-600 text-sm">זה עשוי לקחת כמה שניות</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
            <h3 className="text-lg font-semibold text-red-800">בעיה בחיבור</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <Button
              onClick={() => {
                setError(null);
                handleConnect();
              }}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              נסה שוב
            </Button>
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
