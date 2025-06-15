
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();

  console.log('Index page - user:', user, 'loading:', loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (user) {
    console.log('User is logged in, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('User is not logged in, showing landing page');
  return <LandingPage />;
};

export default Index;
