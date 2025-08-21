import React from 'react';
import { ThreeDButton } from "@/components/ui/three-d-button";
import { SelectionCard } from "@/components/ui/selection-card";
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
                <SelectionCard
                  key={type}
                  onClick={() => handleCommunitySelect(type)}
                >
                  {type}
                </SelectionCard>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6 flex flex-col h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                באילו נישות פועלת הקהילה שלך?
              </h2>
              <p className="text-gray-600 text-base">ניתן לבחור מספר אפשרויות</p>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-64">
              {niches.map((niche) => (
                <SelectionCard
                  key={niche}
                  isSelected={answers.niches.includes(niche)}
                  onClick={() => handleNicheToggle(niche)}
                  className="flex items-center justify-between"
                >
                  <span>{niche}</span>
                  {answers.niches.includes(niche) && (
                    <Check className="w-5 h-5 mr-2" />
                  )}
                </SelectionCard>
              ))}
            </div>
            <div className="flex justify-center pt-4 mt-4">
              <ThreeDButton
                variant="primary"
                size="lg"
                onClick={nextStep}
                className="px-8"
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
            </div>
            <div className="space-y-3">
              {groupCounts.map((count) => (
                <SelectionCard
                  key={count}
                  onClick={() => handleGroupCountSelect(count)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'שומר...' : count}
                </SelectionCard>
              ))}
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
          <div className="flex items-center gap-3 mb-2">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="חזרה"
              >
                <ArrowRight className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <span className="text-sm text-gray-500 min-w-[30px]">
              {currentStep + 1}/{totalSteps}
            </span>
            <div className="flex-1 bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        
        {renderQuestion()}
        
        {canSkipCurrentStep && currentStep !== 1 && (
          <div className="flex justify-center pt-6">
            <ThreeDButton 
              variant="neutral"
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