
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
import { Smartphone, CheckCircle, MessageCircle } from 'lucide-react';

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
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
                    <MessageCircle className="h-12 w-12 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    מוכן להתחבר לוואטסאפ?
                  </h3>
                  <p className="text-gray-600 mb-6">
                    נתחיל ביצירת חיבור בטוח בינך לבין וואטסאפ
                  </p>
                  <Button
                    onClick={handleCreateChannel}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold"
                  >
                    התחבר לוואטסאפ
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Step 2: Creating Channel - Loading State */}
            {connectionStep === 'creating_channel' && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <h3 className="text-lg font-semibold">מכין את החיבור...</h3>
                    <p className="text-gray-600 text-sm">
                      יוצר ערוץ בטוח לחיבור הוואטסאפ שלך
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Step 3: Choose Connection Method */}
            {connectionStep === 'choose_method' && (
              <>
                <Card className="mb-4">
                  <CardContent className="p-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">ערוץ נוצר בהצלחה!</span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      איך תרצה לחבר את הוואטסאפ שלך?
                    </p>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* QR Code Option */}
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleMethodSelect('qr')}>
                    <CardContent className="p-6 text-center">
                      <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-4">
                        <Smartphone className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">קוד QR</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        סרוק קוד QR עם הוואטסאפ שלך
                      </p>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        בחר QR
                      </Button>
                    </CardContent>
                  </Card>
                  
                  {/* Phone Number Option */}
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleMethodSelect('phone')}>
                    <CardContent className="p-6 text-center">
                      <div className="p-4 bg-orange-50 rounded-full w-fit mx-auto mb-4">
                        <MessageCircle className="h-8 w-8 text-orange-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">מספר וואטסאפ</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        התחבר עם מספר הטלפון שלך
                      </p>
                      <Button className="w-full bg-orange-600 hover:bg-orange-700">
                        בחר מספר
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
            
            {/* Step 4: Connecting with Selected Method */}
            {connectionStep === 'connecting' && selectedMethod && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <Button
                      variant="outline"
                      onClick={handleBackToMethodSelection}
                      className="mb-4"
                    >
                      ← חזור לבחירת שיטה
                    </Button>
                  </CardContent>
                </Card>
                
                {selectedMethod === 'qr' && (
                  <WhatsAppConnector 
                    userId={user.id} 
                    onConnected={handleConnected}
                    mode="qr-connect"
                  />
                )}
                
                {selectedMethod === 'phone' && (
                  <PhoneAuthConnector 
                    onConnected={handleConnected}
                  />
                )}
              </div>
            )}
          </>
        )}
        
        <WhatsAppInstructions />
      </div>
    </Layout>
  );
};

export default WhatsAppConnect;
