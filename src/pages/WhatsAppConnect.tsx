
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

  console.log('🔄 WhatsAppConnect render:', {
    user: user?.email,
    profileLoading,
    profile: profile ? {
      instance_id: profile.instance_id,
      instance_status: profile.instance_status,
      has_token: !!profile.whapi_token
    } : null,
    connectionStep
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
    }
  }, [profile]);

  const handleCreateChannel = async () => {
    if (!user?.id) return;
    
    setConnectionStep('creating_channel');
    
    try {
      console.log('🔄 Creating WhatsApp channel...');
      
      const { data, error } = await supabase.functions.invoke('whapi-partner-login', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      console.log('✅ Channel created successfully:', data);
      
      // Refresh profile to get new channel data
      await refetchProfile();
      
      toast({
        title: "ערוץ נוצר בהצלחה!",
        description: "כעת תוכל לבחור איך להתחבר לוואטסאפ",
      });
      
      // Wait a moment for the status to update, then move to next step
      setTimeout(() => {
        setConnectionStep('choose_method');
      }, 1000);
      
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      setConnectionStep('initial');
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
            
            {/* Step 2: Creating Channel - Loading State */}
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
