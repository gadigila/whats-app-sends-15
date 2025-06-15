
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, 
  Calendar, 
  Users, 
  Send, 
  Settings,
  Crown,
  LogOut,
  BarChart3,
  Home,
  Smartphone
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navigation = [
    { name: 'דשבורד', href: '/dashboard', icon: Home },
    { name: 'כתיבת הודעה', href: '/compose', icon: MessageSquare },
    { name: 'הודעות מתוזמנות', href: '/scheduled', icon: Calendar },
    { name: 'הודעות שנשלחו', href: '/sent', icon: Send },
    { name: 'קטגוריות', href: '/segments', icon: Users },
    { name: 'חיבור וואטסאפ', href: '/connect', icon: Smartphone },
    { name: 'סטטיסטיקות', href: '/analytics', icon: BarChart3 },
    { name: 'מנוי ותשלום', href: '/billing', icon: Crown },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">מתזמן וואטסאפ</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Subscription Status */}
              {user && (
                <div className="flex items-center gap-2">
                  {user.isPaid ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <Crown className="h-4 w-4" />
                      Premium
                    </span>
                  ) : (
                    <Link to="/billing">
                      <Button size="sm" variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-50">
                        <Crown className="h-4 w-4 mr-1" />
                        שדרג
                      </Button>
                    </Link>
                  )}
                </div>
              )}

              {/* User Menu */}
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">שלום, {user.name}</span>
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-4">
                <nav className="space-y-2">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive(item.href)
                            ? 'bg-green-100 text-green-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
