import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

const TermsOfService = () => {
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
    </div>
  );
};

export default TermsOfService;