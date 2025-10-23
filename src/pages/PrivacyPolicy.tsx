import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="md" variant="dark" />
          <Link 
            to="/" 
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לדף הבית
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">מדיניות פרטיות</h1>
        </div>

        {/* Hebrew Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">מדיניות פרטיות</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-right" dir="rtl">
            <p className="text-gray-700 leading-relaxed mb-4">
              אנו מכבדים את פרטיות המשתמשים שלנו.
            </p>
            <ul className="list-disc pr-6 space-y-2 text-gray-700">
              <li>אנו אוספים מידע בסיסי לצורך מתן השירות (שם, אימייל, פרטי תשלום, ושימוש בפלטפורמה).</li>
              <li>המידע משמש לצורך תפעול המערכת, שיפור השירות ותמיכה בלקוחות.</li>
              <li>המידע נשמר בשרתים מאובטחים ועשוי להיות משותף עם צד ג' רק לצורך תשלום או שירותי אחסון.</li>
              <li>למשתמש זכות לבקש עותק מהמידע האישי או לבקש את מחיקתו.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;