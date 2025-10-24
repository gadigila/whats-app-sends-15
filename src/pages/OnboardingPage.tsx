import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWelcomeFlow } from '@/hooks/useWelcomeFlow';
import OnboardingQuiz from '@/components/OnboardingQuiz';
import WelcomeMessage from '@/components/WelcomeMessage';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { trackCompleteRegistration } from '@/lib/fbPixel';

const OnboardingPage = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: isLoadingProfile } = useUserProfile();
  const {
    showQuiz,
    showWelcome,
    quizAnswers,
    handleQuizComplete,
    handleWelcomeComplete
  } = useWelcomeFlow();

  // Show loading while auth or profile is loading
  if (loading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  // If no user, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user is already onboarded and not showing welcome, redirect to dashboard
  if (profile?.is_onboarded && !showWelcome) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleQuizCompleteWithNavigation = () => {
    handleQuizComplete();
  };

  const handleWelcomeCompleteWithNavigation = () => {
    handleWelcomeComplete();
    
    // Track CompleteRegistration event for Facebook Pixel
    trackCompleteRegistration();
    
    // Navigate to dashboard after welcome is complete
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {showQuiz && (
        <OnboardingQuiz onComplete={handleQuizCompleteWithNavigation} />
      )}

      {showWelcome && (
        <WelcomeMessage 
          onContinue={handleWelcomeCompleteWithNavigation}
          userAnswers={quizAnswers} 
        />
      )}
    </div>
  );
};

export default OnboardingPage;