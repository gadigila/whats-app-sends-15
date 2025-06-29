
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WhatsAppQRDisplayProps {
  qrCode: string;
  onRefreshQR: () => Promise<void>;
  isRefreshing: boolean;
}

const WhatsAppQRDisplay = ({ qrCode, onRefreshQR, isRefreshing }: WhatsAppQRDisplayProps) => {
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [isInCooldown, setIsInCooldown] = useState(true);

  // Start cooldown timer when component mounts or QR is refreshed
  useEffect(() => {
    setIsInCooldown(true);
    setCooldownSeconds(60);

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setIsInCooldown(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrCode]);

  const handleRefreshQR = async () => {
    await onRefreshQR();
    // Timer will restart automatically due to useEffect dependency on qrCode
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardContent className="p-8 text-center space-y-6">
        <h3 className="text-xl font-semibold">סרוק עם הוואטסאפ שלך</h3>
        
        <div className="p-4 bg-white rounded-2xl shadow-lg border w-fit mx-auto">
          <img
            src={qrCode.includes('base64') ? qrCode : qrCode}
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
        
        <div className="text-sm text-gray-600 space-y-1">
          <p>1. פתח וואטסאפ בטלפון</p>
          <p>2. לך להגדרות ← מכשירים מקושרים</p>
          <p>3. לחץ "קשר מכשיר" וסרוק</p>
        </div>
        
        <Button
          onClick={handleRefreshQR}
          variant="outline"
          size="sm"
          disabled={isRefreshing || isInCooldown}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              מרענן...
            </>
          ) : isInCooldown ? (
            `רענן קוד QR (${formatTime(cooldownSeconds)})`
          ) : (
            "רענן קוד QR"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppQRDisplay;
