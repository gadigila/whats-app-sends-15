
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
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
  const { getQrCode, checkInstanceStatus } = useWhatsAppInstance();

  // Get QR code on mount
  useEffect(() => {
    handleGetQrCode();
  }, []);

  const handleGetQrCode = async () => {
    console.log('🔄 Getting QR code for user:', userId);
    
    setQrCode(null);
    
    try {
      const result = await getQrCode.mutateAsync();
      
      if (result?.success && result.qr_code) {
        console.log('✅ QR code received successfully');
        setQrCode(result.qr_code);
        setPolling(true);
        toast({
          title: "QR Code Ready!",
          description: "Scan the code with your WhatsApp.",
        });
      } else {
        throw new Error('QR code not received from server');
      }
    } catch (err: any) {
      console.error('💥 QR code request failed:', err);
      
      // Check if error indicates missing instance
      if (err.message?.includes('instance') || 
          err.message?.includes('not found') || 
          err.message?.includes('requiresNewInstance')) {
        console.log('🚨 Missing instance detected');
        onMissingInstance();
        return;
      }
      
      toast({
        title: "Error Getting QR Code",
        description: err.message || 'Unknown error occurred',
        variant: "destructive",
      });
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
          const result = await checkInstanceStatus.mutateAsync();
          
          console.log('📥 Status check response:', result);
          
          if (result?.connected) {
            console.log('🎉 WhatsApp connected successfully!');
            setPolling(false);
            setQrCode(null);
            onConnected();
            toast({
              title: "WhatsApp Connected!",
              description: "Connection established successfully.",
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
          if (err.message?.includes('requiresNewInstance')) {
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

  if (getQrCode.isError) {
    return (
      <div className="text-center space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error: {getQrCode.error?.message}
          </AlertDescription>
        </Alert>
        <Button onClick={handleGetQrCode} disabled={getQrCode.isPending} variant="outline">
          {getQrCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Try Again
        </Button>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="text-gray-700">Loading QR Code...</span>
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
            toast({
              title: "Error Loading QR Code",
              description: "Try refreshing the code",
              variant: "destructive",
            });
          }}
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Scan QR Code</h2>
        <p className="text-sm text-gray-600">
          Open WhatsApp → Settings → Linked Devices → Link a Device
        </p>
      </div>
      <Button onClick={handleGetQrCode} variant="outline" disabled={getQrCode.isPending}>
        {getQrCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Refresh QR Code
      </Button>
    </div>
  );
};

export default WhatsAppQrSection;
