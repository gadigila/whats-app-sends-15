
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Smartphone, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const WhatsAppConnect = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Check user's current WhatsApp status on load
  useEffect(() => {
    if (user?.id) {
      checkUserStatus();
    }
  }, [user?.id]);

  // Poll for status updates when connecting
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (connectionStatus === 'connecting') {
      interval = setInterval(() => {
        checkConnectionStatus();
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionStatus]);

  const checkUserStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if ((data as any)?.instance_status === 'connected') {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  };

  const startConnection = async () => {
    if (!user?.id) return;

    setLoading(true);
    setConnectionStatus('connecting');
    
    try {
      // Setup instance behind the scenes
      const { data: instanceData, error: instanceError } = await supabase.functions.invoke('instance-manager', {
        body: { userId: user.id }
      });

      if (instanceError) throw instanceError;

      // Get QR code for connection
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { userId: user.id, action: 'get_qr' }
      });

      if (error) throw error;

      if (data?.success && data.qr_code) {
        setQrCode(data.qr_code);
        toast({
          title: "קוד QR מוכן!",
          description: "סרוק את הקוד עם הוואטסאפ שלך.",
        });
      } else {
        throw new Error(data?.error || 'Failed to get QR code');
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "שגיאה בחיבור",
        description: error.message || "לא הצלחנו להתחיל את החיבור. נסה שוב.",
        variant: "destructive"
      });
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const refreshQrCode = async () => {
    if (!user?.id) return;

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { userId: user.id, action: 'get_qr' }
      });

      if (error) throw error;

      if (data?.success && data.qr_code) {
        setQrCode(data.qr_code);
        toast({
          title: "קוד QR חודש!",
          description: "סרוק את הקוד החדש עם הוואטסאפ שלך.",
        });
      }
    } catch (error) {
      console.error('QR refresh error:', error);
      toast({
        title: "שגיאה ברענון קוד QR",
        description: "נסה שוב בעוד כמה רגעים.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    if (!user?.id || checkingStatus) return;

    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { userId: user.id, action: 'check_status' }
      });

      if (error) throw error;

      if (data?.success) {
        const isConnected = data.connected;
        setConnectionStatus(isConnected ? 'connected' : 'connecting');
        
        if (isConnected) {
          setQrCode(null);
          toast({
            title: "וואטסאפ מחובר!",
            description: "החיבור הושלם בהצלחה.",
          });
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { userId: user.id, action: 'disconnect' }
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus('disconnected');
        setQrCode(null);
        toast({
          title: "וואטסאפ נותק",
          description: "החיבור נותק בהצלחה.",
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "שגיאה בניתוק",
        description: "לא הצלחנו לנתק את הוואטסאפ. נסה שוב.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">חבר את הוואטסאפ שלך</h1>
          <p className="text-gray-600">
            {connectionStatus === 'connecting' && qrCode ? 
              'סרוק את קוד ה-QR עם הוואטסאפ שלך כדי להתחבר' :
              'התחבר לוואטסאפ כדי להתחיל לשלוח הודעות לקבוצות שלך'
            }
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            {connectionStatus === 'connecting' && qrCode ? (
              // Show QR code for scanning
              <div className="text-center">
                <div className="p-4 bg-gray-50 rounded-2xl w-fit mx-auto mb-6">
                  <img 
                    src={qrCode} 
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  סרוק קוד QR
                </h2>
                
                <div className="text-right space-y-3 mb-6 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <p className="text-sm text-gray-700">פתח וואטסאפ בטלפון שלך</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <p className="text-sm text-gray-700">עבור להגדרות ← מכשירים מקושרים</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <p className="text-sm text-gray-700">לחץ על "קשר מכשיר" וסרוק את קוד ה-QR הזה</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-blue-600 mb-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">ממתין לחיבור...</span>
                </div>

                <Button 
                  onClick={refreshQrCode}
                  variant="outline"
                  disabled={loading}
                >
                  רענן קוד QR
                </Button>
              </div>
            ) : (
              // Show connect button
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
                  onClick={startConnection}
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
