import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">תנאי שימוש</h1>
          <h2 className="text-2xl font-semibold text-gray-700">Terms of Service</h2>
        </div>

        {/* Hebrew Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">תנאי שימוש - עברית</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-right" dir="rtl">
            <p className="text-gray-700 leading-relaxed mb-4">
              ברוך הבא לשירות שלנו. השימוש בפלטפורמה מיועד לעסקים ואנשים פרטיים לצורך ניהול ותזמון הודעות WhatsApp.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              השימוש בשירות מותנה בקבלת התנאים הבאים:
            </p>
            <ul className="list-disc pr-6 space-y-2 text-gray-700">
              <li>אין להשתמש בשירות לצורך ספאם, תוכן פוגעני או פעילות לא חוקית.</li>
              <li>השירות ניתן כפי שהוא ("As-Is"), ואיננו מתחייבים לזמינות רציפה או ללא תקלות.</li>
              <li>התשלום הינו חודשי/שנתי מראש, בהתאם למסלול שבחרת.</li>
              <li>אנו רשאים לעדכן את התנאים מעת לעת, והמשך השימוש בשירות מהווה הסכמה לשינויים.</li>
              <li>הדין החל הוא חוקי מדינת ישראל.</li>
            </ul>
          </CardContent>
        </Card>

        {/* English Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">Terms of Service - English</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              Welcome to our service. The platform is designed for businesses and individuals to manage and schedule WhatsApp messages.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              By using our service, you agree to the following terms:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>You may not use the service for spam, abusive content, or illegal activities.</li>
              <li>The service is provided "As-Is" without warranties of uninterrupted availability.</li>
              <li>Payments are billed monthly or annually in advance, according to your chosen plan.</li>
              <li>We may update these terms from time to time, and continued use constitutes acceptance.</li>
              <li>These terms are governed by the laws of the State of Israel.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TermsOfService;