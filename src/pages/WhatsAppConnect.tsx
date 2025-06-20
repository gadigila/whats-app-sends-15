
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

const WhatsAppConnect = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const [connectionStep, setConnectionStep] = useState<'initial' | 'creating_channel' | 'choose_method' | 'connecting' | 'connected'>('initial');
  const [selectedMethod, setSelectedMethod] = useState<'qr' | 'phone' | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);

  console.log('🔄 WhatsAppConnect render:', {
    user: user?.email,
    profileLoading,
    profile: profile ? {
      instance_id: profile.instance_id,
      instance_status: profile.instance_status,
      has_token: !!profile.whapi_token
    } : null,
    connectionStep,
    pollingAttempts
  });

  // Update connection step based on profile
  useEffect(() => {
    if (profile) {
      if (profile.instance_status === 'connected') {
        setConnectionStep('connected');
      } else if (profile.instance_id && profile.whapi_token && profile.instance_status === 'unauthorized') {
        // Channel exists and ready for connection
        setConnectionStep('choose_method');
      } else if (profile.instance_id && profile.whapi_token && profile.instance_status === 'initializing') {
        // Channel is being created, wait for it to be ready
        setConnectionStep('creating_channel');
      } else {
        setConnectionStep('initial');
      }
      
      // Reset polling attempts when profile changes
      setPollingAttempts(0);
    }
  }, [profile]);

  // Intelligent polling when channel is being created
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    const maxPollingAttempts = 20; // Poll for up to 60 seconds (20 attempts * 3 seconds)
    
    if (connectionStep === 'creating_channel' && profile?.instance_id && profile?.whapi_token && pollingAttempts < maxPollingAttempts) {
      console.log('🔄 Starting status polling, attempt:', pollingAttempts + 1);
      
      pollInterval = setInterval(async () => {
        try {
          console.log('📡 Checking channel status via manual sync...');
          
          const { data, error } = await supabase.functions.invoke('whapi-manual-status-sync', {
            body: { userId: user.id }
          });
          
          if (error) {
            console.error('❌ Manual status sync error:', error);
          } else {
            console.log('📊 Manual status sync result:', data);
            
            // Refresh profile to get updated status
            const refreshResult = await refetchProfile();
            
            if (refreshResult.data?.instance_status === 'unauthorized') {
              console.log('🎉 Channel is now ready for connection!');
              setConnectionStep('choose_method');
              clearInterval(pollInterval);
              
              toast({
                title: "ערוץ מוכן!",
                description: "כעת תוכל לבחור איך להתחבר לוואטסאפ",
              });
              
              return; // Exit polling
            }
          }
        } catch (error) {
          console.error('❌ Polling error:', error);
        }
        
        setPollingAttempts(prev => prev + 1);
      }, 3000); // Poll every 3 seconds
      
      // Stop polling after max attempts
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
    if (!user?.id) return;
    
    setConnectionStep('creating_channel');
    setPollingAttempts(0);
    
    try {
      console.log('🔄 Creating WhatsApp channel...');
      
      const { data, error } = await supabase.functions.invoke('whapi-partner-login', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      console.log('✅ Channel creation result:', data);
      
      // Refresh profile to get new channel data
      await refetchProfile();
      
      if (data.channel_ready) {
        // Channel is immediately ready
        console.log('🎯 Channel is immediately ready!');
        setConnectionStep('choose_method');
        
        toast({
          title: "ערוץ נוצר ומוכן!",
          description: "בחר איך תרצה להתחבר לוואטסאפ",
        });
      } else {
        // Channel needs time to initialize
        console.log('⏳ Channel created, waiting for initialization...');
        
        toast({
          title: "יוצר ערוץ...",
          description: "זה עשוי לקחת כמה שניות",
        });
        
        // Polling will start automatically via useEffect
      }
      
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      setConnectionStep('initial');
      setPollingAttempts(0);
      
      toast({
        title: "שגיאה ביצירת ערוץ",
        description: error.message || "נסה שוב מאוחר יותר",
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
    
    // Refresh profile
    await refetchProfile();
    
    // Sync groups
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

  if (profileLoading) {
    return <WhatsAppLoadingState />;
  }

  // Connected state
  if (connectionStep === 'connected') {
    return (
      <WhatsAppConnectedView
        profile={profile}
        onNavigateToCompose={handleNavigateToCompose}
        onSyncGroups={handleSyncGroups}
        onDisconnect={handleDisconnect}
        isSyncingGroups={syncGroups.isPending}
        isDisconnecting={deleteInstance.isPending}
      />
    );
  }

  // Main connection flow
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">חבר את הוואטסאפ שלך</h1>
          <p className="text-gray-600">
            חבר את הוואטסאפ שלך כדי להתחיל לשלוח הודעות לקבוצות
          </p>
        </div>
        
        {user?.id && (
          <>
            {/* Step 1: Initial - Main Connect Button */}
            {connectionStep === 'initial' && (
              <WhatsAppInitialView onConnect={handleCreateChannel} />
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
          </>
        )}
        
        <WhatsAppInstructions />
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
