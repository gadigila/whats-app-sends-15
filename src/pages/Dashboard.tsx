
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Calendar, CheckCircle, AlertTriangle, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  
  // For now, we'll simulate the user state - in real app this would come from user profile
  const isWhatsAppConnected = false; // This should come from user's profile/instance status
  const hasPaidPlan = false; // This should come from user's billing status

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

  // New user flow - not connected to WhatsApp yet
  if (!isWhatsAppConnected) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Welcome Message */}
          <div className="text-center py-12">
            <div className="p-6 bg-green-50 rounded-full w-fit mx-auto mb-6">
              <MessageSquare className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              ברוך הבא ל-Reecher! 👋
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              כדי להתחיל לשלוח הודעות לכל קבוצות הוואטסאפ שלך - 
              חבר את הוואטסאפ שלך למערכת
            </p>
            
            {!hasPaidPlan ? (
              <div className="space-y-4">
                <p className="text-gray-600 mb-6">
                  תחילה, בחר את התוכנית שלך כדי לגשת לכל התכונות
                </p>
                <Link to="/billing">
                  <Button className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 text-lg rounded-full">
                    <Crown className="mr-2 h-5 w-5" />
                    בחר תוכנית ומשך לחיבור
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to="/connect">
                <Button className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 text-lg rounded-full">
                  חבר את הוואטסאפ שלך
                </Button>
              </Link>
            )}
          </div>

          {/* Steps Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                השלבים הבאים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-orange-50">
                  <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {!hasPaidPlan ? 'בחר תוכנית תשלום' : 'בחרת תוכנית ✓'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {!hasPaidPlan 
                        ? 'בחר את התוכנית החודשית כדי לגשת לכל התכונות'
                        : 'המשך לחיבור הוואטסאפ'
                      }
                    </p>
                  </div>
                </div>
                
                <div className={`flex items-center gap-4 p-4 rounded-lg ${hasPaidPlan ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <div className={`w-8 h-8 ${hasPaidPlan ? 'bg-orange-500' : 'bg-gray-400'} text-white rounded-full flex items-center justify-center text-sm font-bold`}>
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">חבר וואטסאפ</h3>
                    <p className="text-sm text-gray-600">
                      סרוק QR קוד פשוט כדי לחבר את הוואטסאפ שלך
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">התחל לשלוח</h3>
                    <p className="text-sm text-gray-600">
                      כתוב הודעות ושלח לכל הקבוצות שלך בבת אחת
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Connected user dashboard - full functionality
  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              שלום, {user?.name || user?.email}! 👋
            </h1>
            <p className="text-gray-600">
              ברוך הבא ל-Reecher - מערכת שליחת ההודעות החכמה שלך
            </p>
          </div>
          
          <Link to="/compose">
            <Button className="bg-green-500 hover:bg-green-600">
              <MessageSquare className="h-4 w-4 mr-2" />
              שלח הודעה חדשה
            </Button>
          </Link>
        </div>

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
                  שלח הודעה חדשה
                </Button>
              </Link>
              <Link to="/scheduled" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 ml-2" />
                  הודעות מתוזמנות
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
              <CardTitle>סטטוס המערכת</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">וואטסאפ מחובר</span>
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    פעיל
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">תוכנית נוכחית</span>
                  <span className="font-medium">Premium</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">פעילות אחרונה</span>
                  <span className="font-medium">זמין</span>
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
