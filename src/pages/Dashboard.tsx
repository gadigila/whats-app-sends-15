
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Calendar, CheckCircle, AlertCircle, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  
  const trialDaysLeft = user ? Math.ceil((user.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  
  const stats = [
    {
      title: 'הודעות שנשלחו',
      value: '127',
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'קבוצות מחוברות',
      value: user?.whatsappConnected ? '8' : '0',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'מתוזמנות',
      value: '5',
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'אחוז הצלחה',
      value: '98%',
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              ברוך השב, {user?.name}!
            </h1>
            <p className="text-gray-600">
              {user?.isPaid 
                ? "החשבון שלך פעיל ומוכן לשימוש."
                : `נותרו לך ${Math.max(0, trialDaysLeft)} ימים בתקופת הניסיון החינמית.`
              }
            </p>
          </div>
          
          <div className="flex gap-3">
            {!user?.isPaid && (
              <Link to="/billing">
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Crown className="h-4 w-4 mr-2" />
                  שדרג לPremium
                </Button>
              </Link>
            )}
            {!user?.whatsappConnected && (
              <Link to="/connect">
                <Button className="bg-green-600 hover:bg-green-700">
                  חבר וואטסאפ
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Subscription Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${user?.isPaid ? 'bg-green-50' : 'bg-orange-50'}`}>
                {user?.isPaid ? (
                  <Crown className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  סטטוס מנוי: {user?.isPaid ? 'Premium פעיל' : 'ניסיון חינם'}
                </h3>
                <p className="text-gray-600">
                  {user?.isPaid 
                    ? 'יש לך גישה מלאה לכל התכונות של המערכת.'
                    : `נותרו לך ${Math.max(0, trialDaysLeft)} ימים בתקופת הניסיון. שדרג כדי להמשיך להשתמש.`
                  }
                </p>
              </div>
              {!user?.isPaid && (
                <Link to="/billing">
                  <Button>שדרג עכשיו</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connection Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${user?.whatsappConnected ? 'bg-green-50' : 'bg-red-50'}`}>
                {user?.whatsappConnected ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  סטטוס וואטסאפ: {user?.whatsappConnected ? 'מחובר' : 'לא מחובר'}
                </h3>
                <p className="text-gray-600">
                  {user?.whatsappConnected 
                    ? 'הוואטסאפ שלך מחובר ומוכן לשליחת הודעות.'
                    : 'חבר את הוואטסאפ שלך כדי להתחיל לשלוח הודעות לקבוצות.'
                  }
                </p>
              </div>
              {!user?.whatsappConnected && (
                <Link to="/connect">
                  <Button>חבר עכשיו</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>פעולות מהירות</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/compose" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="h-4 w-4 ml-2" />
                  כתוב הודעה חדשה
                </Button>
              </Link>
              <Link to="/scheduled" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 ml-2" />
                  צפה בהודעות מתוזמנות
                </Button>
              </Link>
              <Link to="/segments" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 ml-2" />
                  נהל קטגוריות
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>פעילות אחרונה</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>הודעה נשלחה ל"צוות שיווק" - לפני שעתיים</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>קטגוריה חדשה "לקוחות VIP" נוצרה - לפני יום</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>הודעה תוזמנה למחר - לפני יומיים</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
