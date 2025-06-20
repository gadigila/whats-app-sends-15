
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Smartphone, AlertCircle, RefreshCw } from 'lucide-react';
import { useWhatsAppConnect } from '@/hooks/useWhatsAppConnect';

interface WhatsAppConnectorProps {
  userId: string;
  onConnected?: () => void;
  mode: 'qr-connect';
}

const WhatsAppConnector = ({ userId, onConnected, mode }: WhatsAppConnectorProps) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const { connectWhatsApp, checkStatus, isConnecting } = useWhatsAppConnect();

  console.log('🔄 WhatsAppConnector state:', {
    userId,
    mode,
    qrCode: !!qrCode,
    polling,
    error,
    retryAfter,
    isConnecting
  });

  // Auto-start QR when component mounts
  useEffect(() => {
    handleStartQR();
  }, []);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryTimeout]);

  const handleStartQR = async () => {
    try {
      setError(null);
      setRetryAfter(null);
      console.log('🔄 Getting QR code with enhanced logic...');
      
      const result = await connectWhatsApp.mutateAsync();
      console.log('📱 Enhanced QR result:', result);
      
      if (result.already_connected) {
        console.log('✅ Already connected!');
        onConnected?.();
        return;
      }
      
      if (result.qr_code) {
        console.log('📱 QR code received, starting polling...');
        setQrCode(result.qr_code);
        setPolling(true);
      } else if (result.retry_after) {
        console.log('⏳ Channel still initializing, setting up retry...');
        setError(result.message || 'הערוץ עדיין מתכונן...');
        setRetryAfter(result.retry_after);
        
        // Auto-retry after the specified delay
        const timeout = setTimeout(() => {
          console.log('🔄 Auto-retrying QR generation...');
          handleStartQR();
        }, result.retry_after);
        
        setRetryTimeout(timeout);
      } else {
        setError(result.message || 'לא ניתן לקבל קוד QR כרגע');
      }
    } catch (error) {
      console.error('❌ QR failed:', error);
      setError(`שגיאה בקבלת QR: ${error.message || 'שגיאה לא ידועה'}`);
    }
  };

  // Enhanced polling for connection status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (polling && qrCode) {
      console.log('🔄 Starting enhanced status polling...');
      
      interval = setInterval(async () => {
        try {
          console.log('🔍 Checking connection status...');
          const result = await checkStatus.mutateAsync();
          console.log('📊 Status check result:', result);
          
          if (result.connected || result.status === 'connected') {
            console.log('🎉 Connection successful!');
            setPolling(false);
            setQrCode(null);
            onConnected?.();
          } else if (result.status === 'initializing') {
            console.log('⏳ Still initializing, continuing to poll...');
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
            <h3 className="text-lg font-semibold">מכין קוד QR...</h3>
            <p className="text-gray-600 text-sm">זה עשוי לקחת כמה שניות</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state with retry functionality
  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
            <h3 className="text-lg font-semibold text-red-800">בעיה בקוד QR</h3>
            <p className="text-red-600 text-sm">{error}</p>
            
            {retryAfter ? (
              <div className="flex flex-col items-center space-y-2">
                <p className="text-sm text-gray-600">
                  ינסה שוב אוטומטית בעוד {Math.round(retryAfter / 1000)} שניות
                </p>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              </div>
            ) : (
              <Button
                onClick={() => {
                  setError(null);
                  handleStartQR();
                }}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                נסה שוב
              </Button>
            )}
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
            
            <Button
              onClick={handleStartQR}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              רענן קוד QR
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial state
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-6">
          <Smartphone className="h-12 w-12 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          חיבור עם קוד QR
        </h3>
        <p className="text-gray-600 mb-6">
          מכין את קוד ה-QR...
        </p>
        <Button onClick={handleStartQR} variant="outline">
          התחל
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnector;
