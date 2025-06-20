import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import WhatsAppInstructions from '@/components/WhatsAppInstructions';
import WhatsAppLoadingState from '@/components/WhatsAppLoadingState';
import WhatsAppConnectedView from '@/components/WhatsAppConnectedView';
import WhatsAppInitialView from '@/components/WhatsAppInitialView';
import WhatsAppCreatingChannel from '@/components/WhatsAppCreatingChannel';
import WhatsAppMethodSelection from '@/components/WhatsAppMethodSelection';
import WhatsAppConnectingView from '@/components/WhatsAppConnectingView';
import { toast } from '@/hooks/use-toast';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';

const WhatsAppConnect = () => {
  const { user, isAuthReady } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const [connectionStep, setConnectionStep] = useState<'initial' | 'creating_channel' | 'choose_method' | 'connecting' | 'connected'>('initial');
  const [selectedMethod, setSelectedMethod] = useState<'qr' | 'phone' | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [userInitiatedConnection, setUserInitiatedConnection] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  console.log('🔄 WhatsAppConnect render:', {
    isAuthReady,
    user: user?.email,
    userId: user?.id,
    profileLoading,
    profileError: profileError?.message,
    profile: profile ? {
      instance_id: profile.instance_id,
      instance_status: profile.instance_status,
      has_token: !!profile.whapi_token
    } : null,
    connectionStep,
    userInitiatedConnection,
    pollingAttempts,
    isCreatingChannel
  });

  // Handle profile errors
  useEffect(() => {
    if (profileError) {
      console.error('❌ Profile error:', profileError);
      toast({
        title: "שגיאה בטעינת הפרופיל",
        description: "נסה לרענן את הדף",
        variant: "destructive",
      });
    }
  }, [profileError]);

  // Enhanced connection step evaluation
  useEffect(() => {
    if (profile && profileLoading === false && isAuthReady) {
      console.log('📊 Enhanced evaluation of profile for connection step:', {
        instance_status: profile.instance_status,
        has_instance_id: !!profile.instance_id,
        has_token: !!profile.whapi_token,
        userInitiatedConnection
      });
      
      if (profile.instance_status === 'connected') {
        console.log('✅ Profile shows connected status');
        setConnectionStep('connected');
      } else if (profile.instance_id && profile.whapi_token) {
        // Enhanced status handling
        if (profile.instance_status === 'unauthorized') {
          console.log('🔑 Channel ready for connection');
          setConnectionStep('choose_method');
        } else if (profile.instance_status === 'initializing' && userInitiatedConnection) {
          console.log('⏳ Channel still initializing after user action');
          setConnectionStep('creating_channel');
        } else {
          console.log('🔍 Channel exists but status unclear, checking...');
          setConnectionStep('choose_method'); // Let the QR component handle the status checking
        }
      } else {
        console.log('🎯 No valid channel - showing initial view');
        setConnectionStep('initial');
        setUserInitiatedConnection(false);
      }
      
      setPollingAttempts(0);
    } else if (!profile && !profileLoading && profileError) {
      console.log('👤 Profile error - showing initial view');
      setConnectionStep('initial');
      setUserInitiatedConnection(false);
    }
  }, [profile, profileLoading, profileError, userInitiatedConnection, isAuthReady]);

  // Enhanced polling for channel initialization
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    const maxPollingAttempts = 15; // Reduced from 20 for faster feedback
    
    if (connectionStep === 'creating_channel' && profile?.instance_id && profile?.whapi_token && pollingAttempts < maxPollingAttempts) {
      console.log('🔄 Starting enhanced status polling, attempt:', pollingAttempts + 1);
      
      pollInterval = setInterval(async () => {
        try {
          console.log('📡 Enhanced channel status check...');
          
          const { data, error } = await supabase.functions.invoke('whapi-manual-status-sync', {
            body: { userId: user?.id }
          });
          
          if (error) {
            console.error('❌ Manual status sync error:', error);
          } else {
            console.log('📊 Manual status sync result:', data);
            
            const refreshResult = await refetchProfile();
            console.log('🔄 Profile refresh result:', {
              success: !!refreshResult.data,
              newStatus: refreshResult.data?.instance_status
            });
            
            if (refreshResult.data?.instance_status === 'unauthorized') {
              console.log('🎉 Channel is now ready for connection!');
              setConnectionStep('choose_method');
              clearInterval(pollInterval);
              
              toast({
                title: "ערוץ מוכן!",
                description: "כעת תוכל לבחור איך להתחבר לוואטסאפ",
              });
              
              return;
            } else if (refreshResult.data?.instance_status === 'connected') {
              console.log('🎉 Channel is already connected!');
              setConnectionStep('connected');
              clearInterval(pollInterval);
              return;
            }
          }
        } catch (error) {
          console.error('❌ Enhanced polling error:', error);
        }
        
        setPollingAttempts(prev => prev + 1);
      }, 3000); // 3 second intervals
      
      // Enhanced timeout handling
      setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          console.log('⏰ Enhanced polling timeout reached');
          
          if (pollingAttempts >= maxPollingAttempts) {
            toast({
              title: "יצירת הערוץ לוקחת זמן רב מהצפוי",
              description: "תוכל לנסות לרענן או ליצור ערוץ חדש",
              variant: "destructive",
            });
            
            // Auto-transition to method selection anyway - let QR component handle retries
            setConnectionStep('choose_method');
          }
        }
      }, maxPollingAttempts * 3000);
    }
    
    return () => {
      if (pollInterval) {
        console.log('🛑 Stopping enhanced status polling');
        clearInterval(pollInterval);
      }
    };
  }, [connectionStep, profile?.instance_id, profile?.whapi_token, pollingAttempts, user?.id, refetchProfile]);

  // Enhanced channel creation with better error handling
  const handleCreateChannel = async () => {
    if (!user?.id) {
      console.error('❌ No user ID available');
      toast({
        title: "שגיאה",
        description: "לא נמצא מזהה משתמש",
        variant: "destructive",
      });
      return;
    }
    
    if (isCreatingChannel) {
      console.log('⚠️ Channel creation already in progress');
      return;
    }
    
    console.log('🚀 Enhanced channel creation process started');
    
    setIsCreatingChannel(true);
    setUserInitiatedConnection(true);
    setConnectionStep('creating_channel');
    setPollingAttempts(0);
    
    try {
      console.log('🔄 Calling enhanced whapi-partner-login function...');
      
      const { data, error } = await supabase.functions.invoke('whapi-partner-login', {
        body: { userId: user.id }
      });
      
      console.log('📥 Enhanced function response received:', {
        hasData: !!data,
        hasError: !!error,
        data: data || null,
        error: error || null
      });
      
      if (error) {
        console.error('❌ Supabase function error:', error);
        throw new Error(`Function error: ${error.message}`);
      }
      
      if (!data) {
        console.error('❌ No data returned from function');
        throw new Error('No data returned from function');
      }
      
      if (data.error) {
        console.error('❌ Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      console.log('✅ Enhanced channel creation result:', data);
      
      // Refresh profile to get new channel data
      console.log('🔄 Refreshing profile to get new channel data...');
      const refreshResult = await refetchProfile();
      
      if (data.existing_instance) {
        console.log('🔄 Using existing instance');
        setConnectionStep('choose_method');
        
        toast({
          title: "ערוץ קיים נמצא!",
          description: "משתמש בחיבור הקיים שלך",
        });
      } else if (data.channel_ready) {
        console.log('🎯 New channel is immediately ready!');
        setConnectionStep('choose_method');
        
        toast({
          title: "ערוץ נוצר ומוכן!",
          description: "בחר איך תרצה להתחבר לוואטסאפ",
        });
      } else {
        console.log('⏳ Channel created, waiting for initialization...');
        
        toast({
          title: "יוצר ערוץ...",
          description: "זה עשוי לקחת עד דקה",
        });
      }
      
    } catch (error) {
      console.error('❌ Enhanced channel creation failed:', error);
      
      setConnectionStep('initial');
      setPollingAttempts(0);
      setUserInitiatedConnection(false);
      
      toast({
        title: "שגיאה ביצירת ערוץ",
        description: error?.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleResetAndStart = async () => {
    if (!user?.id) return;
    
    try {
      console.log('🧹 Resetting user profile and starting fresh...');
      
      // Clean up database
      await supabase
        .from('profiles')
        .update({
          instance_id: null,
          whapi_token: null,
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      // Reset state
      setConnectionStep('initial');
      setSelectedMethod(null);
      setPollingAttempts(0);
      setUserInitiatedConnection(false);
      setIsCreatingChannel(false);
      
      // Refresh profile
      await refetchProfile();
      
      toast({
        title: "איפוס הושלם",
        description: "כעת תוכל להתחיל מחדש",
      });
      
    } catch (error) {
      console.error('❌ Reset failed:', error);
      toast({
        title: "שגיאה באיפוס",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  };

  const handleMethodSelect = (method: 'qr' | 'phone') => {
    console.log('📱 Method selected:', method);
    setSelectedMethod(method);
    setConnectionStep('connecting');
  };

  const handleConnected = async () => {
    console.log('🎉 WhatsApp connected successfully');
    setConnectionStep('connected');
    
    await refetchProfile();
    
    try {
      console.log('📱 Syncing groups...');
      await syncGroups.mutateAsync();
    } catch (error) {
      console.error('Failed to sync groups:', error);
    }
    
    toast({
      title: "וואטסאפ מחובר!",
      description: "החיבור הושלם בהצלחה",
    });
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    
    try {
      await deleteInstance.mutateAsync();
      await refetchProfile();
      setConnectionStep('initial');
      setSelectedMethod(null);
      setPollingAttempts(0);
      setUserInitiatedConnection(false);
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

  const handleNavigateToCompose = () => {
    window.location.href = '/compose';
  };

  const handleBackToMethodSelection = () => {
    setConnectionStep('choose_method');
    setSelectedMethod(null);
  };

  // Show loading only when auth is not ready or profile is loading
  if (!isAuthReady || (profileLoading && !profileError)) {
    console.log('⏳ Still loading...', { isAuthReady, profileLoading, hasProfileError: !!profileError });
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
  if (connectionStep === 'connected') {
    console.log('🎉 Showing connected view');
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
          if (!user?.id) return;
          
          try {
            await deleteInstance.mutateAsync();
            await refetchProfile();
            setConnectionStep('initial');
            setSelectedMethod(null);
            setPollingAttempts(0);
            setUserInitiatedConnection(false);
          } catch (error) {
            console.error('❌ Disconnect failed:', error);
          }
        }}
        isSyncingGroups={syncGroups.isPending}
        isDisconnecting={deleteInstance.isPending}
      />
    );
  }

  // Main connection flow
  console.log('🎯 Rendering main connection flow, step:', connectionStep);
  
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">חבר את הוואטסאפ שלך</h1>
          <p className="text-gray-600">
            חבר את הוואטסאפ שלך כדי להתחיל לשלוח הודעות לקבוצות
          </p>
        </div>
        
        {/* Emergency Reset Button */}
        {(profile?.instance_id || connectionStep !== 'initial') && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={handleResetAndStart}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              🧹 אפס הכל והתחל מחדש
            </Button>
          </div>
        )}
        
        {/* Step 1: Initial - Main Connect Button */}
        {connectionStep === 'initial' && (
          <WhatsAppInitialView 
            onConnect={handleCreateChannel} 
          />
        )}
        
        {/* Step 2: Creating Channel - Loading State with Polling */}
        {connectionStep === 'creating_channel' && (
          <WhatsAppCreatingChannel />
        )}
        
        {/* Step 3: Choose Connection Method */}
        {connectionStep === 'choose_method' && (
          <WhatsAppMethodSelection onMethodSelect={handleMethodSelect} />
        )}
        
        {/* Step 4: Connecting with Selected Method */}
        {connectionStep === 'connecting' && selectedMethod && user.id && (
          <WhatsAppConnectingView
            selectedMethod={selectedMethod}
            userId={user.id}
            onConnected={handleConnected}
            onBackToMethodSelection={handleBackToMethodSelection}
          />
        )}
        
        <WhatsAppInstructions />
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
