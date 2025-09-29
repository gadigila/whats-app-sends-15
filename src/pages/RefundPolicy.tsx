import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const RefundPolicy = () => {
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
    </Layout>
  );
};

export default RefundPolicy;