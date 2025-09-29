import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Link 
            to="/billing" 
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לעמוד התשלום
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">מדיניות פרטיות</h1>
          <h2 className="text-2xl font-semibold text-gray-700">Privacy Policy</h2>
        </div>

        {/* Hebrew Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">מדיניות פרטיות - עברית</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-right" dir="rtl">
            <p className="text-gray-700 leading-relaxed mb-4">
              אנו מכבדים את פרטיות המשתמשים שלנו.
            </p>
            <ul className="list-disc pr-6 space-y-2 text-gray-700">
              <li>אנו אוספים מידע בסיסי לצורך מתן השירות (שם, אימייל, פרטי תשלום, ושימוש בפלטפורמה).</li>
              <li>המידע משמש לצורך תפעול המערכת, שיפור השירות ותמיכה בלקוחות.</li>
              <li>המידע נשמר בשרתים מאובטחים ועשוי להיות משותף עם צד ג' רק לצורך תשלום (Paddle) או שירותי אחסון.</li>
              <li>למשתמש זכות לבקש עותק מהמידע האישי או לבקש את מחיקתו.</li>
            </ul>
          </CardContent>
        </Card>

        {/* English Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">Privacy Policy - English</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              We respect the privacy of our users.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>We collect basic information required to provide the service (name, email, payment details, and platform usage).</li>
              <li>This information is used to operate the system, improve the service, and support customers.</li>
              <li>Data is stored securely and may be shared with third parties only for payment processing (Paddle) or hosting services.</li>
              <li>Users have the right to request a copy of their personal data or request its deletion.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;