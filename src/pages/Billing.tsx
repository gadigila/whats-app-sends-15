import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ThreeDButton } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Crown, Star, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { usePaymentPlans } from '@/hooks/usePaymentPlans';

const Billing = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { trialStatus, isLoading: trialLoading } = useTrialStatus();
  const { plans, currentPlan, billingPeriod, setBillingPeriod } = usePaymentPlans();

  const isPaid = trialStatus?.isPaid || false;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // כאן נחבר למערכת Grow לתשלום
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

  if (trialLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">טוען...</div>
        </div>
      </Layout>
    );
  }

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
        {user && trialStatus && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  isPaid ? 'bg-green-50' : 
                  trialStatus.isExpired ? 'bg-red-50' : 'bg-orange-50'
                }`}>
                  {isPaid ? (
                    <Crown className="h-6 w-6 text-green-600" />
                  ) : trialStatus.isExpired ? (
                    <Star className="h-6 w-6 text-red-600" />
                  ) : (
                    <Star className="h-6 w-6 text-orange-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    סטטוס נוכחי: {
                      isPaid ? 'Premium' : 
                      trialStatus.isExpired ? 'תקופת ניסיון פגה' : 
                      `תקופת ניסיון - ${trialStatus.daysLeft} ימים נותרו`
                    }
                  </h3>
                  <p className="text-gray-600">
                    {isPaid 
                      ? 'יש לך גישה מלאה לכל התכונות.'
                      : trialStatus.isExpired
                      ? 'תקופת הניסיון הסתיימה. שדרג כדי להמשיך.'
                      : 'בחר תוכנית כדי להמשיך לאחר תקופת הניסיון.'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Period Toggle */}
        {!isPaid && (
          <div className="flex justify-center">
            <div className="bg-gray-300 p-1 rounded-lg">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-800 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                חודשי
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-800 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                שנתי
                <span className="mr-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  חסוך 17%
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Main Pricing Plan */}
        {currentPlan && (
          <div className="max-w-md mx-auto">
            <Card className={`border-green-200 bg-green-50/50 ${
              currentPlan.popular ? 'ring-2 ring-green-500' : ''
            }`}>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                  <Crown className="h-6 w-6 text-green-500" />
                  {currentPlan.name}
                  {currentPlan.popular && (
                    <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                      הכי פופולרי
                    </span>
                  )}
                </CardTitle>
                <div className="mt-4">
                  <div className="text-5xl font-bold text-gray-900">₪{currentPlan.price}</div>
                  {currentPlan.originalPrice && (
                    <div className="text-lg text-gray-500 line-through">₪{currentPlan.originalPrice}</div>
                  )}
                  <p className="text-gray-600 text-lg">
                    ל{currentPlan.period === 'monthly' ? 'חודש' : 'שנה'} - ללא הגבלה
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <ul className="space-y-3 mb-8">
                  {currentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <ThreeDButton 
                  onClick={handleUpgrade}
                  disabled={loading || isPaid}
                  variant="primary"
                  className="w-full"
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
                </ThreeDButton>
                
                {!isPaid && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    לאחר התשלום תועבר לחיבור וואטסאפ
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

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
