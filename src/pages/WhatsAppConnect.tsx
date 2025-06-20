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

  // Update connection step based on profile - but only after user initiates connection
  useEffect(() => {
    if (profile && profileLoading === false && isAuthReady) {
      console.log('📊 Evaluating profile for connection step:', {
        instance_status: profile.instance_status,
        has_instance_id: !!profile.instance_id,
        has_token: !!profile.whapi_token,
        userInitiatedConnection
      });
      
      if (profile.instance_status === 'connected') {
        console.log('✅ Profile shows connected status');
        setConnectionStep('connected');
      } else if (profile.instance_id && profile.whapi_token && profile.instance_status === 'unauthorized') {
        console.log('🔑 Profile has instance and token, ready for connection');
        setConnectionStep('choose_method');
      } else if (userInitiatedConnection && profile.instance_id && profile.whapi_token && profile.instance_status === 'initializing') {
        console.log('⏳ Profile shows initializing status after user action');
        setConnectionStep('creating_channel');
      } else {
        console.log('🎯 Starting fresh - showing initial view');
        setConnectionStep('initial');
        setUserInitiatedConnection(false);
      }
      
      // Reset polling attempts when profile changes
      setPollingAttempts(0);
    } else if (!profile && !profileLoading && profileError) {
      console.log('👤 Profile error - showing initial view');
      setConnectionStep('initial');
      setUserInitiatedConnection(false);
    }
  }, [profile, profileLoading, profileError, userInitiatedConnection, isAuthReady]);

  // Intelligent polling when channel is being created
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    const maxPollingAttempts = 20;
    
    if (connectionStep === 'creating_channel' && profile?.instance_id && profile?.whapi_token && pollingAttempts < maxPollingAttempts) {
      console.log('🔄 Starting status polling, attempt:', pollingAttempts + 1);
      
      pollInterval = setInterval(async () => {
        try {
          console.log('📡 Checking channel status via manual sync...');
          
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
            }
          }
        } catch (error) {
          console.error('❌ Polling error:', error);
        }
        
        setPollingAttempts(prev => prev + 1);
      }, 3000);
      
      setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          console.log('⏰ Polling timeout reached');
          
          if (pollingAttempts >= maxPollingAttempts) {
            toast({
              title: "יצירת הערוץ לוקחת זמן רב מהצפוי",
              description: "נסה לרענן את הדף או ליצור ערוץ חדש",
              variant: "destructive",
            });
          }
        }
      }, maxPollingAttempts * 3000);
    }
    
    return () => {
      if (pollInterval) {
        console.log('🛑 Stopping status polling');
        clearInterval(pollInterval);
      }
    };
  }, [connectionStep, profile?.instance_id, profile?.whapi_token, pollingAttempts, user?.id, refetchProfile]);

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
    
    // Prevent multiple clicks
    if (isCreatingChannel) {
      console.log('⚠️ Channel creation already in progress');
      return;
    }
    
    console.log('🚀 User clicked create channel button');
    
    setIsCreatingChannel(true);
    setUserInitiatedConnection(true);
    setConnectionStep('creating_channel');
    setPollingAttempts(0);
    
    try {
      console.log('🔄 Calling whapi-partner-login function...');
      
      const { data, error } = await supabase.functions.invoke('whapi-partner-login', {
        body: { userId: user.id }
      });
      
      console.log('📥 Function response received:', {
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
      
      console.log('✅ Channel creation result:', data);
      
      // Refresh profile to get new channel data
      console.log('🔄 Refreshing profile to get new channel data...');
      const refreshResult = await refetchProfile();
      
      if (data.channel_ready) {
        console.log('🎯 Channel is immediately ready!');
        setConnectionStep('choose_method');
        
        toast({
          title: "ערוץ נוצר ומוכן!",
          description: "בחר איך תרצה להתחבר לוואטסאפ",
        });
      } else {
        console.log('⏳ Channel created, waiting for initialization...');
        
        toast({
          title: "יוצר ערוץ...",
          description: "זה עשוי לקחת כמה שניות",
        });
      }
      
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      
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
