
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, CheckCircle, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSimpleWhatsAppConnect } from '@/hooks/useSimpleWhatsAppConnect';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';

const WhatsAppConnect = () => {
  const { user, isAuthReady } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { connect, disconnect, isConnecting, isDisconnecting } = useSimpleWhatsAppConnect();
  const { syncGroups } = useWhatsAppGroups();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  console.log('🔄 Simple WhatsApp Connect:', {
    user: user?.email,
    profileLoading,
    profile: profile ? {
      instance_id: profile.instance_id,
      instance_status: profile.instance_status,
      has_token: !!profile.whapi_token
    } : null
  });

  // Poll for connection status when QR is displayed
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (polling && qrCode) {
      console.log('🔄 Starting connection polling...');
      
      interval = setInterval(async () => {
        const result = await refetchProfile();
        
        if (result.data?.instance_status === 'connected') {
          console.log('🎉 Connection successful!');
          setPolling(false);
          setQrCode(null);
          
          // Sync groups
          try {
            await syncGroups.mutateAsync();
          } catch (error) {
            console.error('Failed to sync groups:', error);
          }
        }
      }, 3000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [polling, qrCode, refetchProfile, syncGroups]);

  const handleConnect = async () => {
    try {
      const result = await connect.mutateAsync();
      
      if (result.already_connected) {
        // Already connected, sync groups
        try {
          await syncGroups.mutateAsync();
        } catch (error) {
          console.error('Failed to sync groups:', error);
        }
      } else if (result.qr_code) {
        setQrCode(result.qr_code);
        setPolling(true);
      }
    } catch (error) {
      console.error('Connect failed:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      setQrCode(null);
      setPolling(false);
      await refetchProfile();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const handleNavigateToCompose = () => {
    window.location.href = '/compose';
  };

  // Loading state
  if (!isAuthReady || profileLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </Layout>
    );
  }

  // No user
  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-8">
          <p className="text-gray-600">יש להתחבר תחילה</p>
        </div>
      </Layout>
    );
  }

  const isConnected = profile?.instance_status === 'connected';

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">חיבור WhatsApp</h1>
          <p className="text-gray-600">
            חבר את WhatsApp שלך כדי להתחיל לשלוח הודעות
          </p>
        </div>

        {/* Connected State */}
        {isConnected && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                WhatsApp מחובר!
              </h2>
              <p className="text-gray-600 mb-6">
                הWhatsApp שלך מחובר ומוכן לשימוש
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={handleNavigateToCompose}
                  className="bg-green-600 hover:bg-green-700"
                >
                  התחל לשלוח הודעות
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  disabled={isDisconnecting}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <WifiOff className="h-4 w-4 mr-2" />
                  )}
                  נתק
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code State */}
        {!isConnected && qrCode && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <div className="p-4 bg-white rounded-2xl shadow-lg border w-fit mx-auto">
                <img
                  src={qrCode}
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
              
              <div className="space-y-3">
                <h3 className="text-xl font-semibold">סרוק עם WhatsApp</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>1. פתח WhatsApp בטלפון</p>
                  <p>2. לך להגדרות ← מכשירים מקושרים</p>
                  <p>3. לחץ "קשר מכשיר" וסרוק</p>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-blue-600 mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מחכה לסריקה...
                </div>
                
                <Button
                  onClick={handleConnect}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  רענן קוד QR
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not Connected State */}
        {!isConnected && !qrCode && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
                <MessageCircle className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                מוכן להתחבר ל-WhatsApp?
              </h3>
              <p className="text-gray-600 mb-6">
                נתחיל ביצירת חיבור בטוח בינך לבין WhatsApp
              </p>
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    מתחבר...
                  </>
                ) : (
                  "התחבר ל-WhatsApp"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
