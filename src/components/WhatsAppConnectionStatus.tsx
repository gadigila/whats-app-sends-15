import { useState } from 'react';
import { ThreeDButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, WifiOff, Users } from 'lucide-react';

interface WhatsAppConnectionStatusProps {
  onNavigateToCompose: () => void;
  onNavigateToGroups: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
  // Hard disconnect dialog props
  showDisconnectDialog?: boolean;
  onOpenDisconnectDialog?: () => void;
  onCloseDisconnectDialog?: () => void;
  onConfirmHardDisconnect?: () => void;
  isHardDisconnecting?: boolean;
}

const WhatsAppConnectionStatus = ({
  onNavigateToCompose,
  onNavigateToGroups,
  onDisconnect,
  isDisconnecting,
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
            <ThreeDButton
              onClick={onNavigateToCompose}
              variant="primary"
            >
              התחל לשלוח הודעות
            </ThreeDButton>
            
            {/* Updated: Navigate to Groups page instead of sync */}
            <ThreeDButton
              onClick={onNavigateToGroups}
              variant="secondary"
            >
              <Users className="h-4 w-4 mr-2" />
              קבוצות
            </ThreeDButton>
            
            <ThreeDButton
              onClick={handleDisconnectClick}
              variant="destructive"
              disabled={isDisconnecting || isHardDisconnecting}
            >
              {(isDisconnecting || isHardDisconnecting) ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <WifiOff className="h-4 w-4 mr-2" />
              )}
              {isHardDisconnecting ? 'מנתק...' : 'נתק'}
            </ThreeDButton>
          </div>
        </CardContent>
      </Card>

      {/* Existing Hard Disconnect Confirmation Dialog */}
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
              <ThreeDButton
                onClick={onCloseDisconnectDialog}
                variant="secondary"
                disabled={isHardDisconnecting}
                className="px-6"
              >
                ביטול
              </ThreeDButton>
              
              <ThreeDButton
                onClick={onConfirmHardDisconnect}
                variant="destructive"
                disabled={isHardDisconnecting}
                className="px-6"
              >
                {isHardDisconnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    מנתק...
                  </>
                ) : (
                  'כן, נתק'
                )}
              </ThreeDButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WhatsAppConnectionStatus;
