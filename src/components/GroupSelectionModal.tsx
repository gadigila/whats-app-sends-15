import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Users, RefreshCw, CheckCircle, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Group {
  group_id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  participants_count: number;
  last_fetched_at: string;
  is_selected?: boolean;
}

interface GroupSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const GroupSelectionModal: React.FC<GroupSelectionModalProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load all groups and selected groups when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      loadGroups();
      loadSelectedGroups();
    }
  }, [isOpen, userId]);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('all_user_groups')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;

      setGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
      toast({
        title: "שגיאה בטעינת קבוצות",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSelectedGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('user_selected_groups')
        .select('group_id')
        .eq('user_id', userId);

      if (error) throw error;

      const selectedIds = new Set(data?.map(g => g.group_id) || []);
      setSelectedGroups(selectedIds);
    } catch (error) {
      console.error('Error loading selected groups:', error);
    }
  };

  const handleGroupToggle = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = () => {
    const filteredGroups = getFilteredGroups();
    if (selectedGroups.size === filteredGroups.length) {
      // Deselect all
      setSelectedGroups(new Set());
    } else {
      // Select all filtered groups
      const allIds = new Set(filteredGroups.map(g => g.group_id));
      setSelectedGroups(allIds);
    }
  };

  const refreshMemberCounts = async () => {
    if (selectedGroups.size === 0) {
      toast({
        title: "אין קבוצות נבחרות",
        description: "בחר קבוצות כדי לעדכן את כמות החברים",
        variant: "destructive",
      });
      return;
    }

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { 
          userId, 
          refreshMemberCounts: true 
        }
      });

      if (error) throw error;

      toast({
        title: "עודכן בהצלחה! ✅",
        description: data.message,
      });

      // Reload groups to show updated counts
      await loadGroups();
      
    } catch (error: any) {
      console.error('Error refreshing member counts:', error);
      toast({
        title: "שגיאה בעדכון",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveSelectedGroups = async () => {
    setIsSaving(true);
    try {
      // Clear existing selections
      await supabase
        .from('user_selected_groups')
        .delete()
        .eq('user_id', userId);

      // Insert new selections
      if (selectedGroups.size > 0) {
        const selectedGroupsData = Array.from(selectedGroups).map(groupId => {
          const group = groups.find(g => g.group_id === groupId);
          return {
            user_id: userId,
            group_id: groupId,
            name: group?.name || 'Unknown Group',
            description: group?.description,
            avatar_url: group?.avatar_url,
            participants_count: group?.participants_count || 0,
            selected_at: new Date().toISOString()
          };
        });

        const { error } = await supabase
          .from('user_selected_groups')
          .insert(selectedGroupsData);

        if (error) throw error;
      }

      toast({
        title: "נשמר בהצלחה! 🎉",
        description: `נבחרו ${selectedGroups.size} קבוצות לשליחת הודעות`,
      });

      onClose();

    } catch (error: any) {
      console.error('Error saving selected groups:', error);
      toast({
        title: "שגיאה בשמירה",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getFilteredGroups = () => {
    if (!searchTerm) return groups;
    
    return groups.filter(group =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredGroups = getFilteredGroups();
  const totalMembers = Array.from(selectedGroups)
    .reduce((sum, groupId) => {
      const group = groups.find(g => g.group_id === groupId);
      return sum + (group?.participants_count || 0);
    }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            בחר קבוצות לניהול ({groups.length} קבוצות נמצאו)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="חיפוש קבוצות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <Button
              variant="outline"
              onClick={handleSelectAll}
              disabled={isLoading}
            >
              {selectedGroups.size === filteredGroups.length ? 'בטל בחירת הכל' : 'בחר הכל'}
            </Button>

            <Button
              variant="outline"
              onClick={refreshMemberCounts}
              disabled={isRefreshing || selectedGroups.size === 0}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-2" />
              )}
              עדכן חברים
            </Button>
          </div>

          {/* Selection Summary */}
          <div className="bg-primary/5 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {selectedGroups.size} קבוצות נבחרו
                </Badge>
                <Badge variant="secondary" className="bg-secondary">
                  {totalMembers.toLocaleString()} חברים סה"כ
                </Badge>
              </div>
              {selectedGroups.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  תוכל לשלוח הודעות לכל הקבוצות האלה בלחיצה אחת
                </span>
              )}
            </div>
          </div>

          {/* Groups List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="mr-2 text-muted-foreground">טוען קבוצות...</span>
            </div>
          ) : (
            <ScrollArea className="h-96 w-full border rounded-lg">
              <div className="p-4 space-y-2">
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'לא נמצאו קבוצות התואמות לחיפוש' : 'לא נמצאו קבוצות'}
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const isSelected = selectedGroups.has(group.group_id);
                    
                    return (
                      <div
                        key={group.group_id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-background border-border hover:bg-muted/50'
                        }`}
                        onClick={() => handleGroupToggle(group.group_id)}
                      >
                        <div className="flex items-center ml-3">
                          {isSelected ? (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground truncate">
                              {group.name}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {group.participants_count > 0 
                                ? `${group.participants_count} חברים`
                                : 'לא ידוע'
                              }
                            </Badge>
                          </div>
                          
                          {group.description && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}

          {/* Help Text */}
          <div className="bg-accent/50 border border-accent rounded-lg p-3">
            <p className="text-sm text-accent-foreground">
              <strong>💡 טיפ:</strong> בחר את הקבוצות שאתה רוצה לנהל ולשלוח להן הודעות. 
              תוכל לחזור ולערוך את הרשימה בכל זמן. לחץ "עדכן חברים" כדי לקבל את מספר החברים העדכני.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>
          <Button 
            onClick={saveSelectedGroups} 
            disabled={isSaving || selectedGroups.size === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : null}
            שמור קבוצות ({selectedGroups.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};