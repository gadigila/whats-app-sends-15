
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppLoadingState from '@/components/WhatsAppLoadingState';
import WhatsAppConnectedView from '@/components/WhatsAppConnectedView';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppSimple } from '@/hooks/useWhatsAppSimple';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Loader2, Smartphone } from 'lucide-react';

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
      setCountdown(90); // Start 90-second countdown
      await createChannel.mutateAsync();
      await refetchProfile();
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      setCountdown(0);
    }
  };

  // Handle QR code request
  const handleGetQR = async () => {
    try {
      const result = await getQRCode.mutateAsync();
      if (result.already_connected) {
        await refetchProfile();
      } else if (result.qr_code) {
        setQrCode(result.qr_code);
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
          <Card>
            <CardContent className="p-8 text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
                <MessageCircle className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                מוכן להתחבר לוואטסאפ?
              </h3>
              <p className="text-gray-600 mb-6">
                נתחיל ביצירת חיבור בטוח בינך לבין וואטסאפ
              </p>
              <Button
                onClick={handleCreateChannel}
                disabled={isCreatingChannel}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold"
              >
                {isCreatingChannel ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    יוצר ערוץ...
                  </>
                ) : (
                  "התחבר לוואטסאפ"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Channel creating - Show countdown */}
        {isCreatingChannel && countdown > 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-600">{countdown}</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">מכין את החיבור...</h3>
              <p className="text-gray-600 mb-4">
                יוצר ערוץ בטוח לחיבור הוואטסאפ שלך
              </p>
              <p className="text-sm text-orange-600">
                זמן המתנה נדרש: {countdown} שניות נותרו
              </p>
              <p className="text-xs text-gray-500 mt-2">
                זהו דרישה של WHAPI - אנא המתן עד לסיום
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Channel ready but no QR - Show get QR button */}
        {profile?.instance_id && profile?.instance_status === 'unauthorized' && !qrCode && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-6">
                <Smartphone className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                ערוץ מוכן לחיבור!
              </h3>
              <p className="text-gray-600 mb-6">
                כעת תוכל לקבל קוד QR כדי לחבר את הוואטסאפ שלך
              </p>
              <Button
                onClick={handleGetQR}
                disabled={isGettingQR}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold"
              >
                {isGettingQR ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    מקבל QR...
                  </>
                ) : (
                  "קבל קוד QR"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Show QR Code */}
        {qrCode && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <h3 className="text-xl font-semibold">סרוק עם הוואטסאפ שלך</h3>
              
              <div className="p-4 bg-white rounded-2xl shadow-lg border w-fit mx-auto">
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="WhatsApp QR Code"
                  className="w-80 h-80 mx-auto rounded-lg"
                  style={{
                    maxWidth: '90vw',
                    height: 'auto',
                    aspectRatio: '1/1',
                    imageRendering: 'crisp-edges'
                  }}
                />
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <p>1. פתח וואטסאפ בטלפון</p>
                <p>2. לך להגדרות ← מכשירים מקושרים</p>
                <p>3. לחץ "קשר מכשיר" וסרוק</p>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                מחכה לסריקה...
              </div>
              
              <Button
                onClick={handleGetQR}
                variant="outline"
                size="sm"
                disabled={isGettingQR}
              >
                {isGettingQR ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                רענן קוד QR
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Channel initializing */}
        {profile?.instance_status === 'initializing' && !isCreatingChannel && (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">מכין ערוץ...</h3>
              <p className="text-gray-600 mb-4">
                הערוץ עדיין נטען במערכת של WHAPI
              </p>
              <Button
                onClick={handleGetQR}
                variant="outline"
                disabled={isGettingQR}
              >
                {isGettingQR ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                נסה לקבל QR
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
