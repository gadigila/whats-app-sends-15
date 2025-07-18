import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface QuizAnswers {
  community_type?: string;
  niches: string[];
  group_count_range: string;
}

export const useOnboardingQuiz = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({
    niches: [],
    group_count_range: ''
  });

  const totalSteps = 3;

  const submitQuiz = useMutation({
    mutationFn: async (quizAnswers: QuizAnswers) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          community_type: quizAnswers.community_type,
          niches: quizAnswers.niches,
          group_count_range: quizAnswers.group_count_range,
          quiz_completed_at: new Date().toISOString(),
          is_onboarded: true
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      return quizAnswers;
    },
    onSuccess: () => {
      toast.success('הקוויז הושלם בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (error) => {
      console.error('Quiz submission error:', error);
      toast.error('שגיאה בשמירת הקוויז. אנא נסה שוב.');
    }
  });

  const updateAnswer = (field: keyof QuizAnswers, value: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipStep = () => {
    // Can skip all steps except group count (step 2)
    if (currentStep !== 2) {
      nextStep();
    }
  };

  const canSkipCurrentStep = currentStep !== 2; // Cannot skip group count question

  const handleSubmit = () => {
    if (!answers.group_count_range) {
      toast.error('אנא בחר כמות קבוצות');
      return;
    }
    submitQuiz.mutate(answers);
  };

  return {
    currentStep,
    totalSteps,
    answers,
    updateAnswer,
    nextStep,
    prevStep,
    skipStep,
    canSkipCurrentStep,
    handleSubmit,
    isSubmitting: submitQuiz.isPending,
    isSuccess: submitQuiz.isSuccess
  };
};