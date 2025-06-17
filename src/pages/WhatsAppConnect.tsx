
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppQrSection from '@/components/WhatsAppQrSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Smartphone, Loader2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useUserProfile } from '@/hooks/useUserProfile';

const WhatsAppConnect = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { createInstance, deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'created' | 'connected'>('disconnected');

  console.log('🔄 WhatsAppConnect render:', {
    user: user?.email,
    profileLoading,
    profile: profile ? {
      instance_id: profile.instance_id,
      instance_status: profile.instance_status,
      has_token: !!profile.whapi_token
    } : null,
    connectionStatus
  });

  // Check user's WhatsApp status on load
  useEffect(() => {
    if (profile) {
      console.log('📥 Profile effect triggered:', profile);
      console.log('Instance ID:', profile.instance_id);
      console.log('Instance Status:', profile.instance_status);
      console.log('Has Token:', !!profile.whapi_token);
      
      if (profile.instance_status === 'connected') {
        console.log('✅ Setting status to connected');
        setConnectionStatus('connected');
      } else if (profile.instance_status === 'created' && profile.instance_id && profile.whapi_token) {
        console.log('🔄 Setting status to created');
        setConnectionStatus('created');
      } else {
        console.log('❌ Setting status to disconnected');
        setConnectionStatus('disconnected');
      }
    }
  }, [profile]);

  // Called when QR component reports success
  const handleQrConnected = async () => {
    console.log('🎉 QR connection successful, updating state...');
    setConnectionStatus('connected');
    
    // Refresh profile to get updated status
    console.log('🔄 Refetching profile...');
    await refetchProfile();
    
    // Sync groups after successful connection
    try {
      console.log('📱 Syncing groups...');
      await syncGroups.mutateAsync();
    } catch (error) {
      console.error('Failed to sync groups after connection:', error);
    }
  };

  const handleStart = async () => {
    if (!user?.id) return;
    console.log('🚀 Starting WhatsApp connection for user:', user.id);
    
    try {
      const result = await createInstance.mutateAsync();
      console.log('✅ Instance created successfully:', result);
      
      // Only refresh profile and change status if creation was successful
      await refetchProfile();
      setConnectionStatus('created');
      
      console.log('✅ Ready to show QR code');
    } catch (error) {
      console.error('❌ Failed to create instance:', error);
      
      // Make sure we stay in disconnected state on error
      setConnectionStatus('disconnected');
      
      toast({
        title: "שגיאה ביצירת instance",
        description: error instanceof Error ? error.message : "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    console.log('🔌 Disconnecting WhatsApp for user:', user.id);

    try {
      await deleteInstance.mutateAsync();
      await refetchProfile();
      setConnectionStatus('disconnected');
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  };

  const handleSyncGroups = async () => {
    try {
      await syncGroups.mutateAsync();
    } catch (error) {
      console.error('Failed to sync groups:', error);
    }
  };

  const handleMissingInstance = () => {
    console.log('🚨 Missing instance detected, switching to disconnected state');
    setConnectionStatus('disconnected');
    toast({
      title: "דרוש instance חדש",
      description: "אנא צור instance חדש כדי להמשיך",
      variant: "destructive",
    });
  };

  console.log('🎯 Current render state:', {
    profileLoading,
    connectionStatus,
    willRenderQr: connectionStatus === 'created' && user?.id,
    willRenderConnected: connectionStatus === 'connected',
    willRenderStart: connectionStatus === 'disconnected'
  });

  if (profileLoading) {
    console.log('⏳ Rendering loading state');
    return (
      <Layout>
        <div className="max-w-2xl mx-auto flex flex-col items-center min-h-[75vh] justify-center gap-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="text-gray-700">טוען פרופיל משתמש...</span>
        </div>
      </Layout>
    );
  }

  if (connectionStatus === 'connected') {
    console.log('✅ Rendering connected state');
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">וואטסאפ מחובר</h1>
            <p className="text-gray-600">הוואטסאפ שלך מחובר ומוכן לשימוש!</p>
          </div>
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
                  onClick={() => window.location.href = '/compose'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  התחל לשלוח הודעות
                </Button>
                <Button
                  onClick={handleSyncGroups}
                  variant="outline"
                  disabled={syncGroups.isPending}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  {syncGroups.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  סנכרן קבוצות
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  disabled={deleteInstance.isPending}
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  {deleteInstance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <WifiOff className="h-4 w-4 mr-2" />}
                  נתק
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>פרטי החיבור</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">סטטוס:</span>
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <Wifi className="h-4 w-4" />
                    מחובר
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">תוכנית:</span>
                  <span className="font-medium">{profile?.payment_plan || 'trial'}</span>
                </div>
                {profile?.trial_expires_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">תוקף טריאל:</span>
                    <span className="font-medium">
                      {new Date(profile.trial_expires_at).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Main connection UI (created or disconnected)
  console.log('🔄 Rendering main connection UI, status:', connectionStatus);
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">חבר את הוואטסאפ שלך</h1>
          <p className="text-gray-600">
            {connectionStatus === 'created'
              ? 'סרוק את קוד ה-QR עם הוואטסאפ שלך כדי להתחבר'
              : 'התחבר לוואטסאפ כדי להתחיל לשלוח הודעות לקבוצות שלך'}
          </p>
        </div>
        
        <Card>
          <CardContent className="p-8">
            {connectionStatus === 'created' && user?.id ? (
              <>
                <div className="mb-4 text-center text-sm text-blue-600">
                  מצב: מחכה לסריקת QR | משתמש: {user.email}
                </div>
                <WhatsAppQrSection 
                  userId={user.id} 
                  onConnected={handleQrConnected}
                  onMissingInstance={handleMissingInstance}
                />
              </>
            ) : (
              <div className="text-center">
                <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
                  <Smartphone className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  התחבר לוואטסאפ
                </h2>
                <p className="text-gray-600 mb-6">
                  חבר את הוואטסאפ שלך כדי להתחיל לשלוח הודעות אוטומטיות לקבוצות.
                </p>
                <div className="mb-4 text-xs text-gray-500">
                  מצב נוכחי: {connectionStatus} | משתמש: {user?.email || 'לא מחובר'}
                </div>
                <Button
                  onClick={handleStart}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={createInstance.isPending}
                >
                  {createInstance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  התחבר עכשיו
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">הערות חשובות</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• השאר את הטלפון שלך מחובר לאינטרנט</li>
                  <li>• החיבור יישאר פעיל כל עוד הטלפון מחובר</li>
                  <li>• אתה יכול להתנתק בכל עת מהטלפון או מכאן</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
