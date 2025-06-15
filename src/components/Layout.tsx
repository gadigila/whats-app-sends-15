
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Calendar, 
  Users, 
  Send,
  Crown,
  LogOut,
  Home,
  Smartphone,
  Menu,
  X
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navigation = [
    { name: 'דשבורד', href: '/dashboard', icon: MessageSquare },
    { name: 'כתיבת הודעה', href: '/compose', icon: Send },
    { name: 'הודעות מתוזמנות', href: '/scheduled', icon: Calendar },
    { name: 'הודעות שנשלחו', href: '/sent', icon: Send },
    { name: 'קטגוריות', href: '/segments', icon: Users },
    { name: 'חיוב', href: '/billing', icon: Crown },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* Sidebar - Desktop only */}
      <aside className="hidden md:flex w-64 bg-white shadow-sm border-l flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">מתזמן וואטסאפ</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg border-r-4 ${
                    isActive(item.href)
                      ? 'bg-green-50 text-green-700 border-green-600'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50 border-transparent'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        {user && (
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-gray-700">שלום, {user.email}</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900 w-full justify-start"
            >
              <LogOut className="h-4 w-4 ml-2" />
              התנתק
            </Button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header for Mobile */}
        <header className="md:hidden bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">מתזמן וואטסאפ</h1>
              </div>
              
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="border-t border-gray-200 bg-white">
              <div className="px-4 py-3 space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-green-50 text-green-700 border-r-4 border-green-600'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                
                {/* Mobile user info */}
                {user && (
                  <div className="pt-3 border-t border-gray-200 mt-3">
                    <div className="px-3 py-2 text-sm text-gray-700">
                      שלום, {user.email}
                    </div>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 w-full text-right"
                    >
                      <LogOut className="h-4 w-4" />
                      התנתק
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
