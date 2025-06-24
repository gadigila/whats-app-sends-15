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
  const { createChannel, getQRCode, checkConnectionStatus, isCreatingChannel, isGettingQR } = useWhatsAppSimple();
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isPollingForQR, setIsPollingForQR] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [isPollingConnection, setIsPollingConnection] = useState(false);
  const [connectionPollingAttempts, setConnectionPollingAttempts] = useState(0);

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    userId: user?.id,
    profileStatus: profile?.instance_status,
    hasInstanceId: !!profile?.instance_id,
    qrCode: !!qrCode,
    isPollingForQR,
    pollingAttempts,
    isPollingConnection,
    connectionPollingAttempts
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

  // 🆕 NEW: Connection status polling function
  const pollForConnection = async () => {
    if (connectionPollingAttempts >= 60) { // Max 60 attempts = 5 minutes
      console.log('❌ Max connection polling attempts reached');
      setIsPollingConnection(false);
      setConnectionPollingAttempts(0);
      toast({
        title: "זמן ההמתנה פג",
        description: "לא זוהה חיבור. נסה לסרוק שוב את הקוד",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`🔍 Checking connection status... attempt ${connectionPollingAttempts + 1}/60`);
      const result = await checkConnectionStatus.mutateAsync();
      
      if (result.connected && result.status === 'connected') {
        console.log('🎉 Connection detected!');
        setIsPollingConnection(false);
        setConnectionPollingAttempts(0);
        setQrCode(null); // Hide QR code
        await refetchProfile();
        return;
      }
      
      // Continue polling
      setConnectionPollingAttempts(prev => prev + 1);
      setTimeout(() => {
        if (isPollingConnection) {
          pollForConnection();
        }
      }, 5000); // Check every 5 seconds
      
    } catch (error) {
      console.error('❌ Connection polling error:', error);
      setConnectionPollingAttempts(prev => prev + 1);
      
      // Retry on error
      setTimeout(() => {
        if (isPollingConnection && connectionPollingAttempts < 60) {
          pollForConnection();
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

  // 🆕 NEW: Start connection polling when QR is displayed
  useEffect(() => {
    // Start connection polling when QR is displayed
    if (qrCode && !isPollingConnection && profile?.instance_status !== 'connected') {
      console.log('🚀 Starting connection status polling...');
      setIsPollingConnection(true);
      setConnectionPollingAttempts(0);
      
      // Start polling after showing QR
      setTimeout(() => {
        pollForConnection();
      }, 3000);
    }
  }, [qrCode, isPollingConnection, profile?.instance_status]);

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
            // 🆕 NEW: Also stop connection polling
            setIsPollingConnection(false);
            setConnectionPollingAttempts(0);
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
    // 🆕 NEW: Stop connection polling when refreshing QR
    setIsPollingConnection(false);
    setConnectionPollingAttempts(0);
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
          <div>
            <WhatsAppQRDisplay 
              qrCode={qrCode} 
              onRefreshQR={handleRefreshQR}
              isRefreshing={isPollingForQR}
            />
            
            {/* 🆕 NEW: Connection status indicator */}
            {isPollingConnection && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-blue-800 font-medium">
                    מחכה לחיבור... ({connectionPollingAttempts + 1}/60)
                  </span>
                </div>
                <p className="text-xs text-blue-600">
                  לאחר סריקת הקוד, החיבור יזוהה אוטומטית בעוד {Math.max(0, 5 - (connectionPollingAttempts % 5))} שניות
                </p>
                <div className="mt-2 bg-blue-100 rounded-full h-1 w-full">
                  <div 
                    className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${(connectionPollingAttempts / 60) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;