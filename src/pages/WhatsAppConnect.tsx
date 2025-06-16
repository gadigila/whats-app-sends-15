
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import WhatsAppQrSection from '@/components/WhatsAppQrSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Smartphone, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const WhatsAppConnect = () => {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check user's WhatsApp status on load
  useEffect(() => {
    if (user?.id) {
      console.log('🔍 Checking user WhatsApp status for:', user.id);
      checkUserStatus();
    }
  }, [user?.id]);

  const checkUserStatus = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      console.log('📡 Fetching user profile for status check');
      const { data, error } = await supabase
        .from('profiles')
        .select('instance_status')
        .eq('id', user?.id)
        .maybeSingle();
        
      console.log('📥 Profile data:', { data, error });
      
      if (error) throw error;
      if (data?.instance_status === 'connected') {
        console.log('✅ User already connected');
        setConnectionStatus('connected');
      } else {
        console.log('❌ User not connected, status:', data?.instance_status);
        setConnectionStatus('disconnected');
      }
    } catch (e: any) {
      console.error('💥 Status check failed:', e);
      setErrorMsg(e.message || 'שגיאה בטעינת סטטוס החיבור');
    } finally {
      setLoading(false);
    }
  };

  // Called when QR component reports success
  const handleQrConnected = () => {
    console.log('🎉 QR connection successful');
    setConnectionStatus('connected');
  };

  const handleStart = async () => {
    if (!user?.id) return;
    console.log('🚀 Starting WhatsApp connection for user:', user.id);
    setConnectionStatus('connecting');
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    console.log('🔌 Disconnecting WhatsApp for user:', user.id);
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { userId: user.id, action: 'disconnect' }
      });
      
      console.log('📥 Disconnect response:', { data, error });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setConnectionStatus('disconnected');
      toast({
        title: "נותק בהצלחה",
        description: "החשבון נותק מהשירות.",
      });
    } catch (error: any) {
      console.error('💥 Disconnect failed:', error);
      setErrorMsg(error.message || "שגיאה בניתוק");
    } finally {
      setLoading(false);
    }
  };

  if (errorMsg) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto flex flex-col items-center min-h-[75vh] justify-center gap-8">
          <div className="text-center">
            <h1 className="text-2xl text-red-600 font-bold mb-4">שגיאה</h1>
            <p className="text-gray-700 mb-6">{errorMsg}</p>
            <Button onClick={checkUserStatus}>נסה שוב</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (connectionStatus === 'connected') {
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
                  onClick={handleDisconnect}
                  variant="outline"
                  disabled={loading}
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4 mr-2" />}
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
                  <span className="text-gray-600">פעילות אחרונה:</span>
                  <span className="font-medium">זמין</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Main connection UI
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">חבר את הוואטסאפ שלך</h1>
          <p className="text-gray-600">
            {connectionStatus === 'connecting'
              ? 'סרוק את קוד ה-QR עם הוואטסאפ שלך כדי להתחבר'
              : 'התחבר לוואטסאפ כדי להתחיל לשלוח הודעות לקבוצות שלך'}
          </p>
        </div>
        <Card>
          <CardContent className="p-8">
            {connectionStatus === 'connecting' && user?.id ? (
              <WhatsAppQrSection userId={user.id} onConnected={handleQrConnected} />
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
                <Button
                  onClick={handleStart}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
