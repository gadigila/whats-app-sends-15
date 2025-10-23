import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

const RefundPolicy = () => {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">מדיניות החזרים</h1>
        </div>

        {/* Hebrew Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">מדיניות החזרים</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-right" dir="rtl">
            <div className="space-y-4 text-gray-700">
              <p className="leading-relaxed">
                <strong>מנוי חודשי</strong> ניתן לביטול בכל עת. לאחר ביטול, המשתמש ימשיך לקבל גישה לשירות עד לסוף מחזור החיוב הנוכחי. לא יינתן החזר חלקי על יתרת התקופה.
              </p>
              <p className="leading-relaxed">
                <strong>מנוי שנתי</strong> אינו ניתן להחזר. ניתן לבטל את החידוש האוטומטי כך שהמנוי לא ימשיך לשנה נוספת.
              </p>
              <p className="leading-relaxed">
                החזרים יבוצעו רק אם חלה טעות חיובית או תקלה טכנית מצדנו, ובמקרה כזה ההחזר יתבצע באותו אמצעי תשלום שבו בוצעה העסקה.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RefundPolicy;