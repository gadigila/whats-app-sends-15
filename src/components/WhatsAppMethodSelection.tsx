
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, MessageCircle, CheckCircle } from 'lucide-react';

interface WhatsAppMethodSelectionProps {
  onMethodSelect: (method: 'qr' | 'phone') => void;
}

const WhatsAppMethodSelection = ({ onMethodSelect }: WhatsAppMethodSelectionProps) => {
  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">ערוץ נוצר בהצלחה!</span>
          </div>
          <p className="text-gray-600 text-sm">
            איך תרצה לחבר את הוואטסאפ שלך?
          </p>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* QR Code Option */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onMethodSelect('qr')}>
          <CardContent className="p-6 text-center">
            <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-4">
              <Smartphone className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">קוד QR</h3>
            <p className="text-gray-600 text-sm mb-4">
              סרוק קוד QR עם הוואטסאפ שלך
            </p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              בחר QR
            </Button>
          </CardContent>
        </Card>
        
        {/* Phone Number Option */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onMethodSelect('phone')}>
          <CardContent className="p-6 text-center">
            <div className="p-4 bg-orange-50 rounded-full w-fit mx-auto mb-4">
              <MessageCircle className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">מספר וואטסאפ</h3>
            <p className="text-gray-600 text-sm mb-4">
              התחבר עם מספר הטלפון שלך
            </p>
            <Button className="w-full bg-orange-600 hover:bg-orange-700">
              בחר מספר
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default WhatsAppMethodSelection;
