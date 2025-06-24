import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppLoadingState from '@/components/WhatsAppLoadingState';
import WhatsAppConnectedView from '@/components/WhatsAppConnectedView';
import WhatsAppInitialState from '@/components/WhatsAppInitialState';
import WhatsAppChannelCreating from '@/components/WhatsAppChannelCreating';
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
  const [channelCreatedAt, setChannelCreatedAt] = useState<Date | null>(null);

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    userId: user?.id,
    profileLoading,
    profileStatus: profile?.instance_status,
    hasInstanceId: !!profile?.instance_id,
    hasToken: !!profile?.whapi_token,
    isPollingForQR,
    pollingAttempts
  });

  // Auto QR polling function
  const pollForQR = async () => {
    console.log('🔄 Polling for QR, attempt:', pollingAttempts + 1);
    
    try {
      const result = await getQRCode.mutateAsync();
      
      console.log('📤 Poll result:', {
        success: result.success,
        hasQrCode: !!result.qr_code,
        responseKeys: Object.keys(result)
      });
      
      if (result.already_connected) {
        console.log('✅ Already connected during polling!');
        setIsPollingForQR(false);
        setPollingAttempts(0);
        await refetchProfile();
        return;
      }
      
      // Extract QR from response - your logs show it's in "qr_code" field
      const qrData = result.qr_code || result.qr_code_url || result.base64 || result.qr || result.image;
      
      if (qrData && qrData.trim() !== '') {
        console.log('✅ QR code found! Length:', qrData.length);
        
        // Format QR properly
        let formattedQR = qrData;
        if (formattedQR && !formattedQR.startsWith('data:image')) {
          formattedQR = `data:image/png;base64,${formattedQR}`;
        }
        
        setQrCode(formattedQR);
        setIsPollingForQR(false);
        setPollingAttempts(0);
        
        toast({
          title: "קוד QR מוכן!",
          description: "סרוק את הקוד עם הוואטסאפ שלך",
        });
      } else {
        console.log('⏳ QR not ready yet, continuing to poll...');
        setPollingAttempts(prev => prev + 1);
        
        // Continue polling if under max attempts
        if (pollingAttempts < 40) { // 40 attempts = ~2 minutes with 3 second intervals
          setTimeout(() => {
            if (isPollingForQR) {
              pollForQR();
            }
          }, 3000); // 3 second intervals
        } else {
          console.error('❌ Max polling attempts reached');
          setIsPollingForQR(false);
          setPollingAttempts(0);
          
          toast({
            title: "שגיאה",
            description: "הערוץ לא מוכן לקוד QR. נסה ליצור ערוץ חדש",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('❌ Polling error:', error);
      setPollingAttempts(prev => prev + 1);
      
      // Retry on error if under max attempts
      if (pollingAttempts < 40) {
        setTimeout(() => {
          if (isPollingForQR) {
            pollForQR();
          }
        }, 5000); // 5 second delay on errors
      } else {
        setIsPollingForQR(false);
        setPollingAttempts(0);
        
        toast({
          title: "שגיאה בקבלת קוד QR",
          description: "נסה ליצור ערוץ חדש",
          variant: "destructive",
        });
      }
    }
  };

  // Start QR polling when channel is ready
  useEffect(() => {
    const shouldStartPolling = 
      profile?.instance_id && 
      ['unauthorized', 'qr', 'active', 'ready'].includes(profile?.instance_status || '') &&
      !qrCode && 
      !isPollingForQR &&
      channelCreatedAt;
    
    if (shouldStartPolling) {
      // Wait 30 seconds after channel creation before starting to poll
      const timeSinceCreation = Date.now() - channelCreatedAt.getTime();
      const thirtySeconds = 30 * 1000;
      
      if (timeSinceCreation >= thirtySeconds) {
        console.log('🚀 Starting QR polling...');
        setIsPollingForQR(true);
        setPollingAttempts(0);
        pollForQR();
      } else {
        // Wait the remaining time then start polling
        const remainingWait = thirtySeconds - timeSinceCreation;
        console.log(`⏳ Waiting ${remainingWait/1000} more seconds before starting QR polling`);
        
        setTimeout(() => {
          if (!qrCode && !isPollingForQR) {
            console.log('🚀 Starting delayed QR polling...');
            setIsPollingForQR(true);
            setPollingAttempts(0);
            pollForQR();
          }
        }, remainingWait);
      }
    }
  }, [profile?.instance_id, profile?.instance_status, qrCode, isPollingForQR, channelCreatedAt]);

  // Show loading only when auth is not ready or profile is loading
  if (!isAuthReady || (profileLoading && !profileError)) {
    return <WhatsAppLoadingState />;
  }

  // If no user after auth is ready, show error
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
            // Reset states
            setChannelCreatedAt(null);
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

  // Handle channel creation and auto-start QR polling
  const handleCreateChannel = async () => {
    try {
      const result = await createChannel.mutateAsync();
      
      // Track when channel was created
      const createdAt = new Date();
      setChannelCreatedAt(createdAt);
      
      console.log('✅ Channel created at:', createdAt.toISOString());
      
      await refetchProfile();
      
      // QR polling will start automatically via useEffect
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

        {/* Step 1: No channel - Show create button */}
        {!profile?.instance_id && (
          <WhatsAppInitialState onCreateChannel={handleCreateChannel} />
        )}

        {/* Step 2: Channel creating */}
        {isCreatingChannel && (
          <WhatsAppChannelCreating countdown={90} />
        )}

        {/* Step 3: Channel created, waiting for QR or polling */}
        {profile?.instance_id && 
         ['unauthorized', 'qr', 'active', 'ready', 'initializing'].includes(profile?.instance_status || '') && 
         !qrCode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <div className="text-blue-800">
              {isPollingForQR ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold mb-2">מחכה לקוד QR...</h3>
                  <p className="text-sm mb-2">
                    הערוץ מוכן, מחכה שWHAPI יכין את קוד ה-QR
                  </p>
                  <p className="text-xs text-blue-600">
                    ניסיון {pollingAttempts + 1} מתוך 40
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">מכין ערוץ...</h3>
                  <p className="text-sm">
                    הערוץ נוצר, ממתין שיהיה מוכן לקוד QR
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Show QR Code */}
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