import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  MessageSquare, 
  Users, 
  RefreshCw, 
  LogOut, 
  Calendar,
  Clock,
  Loader2
} from 'lucide-react';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';

interface WhatsAppConnectedViewProps {
  profile: any;
  onNavigateToCompose: () => void;
  onSyncGroups: () => void;
  onDisconnect: () => void;
  isSyncingGroups: boolean;
  isDisconnecting: boolean;
}

const WhatsAppConnectedView: React.FC<WhatsAppConnectedViewProps> = ({
  profile,
  onNavigateToCompose,
  onSyncGroups, // This is now unused, we use the enhanced hook
  onDisconnect,
  isSyncingGroups: externalIsSyncing, // Keep for backward compatibility
  isDisconnecting
}) => {
  // 🆕 Use enhanced groups hook for smart sync
  const {
    groups,
    totalGroups,
    adminGroups,
    totalMembers,
    syncGroups,
    isSyncing,
    isInCooldown,
    syncCooldownSeconds,
    autoRetryActive,
    retryAttempt
  } = useWhatsAppGroups();

  // 🆕 Smart sync button handler
  const handleSyncClick = () => {
    if (!isInCooldown && !isSyncing) {
      syncGroups.mutate();
    }
  };

  // 🆕 Sync button text and state
  const getSyncButtonText = () => {
    if (isSyncing) {
      return autoRetryActive ? `חיפוש אוטומטי (${retryAttempt + 1})...` : 'מסנכרן קבוצות...';
    }
    
    if (isInCooldown) {
      return `זמין בעוד ${syncCooldownSeconds}s`;
    }
    
    if (autoRetryActive) {
      return `חיפוש אוטומטי פעיל (${retryAttempt})`;
    }
    
    return 'סנכרן קבוצות';
  };

  const getSyncButtonIcon = () => {
    if (isSyncing || autoRetryActive) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    
    if (isInCooldown) {
      return <Clock className="h-4 w-4" />;
    }
    
    return <RefreshCw className="h-4 w-4" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Phone className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp מחובר בהצלחה!</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-green-700 border-green-700">
                מחובר
              </Badge>
              {profile?.phone_number && (
                <Badge variant="secondary">
                  {profile.phone_number}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            סטטיסטיקות הקבוצות שלך
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalGroups}</div>
              <div className="text-sm text-blue-800">סך קבוצות</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{adminGroups}</div>
              <div className="text-sm text-green-800">קבוצות מנהל</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{totalMembers.toLocaleString()}</div>
              <div className="text-sm text-purple-800">סך חברים</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🆕 Enhanced Auto-Retry Status */}
      {autoRetryActive && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900">חיפוש אוטומטי פעיל</h4>
                <p className="text-sm text-blue-700">
                  מחפש קבוצות נוספות ברקע (ניסיון {retryAttempt + 1})...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              שלח הודעות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              שלח הודעות לכל הקבוצות שלך או לקבוצות נבחרות
            </p>
            <Button 
              onClick={onNavigateToCompose}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={totalGroups === 0}
            >
              <MessageSquare className="h-4 w-4 ml-2" />
              צור הודעה חדשה
            </Button>
            {totalGroups === 0 && (
              <p className="text-sm text-orange-600">
                תחילה סנכרן את הקבוצות שלך
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              סנכרון קבוצות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              עדכן את רשימת הקבוצות שלך מ-WhatsApp
            </p>
            
            {/* 🆕 Enhanced Sync Button with Smart States */}
            <Button 
              onClick={handleSyncClick}
              disabled={isInCooldown || isSyncing || externalIsSyncing}
              className={`w-full ${
                isInCooldown 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : isSyncing || autoRetryActive
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-blue-600 hover:bg-blue-700'
              }`}
              variant={isInCooldown ? "secondary" : "default"}
            >
              {getSyncButtonIcon()}
              <span className="mr-2">{getSyncButtonText()}</span>
            </Button>
            
            {/* 🆕 Cooldown explanation */}
            {isInCooldown && (
              <p className="text-xs text-gray-500 text-center">
                ממתין לסנכרון WhatsApp לפני חיפוש הקבוצות
              </p>
            )}
            
            {/* 🆕 Auto-retry info */}
            {autoRetryActive && (
              <p className="text-xs text-blue-600 text-center">
                מתבצע חיפוש נוסף ברקע לתוצאות טובות יותר
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            הודעות מתוזמנות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            נהל הודעות שתוזמנו לשליחה מאוחר יותר
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/scheduled'}
            className="w-full"
          >
            <Calendar className="h-4 w-4 ml-2" />
            צפה בהודעות מתוזמנות
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect Section */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <LogOut className="h-5 w-5" />
            נתק WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            נתק את חשבון ה-WhatsApp שלך מהמערכת
          </p>
          <Button 
            variant="outline" 
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="w-full text-red-600 border-red-600 hover:bg-red-50"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                מנתק...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4 ml-2" />
                נתק WhatsApp
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConnectedView;