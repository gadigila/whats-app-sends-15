import { Button, ThreeDButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Users, Clock, CheckCircle, Star, ArrowLeft, Zap, Shield, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import TestimonialsSection from '@/components/TestimonialsSection';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white" dir="rtl">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-xl">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reecher.app</h1>
          </div>
          <Link to="/auth">
            <ThreeDButton variant="secondary">
              התחבר
            </ThreeDButton>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            שלח הודעה לכל
            <br />
            <span className="text-green-500">קבוצות הוואטסאפ שלך</span>
            <br />
            בלחיצה אחת
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            חסוך שעות, הפץ תוכן לכולם, בבת אחת. 
            מערכת חכמה לשליחת הודעות מתוזמנות לכל הקבוצות שלך ב-WhatsApp.
          </p>
          <Link to="/auth">
            <ThreeDButton variant="primary" size="lg">
              התחל עכשיו בחינם
              <ArrowLeft className="mr-2 h-5 w-5" />
            </ThreeDButton>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            למה Reecher?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                  <Users className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">כל הקבוצות בבת אחת</h3>
                <p className="text-gray-600">
                  שלח הודעה לכל קבוצות הוואטסאפ שלך במקום לשלוח אחת אחת
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                  <Clock className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">תזמון מתקדם</h3>
                <p className="text-gray-600">
                  תזמן הודעות מראש ותן למערכת לשלוח בזמן המתאים
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">פשוט וקל</h3>
                <p className="text-gray-600">
                  ממשק פשוט וידידותי שכל אחד יכול להשתמש בו
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            איך זה עובד?
          </h2>
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">התחבר לוואטסאפ</h3>
                <p className="text-gray-600">סרוק QR קוד פשוט כדי לחבר את הוואטסאפ שלך</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">כתוב הודעה</h3>
                <p className="text-gray-600">כתוב הודעה, צרף קבצים ובחר לאילו קבוצות לשלוח</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">שלח או תזמן</h3>
                <p className="text-gray-600">שלח מיד או תזמן לזמן מתאים - זה הכל!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Reecher Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              למה Reecher?
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              הפתרון המתקדם ביותר לשליחת הודעות קבוצתיות בוואטסאפ
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                <Zap className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">מהירות</h3>
              <p className="text-gray-600 text-sm">
                שלח לעשרות קבוצות בשניות במקום שעות
              </p>
            </div>

            <div className="text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                <Shield className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">אמינות</h3>
              <p className="text-gray-600 text-sm">
                חיבור יציב לוואטסאפ ללא הפרעות
              </p>
            </div>

            <div className="text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">יעילות</h3>
              <p className="text-gray-600 text-sm">
                חסוך עד 90% מהזמן בשליחת הודעות
              </p>
            </div>

            <div className="text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                <Users className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">נוחות</h3>
              <p className="text-gray-600 text-sm">
                ממשק פשוט שכל אחד יכול להשתמש בו
              </p>
            </div>
          </div>

          {/* Additional Benefits */}
          <div className="grid md:grid-cols-2 gap-12 mt-16">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                🚀 חסוך זמן יקר
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">שלח לכל הקבוצות בלחיצה אחת</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">תזמן הודעות מראש</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">העלה קבצים ותמונות</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                📊 שליטה מלאה
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">עקוב אחר סטטוס השליחה</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">נהל קבוצות בקטגוריות</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-gray-700">היסטוריה מלאה של הודעות</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Pricing Preview */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">
            מחיר פשוט ושקוף
          </h2>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Star className="h-6 w-6 text-green-500" />
                <span className="text-lg font-semibold text-green-600">פופולרי</span>
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">₪99</div>
              <p className="text-gray-600 mb-6">לחודש - ללא הגבלה</p>
              <ul className="space-y-3 text-right mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>הודעות ללא הגבלה</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>תזמון מתקדם</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>קבוצות ללא הגבלה</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>תמיכה מלאה</span>
                </li>
              </ul>
              <Link to="/auth">
                <ThreeDButton variant="primary" className="w-full" size="lg">
                  התחל עכשיו
                </ThreeDButton>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-2 bg-green-500 rounded-xl">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold">Reecher.app</h3>
          </div>
          <p className="text-gray-400 mb-8">
            הפתרון החכם לשליחת הודעות מתוזמנות בוואטסאפ
          </p>
          <div className="text-sm text-gray-500">
            © 2024 Reecher.app - כל הזכויות שמורות
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
