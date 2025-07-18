import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, MessageSquare, Users, BarChart3, Clock, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl mx-auto animate-scale-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">
            ברוך הבא ל-reacher.app! 🎉
          </CardTitle>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            {getPersonalizedMessage()}
          </p>
          {userAnswers?.group_count_range && (
            <Badge variant="secondary" className="text-sm">
              מנהל {userAnswers.group_count_range} קבוצות
            </Badge>
          )}
        </CardHeader>
        
        <CardContent className="space-y-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-foreground mb-6">
              היתרונות שאתה עומד לקבל:
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit, index) => (
                <div 
                  key={index}
                  className="flex items-start space-x-3 space-x-reverse p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <benefit.icon className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-right">
                    <h4 className="font-medium text-foreground">{benefit.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {userAnswers?.niches && userAnswers.niches.length > 0 && (
            <div className="text-center space-y-3">
              <h4 className="text-lg font-medium text-foreground">
                מותאם במיוחד עבור:
              </h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {userAnswers.niches.map((niche, index) => (
                  <Badge key={index} variant="outline" className="text-sm">
                    {niche}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center">
            <h4 className="text-lg font-semibold text-primary mb-2">
              הכל מוכן לשימוש! 
            </h4>
            <p className="text-muted-foreground mb-4">
              עכשיו תוכל להתחיל לשלוח הודעות לכל הקבוצות שלך בקליק אחד
            </p>
            <Button 
              onClick={onContinue}
              size="lg"
              className="min-w-[200px] animate-pulse hover:animate-none"
            >
              בואו נתחיל! 🚀
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WelcomeMessage;