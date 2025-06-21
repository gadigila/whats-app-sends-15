
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface WhatsAppInitializingProps {
  onTryGetQR: () => Promise<void>;
  isTrying: boolean;
}

const WhatsAppInitializing = ({ onTryGetQR, isTrying }: WhatsAppInitializingProps) => {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">מכין ערוץ...</h3>
        <p className="text-gray-600 mb-4">
          הערוץ עדיין נטען במערכת של WHAPI
        </p>
        <Button
          onClick={onTryGetQR}
          variant="outline"
          disabled={isTrying}
        >
          {isTrying ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          נסה לקבל QR
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppInitializing;
