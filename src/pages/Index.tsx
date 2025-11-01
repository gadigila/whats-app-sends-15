import { Button, ThreeDButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Clock, CheckCircle, Star, ArrowLeft, Zap, Shield, TrendingUp, Target, FileText, BarChart3, Upload, FolderTree, Sparkles } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';
import TestimonialsSection from '@/components/TestimonialsSection';
import { Logo } from '@/components/Logo';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import heroPhone from '@/assets/hero-phone.png';
import howItWorksImage from '@/assets/how-it-works.png';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white" dir="rtl">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/auth">
            <ThreeDButton variant="secondary">
              התחבר
            </ThreeDButton>
          </Link>
          <div className="flex items-center gap-3">
            <Logo size="lg" variant="dark" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-12 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img 
            src={heroPhone} 
            alt="Reecher trophy icon" 
            className="w-40 h-40 mx-auto mb-7"
          />
          <h1 className="text-[2.5rem] md:text-[4.75rem] font-bold text-gray-900 mb-6 leading-[1]">
            לשלוח הודעה לכל
            <br />
            <span className="text-green-500">קבוצות הוואטסאפ שלך</span>
            <br />
            בלחיצה אחת
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            הפתרון למנהלי קהילות, בעלי עסקים ומדריכים. תזמון אוטומטי, סגמנטים חכמים ואנליטיקס בזמן אמת
          </p>
          <Link to="/auth">
            <ThreeDButton variant="primary" size="lg">
              התחילו עכשיו בחינם
              <ArrowLeft className="mr-2 h-5 w-5" />
            </ThreeDButton>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            3 ימי ניסיון חינם · בלי כרטיס אשראי
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="space-y-6">
            <div>
              <div className="max-w-2xl mx-auto">
                <YouTubePlayer 
                  videoId="9UOF2tRQxGc"
                  autoplay={true}
                  mute={true}
                  controls={false}
                />
              </div>
            </div>
            
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mt-8">
              ניהול קבוצות וואטסאפ לא צריך להיות כאב ראש
            </h3>
            
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              ריצ׳ר הופך משימה של שעות למשימה של דקות.
              שליחה מרכזית לכל הקבוצות, תזמון חכם וביקורת מלאה.
              פשוט, מהיר ועושה בדיוק מה שצריך.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            איך זה עובד?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Image */}
            <div>
              <img 
                src={howItWorksImage} 
                alt="איך זה עובד - תהליך העבודה עם ריצ׳ר" 
                className="w-full rounded-2xl shadow-lg"
              />
            </div>
            
            {/* Right: Steps */}
            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">מתחברים</h3>
                  <p className="text-gray-600">סורקים QR חד פעמי.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">מכינים</h3>
                  <p className="text-gray-600">כותבים הודעה, מצרפים קבצים ובוחרים קבוצות.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">שולחים או מתזמנים</h3>
                  <p className="text-gray-600">עכשיו, יומי או שבועי.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6 pt-6 mt-6 border-t border-gray-200">
                <CheckCircle className="w-12 h-12 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-lg text-gray-900">רואים סטטוס בזמן אמת והיסטוריה מלאה של כל השליחות.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* מה מקבלים במערכת Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              מה מקבלים במערכת
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="p-4 bg-green-50 rounded-full w-fit mb-4">
                  <Target className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">סגמנטים חכמים</h3>
                <p className="text-gray-600">
                  יוצרים סופר קבוצה שמרכזת קבוצות, מארגנים לקטגוריות ושולחים מדויק לכל פלח.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="p-4 bg-green-50 rounded-full w-fit mb-4">
                  <FileText className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">תבניות וטיוטות</h3>
                <p className="text-gray-600">
                  שומרים הודעות כתבניות ומשלימים טיוטות מתי שנוח. הכל מסודר במקום אחד.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="p-4 bg-green-50 rounded-full w-fit mb-4">
                  <BarChart3 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">אנליטיקס ברור</h3>
                <p className="text-gray-600">
                  דשבורד בזמן אמת שמראה מה נשלח, למי ומתי. נשארים בשליטה מלאה.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="p-4 bg-green-50 rounded-full w-fit mb-4">
                  <Upload className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">קבצים ותמונות</h3>
                <p className="text-gray-600">
                  מצרפים בקלות ומפיצים יחד עם ההודעה לכל הקבוצות.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="p-4 bg-green-50 rounded-full w-fit mb-4">
                  <FolderTree className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">ניהול קבוצות וקטגוריות</h3>
                <p className="text-gray-600">
                  מסדרים קבוצות לפי נושאים ומנהלים שליחה מרוכזת לכל קטגוריה.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="p-4 bg-green-50 rounded-full w-fit mb-4">
                  <Sparkles className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">שדרוג הודעות עם AI</h3>
                <p className="text-gray-600">
                  מציע וריאציות להודעה, מבליט קריאה לפעולה ומתאים לאורך ולמבנה של וואטסאפ.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* למי זה מתאים Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              למי זה מתאים
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                  <Users className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">מנהלי קהילות</h3>
                <p className="text-gray-600">
                  עדכונים ושגרות קבועות לכולם בזמן.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">בעלי עסקים</h3>
                <p className="text-gray-600">
                  מבצעים, תוכן ושירות לקבוצות רבות בלחיצה.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-4">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">מדריכים</h3>
                <p className="text-gray-600">
                  שליחת חומרי לימוד ותזכורות מתוזמנות.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Pricing Preview */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center text-gray-900">
            מחיר פשוט ושקוף
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold mb-2">חודשי</h3>
                <div className="text-4xl font-bold text-gray-900 mb-6">₪99</div>
                <div className="space-y-3 text-right mb-8">
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>הודעות ללא הגבלה</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>תזמון מתקדם</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>קבוצות ללא הגבלה</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>תמיכה מהירה</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
                  <span className="text-sm text-muted-foreground">• ניתן לבטל בכל רגע - בלי טריקים ובלי אותיות קטנות</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50 hover:shadow-lg transition-shadow relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-1 rounded-full">
                  <Star className="h-4 w-4" />
                  <span className="text-sm font-semibold">פופולרי</span>
                </div>
              </div>
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold mb-2">שנתי</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">₪999</div>
                <p className="text-sm text-gray-500 line-through mb-4">₪1,188</p>
                <div className="space-y-3 text-right mb-8">
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>הודעות ללא הגבלה</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>תזמון מתקדם</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>קבוצות ללא הגבלה</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>תמיכה מהירה</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="font-semibold text-green-700">חיסכון של 17% בתשלום שנתי</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
                  <span className="text-sm text-muted-foreground">• ניתן לבטל בכל רגע - בלי טריקים ובלי אותיות קטנות</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex justify-center mt-8">
            <Link to="/auth">
              <ThreeDButton variant="primary" size="lg">
                התחילו עכשיו
              </ThreeDButton>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center text-gray-900">
            שאלות נפוצות
          </h2>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">זה בטוח?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                כן. עובד עם WhatsApp Web והמידע נשמר בצורה מאובטחת.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">יש הגבלת קבוצות?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                לא. אפשר להוסיף כמה שצריך.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">אפשר לצרף קבצים ותמונות?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                כן. מצרפים כמו בהודעה רגילה.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">יש ניסיון חינם?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                כן. 3 ימים בלי כרטיס אשראי.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">אפשר לראות סטטוס שליחה?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                כן. יש סטטוס בזמן אמת והיסטוריה מלאה.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">מה קורה אם יש לי קבוצות חדשות?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                פשוט מסנכרנים את הקבוצות החדשות בקלות. הן מופיעות אוטומטית.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">אפשר להשתמש מהפלאפון?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                כן. אחרי החיבור הראשוני אפשר לשלוח מכל מכשיר, מכל מקום בעולם.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">מה ההבדל מלשלוח ידנית?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                חוסכים זמן, נשארים מסודרים ולא שוכחים אף קבוצה.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">אפשר לערוך הודעה שכבר תוזמנה?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                כן. עד לרגע השליחה אפשר לשנות הכל.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">כמה זמן לוקח להתחיל?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                פחות מ-3 דקות. סורקים QR ומתחילים לשלוח.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-11" className="bg-white rounded-lg px-6 border-none">
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="font-semibold">אפשר לבטל מתי שרוצים?</span>
              </AccordionTrigger>
              <AccordionContent className="text-right text-gray-600">
                כן. מבטלים בכל רגע.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            מוכנים לחסוך זמן ולהישאר מסודרים?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            התחילו בחינם ותראו תוצאות כבר היום.
          </p>
          <Link to="/auth">
            <ThreeDButton variant="primary" size="lg">
              התחילו עכשיו בחינם
              <ArrowLeft className="mr-2 h-5 w-5" />
            </ThreeDButton>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Logo size="lg" variant="light" />
          </div>
          <p className="text-gray-400 mb-6">
            הפתרון החכם לשליחת הודעות מתוזמנות בוואטסאפ
          </p>
          <div className="flex items-center justify-center gap-3 mb-6 text-sm">
            <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition-colors">
              תנאי שימוש
            </Link>
            <span className="text-gray-600">•</span>
            <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">
              מדיניות פרטיות
            </Link>
            <span className="text-gray-600">•</span>
            <Link to="/refund-policy" className="text-gray-400 hover:text-white transition-colors">
              מדיניות החזרים
            </Link>
          </div>
          <div className="text-sm text-gray-500">
            © 2025 Reecher.app - כל הזכויות שמורות
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
