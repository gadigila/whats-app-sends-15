
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, Send, Users, CreditCard, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'דשבורד', href: '/dashboard', icon: MessageSquare },
    { name: 'כתיבת הודעה', href: '/compose', icon: Send },
    { name: 'הודעות מתוזמנות', href: '/scheduled', icon: Calendar },
    { name: 'הודעות שנשלחו', href: '/sent', icon: Send },
    { name: 'קטגוריות', href: '/segments', icon: Users },
    { name: 'חיוב', href: '/billing', icon: CreditCard },
  ];

  const trialDaysLeft = user ? Math.ceil((user.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const isTrialExpired = trialDaysLeft <= 0 && !user?.isPaid;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Mobile menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
        <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <span className="text-xl font-bold text-green-600">מתזמן וואטסאפ</span>
            <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-4 left-4 right-4">
            <Button onClick={logout} variant="outline" className="w-full">
              התנתק
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar - moved to right */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 lg:border-l lg:bg-white">
        <div className="flex h-16 items-center px-6 border-b">
          <span className="text-xl font-bold text-green-600">מתזמן וואטסאפ</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <Button onClick={logout} variant="outline" className="w-full">
            התנתק
          </Button>
        </div>
      </div>

      {/* Main content - adjusted for right sidebar */}
      <div className="lg:pr-64">
        {/* Top bar */}
        <div className="flex h-16 items-center justify-between px-4 bg-white border-b lg:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {!user?.isPaid && (
            <div className="flex items-center gap-4">
              {trialDaysLeft > 0 ? (
                <span className="text-sm text-amber-600 font-medium">
                  תקופת ניסיון: {trialDaysLeft} ימים נותרו
                </span>
              ) : (
                <span className="text-sm text-red-600 font-medium">
                  תקופת הניסיון הסתיימה
                </span>
              )}
              <Link to="/billing">
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  שדרג עכשיו
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {isTrialExpired && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">תקופת הניסיון שלך הסתיימה. אנא שדרג כדי להמשיך להשתמש בשירות.</p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
