import { useState, useEffect } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';

export const useWelcomeFlow = () => {
  const { data: profile, isLoading: isLoadingProfile } = useUserProfile();
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{
    community_type?: string;
    niches: string[];
    group_count_range: string;
  } | null>(null);

  // Derived state - quiz shows when profile is loaded and user is not onboarded
  const shouldShowQuiz = !isLoadingProfile && 
                        !!profile && 
                        !profile.is_onboarded && 
                        !dismissedThisSession;

  useEffect(() => {
    if (profile) {
      console.log('🔍 Profile loaded:', {
        id: profile.id,
        is_onboarded: profile.is_onboarded,
        shouldShowQuiz: !isLoadingProfile && !profile.is_onboarded && !dismissedThisSession
      });
    }
  }, [profile, isLoadingProfile, dismissedThisSession]);

  const handleQuizComplete = () => {
    console.log('🎉 Quiz completed, dismissing for this session');
    setDismissedThisSession(true);
    
    // Store the quiz answers for the welcome message
    if (profile) {
      setQuizAnswers({
        community_type: profile.community_type || undefined,
        niches: Array.isArray(profile.niches) ? profile.niches as string[] : [],
        group_count_range: profile.group_count_range || ''
      });
    }
    
    // Show welcome immediately after quiz completion
    setShowWelcome(true);
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    setQuizAnswers(null);
  };

  const shouldShowOnboarding = shouldShowQuiz || showWelcome;

  return {
    showQuiz: shouldShowQuiz, // Use derived state
    showWelcome,
    quizAnswers,
    shouldShowOnboarding,
    handleQuizComplete,
    handleWelcomeComplete
  };
};