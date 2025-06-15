
import { Button } from '@/components/ui/button';
import { MessageSquare, Clock, Users, Zap, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white" dir="rtl">
      {/* Hero Section */}
      <div className="px-4 py-16 mx-auto max-w-6xl">
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-green-100 rounded-full">
              <MessageSquare className="h-16 w-16 text-green-600" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            שלח הודעות לכל
            <span className="text-green-600 block">קבוצות הוואטסאפ שלך</span>
            בלחיצה אחת
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            תזמן ושלח הודעות בצורה קבוצתית לקבוצות הוואטסאפ שלך בקלות. 
            חסוך זמן והגע לכולם מיידית.
          </p>
          
          <Link to="/auth">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-200">
              התחל ניסיון 3 ימים חינם
            </Button>
          </Link>
          
          <p className="text-sm text-gray-500 mt-4">
            3 ימי ניסיון חינם • ללא צורך בכרטיס אשראי
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center p-6">
            <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-4">
              <Clock className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">תזמון הודעות</h3>
            <p className="text-gray-600">
              הגדר את ההודעות שלך מראש ותן להן להישלח אוטומטית בזמן המושלם.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-4">
              <Users className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">ניהול קבוצות</h3>
            <p className="text-gray-600">
              ארגן את הקבוצות שלך לקטגוריות ושלח הודעות ממוקדות לקהלים ספציפיים.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-4">
              <Zap className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">מיידי</h3>
            <p className="text-gray-600">
              שלח הודעות לכל הקבוצות שלך בלחיצה אחת. מהיר, אמין ויעיל.
            </p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">תוכניות מחיר</h2>
            <p className="text-xl text-gray-600">בחר את התוכנית המתאימה לך</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Trial Plan */}
            <Card className="relative border-2 border-green-200 shadow-lg">
              <CardHeader className="text-center pb-6">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    מומלץ להתחלה
                  </span>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 mt-4">
                  ניסיון חינם
                </CardTitle>
                <div className="text-4xl font-bold text-green-600 mt-2">
                  ₪0
                  <span className="text-lg text-gray-500 font-normal">/ 3 ימים</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>עד 50 הודעות ביום</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>חיבור לקבוצות וואטסאפ</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>תזמון הודעות</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>תמיכה בתמונות וקבצים</span>
                  </div>
                </div>
                <Link to="/auth" className="block w-full mt-6">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                    התחל ניסיון חינם
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border shadow-lg">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  תוכנית מתקדמת
                </CardTitle>
                <div className="text-4xl font-bold text-blue-600 mt-2">
                  ₪99
                  <span className="text-lg text-gray-500 font-normal">/ חודש</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>הודעות ללא הגבלה</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>חיבור לקבוצות ללא הגבלה</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>תזמון מתקדם</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>אנליטיקס ודוחות</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span>תמיכה עדיפות</span>
                  </div>
                </div>
                <Link to="/auth" className="block w-full mt-6">
                  <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                    התחל עם הניסיון החינם
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20 p-8 bg-white rounded-2xl shadow-lg">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            מוכן להתחיל?
          </h2>
          <p className="text-gray-600 mb-6">
            הצטרף לאלפי משתמשים שחוסכים שעות כל שבוע עם הודעות וואטסאפ אוטומטיות.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg rounded-full">
              התחל את הניסיון החינם שלך - 3 ימים
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
