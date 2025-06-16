
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  RefreshCw, 
  Search, 
  Crown,
  MessageCircle,
  Clock,
  Layers
} from 'lucide-react';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useSegments } from '@/hooks/useSegments';
import { cn } from '@/lib/utils';

interface WhatsAppGroupsListProps {
  onGroupSelect?: (groupIds: string[], groupNames: string[]) => void;
  selectedGroups?: string[];
  selectionMode?: boolean;
}

const WhatsAppGroupsList = ({ 
  onGroupSelect, 
  selectedGroups = [], 
  selectionMode = false 
}: WhatsAppGroupsListProps) => {
  const { groups, isLoading, syncGroups, isSyncing } = useWhatsAppGroups();
  const { segments } = useSegments();
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSelected, setInternalSelected] = useState<string[]>(selectedGroups);

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSegments = segments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGroupToggle = (groupId: string, groupName: string) => {
    if (!selectionMode) return;

    const newSelected = internalSelected.includes(groupId)
      ? internalSelected.filter(id => id !== groupId)
      : [...internalSelected, groupId];

    setInternalSelected(newSelected);

    if (onGroupSelect) {
      const selectedNames = groups
        .filter(g => newSelected.includes(g.group_id))
        .map(g => g.name);
      onGroupSelect(newSelected, selectedNames);
    }
  };

  const handleSegmentSelect = (segment: any) => {
    if (!selectionMode) return;

    // Find the actual group IDs that match the segment's group names
    const segmentGroupIds = groups
      .filter(g => segment.groups.includes(g.name))
      .map(g => g.group_id);

    // Add all groups from this segment to selection
    const newSelected = [...new Set([...internalSelected, ...segmentGroupIds])];
    setInternalSelected(newSelected);

    if (onGroupSelect) {
      const selectedNames = groups
        .filter(g => newSelected.includes(g.group_id))
        .map(g => g.name);
      onGroupSelect(newSelected, selectedNames);
    }
  };

  const formatLastSync = (lastSynced: string) => {
    const date = new Date(lastSynced);
    return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">טוען קבוצות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">נמענים</h3>
          <p className="text-sm text-gray-600">
            {groups.length} קבוצות, {segments.length} קטגוריות
          </p>
        </div>
        <Button
          onClick={() => syncGroups()}
          disabled={isSyncing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={cn("h-4 w-4 ml-2", isSyncing && "animate-spin")} />
          {isSyncing ? 'מסנכרן...' : 'רענן קבוצות'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="חפש קבוצות או קטגוריות..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Tabs for Groups and Segments */}
      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            קבוצות
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            קטגוריות
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="groups" className="mt-4">
          {/* Groups list */}
          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {groups.length === 0 ? 'אין קבוצות' : 'לא נמצאו קבוצות'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {groups.length === 0 
                    ? 'לחץ על "רענן קבוצות" כדי לסנכרן קבוצות מוואטסאפ'
                    : 'נסה חיפוש אחר או נקה את השדה'
                  }
                </p>
                {groups.length === 0 && (
                  <Button onClick={() => syncGroups()} disabled={isSyncing}>
                    <RefreshCw className={cn("h-4 w-4 ml-2", isSyncing && "animate-spin")} />
                    סנכרן קבוצות
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredGroups.map((group) => (
                <Card
                  key={group.id}
                  className={cn(
                    "transition-all duration-200 hover:shadow-md",
                    selectionMode && "cursor-pointer hover:bg-gray-50",
                    internalSelected.includes(group.group_id) && "ring-2 ring-green-500 bg-green-50"
                  )}
                  onClick={() => handleGroupToggle(group.group_id, group.name)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={group.avatar_url || undefined} />
                        <AvatarFallback className="bg-green-100 text-green-700">
                          {group.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {group.name}
                          </h4>
                          {group.is_admin && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        
                        {group.description && (
                          <p className="text-sm text-gray-600 truncate mb-2">
                            {group.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{group.participants_count} משתתפים</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>עודכן: {formatLastSync(group.last_synced_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {group.is_admin && (
                          <Badge variant="secondary" className="text-xs">
                            מנהל
                          </Badge>
                        )}
                        {selectionMode && internalSelected.includes(group.group_id) && (
                          <Badge className="bg-green-600 text-xs">
                            נבחר
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="segments" className="mt-4">
          {/* Segments list */}
          {filteredSegments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {segments.length === 0 ? 'אין קטגוריות' : 'לא נמצאו קטגוריות'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {segments.length === 0 
                    ? 'צור קטגוריות בעמוד הקטגוריות'
                    : 'נסה חיפוש אחר או נקה את השדה'
                  }
                </p>
                {segments.length === 0 && (
                  <Button onClick={() => window.location.href = '/segments'}>
                    <Layers className="h-4 w-4 ml-2" />
                    עבור לעמוד קטגוריות
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredSegments.map((segment) => (
                <Card
                  key={segment.id}
                  className={cn(
                    "transition-all duration-200 hover:shadow-md",
                    selectionMode && "cursor-pointer hover:bg-gray-50"
                  )}
                  onClick={() => handleSegmentSelect(segment)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Layers className="h-6 w-6 text-blue-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {segment.name}
                        </h4>
                        
                        <div className="flex flex-wrap gap-1 mb-2">
                          {segment.groups.slice(0, 3).map(group => (
                            <Badge key={group} variant="secondary" className="text-xs">
                              {group}
                            </Badge>
                          ))}
                          {segment.groups.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{segment.groups.length - 3}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{segment.totalMembers} משתתפים</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>{segment.groups.length} קבוצות</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {selectionMode && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSegmentSelect(segment);
                            }}
                          >
                            בחר הכל
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectionMode && internalSelected.length > 0 && (
        <div className="sticky bottom-4 bg-white p-4 border rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {internalSelected.length} קבוצות נבחרו
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setInternalSelected([]);
                onGroupSelect?.([], []);
              }}
            >
              נקה הכל
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppGroupsList;
