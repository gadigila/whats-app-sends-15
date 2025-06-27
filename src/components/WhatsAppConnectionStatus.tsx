import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2, WifiOff, RefreshCw } from 'lucide-react';

interface WhatsAppConnectionStatusProps {
  onNavigateToCompose: () => void;
  onSyncGroups: () => void;
  onDisconnect: () => void;
  isSyncingGroups: boolean;
  isDisconnecting: boolean;
  // NEW: Add props for hard disconnect dialog
  showDisconnectDialog?: boolean;
  onOpenDisconnectDialog?: () => void;
  onCloseDisconnectDialog?: () => void;
  onConfirmHardDisconnect?: () => void;
  isHardDisconnecting?: boolean;
}

const WhatsAppConnectionStatus = ({
  onNavigateToCompose,
  onSyncGroups,
  onDisconnect,
  isSyncingGroups,
  isDisconnecting,
  // NEW: Dialog props
  showDisconnectDialog = false,
  onOpenDisconnectDialog,
  onCloseDisconnectDialog,
  onConfirmHardDisconnect,
  isHardDisconnecting = false
}: WhatsAppConnectionStatusProps) => {
  
  // Use hard disconnect if available, fallback to old disconnect
  const handleDisconnectClick = () => {
    if (onOpenDisconnectDialog) {
      onOpenDisconnectDialog();
    } else {
      onDisconnect();
    }
  };

  return (
    <>
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
              onClick={handleDisconnectClick}
              variant="outline"
              disabled={isDisconnecting || isHardDisconnecting}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              {(isDisconnecting || isHardDisconnecting) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <WifiOff className="h-4 w-4 mr-2" />
              )}
              {isHardDisconnecting ? 'מנתק...' : 'נתק'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* NEW: Hard Disconnect Confirmation Dialog */}
      {showDisconnectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 text-center">
            <div className="p-3 bg-red-50 rounded-full w-fit mx-auto mb-4">
              <WifiOff className="h-8 w-8 text-red-600" />
            </div>
            
            <h3 className="text-lg font-semibold mb-4 text-right">
              האם אתה בטוח שברצונך להתנתק?
            </h3>
            
            <div className="text-right space-y-2 mb-6">
              <p className="text-gray-700 font-medium">
                פעולה זו תנתק אותך לחלוטין מוואטסאפ:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• החיבור לוואטסאפ יתנתק</li>
                <li>• תצטרך לסרוק QR קוד מחדש</li>
                <li>• כל הקבוצות המסונכרנות יימחקו</li>
                <li>• הודעות מתוזמנות יכולות להיכשל</li>
              </ul>
            </div>
            
            <div className="flex gap-3 justify-center">
              <Button
                onClick={onCloseDisconnectDialog}
                variant="outline"
                disabled={isHardDisconnecting}
                className="px-6"
              >
                ביטול
              </Button>
              
              <Button
                onClick={onConfirmHardDisconnect}
                disabled={isHardDisconnecting}
                className="px-6 bg-red-600 hover:bg-red-700 text-white"
              >
                {isHardDisconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    מנתק...
                  </>
                ) : (
                  'כן, נתק'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WhatsAppConnectionStatus;