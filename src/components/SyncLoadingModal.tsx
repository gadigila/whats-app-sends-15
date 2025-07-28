
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            מסנכרן את הקבוצות שלך
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Main loading indicator */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-gray-900">
                {progress?.stage || 'מחפש את כל הקבוצות שלך...'}
              </p>
              
              {progress && (
                <p className="text-xs text-gray-500">
                  {progress.current} מתוך {progress.total} קבוצות נבדקו
                </p>
              )}
              
              <p className="text-xs text-gray-400">
                זה יכול לקחת עד דקה עבור הרבה קבוצות 🕐
              </p>
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

          {/* What we're looking for */}
          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-blue-900 mb-2">מה אנחנו מחפשים:</p>
            <div className="grid grid-cols-1 gap-1 text-xs">
              <div className="flex items-center gap-2 text-blue-700">
                <Crown className="h-3 w-3" />
                <span>קבוצות שאתה יוצר</span>
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <Shield className="h-3 w-3" />
                <span>קבוצות שאתה מנהל</span>
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <Users className="h-3 w-3" />
                <span>כל הקבוצות (כולל 800+ חברים)</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>טיפ:</strong> אל תסגור את החלון - הסנכרון רץ ברקע והתהליך יושלם אוטומטית
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
