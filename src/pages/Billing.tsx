
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Crown, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

const Billing = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // For now, since we simplified the auth, we'll treat all users as free trial
  const isPaid = false;
  const trialDaysLeft = 3; // Default trial period

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      toast({
        title: "תשלום יתווסף בקרוב",
        description: "לבדיקות - החשבון שלך שודרג זמנית",
      });
      
      console.log('Simulating upgrade for testing');
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
    "חיבור וואטסאפ ללא הגבלה",
    "שליחת הודעות לקבוצות מרובות",
    "תזמון הודעות מתקדם",
    "ניתוח וסטטיסטיקות",
    "תמיכה טכנית מהירה",
    "גיבוי אוטומטי של ההודעות"
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">שדרג את החשבון שלך</h1>
          <p className="text-gray-600">
            קבל גישה מלאה לכל התכונות של מתזמן וואטסאפ
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
                    סטטוס נוכחי: {isPaid ? 'Premium' : 'ניסיון חינם'}
                  </h3>
                  <p className="text-gray-600">
                    {isPaid 
                      ? 'יש לך גישה מלאה לכל התכונות.'
                      : `נותרו לך ${trialDaysLeft} ימים בתקופת הניסיון.`
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-gray-500" />
                ניסיון חינם
              </CardTitle>
              <div className="text-3xl font-bold">₪0</div>
              <p className="text-gray-600">למשך 3 ימים</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>גישה לכל התכונות</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>עד 50 הודעות</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>תמיכה בסיסית</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full" disabled>
                התוכנית הנוכחית שלך
              </Button>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-green-200 bg-green-50/50">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-green-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                מומלץ
              </span>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-green-600" />
                Premium
              </CardTitle>
              <div className="text-3xl font-bold">₪49</div>
              <p className="text-gray-600">לחודש</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={handleUpgrade}
                disabled={loading || isPaid}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading ? "מעבד..." : isPaid ? "התוכנית הנוכחית שלך" : "שדרג עכשיו"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Billing;
