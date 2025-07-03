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
import { supabase } from '@/integrations/supabase/client';
import { WifiOff } from 'lucide-react';

const WhatsAppConnect = () => {
  const { user, isAuthReady } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const { createChannel, getQRCode, isCreatingChannel, isGettingQR } = useWhatsAppSimple();
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isPollingForQR, setIsPollingForQR] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [isPollingConnection, setIsPollingConnection] = useState(false);
  const [connectionPollingAttempts, setConnectionPollingAttempts] = useState(0);
  // 🆕 NEW: Track if user manually started reconnection
  const [manualReconnectStarted, setManualReconnectStarted] = useState(false);

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    userId: user?.id,
    profileStatus: profile?.instance_status,
    hasInstanceId: !!profile?.instance_id,
    qrCode: !!qrCode,
    isPollingForQR,
    pollingAttempts,
    isPollingConnection,
    connectionPollingAttempts,
    manualReconnectStarted
  });

  // Simplified QR polling
  const pollForQR = async () => {
    if (pollingAttempts >= 30) { // Max 30 attempts = 1.5 minutes
      console.error('❌ Max polling attempts reached');
      setIsPollingForQR(false);
      setPollingAttempts(0);
      setManualReconnectStarted(false); // Reset manual flag
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
        setManualReconnectStarted(false); // Reset manual flag
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
      setTimeout(async () => {
        if (isPollingForQR) {
          await pollForQR();
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ Polling error:', error);
      setPollingAttempts(prev => prev + 1);
      
      // Retry on error
      setTimeout(async () => {
        if (isPollingForQR && pollingAttempts < 30) {
          await pollForQR();
        }
      }, 5000);
    }
  };

  // Connection status polling function (using supabase directly)
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
      
      // Call the status check function directly
      const { data, error } = await supabase.functions.invoke('whapi-check-status', {
        body: { userId: user?.id }
      });
      
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Status check failed');
      }
      
      if (data?.connected && data?.status === 'connected') {
        console.log('🎉 Connection detected!');
        setIsPollingConnection(false);
        setConnectionPollingAttempts(0);
        setQrCode(null); // Hide QR code
        setManualReconnectStarted(false); // Reset manual flag
        
        // Show success toast
        toast({
          title: "וואטסאפ מחובר!",
          description: `חובר בהצלחה למספר: ${data.phone || 'לא זוהה'}`,
        });
        
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

  // 🔧 FIXED: Updated useEffect to handle new channels vs reconnection
  useEffect(() => {
    // Check if this is a new channel (recently updated)
    const isNewChannel = profile?.instance_status === 'unauthorized' && 
      profile?.updated_at && 
      (new Date().getTime() - new Date(profile.updated_at).getTime()) < 600000; // 10 minutes old
    
    console.log('🔍 useEffect channel detection:', {
      status: profile?.instance_status,
      updatedAt: profile?.updated_at,
      minutesAgo: profile?.updated_at ? Math.round((new Date().getTime() - new Date(profile.updated_at).getTime()) / 60000) : 'no date',
      isNewChannel,
      manualReconnectStarted
    });
    
    // Don't auto-start QR after hard disconnect, UNLESS:
    // 1. User manually started reconnection, OR
    // 2. This is a fresh new channel
    if (profile?.instance_status === 'unauthorized' && !manualReconnectStarted && !isNewChannel) {
      console.log('⚠️ User is unauthorized (hard disconnected) - waiting for manual reconnection');
      return;
    }
    
    const shouldPoll = 
      profile?.instance_id && 
      (['qr', 'active', 'ready'].includes(profile?.instance_status || '') || 
       (profile?.instance_status === 'unauthorized' && (manualReconnectStarted || isNewChannel))) && // 🆕 Allow new channels and manual reconnection
      !qrCode && 
      !isPollingForQR;
    
    if (shouldPoll) {
      console.log('🚀 Starting QR polling...', { isNewChannel, manualReconnectStarted, status: profile?.instance_status });
      setIsPollingForQR(true);
      setPollingAttempts(0);
      
      // Start polling after a short delay
      setTimeout(async () => {
        await pollForQR();
      }, 2000);
    }
  }, [profile?.instance_status, profile?.instance_id, profile?.updated_at, qrCode, isPollingForQR, manualReconnectStarted]);

  // Start connection polling when QR is displayed
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

  // 🆕 NEW: Reset manual reconnect flag when user becomes connected or disconnected
  useEffect(() => {
    if (profile?.instance_status === 'connected' || profile?.instance_status === 'disconnected') {
      setManualReconnectStarted(false);
    }
  }, [profile?.instance_status]);

  // 🆕 NEW: Manual reconnection function
  const handleManualReconnect = () => {
    console.log('🔄 Manual reconnection started by user');
    setManualReconnectStarted(true);
    setIsPollingForQR(true);
    setPollingAttempts(0);
    setQrCode(null); // Clear any existing QR
    setIsPollingConnection(false);
    setConnectionPollingAttempts(0);
    
    // Start polling immediately for manual reconnection
    setTimeout(async () => {
      await pollForQR();
    }, 500);
  };

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
          // This is now just a fallback - the main disconnect uses the dialog
          try {
            await deleteInstance.mutateAsync();
            await refetchProfile();
            
            // STOP all polling when disconnecting
            setQrCode(null);
            setIsPollingForQR(false);
            setPollingAttempts(0);
            setIsPollingConnection(false);
            setConnectionPollingAttempts(0);
            setManualReconnectStarted(false); // Reset manual flag
            
          } catch (error) {
            console.error('❌ Disconnect failed:', error);
          }
        }}
        isSyncingGroups={syncGroups.isPending}
        isDisconnecting={deleteInstance.isPending}
      />
    );
  }

  // 🔧 FIXED: Disconnected/Unauthorized state - handle new vs disconnected users
  if (profile?.instance_status === 'unauthorized') {
    // 🆕 NEW: Check if this is a fresh channel vs hard disconnected user
    // Use updated_at as a proxy for when the channel was created/last modified
    const isNewChannel = !manualReconnectStarted && profile?.updated_at && 
      (new Date().getTime() - new Date(profile.updated_at).getTime()) < 600000; // 10 minutes old
    
    console.log('🔍 Channel detection:', {
      manualReconnectStarted,
      updatedAt: profile?.updated_at,
      minutesAgo: profile?.updated_at ? Math.round((new Date().getTime() - new Date(profile.updated_at).getTime()) / 60000) : 'no date',
      isNewChannel
    });
    
    // For fresh channels, auto-start QR (don't show manual reconnection)
    if (isNewChannel && !qrCode && !isPollingForQR) {
      console.log('🆕 New channel detected, auto-starting QR...');
      setIsPollingForQR(true);
      setPollingAttempts(0);
      setTimeout(async () => {
        await pollForQR();
      }, 1000);
      
      return (
        <Layout>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">מכין את הוואטסאפ שלך</h1>
              <p className="text-gray-600">יוצר קוד QR לחיבור</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">מכין קוד QR...</h3>
              <p className="text-sm mb-2">הערוץ נוצר, מכין קוד לסריקה</p>
              <p className="text-xs">ניסיון {pollingAttempts + 1} מתוך 30</p>
            </div>
          </div>
        </Layout>
      );
    }

    // If user started manual reconnection and we have QR, show it
    if (manualReconnectStarted && qrCode) {
      return (
        <Layout>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">התחבר מחדש לוואטסאפ</h1>
              <p className="text-gray-600">סרוק את הקוד עם הוואטסאפ שלך</p>
            </div>
            
            <WhatsAppQRDisplay 
              qrCode={qrCode} 
              onRefreshQR={async () => {
                setQrCode(null);
                setIsPollingForQR(true);
                setPollingAttempts(0);
                setIsPollingConnection(false);
                setConnectionPollingAttempts(0);
                await pollForQR();
              }}
              isRefreshing={isPollingForQR}
            />
            
            {/* Connection status indicator */}
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
            
            {/* Back to disconnect view button */}
            <div className="text-center">
              <button
                onClick={() => {
                  setManualReconnectStarted(false);
                  setQrCode(null);
                  setIsPollingForQR(false);
                  setPollingAttempts(0);
                  setIsPollingConnection(false);
                  setConnectionPollingAttempts(0);
                }}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                חזור
              </button>
            </div>
          </div>
        </Layout>
      );
    }

    // If user started manual reconnection but no QR yet, show loading
    if (manualReconnectStarted && isPollingForQR) {
      return (
        <Layout>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">מתחבר מחדש...</h1>
              <p className="text-gray-600">מכין קוד QR להתחברות</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">מחכה לקוד QR...</h3>
              <p className="text-sm mb-2">מכין את הקוד לסריקה</p>
              <p className="text-xs">ניסיון {pollingAttempts + 1} מתוך 30</p>
            </div>
          </div>
        </Layout>
      );
    }

    // Default disconnected state - show reconnect button
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">וואטסאפ מנותק</h1>
            <p className="text-gray-600">הוואטסאפ שלך נותק מהשירות</p>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
            <div className="p-4 bg-orange-100 rounded-full w-fit mx-auto mb-4">
              <WifiOff className="h-8 w-8 text-orange-600" />
            </div>
            
            <h3 className="text-lg font-semibold mb-2">החיבור נותק</h3>
            <p className="text-gray-600 mb-4">
              כדי להמשיך לשלוח הודעות, תצטרך להתחבר מחדש לוואטסאפ
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-right">
              <p className="text-sm text-blue-800">
                💡 לחיצה על הכפתור תתחיל תהליך חיבור מחדש עם QR קוד
              </p>
            </div>
            
            <button
              onClick={handleManualReconnect}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              disabled={isPollingForQR || manualReconnectStarted}
            >
              {(isPollingForQR || manualReconnectStarted) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block ml-2"></div>
                  מתחבר...
                </>
              ) : (
                'התחבר שוב לוואטסאפ'
              )}
            </button>
          </div>
        </div>
      </Layout>
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
    // Stop connection polling when refreshing QR
    setIsPollingConnection(false);
    setConnectionPollingAttempts(0);
    await pollForQR();
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
         ['qr', 'active', 'ready', 'initializing'].includes(profile?.instance_status || '') && 
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
                    onClick={async () => {
                      setIsPollingForQR(true);
                      setPollingAttempts(0);
                      await pollForQR();
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
        {qrCode && !manualReconnectStarted && (
          <div>
            <WhatsAppQRDisplay 
              qrCode={qrCode} 
              onRefreshQR={handleRefreshQR}
              isRefreshing={isPollingForQR}
            />
            
            {/* Connection status indicator */}
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