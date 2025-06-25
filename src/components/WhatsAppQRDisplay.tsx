
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface WhatsAppQRDisplayProps {
  qrCode: string;
  onRefreshQR: () => Promise<void>;
  isRefreshing: boolean;
}

const WhatsAppQRDisplay = ({ qrCode, onRefreshQR, isRefreshing }: WhatsAppQRDisplayProps) => {
  const [cooldownTimer, setCooldownTimer] = useState(0);

  // Start cooldown timer when component mounts (QR is first displayed)
  useEffect(() => {
    setCooldownTimer(60);
  }, []);

  // Handle countdown
  useEffect(() => {
    if (cooldownTimer > 0) {
      const timer = setTimeout(() => {
        setCooldownTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTimer]);

  const handleRefreshClick = async () => {
    if (cooldownTimer > 0) return;
    
    await onRefreshQR();
    setCooldownTimer(60); // Reset timer after refresh
  };

  const isButtonDisabled = cooldownTimer > 0 || isRefreshing;

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
        
        <div className="flex items-center justify-center gap-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          מחכה לסריקה...
        </div>
        
        <Button
          onClick={handleRefreshClick}
          variant="outline"
          size="sm"
          disabled={isButtonDisabled}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              מרענן...
            </>
          ) : cooldownTimer > 0 ? (
            `רענן קוד QR (${cooldownTimer})`
          ) : (
            'רענן קוד QR'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppQRDisplay;
