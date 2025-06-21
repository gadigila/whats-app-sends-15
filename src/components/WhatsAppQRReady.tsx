
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Loader2 } from 'lucide-react';

interface WhatsAppQRReadyProps {
  onGetQR: () => Promise<void>;
  isGettingQR: boolean;
}

const WhatsAppQRReady = ({ onGetQR, isGettingQR }: WhatsAppQRReadyProps) => {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-6">
          <Smartphone className="h-12 w-12 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          ערוץ מוכן לחיבור!
        </h3>
        <p className="text-gray-600 mb-6">
          כעת תוכל לקבל קוד QR כדי לחבר את הוואטסאפ שלך
        </p>
        <Button
          onClick={onGetQR}
          disabled={isGettingQR}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold"
        >
          {isGettingQR ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              מקבל QR...
            </>
          ) : (
            "קבל קוד QR"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppQRReady;
