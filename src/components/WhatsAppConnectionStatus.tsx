
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2, WifiOff, RefreshCw } from 'lucide-react';

interface WhatsAppConnectionStatusProps {
  onNavigateToCompose: () => void;
  onSyncGroups: () => void;
  onDisconnect: () => void;
  isSyncingGroups: boolean;
  isDisconnecting: boolean;
}

const WhatsAppConnectionStatus = ({
  onNavigateToCompose,
  onSyncGroups,
  onDisconnect,
  isSyncingGroups,
  isDisconnecting
}: WhatsAppConnectionStatusProps) => {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          החיבור הצליח
        </h2>
        <p className="text-gray-600 mb-6">
          הוואטסאפ שלך מחובר עכשיו לשירות שלנו. אתה יכול להתחיל לשלוח הודעות לקבוצות שלך.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={onNavigateToCompose}
            className="bg-green-600 hover:bg-green-700"
          >
            התחל לשלוח הודעות
          </Button>
          <Button
            onClick={onSyncGroups}
            variant="outline"
            disabled={isSyncingGroups}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            {isSyncingGroups ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            סנכרן קבוצות
          </Button>
          <Button
            onClick={onDisconnect}
            variant="outline"
            disabled={isDisconnecting}
            className="text-orange-600 border-orange-600 hover:bg-orange-50"
          >
            {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <WifiOff className="h-4 w-4 mr-2" />}
            נתק
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnectionStatus;
