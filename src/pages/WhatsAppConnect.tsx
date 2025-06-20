
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, CheckCircle } from 'lucide-react';

const WhatsAppConnect = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { deleteInstance } = useWhatsAppInstance();
  const { syncGroups } = useWhatsAppGroups();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'channel_ready' | 'connecting' | 'connected'>('disconnected');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

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
        // Channel exists and ready for connection
        setConnectionStatus('channel_ready');
      } else {
        setConnectionStatus('disconnected');
      }
    }
  }, [profile]);

  const handleCreateChannel = async () => {
    if (!user?.id) return;
    
    setIsCreatingChannel(true);
    
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
      
      setConnectionStatus('channel_ready');
      
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      toast({
        title: "שגיאה ביצירת ערוץ",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setIsCreatingChannel(false);
    }
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
            {/* Step 1: Create Channel */}
            {connectionStatus === 'disconnected' && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
                    <Smartphone className="h-12 w-12 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    מוכן להתחבר לוואטסאפ?
                  </h3>
                  <p className="text-gray-600 mb-6">
                    נתחיל ביצירת חיבור בטוח בינך לבין וואטסאפ
                  </p>
                  <Button
                    onClick={handleCreateChannel}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                    disabled={isCreatingChannel}
                  >
                    {isCreatingChannel ? "יוצר חיבור..." : "אני מוכן להתחבר עכשיו!"}
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Step 2: Channel Ready - Choose Connection Method */}
            {connectionStatus === 'channel_ready' && (
              <>
                <Card className="mb-4">
                  <CardContent className="p-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">ערוץ נוצר בהצלחה!</span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      כעת בחר איך תרצה להתחבר לוואטסאפ שלך
                    </p>
                  </CardContent>
                </Card>
                
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
              </>
            )}
            
            {/* Step 3: Connecting State */}
            {connectionStatus === 'connecting' && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <h3 className="text-lg font-semibold">מתחבר לוואטסאפ...</h3>
                    <p className="text-gray-600 text-sm">
                      אנא המתן, התהליך עשוי לקחת כמה רגעים
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
        
        <WhatsAppInstructions />
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
