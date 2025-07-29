import React from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, RefreshCw, Edit, MessageSquare, Loader2, Wifi, WifiOff } from 'lucide-react';
import { GroupSelectionModal } from '@/components/GroupSelectionModal';
import { useGroupManagement } from '@/hooks/useGroupManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

const Groups = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: isLoadingProfile } = useUserProfile();
  const {
    selectedGroups,
    isLoadingSelected,
    startGroupSelection,
    showGroupSelection,
    closeGroupSelection,
    refreshMemberCounts,
    isFetchingAll,
    isRefreshing,
    totalGroups,
    totalMembers,
    hasSelectedGroups
  } = useGroupManagement();

  // Check if WhatsApp is connected
  const isConnected = profile?.instance_status === 'connected' && profile?.whapi_token;

  if (isLoadingSelected || isLoadingProfile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>טוען קבוצות...</span>
          </div>
        </div>
      </Layout>
    );
  }

  // Show WhatsApp not connected message
  if (!isConnected) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center">
                  <WifiOff className="h-12 w-12 text-destructive" />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                וואטסאפ לא מחובר
              </h3>
              
              <p className="text-muted-foreground mb-6">
                כדי לנהל קבוצות ולשלוח הודעות, קודם צריך לחבר את חשבון הוואטסאפ שלך
              </p>
              
              <Button 
                size="lg"
                onClick={() => window.location.href = '/whatsapp-connect'}
                className="w-full sm:w-auto"
              >
                <Wifi className="h-5 w-5 ml-2" />
                חבר וואטסאפ
              </Button>
              
              <div className="mt-8 p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-accent-foreground">
                  <strong>📱 איך לחבר:</strong>
                  <br />
                  • לחץ על "חבר וואטסאפ"
                  <br />
                  • סרוק את קוד ה-QR עם הוואטסאפ שלך
                  <br />
                  • חזור לכאן כדי לנהל את הקבוצות שלך
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">ניהול קבוצות</h1>
            <p className="text-muted-foreground">
              בחר את הקבוצות שאתה רוצה לנהל ולשלוח להן הודעות
            </p>
          </div>
          
          {hasSelectedGroups && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => refreshMemberCounts.mutate()}
                disabled={isRefreshing || !isConnected}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 ml-2" />
                )}
                עדכן מספר חברים
              </Button>
              
              <Button
                variant="outline"
                onClick={startGroupSelection}
                disabled={isFetchingAll || !isConnected}
              >
                <Edit className="h-4 w-4 ml-2" />
                ערוך קבוצות
              </Button>
            </div>
          )}
        </div>

        {/* No Groups State */}
        {!hasSelectedGroups && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-12 w-12 text-primary" />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                טרם נבחרו קבוצות
              </h3>
              
              <p className="text-muted-foreground mb-6">
                כדי להתחיל לשלוח הודעות, קודם צריך לבחור את הקבוצות שאתה רוצה לנהל
              </p>
              
              <Button 
                size="lg"
                onClick={startGroupSelection}
                disabled={isFetchingAll || !isConnected}
                className="w-full sm:w-auto"
              >
                {isFetchingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin ml-2" />
                    טוען קבוצות...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 ml-2" />
                    הוסף קבוצות לניהול
                  </>
                )}
              </Button>
              
              <div className="mt-8 p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-accent-foreground">
                  <strong>💡 איך זה עובד:</strong>
                  <br />
                  • נטען את כל הקבוצות מהוואטסאפ שלך
                  <br />
                  • תבחר אילו קבוצות אתה רוצה לנהל
                  <br />
                  • תוכל לשלוח הודעות לכל הקבוצות שבחרת בלחיצה אחת
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Selected Groups */}
        {hasSelectedGroups && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    סך הכל קבוצות
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalGroups}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    סך הכל חברים
                  </CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalMembers.toLocaleString()}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    ממוצע לקבוצה
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalGroups > 0 ? Math.round(totalMembers / totalGroups) : 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Groups List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>הקבוצות שלך</span>
                  <Button
                    size="sm"
                    onClick={startGroupSelection}
                    disabled={isFetchingAll || !isConnected}
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף עוד
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {selectedGroups.map((group) => (
                    <div 
                      key={group.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        
                        <div>
                          <h3 className="font-medium text-foreground">{group.name}</h3>
                          {group.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-md">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-left">
                        <Badge variant="secondary">
                          {group.participants_count > 0 
                            ? `${group.participants_count} חברים`
                            : 'לא ידוע'
                          }
                        </Badge>
                        {group.last_refreshed_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            עודכן: {new Date(group.last_refreshed_at).toLocaleDateString('he-IL')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Group Selection Modal */}
        {user?.id && (
          <GroupSelectionModal
            isOpen={showGroupSelection}
            onClose={closeGroupSelection}
            userId={user.id}
          />
        )}
      </div>
    </Layout>
  );
};

export default Groups;