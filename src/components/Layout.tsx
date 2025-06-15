
import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, Send, Users, BarChart3, CreditCard, LogOut, Settings, User } from 'lucide-react';
import TrialStatusBanner from '@/components/TrialStatusBanner';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const navigation = [
    { name: 'לוח בקרה', href: '/dashboard', icon: BarChart3 },
    { name: 'כתיבת הודעה', href: '/compose', icon: MessageSquare },
    { name: 'הודעות מתוזמנות', href: '/scheduled', icon: Calendar },
    { name: 'הודעות שנשלחו', href: '/sent', icon: Send },
    { name: 'קבוצות', href: '/segments', icon: Users },
    { name: 'חיבור WhatsApp', href: '/whatsapp-connect', icon: MessageSquare },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getUserInitials = () => {
    if (profile?.name) {
      return profile.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* Fixed Sidebar */}
      <div className="fixed inset-y-0 right-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
            <Link to="/dashboard" className="flex items-center gap-2">
              <MessageSquare className="h-8 w-8 text-green-600" />
              <span className="text-xl font-bold text-gray-900">WhatsApp Manager</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section - Fixed at bottom */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.name || user?.email || 'משתמש'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            
            <div className="space-y-1">
              <Link
                to="/billing"
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                תשלום
              </Link>
              
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors w-full text-right"
              >
                <LogOut className="h-4 w-4" />
                התנתק
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area with proper margin */}
      <div className="flex-1 mr-64">
        <TrialStatusBanner />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
