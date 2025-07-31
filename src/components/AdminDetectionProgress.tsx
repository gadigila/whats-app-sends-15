import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAdminDetection } from '@/hooks/useAdminDetection';

interface AdminDetectionProgressProps {
  className?: string;
  showDetails?: boolean;
}

export const AdminDetectionProgress: React.FC<AdminDetectionProgressProps> = ({ 
  className = '',
  showDetails = true 
}) => {
  const { 
    progress, 
    isLoadingProgress, 
    isProcessing, 
    isCompleted, 
    progressPercentage,
    getStatusText 
  } = useAdminDetection();

  // Don't show anything if no groups or still loading
  if (isLoadingProgress || !progress || progress.total_groups === 0) {
    return null;
  }

  // Don't show if processing is complete and user doesn't want details
  if (isCompleted && !showDetails) {
    return null;
  }

  const getStatusIcon = () => {
    if (isProcessing) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    }
    if (isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (progress.failed_groups > 0) {
      return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getStatusColor = () => {
    if (isProcessing) return 'bg-blue-50 border-blue-200';
    if (isCompleted) return 'bg-green-50 border-green-200';
    if (progress.failed_groups > 0) return 'bg-yellow-50 border-yellow-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <Card className={`${getStatusColor()} ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">
                זיהוי סטטוס מנהל
              </span>
              
              {isProcessing && (
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  מעבד ברקע
                </Badge>
              )}
              
              {isCompleted && (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  הושלם
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              {getStatusText()}
            </p>
            
            {isProcessing && (
              <div className="space-y-1">
                <Progress 
                  value={progressPercentage} 
                  className="h-2" 
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{progress.completed_groups} הושלמו</span>
                  <span>{progress.pending_groups} נותרו</span>
                </div>
              </div>
            )}
            
            {showDetails && isCompleted && (
              <div className="flex gap-2 mt-2">
                {progress.completed_groups > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    ✅ {progress.completed_groups} זוהו
                  </Badge>
                )}
                {progress.failed_groups > 0 && (
                  <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">
                    ⚠️ {progress.failed_groups} נכשלו
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};