import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, Users, Shield, Crown, Search, Database, Zap } from 'lucide-react';

interface SyncProgress {
  stage: 'starting' | 'scanning' | 'processing' | 'individual_fetch' | 'saving' | 'complete';
  groupsScanned: number;
  adminGroupsFound: number;
  currentBatch?: number;
  totalBatches?: number;
  estimatedTimeLeft?: string;
  currentGroupName?: string;
  apiCallsMade?: number;
  cacheHits?: number;
}

interface EnhancedSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress?: SyncProgress;
  syncType?: 'quick' | 'deep';
}

export const EnhancedSyncModal: React.FC<EnhancedSyncModalProps> = ({
  isOpen,
  onClose,
  progress,
  syncType = 'deep'
}) => {
  const getStageInfo = (stage: string) => {
    switch (stage) {
      case 'starting':
        return {
          title: 'מתחיל סריקה חכמה',
          description: 'מכין את המערכת לסריקה מקיפה',
          icon: <Zap className="h-5 w-5 text-blue-600" />,
          color: 'blue'
        };
      case 'scanning':
        return {
          title: 'סורק קבוצות WhatsApp',
          description: 'מחפש בכל הקבוצות שלך...',
          icon: <Search className="h-5 w-5 text-green-600" />,
          color: 'green'
        };
      case 'processing':
        return {
          title: 'מעבד נתונים',
          description: 'בודק תפקידים בקבוצות',
          icon: <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />,
          color: 'purple'
        };
      case 'individual_fetch':
        return {
          title: 'סריקה מעמיקה',
          description: 'בודק קבוצות ספציפיות',
          icon: <Users className="h-5 w-5 text-orange-600" />,
          color: 'orange'
        };
      case 'saving':
        return {
          title: 'שומר תוצאות',
          description: 'מעדכן את בסיס הנתונים',
          icon: <Database className="h-5 w-5 text-indigo-600" />,
          color: 'indigo'
        };
      case 'complete':
        return {
          title: 'הסנכרון הושלם!',
          description: 'כל הקבוצות נמצאו בהצלחה',
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          color: 'green'
        };
      default:
        return {
          title: 'מסנכרן...',
          description: 'מעבד את הבקשה',
          icon: <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />,
          color: 'blue'
        };
    }
  };

  const stageInfo = getStageInfo(progress?.stage || 'starting');
  const isComplete = progress?.stage === 'complete';
  
  // Calculate progress percentage based on stage and data
  const getProgressPercentage = () => {
    if (!progress) return 0;
    
    switch (progress.stage) {
      case 'starting': return 5;
      case 'scanning': return 20 + (progress.currentBatch || 0) / (progress.totalBatches || 1) * 60;
      case 'processing': return 80;
      case 'individual_fetch': return 85;
      case 'saving': return 95;
      case 'complete': return 100;
      default: return 0;
    }
  };

  const progressPercentage = getProgressPercentage();

  return (
    <Dialog open={isOpen} onOpenChange={!isComplete ? () => {} : onClose}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {stageInfo.icon}
            <span>{syncType === 'deep' ? 'סנכרון מעמיק' : 'סנכרון מהיר'}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Main Progress Section - Campaign Style */}
          <div className="space-y-4">
            {/* Stage Progress */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stageInfo.icon}
                <div>
                  <p className="font-medium text-gray-900">{stageInfo.title}</p>
                  <p className="text-sm text-gray-600">{stageInfo.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{Math.round(progressPercentage)}%</p>
                <p className="text-xs text-gray-500">הושלם</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{progress?.estimatedTimeLeft || 'מחשב זמן...'}</span>
                <span>{progress?.apiCallsMade || 0} API calls</span>
              </div>
            </div>
          </div>

          {/* Live Stats - Campaign Style */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">קבוצות מנהל</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {progress?.adminGroupsFound || 0}
              </p>
              <p className="text-xs text-green-600">נמצאו עד כה</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Search className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">קבוצות נסרקו</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {progress?.groupsScanned || 0}
              </p>
              <p className="text-xs text-blue-600">מתוך אלפי קבוצות</p>
            </div>
          </div>

          {/* Current Activity */}
          {progress?.currentGroupName && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                <span className="text-sm font-medium text-yellow-900">בודק כרגע:</span>
              </div>
              <p className="text-sm text-yellow-800 truncate">{progress.currentGroupName}</p>
            </div>
          )}

          {/* Timeline Progress */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">התקדמות:</p>
            <div className="space-y-2">
              {[
                { stage: 'starting', label: 'התחלת סריקה', time: '0s' },
                { stage: 'scanning', label: 'סריקת קבוצות', time: '30s' },
                { stage: 'processing', label: 'עיבוד נתונים', time: '90s' },
                { stage: 'individual_fetch', label: 'בדיקה מעמיקה', time: '120s' },
                { stage: 'saving', label: 'שמירת תוצאות', time: '150s' },
                { stage: 'complete', label: 'הושלם!', time: '180s' }
              ].map((item, index) => {
                const isActive = progress?.stage === item.stage;
                const isCompleted = progress && ['starting', 'scanning', 'processing', 'individual_fetch', 'saving', 'complete'].indexOf(progress.stage) > 
                                   ['starting', 'scanning', 'processing', 'individual_fetch', 'saving', 'complete'].indexOf(item.stage);
                
                return (
                  <div key={item.stage} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      isCompleted ? 'bg-green-500' : 
                      isActive ? 'bg-blue-500 animate-pulse' : 
                      'bg-gray-200'
                    }`} />
                    <div className="flex-1 flex justify-between items-center">
                      <span className={`text-sm ${
                        isCompleted ? 'text-green-700 font-medium' :
                        isActive ? 'text-blue-700 font-medium' :
                        'text-gray-500'
                      }`}>
                        {item.label}
                      </span>
                      <span className="text-xs text-gray-400">{item.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance Stats */}
          {progress?.cacheHits !== undefined && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">אופטימיזציה חכמה</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-purple-700">Cache hits: </span>
                  <span className="font-medium text-purple-900">{progress.cacheHits}</span>
                </div>
                <div>
                  <span className="text-purple-700">API calls: </span>
                  <span className="font-medium text-purple-900">{progress.apiCallsMade}</span>
                </div>
              </div>
            </div>
          )}

          {/* Completion Message */}
          {isComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-semibold text-green-900 mb-1">סנכרון הושלם בהצלחה! 🎉</h3>
              <p className="text-sm text-green-700 mb-3">
                נמצאו {progress?.adminGroupsFound || 0} קבוצות שאתה מנהל
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                סגור
              </button>
            </div>
          )}

          {/* Tips while running */}
          {!isComplete && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>💡 טיפ:</strong> הסנכרון רץ ברקע - אתה יכול לעבוד בכרטיסיות אחרות בזמן ההמתנה
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};