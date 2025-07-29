import React from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Users, Plus, Loader2, Wifi, WifiOff, Settings } from 'lucide-react';
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
    isFetchingAll,
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
                    בחר קבוצות
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

        {/* Selected Groups - Simple Summary */}
        {hasSelectedGroups && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-12 w-12 text-primary" />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {selectedGroups.length} קבוצות נבחרו
              </h3>
              
              <p className="text-muted-foreground mb-6">
                הקבוצות שלך מוכנות לשליחת הודעות. ניהל אותן במודל.
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
                    טוען...
                  </>
                ) : (
                  <>
                    <Settings className="h-5 w-5 ml-2" />
                    נהל קבוצות
                  </>
                )}
              </Button>
            </div>
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