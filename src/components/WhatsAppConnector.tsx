
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Smartphone, AlertCircle, RefreshCw, Clock, CheckCircle } from 'lucide-react';
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
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastQrTime, setLastQrTime] = useState<number | null>(null);
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);
  
  const { connectWhatsApp, checkStatus, isConnecting } = useWhatsAppConnect();

  console.log('🔄 Enhanced WhatsAppConnector state:', {
    userId,
    mode,
    qrCode: !!qrCode,
    polling,
    error,
    retryAfter,
    isConnecting,
    attemptCount,
    autoRetryEnabled
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
      setAttemptCount(prev => prev + 1);
      console.log(`🔄 Getting QR code with enhanced logic, attempt ${attemptCount + 1}...`);
      
      const result = await connectWhatsApp.mutateAsync();
      console.log('📱 Enhanced QR result:', result);
      
      if (result.already_connected) {
        console.log('✅ Already connected!');
        onConnected?.();
        return;
      }
      
      if (result.qr_code) {
        console.log('📱 QR code received, starting enhanced polling...');
        setQrCode(result.qr_code);
        setPolling(true);
        setLastQrTime(Date.now());
        setError(null);
      } else if (result.retry_after) {
        console.log('⏳ Channel still initializing, setting up enhanced retry...');
        const retrySeconds = Math.round(result.retry_after / 1000);
        setError(`הערוץ עדיין מתכונן... מנסה שוב בעוד ${retrySeconds} שניות`);
        setRetryAfter(result.retry_after);
        
        // Auto-retry with enhanced logic
        if (autoRetryEnabled && attemptCount < 10) {
          const timeout = setTimeout(() => {
            console.log('🔄 Enhanced auto-retry QR generation...');
            handleStartQR();
          }, result.retry_after);
          
          setRetryTimeout(timeout);
        } else {
          setError(`נסיונות רבים נכשלו. תוכל לנסות שוב ידנית או לאפס את החיבור.`);
          setAutoRetryEnabled(false);
        }
      } else {
        setError(result.message || 'לא ניתן לקבל קוד QR כרגע');
      }
    } catch (error) {
      console.error('❌ Enhanced QR failed:', error);
      const errorMessage = error.message || 'שגיאה לא ידועה';
      
      // Enhanced error handling with specific messages
      if (errorMessage.includes('still be initializing')) {
        setError('הערוץ עדיין מתכונן. נסה שוב בעוד כמה שניות...');
        
        if (autoRetryEnabled && attemptCount < 8) {
          setTimeout(() => handleStartQR(), 5000);
        }
      } else if (errorMessage.includes('timeout')) {
        setError('פג הזמן הקצוב. נסה ליצור חיבור חדש או לאפס.');
      } else if (errorMessage.includes('No WhatsApp instance')) {
        setError('לא נמצא ערוץ תקין. חזור לשלב יצירת הערוץ.');
      } else {
        setError(`שגיאה בקבלת QR: ${errorMessage}`);
      }
    }
  };

  // Enhanced polling for connection status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (polling && qrCode) {
      console.log('🔄 Starting enhanced connection status polling...');
      
      interval = setInterval(async () => {
        try {
          console.log('🔍 Enhanced connection status check...');
          const result = await checkStatus.mutateAsync();
          console.log('📊 Enhanced status check result:', result);
          
          if (result.connected || result.status === 'connected') {
            console.log('🎉 Connection successful!');
            setPolling(false);
            setQrCode(null);
            onConnected?.();
          } else if (result.status === 'initializing') {
            console.log('⏳ Still initializing, continuing enhanced polling...');
          } else if (result.status === 'error' || result.status === 'failed') {
            console.log('❌ Connection failed, stopping polling');
            setPolling(false);
            setError('החיבור נכשל. נסה לקבל קוד QR חדש.');
          }
        } catch (error) {
          console.error('❌ Enhanced status check failed:', error);
          // Continue polling even on status check errors, but with limit
          if (lastQrTime && Date.now() - lastQrTime > 120000) { // 2 minutes timeout
            console.log('⏰ QR polling timeout reached');
            setPolling(false);
            setError('זמן הקוד QR פג. נסה לקבל קוד חדש.');
          }
        }
      }, 3000);
    }
    
    return () => {
      if (interval) {
        console.log('🛑 Stopping enhanced connection polling');
        clearInterval(interval);
      }
    };
  }, [polling, qrCode, checkStatus, onConnected, lastQrTime]);

  // Loading state with enhanced feedback
  if (isConnecting) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <h3 className="text-lg font-semibold">מכין קוד QR...</h3>
            <p className="text-gray-600 text-sm">
              בודק את מצב הערוץ ומכין את הקוד
            </p>
            {attemptCount > 1 && (
              <p className="text-xs text-gray-500">
                ניסיון {attemptCount} | יכול לקחת עד דקה
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Enhanced error state with better recovery options
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
                  מנסה שוב אוטומטית בעוד {Math.round(retryAfter / 1000)} שניות
                </p>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <Button
                  onClick={() => {
                    setAutoRetryEnabled(false);
                    if (retryTimeout) {
                      clearTimeout(retryTimeout);
                      setRetryTimeout(null);
                    }
                    setRetryAfter(null);
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  עצור ניסיון אוטומטי
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setError(null);
                    setAttemptCount(0);
                    setAutoRetryEnabled(true);
                    handleStartQR();
                  }}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  נסה שוב
                </Button>
                
                {attemptCount > 3 && (
                  <p className="text-xs text-gray-500 mt-2">
                    ניסיונות רבים נכשלו? נסה לאפס את החיבור ולהתחיל מחדש
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Enhanced QR Code display with better user guidance
  if (qrCode) {
    const qrAge = lastQrTime ? Math.floor((Date.now() - lastQrTime) / 1000) : 0;
    const qrExpiring = qrAge > 90; // QR codes typically expire after ~2 minutes
    
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
            
            <div className="flex items-center justify-center gap-4 text-sm mt-4">
              {polling ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מחכה לסריקה...
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="h-4 w-4" />
                  מוכן לסריקה
                </div>
              )}
              
              {qrAge > 0 && (
                <span className={`text-xs ${qrExpiring ? 'text-orange-600' : 'text-gray-400'}`}>
                  {qrExpiring ? '⚠️ ' : ''}
                  גיל: {qrAge}s
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleStartQR}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {qrExpiring ? 'קוד פג תוקף - רענן' : 'רענן קוד QR'}
              </Button>
              
              {qrExpiring && (
                <p className="text-xs text-orange-600">
                  הקוד עשוי להיות פג תוקף. מומלץ לרענן לפני הסריקה
                </p>
              )}
            </div>
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
          מכין את קוד ה-QR המשופר...
        </p>
        <Button onClick={handleStartQR} variant="outline">
          התחל
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnector;
