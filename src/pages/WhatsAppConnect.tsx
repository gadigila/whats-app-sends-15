import { toast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppLoadingState from '@/components/WhatsAppLoadingState';
import WhatsAppConnectedView from '@/components/WhatsAppConnectedView';
import WhatsAppInitialState from '@/components/WhatsAppInitialState';
import WhatsAppChannelCreating from '@/components/WhatsAppChannelCreating';
import WhatsAppQRReady from '@/components/WhatsAppQRReady';
import WhatsAppQRDisplay from '@/components/WhatsAppQRDisplay';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppSimple } from '@/hooks/useWhatsAppSimple';

const WhatsAppConnect = () => {
  const { user, isAuthReady } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const { createChannel, getQRCode, isCreatingChannel, isGettingQR } = useWhatsAppSimple();
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    userId: user?.id,
    profileLoading,
    profileStatus: profile?.instance_status,
    hasInstanceId: !!profile?.instance_id,
    hasToken: !!profile?.whapi_token
  });

  // Countdown for channel creation (90 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown]);

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
          } catch (error) {
            console.error('❌ Disconnect failed:', error);
          }
        }}
        isSyncingGroups={syncGroups.isPending}
        isDisconnecting={deleteInstance.isPending}
      />
    );
  }

  // Handle channel creation
  const handleCreateChannel = async () => {
    try {
      setCountdown(90); // Visual countdown for user
      await createChannel.mutateAsync();
      await refetchProfile();
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      setCountdown(0);
    }
  };

  // Handle QR code request
  // Handle QR code request with enhanced debugging
      const handleGetQR = async () => {
        try {
          console.log('🔲 Requesting QR code...');
          const result = await getQRCode.mutateAsync();
          
          console.log('📤 QR result received:', {
            success: result.success,
            alreadyConnected: result.already_connected,
            hasQrCode: !!(result.qr_code || result.qr_code_url || result.base64 || result.qr || result.image),
            resultKeys: Object.keys(result)
          });
          
          if (result.already_connected) {
            console.log('✅ Already connected, refreshing profile...');
            await refetchProfile();
          } else {
            // Check multiple possible QR field names
            const qrData = result.qr_code_url || result.qr_code || result.base64 || result.qr || result.image;
            
            if (qrData) {
              console.log('✅ Setting QR code, length:', qrData.length);
              
              // Ensure proper data URL format
              let formattedQR = qrData;
              if (formattedQR && !formattedQR.startsWith('data:image')) {
                formattedQR = `data:image/png;base64,${formattedQR}`;
              }
              
              setQrCode(formattedQR);
            } else {
              console.error('❌ No QR data found in any expected field');
              console.log('📊 Available fields:', Object.keys(result));
              
              // Show user-friendly error
              toast({
                title: "שגיאה",
                description: "לא התקבל קוד QR מהשרת, נסה שוב",
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error('❌ QR code failed:', error);
        }
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

        {/* Step 2: Channel creating - Show countdown */}
        {isCreatingChannel && countdown > 0 && (
          <WhatsAppChannelCreating countdown={countdown} />
        )}

        {/* Step 3: Channel ready for QR - Handle multiple statuses */}
        {profile?.instance_id && ['unauthorized', 'qr', 'active', 'ready', 'initializing'].includes(profile?.instance_status || '') && !qrCode && (
          <WhatsAppQRReady onGetQR={handleGetQR} isGettingQR={isGettingQR} />
        )}

        {/* Step 4: Show QR Code */}
        {qrCode && (
          <WhatsAppQRDisplay 
            qrCode={qrCode} 
            onRefreshQR={handleGetQR} 
            isRefreshing={isGettingQR}
          />
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
