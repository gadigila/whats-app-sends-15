import React from 'react';
import { ThreeDButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOnboardingQuiz } from '@/hooks/useOnboardingQuiz';
import { Check, MessageSquare, ArrowRight, ArrowLeft } from 'lucide-react';

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
    nextStep();
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
    handleSubmit(count);
  };

  const progress = ((currentStep + 1) / totalSteps) * 100;

  const renderQuestion = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                איזה סוג קהילה אתה מנהל?
              </h2>
              <p className="text-gray-600 text-base">בחר אפשרות אחת</p>
            </div>
            <div className="space-y-3">
              {communityTypes.map((type) => (
                <ThreeDButton
                  key={type}
                  variant="secondary"
                  size="lg"
                  onClick={() => handleCommunitySelect(type)}
                  className="w-full text-right"
                >
                  {type}
                </ThreeDButton>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                באילו נישות פועלת הקהילה שלך?
              </h2>
              <p className="text-gray-600 text-base">ניתן לבחור מספר אפשרויות</p>
            </div>
            <div className="space-y-3">
              {niches.map((niche) => (
                <ThreeDButton
                  key={niche}
                  variant={answers.niches.includes(niche) ? "primary" : "secondary"}
                  size="lg"
                  onClick={() => handleNicheToggle(niche)}
                  className="w-full text-right flex items-center justify-between"
                >
                  <span>{niche}</span>
                  {answers.niches.includes(niche) && (
                    <Check className="h-5 w-5" />
                  )}
                </ThreeDButton>
              ))}
            </div>
            <div className="flex gap-4 pt-6">
              <ThreeDButton
                variant="secondary"
                size="lg"
                onClick={prevStep}
                className="flex-1"
              >
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                חזרה
              </ThreeDButton>
              <ThreeDButton
                variant="primary"
                size="lg"
                onClick={nextStep}
                className="flex-1"
                disabled={!answers.niches.length}
              >
                המשך
                <ArrowLeft className="w-4 h-4 mr-2" />
              </ThreeDButton>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                כמה קבוצות וואטסאפ אתה מנהל כרגע?
              </h2>
              <p className="text-gray-600 text-base">
                <Badge variant="secondary" className="bg-green-100 text-green-700">שאלה חובה</Badge>
              </p>
            </div>
            <div className="space-y-3">
              {groupCounts.map((count) => (
                <ThreeDButton
                  key={count}
                  variant="secondary"
                  size="lg"
                  onClick={() => handleGroupCountSelect(count)}
                  className="w-full text-right"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'שומר...' : count}
                </ThreeDButton>
              ))}
            </div>
            <div className="flex gap-4 pt-6">
              <ThreeDButton
                variant="secondary"
                size="lg"
                onClick={prevStep}
                disabled={isSubmitting}
                className="flex-1"
              >
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                חזרה
              </ThreeDButton>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">בואו נכיר!</h1>
          <p className="text-base text-gray-600 mb-6">
            כמה שאלות קצרות שיעזרו לנו להתאים עבורכם את המערכת
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            שאלה {currentStep + 1} מתוך {totalSteps}
          </p>
        </div>
        
        {renderQuestion()}
        
        {canSkipCurrentStep && currentStep !== 1 && (
          <div className="flex justify-center pt-6">
            <ThreeDButton 
              variant="secondary"
              onClick={skipStep}
              className="text-gray-500"
            >
              דלג
            </ThreeDButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingQuiz;