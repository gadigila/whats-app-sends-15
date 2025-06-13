
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Smartphone, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const WhatsAppConnect = () => {
  const { user, updateUser } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [qrCode] = useState("https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=whatsapp-connect-demo");

  const handleConnect = () => {
    setConnecting(true);
    
    // Simulate connection process
    setTimeout(() => {
      updateUser({ whatsappConnected: true });
      toast({
        title: "וואטסאפ מחובר!",
        description: "הוואטסאפ שלך מחובר עכשיו ומוכן לשליחת הודעות.",
      });
      setConnecting(false);
    }, 3000);
  };

  const handleDisconnect = () => {
    updateUser({ whatsappConnected: false });
    toast({
      title: "וואטסאפ מנותק",
      description: "הוואטסאפ שלך נותק.",
    });
  };

  if (user?.whatsappConnected) {
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
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
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
                  <span className="text-green-600 font-medium">מחובר</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">קבוצות מחוברות:</span>
                  <span className="font-medium">8 קבוצות</span>
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
          <p className="text-gray-600">סרוק את קוד ה-QR עם הוואטסאפ שלך כדי לחבר את החשבון</p>
        </div>

        <Card>
          <CardContent className="p-8">
            {connecting ? (
              <div className="text-center">
                <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-6">
                  <Smartphone className="h-12 w-12 text-blue-600 animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  מתחבר...
                </h2>
                <p className="text-gray-600 mb-6">
                  אנא המתן בזמן שאנו יוצרים את החיבור עם הוואטסאפ שלך.
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            ) : (
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

                <Button 
                  onClick={handleConnect}
                  className="bg-green-600 hover:bg-green-700 w-full"
                  disabled={connecting}
                >
                  סרקתי את הקוד
                </Button>
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
