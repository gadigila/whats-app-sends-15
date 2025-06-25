
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Users, RefreshCw } from 'lucide-react';

interface SelectiveSyncProps {
  onSyncAll: () => void;
  onSyncAdminOnly: () => void;
  isSyncing: boolean;
  adminGroupsCount?: number;
  totalGroupsCount?: number;
}

const SelectiveGroupSync = ({ 
  onSyncAll, 
  onSyncAdminOnly, 
  isSyncing, 
  adminGroupsCount = 0, 
  totalGroupsCount = 0 
}: SelectiveSyncProps) => {
  const [syncType, setSyncType] = useState<'all' | 'admin' | null>(null);

  const handleSyncAll = () => {
    setSyncType('all');
    onSyncAll();
  };

  const handleSyncAdminOnly = () => {
    setSyncType('admin');
    onSyncAdminOnly();
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <RefreshCw className="h-5 w-5" />
          סנכרון קבוצות WhatsApp
        </CardTitle>
        <p className="text-sm text-blue-600">
          בחר איזה קבוצות לסנכרן עם הפלטפורמה שלך
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync All Groups */}
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">כל הקבוצות</h3>
              <p className="text-sm text-gray-600">
                סנכרן את כל הקבוצות שאתה חבר בהן
              </p>
              {totalGroupsCount > 0 && (
                <Badge variant="secondary" className="mt-1">
                  {totalGroupsCount} קבוצות
                </Badge>
              )}
            </div>
          </div>
          <Button
            onClick={handleSyncAll}
            disabled={isSyncing}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50"
          >
            {isSyncing && syncType === 'all' ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                מסנכרן...
              </>
            ) : (
              'סנכרן הכל'
            )}
          </Button>
        </div>

        {/* Sync Admin Groups Only */}
        <div className="flex items-center justify-between p-4 border border-amber-200 rounded-lg bg-amber-50">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-900">קבוצות בניהולי בלבד</h3>
              <p className="text-sm text-amber-700">
                סנכרן רק קבוצות שאתה מנהל או יוצר שלהן
              </p>
              <Badge className="mt-1 bg-amber-100 text-amber-800 border-amber-300">
                מומלץ למנהלי קהילות
              </Badge>
              {adminGroupsCount > 0 && (
                <Badge variant="secondary" className="mt-1 ml-2">
                  {adminGroupsCount} קבוצות ניהול
                </Badge>
              )}
            </div>
          </div>
          <Button
            onClick={handleSyncAdminOnly}
            disabled={isSyncing}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSyncing && syncType === 'admin' ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                מסנכרן...
              </>
            ) : (
              'סנכרן קבוצות בניהולי'
            )}
          </Button>
        </div>

        {/* Info Note */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
          💡 <strong>טיפ:</strong> אם אתה מנהל קהילות או מעביר תוכן רק לקבוצות שאתה מנהל, 
          בחר "קבוצות בניהולי בלבד" כדי לחסוך זמן ולהתמקד בקבוצות הרלוונטיות.
        </div>
      </CardContent>
    </Card>
  );
};

export default SelectiveGroupSync;
