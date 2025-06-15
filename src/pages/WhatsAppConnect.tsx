import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Smartphone, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const WhatsAppConnect = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Check user's current instance status on load
  useEffect(() => {
    if (user?.id) {
      checkUserInstance();
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

  const checkUserInstance = async () => {
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

      if ((data as any)?.instance_id) {
        setInstanceId((data as any).instance_id);
        setConnectionStatus((data as any).instance_status === 'connected' ? 'connected' : 'disconnected');
      }
    } catch (error) {
      console.error('Error checking user instance:', error);
    }
  };

  const createInstance = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('instance-manager', {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (data?.success) {
        setInstanceId(data.instanceId);
        toast({
          title: "אינסטנס נוצר בהצלחה!",
          description: "עכשיו תוכל להתחבר לוואטסאפ.",
        });
        // After creating instance, get QR code
        await getQrCode();
      } else {
        throw new Error(data?.error || 'Failed to create instance');
      }
    } catch (error) {
      console.error('Instance creation error:', error);
      toast({
        title: "שגיאה ביצירת אינסטנס",
        description: error.message || "לא הצלחנו ליצור אינסטנס וואטסאפ. נסה שוב.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getQrCode = async () => {
    if (!user?.id) return;

    setLoading(true);
    setConnectionStatus('connecting');
    
    try {
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
      console.error('QR code error:', error);
      toast({
        title: "שגיאה בקבלת קוד QR",
        description: error.message || "לא הצלחנו לקבל קוד QR. נסה שוב.",
        variant: "destructive"
      });
      setConnectionStatus('disconnected');
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

  const deleteInstance = async () => {
    if (!user?.id || !instanceId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('instance-manager', {
        body: { userId: user.id, instanceId }
      });

      if (error) throw error;

      if (data?.success) {
        setInstanceId(null);
        setConnectionStatus('disconnected');
        setQrCode(null);
        toast({
          title: "אינסטנס נמחק",
          description: "אינסטנס הוואטסאפ נמחק בהצלחה.",
        });
      }
    } catch (error) {
      console.error('Delete instance error:', error);
      toast({
        title: "שגיאה במחיקת אינסטנס",
        description: "לא הצלחנו למחוק את האינסטנס. נסה שוב.",
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
                  <span className="text-gray-600">אינסטנס ID:</span>
                  <span className="font-medium font-mono text-xs">{instanceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">פעילות אחרונה:</span>
                  <span className="font-medium">לפני דקותיים</span>
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
            {!instanceId ? 'צור אינסטנס חדש והתחבר לוואטסאפ' : 'סרוק את קוד ה-QR עם הוואטסאפ שלך כדי להתחבר'}
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            {!instanceId ? (
              // No instance - show create button
              <div className="text-center">
                <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-6">
                  <Smartphone className="h-12 w-12 text-blue-600" />
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  צור אינסטנס וואטסאפ
                </h2>
                
                <p className="text-gray-600 mb-6">
                  כדי להתחיל, אנחנו צריכים ליצור אינסטנס וואטסאפ חדש עבורך. זה יאפשר לך לשלוח הודעות לקבוצות שלך.
                </p>

                <Button 
                  onClick={createInstance}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  צור אינסטנס חדש
                </Button>
              </div>
            ) : connectionStatus === 'connecting' && qrCode ? (
              // Has instance and QR code - show QR
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
                  onClick={getQrCode}
                  variant="outline"
                  disabled={loading}
                  className="mr-2"
                >
                  רענן קוד QR
                </Button>
              </div>
            ) : (
              // Has instance but no QR - show connect button
              <div className="text-center">
                <div className="p-4 bg-orange-50 rounded-full w-fit mx-auto mb-6">
                  <WifiOff className="h-12 w-12 text-orange-600" />
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  וואטסאפ לא מחובר
                </h2>
                
                <p className="text-gray-600 mb-6">
                  יש לך אינסטנס וואטסאפ, אבל הוא לא מחובר. לחץ על "התחבר" כדי לקבל קוד QR חדש.
                </p>

                <div className="flex gap-3 justify-center">
                  <Button 
                    onClick={getQrCode}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    התחבר
                  </Button>
                  <Button 
                    onClick={deleteInstance}
                    variant="outline"
                    disabled={loading}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    מחק אינסטנס
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">הערות חשובות</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• השאר את הטלפון שלך מחובר לאינטרנט</li>
                  <li>• חיבורי וואטסאפ ווב פגים לאחר זמן של חוסר פעילות</li>
                  <li>• אתה יכול להתנתק בכל עת מהטלפון או מהדשבורד הזה</li>
                  <li>• כל משתמש דורש אינסטנס וואטסאפ נפרד</li>
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
