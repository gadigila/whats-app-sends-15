import { useState, useEffect } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';

export const useWelcomeFlow = () => {
  const { data: profile } = useUserProfile();
  const [showQuiz, setShowQuiz] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{
    community_type?: string;
    niches: string[];
    group_count_range: string;
  } | null>(null);

  useEffect(() => {
    if (profile) {
      // Show quiz immediately after first sign-in if user is not onboarded
      if (!profile.is_onboarded) {
        setShowQuiz(true);
      }
    }
  }, [profile]);

  const handleQuizComplete = () => {
    setShowQuiz(false);
    
    // Store the quiz answers for the welcome message
    if (profile) {
      setQuizAnswers({
        community_type: profile.community_type || undefined,
        niches: Array.isArray(profile.niches) ? profile.niches as string[] : [],
        group_count_range: profile.group_count_range || ''
      });
    }
    
    setShowWelcome(true);
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    setQuizAnswers(null);
  };

  const shouldShowOnboarding = showQuiz || showWelcome;

  return {
    showQuiz,
    showWelcome,
    quizAnswers,
    shouldShowOnboarding,
    handleQuizComplete,
    handleWelcomeComplete
  };
};