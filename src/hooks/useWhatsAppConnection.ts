import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2, WifiOff, RefreshCw, Crown } from 'lucide-react';

// Add the loading modal component inline for now
const SyncLoadingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse mx-auto"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full animate-spin border-t-transparent mx-auto"></div>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          מסנכרן את הקבוצות שלך
        </h3>
        
        <p className="text-gray-600 mb-4">
          מחפש את כל הקבוצות שלך... זה יכול לקחת עד דקה
        </p>
        
        <div className="bg-blue-50 rounded-lg p-3 space-y-2 mb-4">
          <p className="text-xs font-medium text-blue-900 mb-2">מה אנחנו מחפשים:</p>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="flex items-center gap-2 text-blue-700">
              <Crown className="h-3 w-3" />
              <span>קבוצות שאתה יוצר</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700">
              <RefreshCw className="h-3 w-3" />
              <span>קבוצות שאתה מנהל</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700">
              <CheckCircle className="h-3 w-3" />
              <span>כל הקבוצות (כולל 800+ חברים)</span>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            <strong>טיפ:</strong> אל תסגור את החלון - הסנכרון רץ ברקע והתהליך יושלם אוטומטית
          </p>
        </div>
      </div>
    </div>
  );
};

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
  
  // 🚀 NEW: Enhanced sync with loading modal
  const [showSyncModal, setShowSyncModal] = useState(false);

  const handleEnhancedSyncGroups = async () => {
    setShowSyncModal(true);
    
    try {
      await onSyncGroups(); // Call the original sync function
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      // Keep modal open a bit longer to show success
      setTimeout(() => {
        setShowSyncModal(false);
      }, 1000);
    }
  };

  const handleCloseSyncModal = () => {
    // Don't allow closing while syncing
    if (!isSyncingGroups) {
      setShowSyncModal(false);
    }
  };
  
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
            
            {/* 🚀 ENHANCED: Better sync button with modal */}
            <Button
              onClick={handleEnhancedSyncGroups}
              variant="outline"
              disabled={isSyncingGroups}
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              {isSyncingGroups ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  מסנכרן...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  סנכרן קבוצות בניהולי
                </>
              )}
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

      {/* 🚀 NEW: Enhanced Sync Loading Modal */}
      <SyncLoadingModal
        isOpen={showSyncModal}
        onClose={handleCloseSyncModal}
      />

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