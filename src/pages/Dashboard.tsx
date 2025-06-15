
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Calendar, CheckCircle, Crown, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  
  const stats = [
    {
      title: 'הודעות שנשלחו',
      value: '0',
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'קבוצות מחוברות',
      value: '0',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'מתוזמנות',
      value: '0',
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'אחוז הצלחה',
      value: '100%',
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
              ברוך הבא למערכת שליחת הודעות WhatsApp
            </p>
          </div>
          
          <div className="flex gap-3">
            <Link to="/billing">
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Crown className="h-4 w-4 mr-2" />
                שדרג לPremium
              </Button>
            </Link>
            <Link to="/connect">
              <Button className="bg-green-600 hover:bg-green-700">
                חבר וואטסאפ
              </Button>
            </Link>
          </div>
        </div>

        {/* Connection Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  סטטוס וואטסאפ: לא מחובר
                </h3>
                <p className="text-gray-600">
                  חבר את הוואטסאפ שלך כדי להתחיל לשלוח הודעות לקבוצות.
                </p>
              </div>
              <Link to="/connect">
                <Button>חבר עכשיו</Button>
              </Link>
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
                  נהל קבוצות
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>התחל עכשיו</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  כדי להתחיל לשלוח הודעות:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">1</div>
                    <span>חבר את הוואטסאפ שלך</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">2</div>
                    <span>כתוב הודעה חדשה</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">3</div>
                    <span>בחר קבוצות ושלח</span>
                  </div>
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
