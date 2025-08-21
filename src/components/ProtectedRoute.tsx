
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAuthReady } = useAuth();
  const { data: profile, isLoading: isLoadingProfile } = useUserProfile();

  console.log('🔒 ProtectedRoute - Loading:', loading, 'User:', user?.email || 'none', 'Auth Ready:', isAuthReady, 'Profile Loading:', isLoadingProfile, 'Profile:', profile);

  // Show loading while auth is initializing or profile is loading
  if (!isAuthReady || loading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('🔒 No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // If user is not onboarded, redirect to onboarding
  if (profile && !profile.is_onboarded) {
    console.log('🔒 User not onboarded, redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  console.log('🔒 User authenticated and onboarded, rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute;
