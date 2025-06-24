import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppLoadingState from '@/components/WhatsAppLoadingState';
import WhatsAppConnectedView from '@/components/WhatsAppConnectedView';
import WhatsAppInitialState from '@/components/WhatsAppInitialState';
import WhatsAppQRDisplay from '@/components/WhatsAppQRDisplay';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppSimple } from '@/hooks/useWhatsAppSimple';
import { toast } from '@/hooks/use-toast';

const WhatsAppConnect = () => {
  const { user, isAuthReady } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const { createChannel, getQRCode, isCreatingChannel, isGettingQR } = useWhatsAppSimple();
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isPollingForQR, setIsPollingForQR] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    userId: user?.id,
    profileStatus: profile?.instance_status,
    hasInstanceId: !!profile?.instance_id,
    qrCode: !!qrCode,
    isPollingForQR,
    pollingAttempts
  });

  // Simplified QR polling
  const pollForQR = async () => {
    if (pollingAttempts >= 30) { // Max 30 attempts = 1.5 minutes
      console.error('❌ Max polling attempts reached');
      setIsPollingForQR(false);
      setPollingAttempts(0);
      toast({
        title: "שגיאה",
        description: "לא הצלחנו לקבל קוד QR. נסה ליצור ערוץ חדש",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`🔄 Polling attempt ${pollingAttempts + 1}/30`);
      const result = await getQRCode.mutateAsync();
      
      console.log('📤 Poll result:', {
        success: result.success,
        hasQrCode: !!result.qr_code,
        alreadyConnected: result.already_connected
      });
      
      if (result.already_connected) {
        console.log('✅ Already connected!');
        setIsPollingForQR(false);
        setPollingAttempts(0);
        await refetchProfile();
        return;
      }
      
      if (result.qr_code && result.qr_code.trim() !== '') {
        console.log('✅ QR code found! Setting in state...');
        setQrCode(result.qr_code);
        setIsPollingForQR(false);
        setPollingAttempts(0);
        return;
      }
      
      // Continue polling
      setPollingAttempts(prev => prev + 1);
      setTimeout(() => {
        if (isPollingForQR) {
          pollForQR();
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ Polling error:', error);
      setPollingAttempts(prev => prev + 1);
      
      // Retry on error
      setTimeout(() => {
        if (isPollingForQR && pollingAttempts < 30) {
          pollForQR();
        }
      }, 5000);
    }
  };

  // Start polling when channel is ready
  useEffect(() => {
    const shouldPoll = 
      profile?.instance_id && 
      ['unauthorized', 'qr', 'active', 'ready'].includes(profile?.instance_status || '') &&
      !qrCode && 
      !isPollingForQR;
    
    if (shouldPoll) {
      console.log('🚀 Starting QR polling...');
      setIsPollingForQR(true);
      setPollingAttempts(0);
      
      // Start polling after a short delay
      setTimeout(() => {
        pollForQR();
      }, 2000);
    }
  }, [profile?.instance_status, profile?.instance_id, qrCode, isPollingForQR]);

  // Loading states
  if (!isAuthReady || (profileLoading && !profileError)) {
    return <WhatsAppLoadingState />;
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-8">
          <p className="text-gray-600">יש לך להתחבר תחילה</p>
        </div>
      </Layout>
    );
  }

  // Connected state
  if (profile?.instance_status === 'connected') {
    return (
      <WhatsAppConnectedView
        profile={profile}
        onNavigateToCompose={() => window.location.href = '/compose'}
        onSyncGroups={async () => {
          try {
            await syncGroups.mutateAsync();
          } catch (error) {
            console.error('Failed to sync groups:', error);
          }
        }}
        onDisconnect={async () => {
          try {
            await deleteInstance.mutateAsync();
            await refetchProfile();
            setQrCode(null);
            setIsPollingForQR(false);
            setPollingAttempts(0);
          } catch (error) {
            console.error('❌ Disconnect failed:', error);
          }
        }}
        isSyncingGroups={syncGroups.isPending}
        isDisconnecting={deleteInstance.isPending}
      />
    );
  }

  // Channel creation
  const handleCreateChannel = async () => {
    try {
      await createChannel.mutateAsync();
      await refetchProfile();
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
    }
  };

  // Manual QR refresh
  const handleRefreshQR = async () => {
    setQrCode(null);
    setIsPollingForQR(true);
    setPollingAttempts(0);
    pollForQR();
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">חבר את הוואטסאפ שלך</h1>
          <p className="text-gray-600">
            חבר את הוואטסאפ שלך כדי להתחיל לשלוח הודעות לקבוצות
          </p>
        </div>

        {/* No channel */}
        {!profile?.instance_id && (
          <WhatsAppInitialState onCreateChannel={handleCreateChannel} />
        )}

        {/* Channel creating */}
        {isCreatingChannel && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">יוצר ערוץ WhatsApp...</h3>
            <p className="text-sm text-blue-600">זה יקח כ-90 שניות</p>
          </div>
        )}

        {/* Waiting for QR */}
        {profile?.instance_id && 
         ['unauthorized', 'qr', 'active', 'ready', 'initializing'].includes(profile?.instance_status || '') && 
         !qrCode && 
         !isCreatingChannel && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <div className="text-yellow-800">
              {isPollingForQR ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold mb-2">מחכה לקוד QR...</h3>
                  <p className="text-sm mb-2">הערוץ מוכן, מקבל קוד QR</p>
                  <p className="text-xs">ניסיון {pollingAttempts + 1} מתוך 30</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">ערוץ מוכן</h3>
                  <p className="text-sm mb-4">הערוץ נוצר, ממתין לקוד QR</p>
                  <button
                    onClick={() => {
                      setIsPollingForQR(true);
                      setPollingAttempts(0);
                      pollForQR();
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    קבל קוד QR
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {qrCode && (
          <WhatsAppQRDisplay 
            qrCode={qrCode} 
            onRefreshQR={handleRefreshQR}
            isRefreshing={isPollingForQR}
          />
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;