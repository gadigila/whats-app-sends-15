import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface SyncProgressIndicatorProps {
  status?: string;
  message?: string | null;
  currentPass?: number | null;
  totalPasses?: number | null;
  groupsFound?: number | null;
  totalScanned?: number | null;
  className?: string;
}

export const SyncProgressIndicator: React.FC<SyncProgressIndicatorProps> = ({
  status,
  message,
  currentPass,
  totalPasses,
  groupsFound,
  totalScanned,
  className = ""
}) => {
  if (!status || status === 'idle') return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'starting':
      case 'in_progress':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'error':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'starting':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressPercentage = () => {
    if (!currentPass || !totalPasses || totalPasses === 0) return 0;
    return (currentPass / totalPasses) * 100;
  };

  const getDisplayMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'starting':
        return 'מתחיל סנכרון...';
      case 'in_progress':
        return 'מסנכרן קבוצות...';
      case 'completed':
        return `סנכרון הושלם - ${groupsFound || 0} קבוצות נמצאו`;
      case 'error':
        return 'שגיאה בסנכרון';
      default:
        return '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Badge 
        variant="outline" 
        className={`flex items-center gap-2 ${getStatusColor()}`}
      >
        {getStatusIcon()}
        <span className="text-xs font-medium">
          {getDisplayMessage()}
        </span>
      </Badge>
      
      {(status === 'in_progress' || status === 'starting') && currentPass && totalPasses && (
        <div className="space-y-1">
          <Progress 
            value={getProgressPercentage()} 
            className="h-1" 
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>שלב {currentPass} מתוך {totalPasses}</span>
            {totalScanned && <span>{totalScanned.toLocaleString()} נסרקו</span>}
          </div>
        </div>
      )}
      
      {status === 'completed' && groupsFound !== null && totalScanned !== null && (
        <div className="text-xs text-gray-500">
          {groupsFound} קבוצות בניהולך מתוך {totalScanned.toLocaleString()} שנסרקו
        </div>
      )}
    </div>
  );
};