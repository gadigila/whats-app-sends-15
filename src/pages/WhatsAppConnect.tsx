
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppConnector from '@/components/WhatsAppConnector';
import PhoneAuthConnector from '@/components/PhoneAuthConnector';
import WhatsAppInstructions from '@/components/WhatsAppInstructions';
import WhatsAppLoadingState from '@/components/WhatsAppLoadingState';
import WhatsAppConnectedView from '@/components/WhatsAppConnectedView';
import { toast } from '@/hooks/use-toast';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const WhatsAppConnect = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'channel_created' | 'connecting' | 'connected'>('disconnected');

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

  // Update connection status based on profile
  useEffect(() => {
    if (profile) {
      if (profile.instance_status === 'connected') {
        setConnectionStatus('connected');
      } else if (profile.instance_id && profile.whapi_token) {
        // Channel exists, show connection options
        setConnectionStatus('channel_created');
      } else {
        setConnectionStatus('disconnected');
      }
    }
  }, [profile]);

  const handleChannelCreated = () => {
    console.log('🎉 Channel created successfully');
    setConnectionStatus('channel_created');
    refetchProfile();
  };

  const handleConnecting = () => {
    console.log('🔄 Starting connection process');
    setConnectionStatus('connecting');
  };

  const handleConnected = async () => {
    console.log('🎉 WhatsApp connected successfully');
    setConnectionStatus('connected');
    
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

  const handleNavigateToCompose = () => {
    window.location.href = '/compose';
  };

  if (profileLoading) {
    return <WhatsAppLoadingState />;
  }

  // Connected state
  if (connectionStatus === 'connected') {
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
            {connectionStatus === 'disconnected' && (
              <WhatsAppConnector 
                userId={user.id} 
                onChannelCreated={handleChannelCreated}
                mode="create-channel"
              />
            )}
            
            {(connectionStatus === 'channel_created' || connectionStatus === 'connecting') && (
              <Tabs defaultValue="qr" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr">קוד QR</TabsTrigger>
                  <TabsTrigger value="phone">מספר טלפון</TabsTrigger>
                </TabsList>
                
                <TabsContent value="qr" className="space-y-4">
                  <WhatsAppConnector 
                    userId={user.id} 
                    onConnected={handleConnected}
                    onConnecting={handleConnecting}
                    mode="qr-connect"
                  />
                </TabsContent>
                
                <TabsContent value="phone" className="space-y-4">
                  <PhoneAuthConnector 
                    onConnected={handleConnected}
                    onConnecting={handleConnecting}
                  />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
        
        <WhatsAppInstructions />
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
