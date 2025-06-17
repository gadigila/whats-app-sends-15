
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAuthReady } = useAuth();

  console.log('🔒 ProtectedRoute - Loading:', loading, 'User:', user?.email || 'none', 'Auth Ready:', isAuthReady);

  // Show loading while auth is initializing
  if (!isAuthReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('🔒 No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  console.log('🔒 User authenticated, rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute;
