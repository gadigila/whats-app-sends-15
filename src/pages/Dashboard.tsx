import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button, ThreeDButton } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Calendar, CheckCircle, AlertTriangle, Crown, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMessageStats } from '@/hooks/useMessageStats';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSegments } from '@/hooks/useSegments';

const Dashboard = () => {
  const { user } = useAuth();
  const { stats, isLoading: statsLoading } = useMessageStats();
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  const { segments, isLoadingSegments } = useSegments();
  
  const isWhatsAppConnected = userProfile?.instance_status === 'connected';
  const hasPaidPlan = userProfile?.payment_plan !== 'trial' && userProfile?.payment_plan !== 'free';

  const statsData = [
    {
      title: 'הודעות שנשלחו',
      value: statsLoading ? '...' : stats.totalSent.toString(),
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: statsLoading ? 'טוען...' : stats.totalSent > 0 ? 'הודעות שנשלחו בהצלחה' : 'עדיין לא נשלחו הודעות',
    },
    {
      title: 'קטגוריות',
      value: isLoadingSegments ? '...' : segments.length.toString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: isLoadingSegments ? 'טוען...' : segments.length > 0 ? 'קטגוריות שנוצרו למיקוד' : 'עדיין לא נוצרו קטגוריות',
    },
    {
      title: 'מתוזמנות',
      value: statsLoading ? '...' : stats.totalScheduled.toString(),
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: statsLoading ? 'טוען...' : stats.totalScheduled > 0 ? 'הודעות שמחכות לשליחה' : 'אין הודעות מתוזמנות',
    },
    {
      title: 'אחוז הצלחה',
      value: statsLoading ? '...' : `${stats.successRate}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: statsLoading ? 'טוען...' : 'שיעור הצלחת השליחה',
    },
  ];

  // New user flow - not connected to WhatsApp yet
  if (!isWhatsAppConnected) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Welcome Message */}
          <div className="text-center py-8">
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
                  <ThreeDButton variant="primary" size="lg">
                    <Crown className="mr-2 h-5 w-5" />
                    בחר תוכנית ומשך לחיבור
                  </ThreeDButton>
                </Link>
              </div>
            ) : (
              <Link to="/connect">
                <ThreeDButton variant="primary" size="lg">
                  חבר את הוואטסאפ שלך
                </ThreeDButton>
              </Link>
            )}
          </div>

          {/* Stats Preview - Always show for visual context */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsData.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="relative">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{stat.title}</p>
                        <p className="text-2xl font-bold text-gray-400">0</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">יהיה זמין לאחר החיבור</p>
                  </CardContent>
                  {!hasPaidPlan && (
                    <div className="absolute inset-0 bg-gray-50/80 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Crown className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">יהיה זמין לאחר רכישה</p>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Features Preview - Only show for non-paid users */}
          {!hasPaidPlan && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    פעולות מהירות
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500">שלח הודעה חדשה</span>
                      </div>
                      <Crown className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500">הודעות מתוזמנות</span>
                      </div>
                      <Crown className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500">נהל קבוצות</span>
                      </div>
                      <Crown className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="pt-3">
                    <p className="text-center text-sm text-gray-500 mb-3">
                      כל הפעולות יהיו זמינות לאחר הרכישה
                    </p>
                    <Link to="/billing" className="block">
                      <ThreeDButton variant="primary" className="w-full">
                        <Crown className="mr-2 h-4 w-4" />
                        שדרג עכשיו
                      </ThreeDButton>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    מה תקבל אחרי הרכישה?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">שליחה ללא הגבלה לכל הקבוצות</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">תזמון הודעות מתקדם</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">העלאת קבצים ותמונות</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">סטטיסטיקות מפורטות</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">תמיכה טכנית מהירה</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
            <ThreeDButton variant="primary">
              <MessageSquare className="h-4 w-4 mr-2" />
              שלח הודעה חדשה
            </ThreeDButton>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsData.map((stat) => {
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
                  <p className="text-xs text-gray-500 mt-2">{stat.description}</p>
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
                  <span className="font-medium">{userProfile?.payment_plan || 'Free'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">קבוצות זמינות</span>
                  <span className="font-medium">{stats.totalGroups}</span>
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
