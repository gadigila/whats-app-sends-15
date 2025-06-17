
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WhatsAppQrSectionProps {
  userId: string;
  onConnected: () => void;
  onMissingInstance: () => void;
}

const WhatsAppQrSection = ({ userId, onConnected, onMissingInstance }: WhatsAppQrSectionProps) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const { getQrCode, checkInstanceStatus } = useWhatsAppInstance();

  // Get QR code on mount
  useEffect(() => {
    handleGetQrCode();
  }, []);

  const handleGetQrCode = async () => {
    console.log('🔄 Getting QR code for user:', userId);
    
    setQrCode(null);
    setStatus('loading');
    setRetryCount(prev => prev + 1);
    
    try {
      const result = await getQrCode.mutateAsync();
      
      console.log('📥 QR result:', result);
      
      if (result?.success && result.qr_code) {
        console.log('✅ QR code received successfully');
        
        // Validate QR code format
        let formattedQrCode = result.qr_code;
        if (!formattedQrCode.startsWith('data:image/')) {
          console.log('🔧 Formatting QR code as base64 image');
          formattedQrCode = `data:image/png;base64,${result.qr_code}`;
        }
        
        setQrCode(formattedQrCode);
        setStatus('ready');
        setPolling(true);
        setRetryCount(0); // Reset retry count on success
        
        toast({
          title: "QR Code מוכן!",
          description: "סרוק את הקוד עם הוואטסאפ שלך",
        });
      } else {
        console.error('❌ QR code not received:', result);
        setStatus('error');
        throw new Error(result?.error || 'QR code not received from server');
      }
    } catch (err: any) {
      console.error('💥 QR code request failed:', err);
      setStatus('error');
      
      // Check if error indicates missing instance
      if (err.message?.includes('instance') || 
          err.message?.includes('not found') || 
          err.message?.includes('requiresNewInstance') ||
          err.message?.includes('No instance or token found')) {
        console.log('🚨 Missing instance detected');
        onMissingInstance();
        return;
      }
      
      // Show specific error messages
      let errorMessage = 'אירעה שגיאה לא ידועה';
      if (err.message?.includes('Channel not accessible')) {
        errorMessage = 'הערוץ לא נגיש - נדרש instance חדש';
      } else if (err.message?.includes('not found')) {
        errorMessage = 'הערוץ לא נמצא - צור instance חדש';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast({
        title: "שגיאה בקבלת QR Code",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Poll for connection status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (polling) {
      console.log('🔄 Starting connection polling every 3 seconds');
      interval = setInterval(async () => {
        try {
          console.log('📡 Checking connection status...');
          const result = await checkInstanceStatus.mutateAsync();
          
          console.log('📥 Status check response:', result);
          
          if (result?.connected || result?.status === 'connected') {
            console.log('🎉 WhatsApp connected successfully!');
            setPolling(false);
            setQrCode(null);
            onConnected();
            toast({
              title: "וואטסאפ מחובר!",
              description: "החיבור הושלם בהצלחה",
            });
          } else if (result?.requiresNewInstance) {
            console.log('🚨 Instance requires recreation');
            setPolling(false);
            setQrCode(null);
            onMissingInstance();
          }
        } catch (err: any) {
          console.error('💥 Status check failed:', err);
          
          // Check if status check indicates missing instance
          if (err.message?.includes('requiresNewInstance') || 
              err.message?.includes('not found')) {
            console.log('🚨 Missing instance detected during polling');
            setPolling(false);
            setQrCode(null);
            onMissingInstance();
          }
        }
      }, 3000);
    }
    
    return () => {
      if (interval) {
        console.log('🛑 Stopping connection polling');
        clearInterval(interval);
      }
    };
  }, [polling, userId, onConnected, onMissingInstance]);

  if (status === 'error' && !qrCode) {
    return (
      <div className="text-center space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            שגיאה: {getQrCode.error?.message || 'לא ניתן לטעון QR Code'}
            {retryCount > 0 && (
              <div className="mt-2 text-xs">נסיון {retryCount}</div>
            )}
          </AlertDescription>
        </Alert>
        <Button 
          onClick={handleGetQrCode} 
          disabled={getQrCode.isPending} 
          variant="outline"
        >
          {getQrCode.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          נסה שוב
        </Button>
      </div>
    );
  }

  if (status === 'loading' || !qrCode) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="text-gray-700">טוען QR Code...</span>
        <div className="text-xs text-gray-500 text-center">
          הערוץ מתחבר לשירות WHAPI. זה עשוי לקחת כ-60 שניות...
          {retryCount > 0 && (
            <div className="mt-1">נסיון {retryCount}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
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
          onError={(e) => {
            console.error('🖼️ QR image failed to load:', e);
            setStatus('error');
            toast({
              title: "שגיאה בטעינת QR Code",
              description: "הקוד פגום - נסה לרענן",
              variant: "destructive",
            });
          }}
          onLoad={() => {
            console.log('✅ QR image loaded successfully');
          }}
        />
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">סרוק QR Code</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>1. פתח וואטסאפ בטלפון שלך</p>
          <p>2. לך להגדרות ← מכשירים מקושרים</p>
          <p>3. לחץ על "קשר מכשיר" וסרוק את הקוד</p>
        </div>
        {polling && (
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            מחכה לסריקת הקוד...
          </div>
        )}
      </div>
      <Button 
        onClick={handleGetQrCode} 
        variant="outline" 
        disabled={getQrCode.isPending}
      >
        {getQrCode.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        רענן QR Code
      </Button>
    </div>
  );
};

export default WhatsAppQrSection;
