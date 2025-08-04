
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, Shield, Crown } from 'lucide-react';

interface SyncLoadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress?: {
    current: number;
    total: number;
    stage: string;
  };
}

export const SyncLoadingModal: React.FC<SyncLoadingModalProps> = ({
  isOpen,
  onClose,
  progress
}) => {
  const progressPercentage = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">
            🔄 מסנכרן את הקבוצות שלך
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Main loading indicator */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-gray-900">
                אנחנו מחפשים את כל הקבוצות שלך כרגע...
              </p>
              
              <p className="text-xs text-gray-500">
                התהליך יכול לקחת עד דקה אחת עבור חשבונות עם הרבה קבוצות.
              </p>
              
              {progress && (
                <p className="text-xs text-gray-500">
                  {progress.current} מתוך {progress.total} קבוצות נבדקו
                </p>
              )}
            </div>
          </div>

          {/* Progress bar if we have progress data */}
          {progress && (
            <div className="space-y-2">
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{Math.round(progressPercentage)}%</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
            </div>
          )}

          {/* Important tip */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 <strong>טיפ חשוב:</strong> בסנכרון הראשון ייתכן שלא תראה את כל המידע מיד. הנתונים ממשיכים להתעדכן ברקע - המתן כמה דקות או הפעל סנכרון נוסף לתוצאות מלאות.
            </p>
          </div>

          {/* What we're collecting */}
          <div className="bg-green-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-green-900 mb-2">מה אנחנו אוספים עבורך:</p>
            <div className="grid grid-cols-1 gap-1 text-xs">
              <div className="flex items-center gap-2 text-green-700">
                <span>👑</span>
                <span>קבוצות שיצרת - כל הקבוצות שהקמת</span>
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <span>🛡️</span>
                <span>קבוצות שאתה מנהל - קבוצות עם הרשאות ניהול</span>
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <span>💬</span>
                <span>כל הקבוצות שלך - כולל קבוצות גדולות (+800 חברים)</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
