import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Crown, Star, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

const Billing = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // For now, since we simplified the auth, we'll treat all users as free trial
  const isPaid = false;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Here we would integrate with Stripe/Grow payment
      toast({
        title: "מעבר לתשלום",
        description: "בקרוב - התשלום יופעל. לבינתיים החשבון שלך שודרג לבדיקות",
      });
      
      // After successful payment, redirect to WhatsApp connection
      setTimeout(() => {
        window.location.href = '/connect';
      }, 2000);
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "משהו השתבש. אנא נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "הודעות ללא הגבלה",
    "שליחה לכל הקבוצות בבת אחת", 
    "תזמון הודעות מתקדם",
    "העלאת קבצים ותמונות",
    "ניהול קבוצות וסגמנטים",
    "תמיכה טכנית מהירה",
    "גיבוי אוטומטי של ההודעות",
    "דוחות וסטטיסטיקות"
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">הצטרף לתוכנית שלנו</h1>
          <p className="text-gray-600">
            גישה מלאה לכל התכונות של Reecher.app
          </p>
        </div>

        {/* Current Status */}
        {user && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${isPaid ? 'bg-green-50' : 'bg-orange-50'}`}>
                  {isPaid ? (
                    <Crown className="h-6 w-6 text-green-600" />
                  ) : (
                    <Star className="h-6 w-6 text-orange-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    סטטוס נוכחי: {isPaid ? 'Premium' : 'חשבון חדש'}
                  </h3>
                  <p className="text-gray-600">
                    {isPaid 
                      ? 'יש לך גישה מלאה לכל התכונות.'
                      : 'בחר תוכנית כדי להתחיל לשלוח הודעות.'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Pricing Plan */}
        <div className="max-w-md mx-auto">
          <Card className="relative border-green-200 bg-green-50/50 overflow-hidden">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-green-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                הכי פופולרי
              </span>
            </div>
            <CardHeader className="text-center pt-8">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <Crown className="h-6 w-6 text-green-500" />
                Reecher Premium
              </CardTitle>
              <div className="text-5xl font-bold text-gray-900 mt-4">₪99</div>
              <p className="text-gray-600 text-lg">לחודש - ללא הגבלה</p>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={handleUpgrade}
                disabled={loading || isPaid}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-4 text-lg rounded-full"
              >
                {loading ? (
                  "מעבד..."
                ) : isPaid ? (
                  "התוכנית הנוכחית שלך"
                ) : (
                  <>
                    התחל עכשיו
                    <ArrowLeft className="mr-2 h-5 w-5" />
                  </>
                )}
              </Button>
              
              {!isPaid && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  לאחר התשלום תועבר לחיבור וואטסאפ
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Why Reecher */}
        <Card>
          <CardContent className="p-8">
            <h3 className="text-xl font-semibold text-center mb-6">למה Reecher?</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2">🚀 חסוך זמן</h4>
                <p className="text-gray-600">במקום לשלוח הודעה לכל קבוצה בנפרד - שלח לכולן בבת אחת</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">⏰ תזמון חכם</h4>
                <p className="text-gray-600">תזמן הודעות מראש ותן למערכת לשלוח בזמן המתאים</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📁 קבצים ותמונות</h4>
                <p className="text-gray-600">שלח לא רק טקסט - גם תמונות, מסמכים וקובצים</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📊 בקרה מלאה</h4>
                <p className="text-gray-600">עקוב אחר סטטוס השליחה ונהל את כל ההודעות שלך</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Billing;
