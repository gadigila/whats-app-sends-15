
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import WhatsAppConnector from '@/components/WhatsAppConnector';
import PhoneAuthConnector from '@/components/PhoneAuthConnector';

interface WhatsAppConnectingViewProps {
  selectedMethod: 'qr' | 'phone';
  userId: string;
  onConnected: () => void;
  onBackToMethodSelection: () => void;
}

const WhatsAppConnectingView = ({ 
  selectedMethod, 
  userId, 
  onConnected, 
  onBackToMethodSelection 
}: WhatsAppConnectingViewProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <Button
            variant="outline"
            onClick={onBackToMethodSelection}
            className="mb-4"
          >
            ← חזור לבחירת שיטה
          </Button>
        </CardContent>
      </Card>
      
      {selectedMethod === 'qr' && (
        <WhatsAppConnector 
          userId={userId} 
          onConnected={onConnected}
          mode="qr-connect"
        />
      )}
      
      {selectedMethod === 'phone' && (
        <PhoneAuthConnector 
          onConnected={onConnected}
        />
      )}
    </div>
  );
};

export default WhatsAppConnectingView;
