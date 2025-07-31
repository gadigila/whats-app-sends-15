import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, Search, X, Star, Users, RefreshCw, CheckCircle } from 'lucide-react';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useSyncProgress } from '@/hooks/useSyncProgress';
import { toast } from '@/hooks/use-toast';

interface Group {
  group_id: string;
  name: string;
  description?: string;
  participants_count: number;
  is_admin: boolean;
}

interface GroupManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSegmentCreate: (data: { name: string; group_ids: string[]; total_members: number }) => void;
  editingSegment?: { id: string; name: string; group_ids: string[] } | null;
  onSegmentUpdate?: (data: { id: string; name: string; group_ids: string[]; total_members: number }) => void;
}

export const GroupManagementModal = ({ 
  isOpen, 
  onClose, 
  onSegmentCreate, 
  editingSegment,
  onSegmentUpdate 
}: GroupManagementModalProps) => {
  const { groups: allGroups, syncGroups, isSyncing } = useWhatsAppGroups();
  const { currentProgress, isSyncInProgress, startListening, stopListening } = useSyncProgress();
  
  const [step, setStep] = useState<'sync' | 'select'>('sync');
  const [segmentName, setSegmentName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAdminGroups, setShowOnlyAdminGroups] = useState(false);
  const [hasInitialSync, setHasInitialSync] = useState(false);

  // Check if we have groups or need to sync
  useEffect(() => {
    if (isOpen) {
      if (allGroups.length > 0) {
        setStep('select');
        setHasInitialSync(true);
      } else {
        setStep('sync');
        setHasInitialSync(false);
      }
      
      // If editing, populate the form
      if (editingSegment) {
        setSegmentName(editingSegment.name);
        setSelectedGroupIds(editingSegment.group_ids);
        setStep('select');
      }
    } else {
      // Reset when modal closes
      setStep('sync');
      setSegmentName('');
      setSelectedGroupIds([]);
      setSearchQuery('');
      setShowOnlyAdminGroups(false);
      setHasInitialSync(false);
    }
  }, [isOpen, allGroups.length, editingSegment]);

  // Handle sync completion
  useEffect(() => {
    if (currentProgress?.status === 'completed' && step === 'sync') {
      setStep('select');
      setHasInitialSync(true);
      stopListening();
      toast({
        title: "סנכרון הושלם!",
        description: `נמצאו ${currentProgress.groups_found} קבוצות`,
      });
    }
  }, [currentProgress?.status, step, stopListening]);

  const handleStartSync = async () => {
    try {
      startListening();
      await syncGroups.mutateAsync();
      toast({
        title: "🚀 מתחיל סנכרון",
        description: "מסנכרן את הקבוצות שלך...",
      });
    } catch (error) {
      console.error('Sync failed:', error);
      stopListening();
    }
  };

  const handleSkipToSelection = () => {
    if (allGroups.length > 0) {
      setStep('select');
      setHasInitialSync(true);
    } else {
      toast({
        title: "אין קבוצות זמינות",
        description: "אנא בצע סנכרון כדי לטעון את הקבוצות שלך",
        variant: "destructive",
      });
    }
  };

  // Filter groups based on search and admin status
  const filteredGroups = useMemo(() => {
    let filtered = allGroups;
    
    if (showOnlyAdminGroups) {
      filtered = filtered.filter(group => group.is_admin === true);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(query) ||
        (group.description && group.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allGroups, searchQuery, showOnlyAdminGroups]);

  // Group statistics
  const groupStats = useMemo(() => {
    const totalGroups = allGroups.length;
    const adminGroups = allGroups.filter(g => g.is_admin).length;
    const totalMembers = allGroups.reduce((sum, group) => sum + (group.participants_count || 0), 0);
    
    return { totalGroups, adminGroups, totalMembers };
  }, [allGroups]);

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = () => {
    if (!segmentName.trim()) {
      toast({
        title: "נדרש שם",
        description: "אנא הכנס שם לקטגוריה.",
        variant: "destructive",
      });
      return;
    }

    if (selectedGroupIds.length === 0) {
      toast({
        title: "נדרשות קבוצות",
        description: "אנא בחר לפחות קבוצה אחת.",
        variant: "destructive",
      });
      return;
    }

    const totalMembers = selectedGroupIds.reduce((sum, groupId) => {
      const group = allGroups.find(g => g.group_id === groupId);
      return sum + (group?.participants_count || 0);
    }, 0);

    if (editingSegment && onSegmentUpdate) {
      onSegmentUpdate({
        id: editingSegment.id,
        name: segmentName,
        group_ids: selectedGroupIds,
        total_members: totalMembers
      });
    } else {
      onSegmentCreate({
        name: segmentName,
        group_ids: selectedGroupIds,
        total_members: totalMembers
      });
    }

    onClose();
  };

  const renderSyncStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        {isSyncing || isSyncInProgress ? (
          <>
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">מסנכרן קבוצות...</h3>
              {currentProgress?.message && (
                <p className="text-sm text-gray-600">{currentProgress.message}</p>
              )}
              {currentProgress?.groups_found !== undefined && (
                <p className="text-sm text-green-600">
                  נמצאו {currentProgress.groups_found} קבוצות עד כה
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <RefreshCw className="h-12 w-12 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">סנכרון קבוצות</h3>
              <p className="text-gray-600">
                כדי ליצור קטגוריות, נצטרך לסנכרן את הקבוצות שלך מוואטסאפ
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={handleStartSync} className="bg-green-600 hover:bg-green-700">
                <RefreshCw className="h-4 w-4 ml-2" />
                התחל סנכרון
              </Button>
              {allGroups.length > 0 && (
                <Button variant="outline" onClick={handleSkipToSelection}>
                  השתמש בקבוצות הקיימות
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderSelectionStep = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="segmentName">שם הקטגוריה</Label>
        <Input
          id="segmentName"
          placeholder="הכנס שם לקטגוריה..."
          value={segmentName}
          onChange={(e) => setSegmentName(e.target.value)}
          className="mt-1"
        />
      </div>
      
      <div>
        <Label>בחר קבוצות</Label>
        
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">
                הצג רק קבוצות שאני מנהל ({groupStats.adminGroups} מתוך {groupStats.totalGroups})
              </span>
            </div>
            <Switch
              checked={showOnlyAdminGroups}
              onCheckedChange={setShowOnlyAdminGroups}
            />
          </div>
          
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חפש קבוצות..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            מציג {filteredGroups.length} קבוצות זמינות
          </div>
        </div>
        
        <div className="mt-4 space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              לא נמצאו קבוצות התואמות לחיפוש
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.group_id} className="flex items-center space-x-3 space-x-reverse p-2 hover:bg-gray-50 rounded-lg">
                <Checkbox
                  id={group.group_id}
                  checked={selectedGroupIds.includes(group.group_id)}
                  onCheckedChange={() => handleGroupToggle(group.group_id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <label htmlFor={group.group_id} className="text-sm font-medium cursor-pointer">
                      {group.name}
                    </label>
                    {group.is_admin && (
                      <Star className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {group.participants_count} משתתפים
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        
        {selectedGroupIds.length > 0 && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                נבחרו {selectedGroupIds.length} קבוצות • {
                  selectedGroupIds.reduce((sum, groupId) => {
                    const group = allGroups.find(g => g.group_id === groupId);
                    return sum + (group?.participants_count || 0);
                  }, 0)
                } משתתפים בסך הכל
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClose}>
          ביטול
        </Button>
        <Button 
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-700"
          disabled={!segmentName.trim() || selectedGroupIds.length === 0}
        >
          {editingSegment ? 'עדכן קטגוריה' : 'צור קטגוריה'}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'sync' 
              ? 'ניהול קבוצות' 
              : editingSegment 
                ? 'ערוך קטגוריה' 
                : 'צור קטגוריה חדשה'
            }
          </DialogTitle>
        </DialogHeader>
        
        {step === 'sync' ? renderSyncStep() : renderSelectionStep()}
      </DialogContent>
    </Dialog>
  );
};