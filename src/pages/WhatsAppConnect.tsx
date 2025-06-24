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
import { toast } from '@/hooks/use-toast';

const WhatsAppConnect = () => {
  const { user, isAuthReady } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const { createChannel, getQRCode, isCreatingChannel, isGettingQR } = useWhatsAppSimple();
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [qrCountdown, setQrCountdown] = useState(0); // NEW: QR waiting countdown
  const [channelCreatedAt, setChannelCreatedAt] = useState<Date | null>(null); // NEW: Track when channel was created

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    userId: user?.id,
    profileLoading,
    profileStatus: profile?.instance_status,
    hasInstanceId: !!profile?.instance_id,
    hasToken: !!profile?.whapi_token,
    qrCountdown
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

  // NEW: QR countdown (120 seconds = 2 minutes as recommended by WHAPI)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrCountdown > 0) {
      interval = setInterval(() => {
        setQrCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrCountdown]);

  // NEW: Check if enough time has passed since channel creation
  const canRequestQR = () => {
    if (!channelCreatedAt) return true; // If we don't know when it was created, allow it
    const timeSinceCreation = Date.now() - channelCreatedAt.getTime();
    const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
    return timeSinceCreation >= twoMinutes;
  };

  // NEW: Calculate remaining wait time
  const getRemainingWaitTime = () => {
    if (!channelCreatedAt) return 0;
    const timeSinceCreation = Date.now() - channelCreatedAt.getTime();
    const twoMinutes = 2 * 60 * 1000;
    return Math.max(0, Math.ceil((twoMinutes - timeSinceCreation) / 1000));
  };

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
            setQrCountdown(0);
          } catch (error) {
            console.error('❌ Disconnect failed:', error);
          }
        }}
        isSyncingGroups={syncGroups.isPending}
        isDisconnecting={deleteInstance.isPending}
      />
    );
  }

  // Handle channel creation with timing tracking
  const handleCreateChannel = async () => {
    try {
      setCountdown(90); // Visual countdown for user
      const result = await createChannel.mutateAsync();
      
      // NEW: Track when channel was created and start QR countdown
      const createdAt = new Date();
      setChannelCreatedAt(createdAt);
      setQrCountdown(120); // 2 minutes countdown for QR readiness
      
      console.log('✅ Channel created at:', createdAt.toISOString());
      
      await refetchProfile();
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      setCountdown(0);
      setQrCountdown(0);
    }
  };

  // Handle QR code request with timing validation
  const handleGetQR = async () => {
    // NEW: Check if enough time has passed
    if (!canRequestQR()) {
      const remainingTime = getRemainingWaitTime();
      toast({
        title: "יש להמתין עוד",
        description: `WHAPI ממליץ להמתין 2 דקות לאחר יצירת הערוץ. נותרו ${remainingTime} שניות`,
        variant: "destructive",
      });
      return;
    }

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
        
        if (qrData && qrData.trim() !== '') { // NEW: Check for empty string
          console.log('✅ Setting QR code, length:', qrData.length);
          
          // Ensure proper data URL format
          let formattedQR = qrData;
          if (formattedQR && !formattedQR.startsWith('data:image')) {
            formattedQR = `data:image/png;base64,${formattedQR}`;
          }
          
          setQrCode(formattedQR);
          setQrCountdown(0); // Stop countdown since QR is ready
        } else {
          console.error('❌ QR data is empty or not found');
          console.log('📊 Available fields:', Object.keys(result));
          
          // NEW: Suggest waiting more if QR is empty
          const remainingTime = getRemainingWaitTime();
          if (remainingTime > 0) {
            toast({
              title: "הערוץ עדיין לא מוכן",
              description: `נסה שוב בעוד ${remainingTime} שניות`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "שגיאה",
              description: "הערוץ לא מחזיר קוד QR. נסה שוב או צור ערוץ חדש",
              variant: "destructive",
            });
          }
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

        {/* NEW: Step 2.5: Channel created but waiting for QR readiness */}
        {profile?.instance_id && qrCountdown > 0 && !qrCode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <div className="text-yellow-800">
              <h3 className="text-lg font-semibold mb-2">הערוץ נוצר! ממתין לקוד QR...</h3>
              <p className="text-sm mb-4">
                WHAPI ממליץ להמתין 2 דקות לאחר יצירת הערוץ לפני בקשת קוד QR
              </p>
              <div className="text-2xl font-mono text-yellow-600">
                {Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-xs mt-2">זמן המתנה נותר</p>
            </div>
          </div>
        )}

       {/* Step 3: Channel ready for QR - Handle multiple statuses */}
{profile?.instance_id && 
 ['unauthorized', 'qr', 'active', 'ready', 'initializing'].includes(profile?.instance_status || '') && 
 !qrCode && 
 qrCountdown === 0 && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
    <div className="text-blue-800">
      <h3 className="text-lg font-semibold mb-2">ערוץ מוכן לקוד QR!</h3>
      <p className="text-sm mb-4">
        {!canRequestQR() 
          ? `יש להמתין עוד ${getRemainingWaitTime()} שניות לפני בקשת קוד QR`
          : 'כעת תוכל לקבל קוד QR לחיבור הוואטסאפ'
        }
      </p>
      <button
        onClick={handleGetQR}
        disabled={isGettingQR || !canRequestQR()}
        className={`px-6 py-3 rounded-lg font-medium transition-colors ${
          canRequestQR() && !isGettingQR()
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isGettingQR() ? 'מקבל קוד QR...' : 'קבל קוד QR'}
      </button>
    </div>
  </div>
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