import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, X, Users, MessageSquare, Star } from 'lucide-react';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useSegments } from '@/hooks/useSegments';

interface MessageRecipientsSelectorProps {
  selectedGroupIds: string[];
  selectedSegmentIds: string[];
  onGroupsChange: (groupIds: string[]) => void;
  onSegmentsChange: (segmentIds: string[]) => void;
}

const MessageRecipientsSelector = ({
  selectedGroupIds,
  selectedSegmentIds,
  onGroupsChange,
  onSegmentsChange
}: MessageRecipientsSelectorProps) => {
  const { groups, isLoadingGroups } = useWhatsAppGroups();
  const { segments, isLoadingSegments } = useSegments();
  
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [segmentSearchQuery, setSegmentSearchQuery] = useState('');
  const [showOnlyAdminGroups, setShowOnlyAdminGroups] = useState(false);

  // Filter groups based on search and admin status
  const filteredGroups = useMemo(() => {
    let filtered = groups;
    
    if (showOnlyAdminGroups) {
      filtered = filtered.filter(group => group.is_admin === true);
    }
    
    if (groupSearchQuery.trim()) {
      const query = groupSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(query) ||
        (group.description && group.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [groups, groupSearchQuery, showOnlyAdminGroups]);

  // Filter segments based on search
  const filteredSegments = useMemo(() => {
    if (!segmentSearchQuery.trim()) return segments;
    
    const query = segmentSearchQuery.toLowerCase().trim();
    return segments.filter(segment => 
      segment.name.toLowerCase().includes(query)
    );
  }, [segments, segmentSearchQuery]);

  // Get all group IDs from selected segments
  const groupIdsFromSegments = useMemo(() => {
    const segmentGroupIds = new Set<string>();
    selectedSegmentIds.forEach(segmentId => {
      const segment = segments.find(s => s.id === segmentId);
      if (segment) {
        segment.group_ids.forEach(groupId => segmentGroupIds.add(groupId));
      }
    });
    return Array.from(segmentGroupIds);
  }, [selectedSegmentIds, segments]);

  // Calculate total unique groups and members
  const totalStats = useMemo(() => {
    const allSelectedGroupIds = new Set([...selectedGroupIds, ...groupIdsFromSegments]);
    const totalGroups = allSelectedGroupIds.size;
    const totalMembers = Array.from(allSelectedGroupIds).reduce((sum, groupId) => {
      const group = groups.find(g => g.group_id === groupId);
      return sum + (group?.participants_count || 0);
    }, 0);
    
    return { totalGroups, totalMembers };
  }, [selectedGroupIds, groupIdsFromSegments, groups]);

  const handleGroupToggle = (groupId: string) => {
    const newSelection = selectedGroupIds.includes(groupId)
      ? selectedGroupIds.filter(id => id !== groupId)
      : [...selectedGroupIds, groupId];
    onGroupsChange(newSelection);
  };

  const handleSegmentToggle = (segmentId: string) => {
    const newSelection = selectedSegmentIds.includes(segmentId)
      ? selectedSegmentIds.filter(id => id !== segmentId)
      : [...selectedSegmentIds, segmentId];
    onSegmentsChange(newSelection);
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find(g => g.group_id === groupId);
    return group?.name || 'קבוצה לא ידועה';
  };

  if (isLoadingGroups || isLoadingSegments) {
    return (
      <div className="p-4 text-center text-gray-500">
        טוען נמענים...
      </div>
    );
  }

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">בחר נמענים</Label>
      </div>

      <Tabs defaultValue="segments" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            קטגוריות ({segments.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            קבוצות ({groups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="segments" className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חפש קטגוריות..."
                value={segmentSearchQuery}
                onChange={(e) => setSegmentSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {segmentSearchQuery && (
                <button
                  onClick={() => setSegmentSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2" dir="rtl">
            {segments.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p>לא נוצרו קטגוריות</p>
                <p className="text-xs">צור קטגוריות בעמוד הקטגוריות</p>
              </div>
            ) : filteredSegments.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                לא נמצאו קטגוריות התואמות לחיפוש
              </div>
            ) : (
              filteredSegments.map((segment) => (
                <div key={segment.id} className="flex items-center p-2 hover:bg-gray-50 rounded-lg">
                  <Checkbox
                    checked={selectedSegmentIds.includes(segment.id)}
                    onCheckedChange={() => handleSegmentToggle(segment.id)}
                    className="ml-3"
                  />
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {segment.total_members} חברים
                      </Badge>
                      <span className="text-sm font-medium">
                        {segment.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {segment.group_ids.length} קבוצות
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-end p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-sm font-medium text-amber-900">
                הצג רק קבוצות שאני מנהל
              </span>
              <Star className="h-4 w-4 text-amber-600 mx-2" />
              <Checkbox
                checked={showOnlyAdminGroups}
                onCheckedChange={(checked) => setShowOnlyAdminGroups(checked as boolean)}
              />
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חפש קבוצות..."
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {groupSearchQuery && (
                <button
                  onClick={() => setGroupSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2" dir="rtl">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                לא נמצאו קבוצות התואמות לחיפוש
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div 
                  key={group.group_id} 
                  className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  onClick={() => handleGroupToggle(group.group_id)}
                >
                  <Checkbox
                    checked={selectedGroupIds.includes(group.group_id)}
                    disabled
                    className="ml-3 pointer-events-none"
                  />
                  <div className="flex items-center gap-2 mr-3">
                    <span className="text-sm font-medium">
                      {group.name}
                    </span>
                    {group.is_admin && (
                      <Star className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-xs text-gray-500">
                      {group.participants_count || 0} חברים
                      {group.is_admin && ' • מנהל'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Summary */}
      {(selectedGroupIds.length > 0 || selectedSegmentIds.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900">סיכום נמענים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{totalStats.totalGroups}</span>
              <span>סך קבוצות:</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{totalStats.totalMembers}</span>
              <span>סך חברים:</span>
            </div>
            
            {selectedSegmentIds.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-600 mb-2 text-right">קטגוריות נבחרות:</p>
                <div className="flex flex-wrap gap-1 justify-end">
                  {selectedSegmentIds.map(segmentId => {
                    const segment = segments.find(s => s.id === segmentId);
                    return segment ? (
                      <Badge key={segmentId} variant="secondary" className="text-xs">
                        {segment.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            
            {selectedGroupIds.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-600 mb-2 text-right">קבוצות נבחרות:</p>
                <div className="flex flex-wrap gap-1 justify-end">
                  {selectedGroupIds.map(groupId => (
                    <Badge key={groupId} variant="outline" className="text-xs">
                      {getGroupName(groupId)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MessageRecipientsSelector;