
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, Smartphone, AlertCircle, RefreshCw, Stethoscope, Bug } from 'lucide-react';
import { useWhatsAppConnect } from '@/hooks/useWhatsAppConnect';
import { useWhapiRecovery } from '@/hooks/useWhapiRecovery';
import { useWhapiDiagnostics } from '@/hooks/useWhapiDiagnostics';

interface WhatsAppConnectorProps {
  userId: string;
  onConnected: () => void;
}

const WhatsAppConnector = ({ userId, onConnected }: WhatsAppConnectorProps) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(false);
  
  const { connectWhatsApp, checkStatus, isConnecting } = useWhatsAppConnect();
  const { runRecovery, forceNewInstance, isLoading: isRecovering } = useWhapiRecovery();
  const { runDiagnostics, isRunning: isDiagnosing } = useWhapiDiagnostics();

  // Add comprehensive logging
  useEffect(() => {
    console.log('🔄 WhatsAppConnector state:', {
      userId,
      qrCode: !!qrCode,
      polling,
      error,
      isConnecting,
      isRecovering,
      isDiagnosing,
      debugMode
    });
  }, [userId, qrCode, polling, error, isConnecting, isRecovering, isDiagnosing, debugMode]);

  const handleConnect = async () => {
    try {
      setError(null);
      setDiagnosticsResult(null);
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
        console.log('⚠️ No QR code in response, trying recovery...');
        handleRecovery();
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
      setError(`שגיאה בחיבור: ${error.message || 'שגיאה לא ידועה'}`);
    }
  };

  const handleRecovery = async () => {
    try {
      setError(null);
      setDiagnosticsResult(null);
      console.log('🚑 Starting recovery...');
      
      const result = await runRecovery.mutateAsync(false);
      console.log('🔧 Recovery result:', result);
      
      if (result.success) {
        if (result.qr_code) {
          setQrCode(result.qr_code);
          setPolling(true);
        } else if (result.message.includes('already connected')) {
          onConnected();
        } else if (result.retry_after) {
          setError(`המערכת מתכוננת... נסה שוב בעוד ${result.retry_after} שניות`);
          setTimeout(() => handleRecovery(), result.retry_after * 1000);
        } else {
          setError(result.message || 'בעיה בשחזור המערכת');
        }
      } else {
        setError(result.error || 'שחזור נכשל');
      }
    } catch (error) {
      console.error('❌ Recovery failed:', error);
      setError(`שחזור נכשל: ${error.message || 'שגיאה לא ידועה'}`);
    }
  };

  const handleForceNew = async () => {
    try {
      setError(null);
      setDiagnosticsResult(null);
      console.log('🆕 Creating new instance...');
      
      const result = await forceNewInstance.mutateAsync();
      console.log('🏗️ Force new result:', result);
      
      if (result.success && result.qr_code) {
        setQrCode(result.qr_code);
        setPolling(true);
      } else {
        setError(result.error || 'יצירת instance חדש נכשלה');
      }
    } catch (error) {
      console.error('❌ Force new failed:', error);
      setError(`יצירת instance חדש נכשלה: ${error.message || 'שגיאה לא ידועה'}`);
    }
  };

  const handleDiagnostics = async () => {
    try {
      setError(null);
      console.log('🔬 Running diagnostics...');
      
      const result = await runDiagnostics.mutateAsync();
      console.log('📋 Diagnostics result:', result);
      setDiagnosticsResult(result);
      
      // Auto-apply simple fixes based on diagnostics
      if (result.recommendations.some((r: string) => r.includes('need new instance') || r.includes('Channel not found'))) {
        setError('נדרש instance חדש. לחץ על "יצור חדש"');
      } else if (result.recommendations.some((r: string) => r.includes('QR code is available') || r.includes('ready for QR scan'))) {
        setError('קוד QR זמין. נסה להתחבר שוב.');
      } else if (result.recommendations.some((r: string) => r.includes('already authenticated'))) {
        onConnected();
      } else if (result.recommendations.length === 0) {
        setError('הכל נראה תקין. נסה להתחבר שוב.');
      }
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      setError(`בדיקה נכשלה: ${error.message || 'שגיאה לא ידועה'}`);
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
          // Don't stop polling on status check errors
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
  if (isConnecting || isRecovering) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <h3 className="text-lg font-semibold">
              {isRecovering ? 'מתקן חיבור...' : 'מתחבר לוואטסאפ...'}
            </h3>
            <p className="text-gray-600 text-sm">
              זה עשוי לקחת כמה שניות
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state with diagnostics
  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
            <h3 className="text-lg font-semibold text-red-800">בעיה בחיבור</h3>
            <p className="text-red-600 text-sm">{error}</p>
            
            {/* Show diagnostics results if available */}
            {diagnosticsResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left text-xs max-w-md">
                <h4 className="font-semibold mb-2">המלצות לפתרון:</h4>
                <ul className="space-y-1">
                  {diagnosticsResult.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-gray-700">{rec}</li>
                  ))}
                </ul>
                {debugMode && (
                  <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
                    <pre>{JSON.stringify(diagnosticsResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setError(null);
                  setDiagnosticsResult(null);
                  handleConnect();
                }}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                נסה שוב
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setDiagnosticsResult(null);
                  handleRecovery();
                }}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                שחזור
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setDiagnosticsResult(null);
                  handleForceNew();
                }}
                variant="outline"
                className="border-orange-600 text-orange-600 hover:bg-orange-50"
              >
                יצור חדש
              </Button>
              <Button
                onClick={handleDiagnostics}
                variant="outline"
                className="border-purple-600 text-purple-600 hover:bg-purple-50"
                disabled={isDiagnosing}
              >
                {isDiagnosing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Stethoscope className="h-4 w-4 mr-1" />}
                בדיקה
              </Button>
              <Button
                onClick={() => setDebugMode(!debugMode)}
                variant="outline"
                className="border-gray-600 text-gray-600 hover:bg-gray-50"
                size="sm"
              >
                <Bug className="h-4 w-4" />
                {debugMode ? 'הסתר' : 'דיבוג'}
              </Button>
            </div>
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
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleConnect}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
            disabled={isConnecting || isRecovering}
          >
            התחבר עכשיו
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleRecovery}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 flex-1"
              disabled={isConnecting || isRecovering}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              שחזור חיבור
            </Button>
            <Button
              onClick={handleDiagnostics}
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50"
              disabled={isConnecting || isRecovering || isDiagnosing}
            >
              {isDiagnosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
            </Button>
            <Button
              onClick={() => setDebugMode(!debugMode)}
              variant="outline"
              className="border-gray-600 text-gray-600 hover:bg-gray-50"
              disabled={isConnecting || isRecovering}
            >
              <Bug className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnector;
