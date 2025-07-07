import React from 'react';
import Layout from '@/components/Layout';
import { CheckCircle, Users, MessageSquare, Settings, RefreshCw, Clock, Zap } from 'lucide-react';

interface WhatsAppConnectedViewProps {
  profile: any;
  onNavigateToCompose: () => void;
  onSyncGroups: () => void;
  onDisconnect: () => void;
  isSyncingGroups: boolean;
  isDisconnecting: boolean;
  // 🚀 NEW: Enhanced sync props
  syncCooldownRemaining?: number;
  syncCooldownStatus?: string | null;
  isSyncAvailable?: boolean;
  hasAutoSynced?: boolean;
  autoSyncScheduled?: boolean;
}

const WhatsAppConnectedView: React.FC<WhatsAppConnectedViewProps> = ({
  profile,
  onNavigateToCompose,
  onSyncGroups,
  onDisconnect,
  isSyncingGroups,
  isDisconnecting,
  syncCooldownRemaining = 0,
  syncCooldownStatus = null,
  isSyncAvailable = true,
  hasAutoSynced = false,
  autoSyncScheduled = false
}) => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">וואטסאפ מחובר!</h1>
              <p className="text-gray-600">
                מחובר כ: <span className="font-medium">{profile?.phone_number || 'לא זוהה'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Auto-sync Status */}
        {autoSyncScheduled && !hasAutoSynced && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800">🤖 סנכרון אוטומטי מתוכנן</span>
            </div>
            <p className="text-sm text-blue-600">
              הקבוצות שלך יסונכרנו אוטומטית בעוד כמה שניות עם הגנה מפני הגבלות API
            </p>
          </div>
        )}

        {hasAutoSynced && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">✅ סנכרון אוטומטי הושלם</span>
            </div>
            <p className="text-sm text-green-600">
              הקבוצות שלך סונכרנו אוטומטית לאחר החיבור
            </p>
          </div>
        )}

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Compose Message Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">שלח הודעות</h3>
            </div>
            <p className="text-gray-600 mb-4">
              שלח הודעות לכל הקבוצות שלך או לקבוצות נבחרות
            </p>
            <button
              onClick={onNavigateToCompose}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              צור הודעה חדשה
            </button>
          </div>

          {/* Sync Groups Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">סנכרון קבוצות</h3>
            </div>
            <p className="text-gray-600 mb-4">
              עדכן את רשימת הקבוצות שלך עם הגנה מפני הגבלות API
            </p>
            
            {/* Enhanced Sync Button with Cooldown */}
            <div className="space-y-3">
              <button
                onClick={onSyncGroups}
                disabled={!isSyncAvailable || isSyncingGroups}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                  isSyncAvailable && !isSyncingGroups
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSyncingGroups ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>מסנכרן קבוצות...</span>
                  </>
                ) : syncCooldownRemaining > 0 ? (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>המתן {syncCooldownStatus}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>סנכרן קבוצות</span>
                  </>
                )}
              </button>

              {/* Cooldown Info */}
              {syncCooldownRemaining > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <Zap className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">הגנה מפני הגבלות API</span>
                  </div>
                  <p className="text-xs text-orange-600">
                    המתן {syncCooldownStatus} לפני סנכרון נוסף כדי למנוע הגבלות מצד WHAPI
                  </p>
                  <div className="mt-2 bg-orange-100 rounded-full h-1 w-full">
                    <div 
                      className="bg-orange-600 h-1 rounded-full transition-all duration-1000"
                      style={{ width: `${100 - (syncCooldownRemaining / 90) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Sync Available Info */}
              {isSyncAvailable && syncCooldownRemaining === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">מוכן לסנכרון</span>
                  </div>
                  <p className="text-xs text-green-600">
                    הסנכרון המחוזק כולל הגנה מפני הגבלות API ואלגוריתם משופר לגילוי קבוצות
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">סטטוס מהיר</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {profile?.instance_status === 'connected' ? '✅' : '❌'}
              </div>
              <p className="text-sm text-gray-600">סטטוס חיבור</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {profile?.phone_number ? '📱' : '❓'}
              </div>
              <p className="text-sm text-gray-600">מספר טלפון</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {hasAutoSynced ? '🤖' : autoSyncScheduled ? '⏰' : '⭕'}
              </div>
              <p className="text-sm text-gray-600">סנכרון אוטומטי</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {syncCooldownRemaining > 0 ? '🛡️' : '✅'}
              </div>
              <p className="text-sm text-gray-600">הגנת API</p>
            </div>
          </div>
        </div>

        {/* Enhanced Features Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">🚀 שיפורים חדשים</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-blue-100 rounded-full mt-1">
                  <Zap className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">הגנה מפני הגבלות API</h4>
                  <p className="text-sm text-blue-700">סנכרון חכם עם השהיות מותאמות למניעת חסימות</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-blue-100 rounded-full mt-1">
                  <RefreshCw className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">סנכרון אוטומטי</h4>
                  <p className="text-sm text-blue-700">הקבוצות מסתנכרנות אוטומטית 90 שניות לאחר החיבור</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-blue-100 rounded-full mt-1">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">זיהוי קבוצות משופר</h4>
                  <p className="text-sm text-blue-700">אלגוריתם משופר לזיהוי מדויק של תפקידי מנהל ויוצר</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-blue-100 rounded-full mt-1">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">זמן המתנה מינימלי</h4>
                  <p className="text-sm text-blue-700">90 שניות בין סנכרונים למניעת עומס מיותר</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">הגדרות מתקדמות</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Settings className="h-5 w-5 text-gray-600" />
                <div>
                  <h4 className="font-medium text-gray-900">ניהול חיבור</h4>
                  <p className="text-sm text-gray-600">נתק את הוואטסאפ מהפלטפורמה</p>
                </div>
              </div>
              <button
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    <span>מנתק...</span>
                  </div>
                ) : (
                  'נתק וואטסאפ'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-4">
            <h4 className="font-medium text-gray-900 mb-2">🔧 Debug Info</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Instance ID: {profile?.instance_id || 'None'}</div>
              <div>Status: {profile?.instance_status || 'Unknown'}</div>
              <div>Phone: {profile?.phone_number || 'Not set'}</div>
              <div>Cooldown: {syncCooldownRemaining}s remaining</div>
              <div>Auto-synced: {hasAutoSynced ? 'Yes' : 'No'}</div>
              <div>Auto-sync scheduled: {autoSyncScheduled ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WhatsAppConnectedView;