
import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import TrialStatusBanner from '@/components/TrialStatusBanner';
import { Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useWelcomeFlow } from '@/hooks/useWelcomeFlow';
import OnboardingQuiz from '@/components/OnboardingQuiz';
import WelcomeMessage from '@/components/WelcomeMessage';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const {
    showQuiz,
    showWelcome,
    quizAnswers,
    shouldShowOnboarding,
    handleQuizComplete,
    handleWelcomeComplete
  } = useWelcomeFlow();

  const getUserName = () => {
    if (profile?.name) return profile.name;
    if (user?.email) return user.email.split('@')[0];
    return 'משתמש';
  };

  return (
    <div className="min-h-screen bg-background w-full" dir="rtl">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Mobile header */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 md:hidden">
            <SidebarTrigger>
              <Menu className="h-6 w-6" />
            </SidebarTrigger>
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700">{getUserName()}</span>
            </div>
          </header>
          
          <TrialStatusBanner />
          <main className="p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Onboarding Overlay */}
      {showQuiz && (
        <div className="fixed inset-0 z-50">
          <OnboardingQuiz onComplete={handleQuizComplete} />
        </div>
      )}

      {showWelcome && (
        <div className="fixed inset-0 z-50">
          <WelcomeMessage 
            onContinue={handleWelcomeComplete}
            userAnswers={quizAnswers} 
          />
        </div>
      )}
    </div>
  );
};

export default Layout;
