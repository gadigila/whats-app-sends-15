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
        </div>

        {/* Hebrew Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">תנאי שימוש</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-right" dir="rtl">
            <div className="space-y-4 text-gray-700">
              <p className="leading-relaxed">
                ברוך הבא לשירות שלנו. השימוש בפלטפורמה מיועד לעסקים ואנשים פרטיים לצורך ניהול ותזמון הודעות WhatsApp.
              </p>
              <p className="leading-relaxed">
                השימוש בשירות מותנה בקבלת התנאים הבאים:
              </p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>אין להשתמש בשירות לצורך ספאם, תוכן פוגעני או פעילות לא חוקית.</li>
                <li>השירות ניתן כפי שהוא ("As-Is"), ואיננו מתחייבים לזמינות רציפה או ללא תקלות.</li>
                <li>התשלום הינו חודשי/שנתי מראש, בהתאם למסלול שבחרת.</li>
                <li>אנו רשאים לעדכן את התנאים מעת לעת, והמשך השימוש בשירות מהווה הסכמה לשינויים.</li>
                <li>הדין החל הוא חוקי מדינת ישראל.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TermsOfService;