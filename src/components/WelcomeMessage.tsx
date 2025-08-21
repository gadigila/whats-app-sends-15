import React from 'react';
import { ThreeDButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, MessageSquare, Users, BarChart3, Clock } from 'lucide-react';

interface WelcomeMessageProps {
  onContinue: () => void;
  userAnswers?: {
    community_type?: string;
    niches: string[];
    group_count_range: string;
  };
}

const WelcomeMessage = ({ onContinue, userAnswers }: WelcomeMessageProps) => {
  const benefits = [
    {
      icon: MessageSquare,
      title: 'שליחת הודעות מהירה וחכמה',
      description: 'שלח הודעות לכל הקבוצות שלך בקליק אחד'
    },
    {
      icon: Users,
      title: 'ניהול קבוצות מרוכז',
      description: 'נהל את כל הקבוצות שלך ממקום אחד'
    },
    {
      icon: BarChart3,
      title: 'אנליטיקה מתקדמת',
      description: 'עקוב אחר הביצועים והצלחת ההודעות'
    },
    {
      icon: Clock,
      title: 'חיסכון משמעותי בזמן',
      description: 'חסוך שעות בניהול התקשורת שלך'
    }
  ];

  const getPersonalizedMessage = () => {
    if (userAnswers?.community_type) {
      switch (userAnswers.community_type) {
        case 'קבוצה עסקית':
          return 'מושלם! reacher.app יעזור לך לנהל את התקשורת העסקית שלך ביעילות מקסימלית';
        case 'קבוצת חינוך / בית ספר':
          return 'נהדר! עכשיו תוכל לתקשר עם ההורים והתלמידים שלך בצורה מסודרת ויעילה';
        case 'רשת שיווק שותפים':
          return 'מעולה! נהל את הרשת שלך ושלח עדכונים לכל השותפים בקלות';
        case 'קהילה מקומית':
          return 'נפלא! חבר את כל הקהילה שלך והעביר מידע חשוב בקלות';
        case 'קבוצה דתית / רוחנית':
          return 'ברוך הבא! עכשיו תוכל לחבר את הקהילה הרוחנית שלך בצורה יעילה';
        case 'קבוצה של חברים / משפחה':
          return 'איזה כיף! עכשיו תוכל לתאם עם החברים והמשפחה בקלות';
        default:
          return 'מעולה! עכשיו תוכל לנהל את כל הקבוצות שלך במקום אחד';
      }
    }
    return 'ברוך הבא ל-reacher.app! המערכת שתחסוך לך זמן יקר';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center pb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-right text-gray-900 mb-4">
            {getPersonalizedMessage()}
          </h1>
          {userAnswers?.group_count_range && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-sm">
              מנהל {userAnswers.group_count_range} קבוצות
            </Badge>
          )}
        </div>

        <div className="space-y-8">
          {userAnswers?.niches && userAnswers.niches.length > 0 && (
            <div className="text-center space-y-3">
              <h4 className="text-lg font-semibold text-gray-900">
                מותאם במיוחד עבור:
              </h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {userAnswers.niches.map((niche, index) => (
                  <Badge key={index} variant="secondary" className="text-sm bg-green-100 text-green-700">
                    {niche}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-right text-gray-900">היתרונות שאתה עומד לקבל:</h3>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-4 text-right p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <benefit.icon className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-base text-gray-900">{benefit.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ThreeDButton 
            onClick={onContinue}
            variant="primary"
            size="lg"
            className="w-full"
          >
            בואו נתחיל! 🚀
          </ThreeDButton>
        </div>
      </div>
    </div>
  );
};

export default WelcomeMessage;