import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppLoadingState from '@/components/WhatsAppLoadingState';
import WhatsAppConnectedView from '@/components/WhatsAppConnectedView';
import WhatsAppInitialState from '@/components/WhatsAppInitialState';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppSimple } from '@/hooks/useWhatsAppSimple';
import { toast } from '@/hooks/use-toast';

const WhatsAppConnect = () => {
  const { user, isAuthReady } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const { 
    createChannel, 
    getQRCode, 
    checkStatus, 
    startConnectionPolling,
    isCreatingChannel, 
    isGettingQR 
  } = useWhatsAppSimple();
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingCleanupRef = useRef<(() => void) | null>(null);

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    userId: user?.id,
    profileStatus: profile?.instance_status,
    hasInstanceId: !!profile?.instance_id,
    qrCode: !!qrCode,
    isPolling
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
      }
    };
  }, []);

  // Auto-get QR when channel is ready
  useEffect(() => {
    const shouldGetQR = 
      profile?.instance_id && 
      ['unauthorized', 'initializing'].includes(profile?.instance_status || '') &&
      !qrCode && 
      !isGettingQR &&
      !isCreatingChannel;
    
    if (shouldGetQR) {
      console.log('🚀 Auto-getting QR code...');
      handleGetQR();
    }
  }, [profile?.instance_status, profile?.instance_id]);

  // Loading states
  if (!isAuthReady || profileLoading) {
    return <WhatsAppLoadingState />;
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-8">
          <p className="text-gray-600">יש להתחבר תחילה</p>
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
            if (pollingCleanupRef.current) {
              pollingCleanupRef.current();
              pollingCleanupRef.current = null;
            }
            await deleteInstance.mutateAsync();
            await refetchProfile();
            setQrCode(null);
            setIsPolling(false);
          } catch (error) {
            console.error('❌ Disconnect failed:', error);
          }
        }}
        isSyncingGroups={syncGroups.isPending}
        isDisconnecting={deleteInstance.isPending}
      />
    );
  }

  // Event handlers
  const handleCreateChannel = async () => {
    try {
      await createChannel.mutateAsync();
      await refetchProfile();
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
    }
  };

  const handleGetQR = async () => {
    try {
      const result = await getQRCode.mutateAsync();
      
      if (result.already_connected) {
        await refetchProfile();
      } else if (result.qr_code) {
        setQrCode(result.qr_code_url || result.qr_code);
        
        // Start AGGRESSIVE polling for connection
        console.log('🔄 Starting aggressive connection detection...');
        setIsPolling(true);
        
        // Stop any existing polling
        if (pollingCleanupRef.current) {
          pollingCleanupRef.current();
        }
        
        pollingCleanupRef.current = startConnectionPolling(async () => {
          console.log('✅ Connection detected by polling!');
          setIsPolling(false);
          setQrCode(null);
          await refetchProfile();
          pollingCleanupRef.current = null;
        });
      }
    } catch (error) {
      console.error('❌ QR failed:', error);
    }
  };

  const handleRefreshQR = async () => {
    // Stop current polling
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
      pollingCleanupRef.current = null;
    }
    setIsPolling(false);
    setQrCode(null);
    await handleGetQR();
  };

  const handleManualCheck = async () => {
    try {
      const result = await checkStatus.mutateAsync();
      
      if (result.connected) {
        if (pollingCleanupRef.current) {
          pollingCleanupRef.current();
          pollingCleanupRef.current = null;
        }
        setIsPolling(false);
        setQrCode(null);
        await refetchProfile();
      } else {
        toast({
          title: "עדיין לא מחובר",
          description: `סטטוס: ${result.status}`,
        });
      }
    } catch (error) {
      console.error('❌ Manual status check failed:', error);
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

        {/* No channel */}
              {!profile?.instance_id && (
              <WhatsAppInitialState 
              onCreateChannel={handleCreateChannel}
              />
        )}

        {/* Channel creating */}
        {isCreatingChannel && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">יוצר ערוץ WhatsApp...</h3>
            <p className="text-sm text-blue-600">זה יקח כ-90 שניות</p>
          </div>
        )}

        {/* Channel ready, getting QR */}
        {profile?.instance_id && 
         ['unauthorized', 'initializing'].includes(profile?.instance_status || '') && 
         !qrCode && 
         !isCreatingChannel && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <div className="text-yellow-800">
              {isGettingQR ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold mb-2">מקבל קוד QR...</h3>
                  <p className="text-sm">הערוץ מוכן, מכין קוד QR</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">ערוץ מוכן</h3>
                  <p className="text-sm mb-4">לחץ לקבלת קוד QR</p>
                  <button
                    onClick={handleGetQR}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    קבל קוד QR
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* QR Code Display with AGGRESSIVE polling indicator */}
        {qrCode && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">סרוק את קוד ה-QR</h3>
              
              <div className="mb-4">
                <img 
                  src={qrCode} 
                  alt="QR Code" 
                  className="mx-auto border rounded-lg"
                  style={{ maxWidth: '300px', width: '100%' }}
                />
              </div>
              
              {/* ENHANCED: Aggressive polling indicator */}
              {isPolling && (
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <div className="animate-pulse rounded-full h-2 w-2 bg-green-500"></div>
                    <div className="animate-bounce rounded-full h-2 w-2 bg-blue-500"></div>
                  </div>
                  <div className="text-center">
                    <span className="text-blue-700 font-semibold text-sm">🔍 מזהה חיבור באופן אוטומטי</span>
                    <p className="text-xs text-blue-600 mt-1">
                      בודק כל 3 שניות • זיהוי מיידי לאחר סריקה
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2 mb-6">
                <p className="text-sm text-gray-600">
                  📱 1. פתח את הוואטסאפ בטלפון שלך
                </p>
                <p className="text-sm text-gray-600">
                  ⚙️ 2. לך ל"הגדרות" → "מכשירים מקושרים"
                </p>
                <p className="text-sm text-gray-600">
                  📷 3. סרוק את הקוד הזה
                </p>
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-xs text-green-700">
                    ✨ החיבור יזוהה אוטומטית תוך שניות מהסריקה
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={handleRefreshQR}
                    disabled={isGettingQR}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    🔄 רענן QR
                  </button>
                  <button
                    onClick={handleManualCheck}
                    disabled={checkStatus.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {checkStatus.isPending ? '🔍 בודק...' : '✅ בדוק חיבור'}
                  </button>
                </div>
                
                {isPolling && (
                  <button
                    onClick={() => {
                      if (pollingCleanupRef.current) {
                        pollingCleanupRef.current();
                        pollingCleanupRef.current = null;
                      }
                      setIsPolling(false);
                    }}
                    className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                  >
                    🛑 עצור זיהוי אוטומטי
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold mb-2">🔧 Debug Info:</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <strong>Instance:</strong>
                <pre className="text-gray-600 mt-1">
                  {JSON.stringify({
                    hasInstanceId: !!profile?.instance_id,
                    instanceStatus: profile?.instance_status,
                    instanceId: profile?.instance_id?.substring(0, 20) + '...'
                  }, null, 2)}
                </pre>
              </div>
              <div>
                <strong>State:</strong>
                <pre className="text-gray-600 mt-1">
                  {JSON.stringify({
                    hasQrCode: !!qrCode,
                    isPolling,
                    isGettingQR,
                    isCreatingChannel,
                    hasPollingCleanup: !!pollingCleanupRef.current
                  }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;