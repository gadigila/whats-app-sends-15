
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, signup, signInWithGoogle, loading, user, isAuthReady } = useAuth();
  const navigate = useNavigate();

  console.log('🔄 AuthPage render - user:', user?.email || 'none', 'loading:', loading, 'isAuthReady:', isAuthReady);

  // Handle redirect when user is authenticated
  useEffect(() => {
    console.log('🔄 AuthPage useEffect - checking auth state...');
    
    // Only redirect if auth is ready and we have a user
    if (isAuthReady && user) {
      console.log('🔄 User is authenticated, redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, isAuthReady, navigate]);

  // Show loading while auth is initializing
  if (!isAuthReady) {
    console.log('🔄 Auth not ready yet, showing loading...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  // Don't render auth form if user is already authenticated
  if (user) {
    console.log('🔄 User is authenticated, showing loading state...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">מעביר לדשבורד...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        console.log('🔄 Attempting login with:', email);
        await login(email, password);
        toast({ title: "ברוך השב!" });
        // Don't navigate here - let useEffect handle it after auth state updates
      } else {
        console.log('🔄 Attempting signup with:', email, name);
        await signup(email, password, name);
        toast({ title: "החשבון נוצר בהצלחה!" });
        // Don't navigate here - let useEffect handle it after auth state updates
      }
    } catch (error: any) {
      console.error('🔄 Auth error:', error);
      toast({
        title: "שגיאה",
        description: error.message || "משהו השתבש. אנא נסה שוב.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('🔄 Google auth error:', error);
      toast({
        title: "שגיאה בהתחברות Google",
        description: error.message || "משהו השתבש בהתחברות עם Google.",
        variant: "destructive",
      });
    }
  };

  const isLoading = loading || isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">מתזמן וואטסאפ</h1>
            <p className="text-gray-600 mt-2">
              {isLogin ? 'ברוא השב!' : 'התחל את הניסיון החינם שלך'}
            </p>
          </div>

          {/* Google Sign In */}
          <Button
            onClick={handleGoogleAuth}
            variant="outline"
            className="w-full mb-4 h-12 text-gray-700 border-gray-300 hover:bg-gray-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin ml-3" />
            ) : (
              <svg className="w-5 h-5 ml-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {isLoading ? "מתחבר..." : "המשך עם Google"}
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">או</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label htmlFor="name">שם מלא</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="mt-1 h-12"
                  placeholder="הכנס את השם המלא שלך"
                  disabled={isLoading}
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 h-12"
                placeholder="הכנס את האימייל שלך"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 h-12"
                placeholder="הכנס את הסיסמה שלך"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  "אנא המתן..."
                </div>
              ) : (
                isLogin ? "התחבר" : "התחל ניסיון חינם"
              )}
            </Button>
          </form>

          {/* Toggle */}
          <div className="text-center mt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-green-600 hover:text-green-700 font-medium"
              disabled={isLoading}
            >
              {isLogin ? "אין לך חשבון? הירשם" : "יש לך כבר חשבון? התחבר"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
