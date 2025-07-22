
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOnboardingQuiz } from '@/hooks/useOnboardingQuiz';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface OnboardingQuizProps {
  onComplete: () => void;
}

const OnboardingQuiz = ({ onComplete }: OnboardingQuizProps) => {
  const {
    currentStep,
    totalSteps,
    answers,
    updateAnswer,
    nextStep,
    prevStep,
    skipStep,
    canSkipCurrentStep,
    handleSubmit,
    isSubmitting,
    isSuccess
  } = useOnboardingQuiz();

  React.useEffect(() => {
    if (isSuccess) {
      onComplete();
    }
  }, [isSuccess, onComplete]);

  const communityTypes = [
    'קבוצה עסקית',
    'קבוצת חינוך / בית ספר',
    'רשת שיווק שותפים',
    'קהילה מקומית',
    'קבוצה דתית / רוחנית',
    'קבוצה של חברים / משפחה',
    'אחר'
  ];

  const niches = [
    'טכנולוגיה וסטארטאפים',
    'אופנה ולייף סטייל',
    'בריאות ותזונה',
    'לבית והורות',
    'פיננסים והשקעות',
    'אוכל ובישול',
    'ספורט וכושר',
    'כללי',
    'אחר'
  ];

  const groupCounts = [
    '1–4',
    '5–10',
    '11–20',
    '21–30',
    'יותר מ-30'
  ];

  const handleCommunitySelect = (type: string) => {
    updateAnswer('community_type', type);
    setTimeout(nextStep, 300);
  };

  const handleNicheToggle = (niche: string) => {
    const currentNiches = answers.niches;
    const updatedNiches = currentNiches.includes(niche)
      ? currentNiches.filter(n => n !== niche)
      : [...currentNiches, niche];
    updateAnswer('niches', updatedNiches);
  };

  const handleGroupCountSelect = (count: string) => {
    updateAnswer('group_count_range', count);
    setTimeout(() => handleSubmit(count), 300);
  };

  const progress = ((currentStep + 1) / totalSteps) * 100;

  const renderQuestion = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                איזה סוג קהילה אתה מנהל?
              </h2>
              <p className="text-muted-foreground">בחר אפשרות אחת</p>
            </div>
            <div className="grid gap-3">
              {communityTypes.map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  onClick={() => handleCommunitySelect(type)}
                  className="h-auto p-4 text-right justify-start hover:bg-accent animate-fade-in"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                באילו נישות פועלת הקהילה שלך?
              </h2>
              <p className="text-muted-foreground">ניתן לבחור מספר אפשרויות</p>
            </div>
            <div className="grid gap-3">
              {niches.map((niche) => (
                <Button
                  key={niche}
                  variant={answers.niches.includes(niche) ? "default" : "outline"}
                  onClick={() => handleNicheToggle(niche)}
                  className="h-auto p-4 text-right justify-between hover:bg-accent animate-fade-in"
                >
                  <span>{niche}</span>
                  {answers.niches.includes(niche) && (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
            <div className="flex gap-3 justify-between pt-4">
              <Button
                variant="ghost"
                onClick={prevStep}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                חזרה
              </Button>
              <Button
                onClick={nextStep}
                className="flex-1"
                disabled={!answers.niches.length}
              >
                המשך
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                כמה קבוצות וואטסאפ אתה מנהל כרגע?
              </h2>
              <p className="text-muted-foreground text-sm">
                <Badge variant="secondary">שאלה חובה</Badge>
              </p>
            </div>
            <div className="grid gap-3">
              {groupCounts.map((count) => (
                <Button
                  key={count}
                  variant="outline"
                  onClick={() => handleGroupCountSelect(count)}
                  className="h-auto p-4 text-right justify-start hover:bg-accent animate-fade-in"
                  disabled={isSubmitting}
                >
                  {count}
                </Button>
              ))}
            </div>
            <div className="flex gap-3 justify-start pt-4">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                חזרה
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto animate-scale-in">
        <CardHeader className="text-center">
          <CardTitle className="text-lg text-muted-foreground">
            שאלון התאמה אישית
          </CardTitle>
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              שאלה {currentStep + 1} מתוך {totalSteps}
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          {renderQuestion()}
          
          {canSkipCurrentStep && currentStep !== 1 && (
            <div className="flex justify-center pt-6">
              <Button 
                variant="ghost" 
                onClick={skipStep}
                className="text-muted-foreground hover:text-foreground"
              >
                דלג
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingQuiz;
