import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Users, RefreshCw, Filter } from 'lucide-react';

interface SelectiveSyncProps {
  onSyncAll: () => void;
  onSyncAdminOnly: () => void;
  isSyncing: boolean;
  adminGroupsCount?: number;
  totalGroupsCount?: number;
  groups?: any[]; // Add groups prop to show current status
}

const SelectiveGroupSync = ({ 
  onSyncAll, 
  onSyncAdminOnly, 
  isSyncing, 
  adminGroupsCount = 0, 
  totalGroupsCount = 0,
  groups = []
}: SelectiveSyncProps) => {
  const [syncType, setSyncType] = useState<'all' | 'admin' | null>(null);
  const [showFilter, setShowFilter] = useState<'all' | 'admin'>('all');

  const handleSyncAll = () => {
    setSyncType('all');
    setShowFilter('all');
    onSyncAll();
  };

  const handleSyncAdminOnly = () => {
    setSyncType('admin');
    setShowFilter('admin');
    onSyncAdminOnly();
  };

  // Filter groups based on current view
  const displayGroups = showFilter === 'admin' 
    ? groups.filter(g => g.is_admin === true)
    : groups;

  return (
    <div className="space-y-6">
      {/* Sync Options */}
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
                  סנכרן ורק קבוצות שאתה מנהל או יוצר שלהן
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

      {/* Groups Display with Filter Toggle */}
      {groups && groups.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>הקבוצות שלך</CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Button
                  variant={showFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFilter('all')}
                  className="text-xs"
                >
                  כל הקבוצות ({totalGroupsCount})
                </Button>
                <Button
                  variant={showFilter === 'admin' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFilter('admin')}
                  className="text-xs bg-amber-600 hover:bg-amber-700 border-amber-600"
                >
                  <Crown className="h-3 w-3 ml-1" />
                  קבוצות בניהולי ({adminGroupsCount})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {displayGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {showFilter === 'admin' ? (
                  <div>
                    <Crown className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>לא נמצאו קבוצות בניהולך</p>
                    <p className="text-xs mt-1">אולי יש בעיה בזיהוי הניהול? נסה לסנכרן שוב</p>
                  </div>
                ) : (
                  <div>
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>לא נמצאו קבוצות</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayGroups.slice(0, 8).map((group) => (
                    <div key={group.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        {group.is_admin ? (
                          <Crown className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Users className="h-4 w-4 text-gray-400" />
                        )}
                        {group.avatar_url && (
                          <img 
                            src={group.avatar_url} 
                            alt={group.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{group.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{group.participants_count || 0} משתתפים</span>
                          {group.is_admin && (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                              מנהל
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {displayGroups.length > 8 && (
                  <div className="text-center pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      ועוד {displayGroups.length - 8} קבוצות {showFilter === 'admin' ? 'בניהולך' : 'נוספות'}...
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SelectiveGroupSync;