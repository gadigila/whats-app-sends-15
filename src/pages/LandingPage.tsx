
import { Button } from '@/components/ui/button';
import { MessageSquare, Clock, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

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
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
            >
              התחל ניסיון חינם
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
            <h3 className="text-xl font-semibold mb-2">משלוח מיידי</h3>
            <p className="text-gray-600">
              שלח הודעות לכל הקבוצות שלך בלחיצה אחת. מהיר, אמין ויעיל.
            </p>
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
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg rounded-full"
            >
              התחל את הניסיון החינם שלך
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
