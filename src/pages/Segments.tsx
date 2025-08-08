import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button, ThreeDButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, Plus, Edit, Trash2, MessageSquare, Search, X, Star, Crown, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useUserProfile } from '@/hooks/useUserProfile';
import { SyncLoadingModal } from '@/components/SyncLoadingModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Segment {
  id: string;
  name: string;
  group_ids: string[];
  total_members: number;
  created_at: string;
  updated_at: string;
}

const Segments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useUserProfile();
  const { groups: allGroups, isLoadingGroups, syncGroups, isSyncing } = useWhatsAppGroups();
  
  // Check if WhatsApp is connected
  const isWhatsAppConnected = profile?.instance_status === 'connected';
  
  // Sync modal state
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Enhanced sync with loading modal
  const handleEnhancedSyncGroups = async () => {
    if (!isWhatsAppConnected) {
      toast({
        title: "וואטסאפ לא מחובר",
        description: "אנא חבר את הוואטסאפ שלך תחילה כדי לסנכרן קבוצות",
        variant: "destructive",
      });
      return;
    }

    setShowSyncModal(true);
    
    try {
      await syncGroups.mutateAsync();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      // Keep modal open a bit longer to show success
      setTimeout(() => {
        setShowSyncModal(false);
      }, 1000);
    }
  };

  const handleCloseSyncModal = () => {
    // Don't allow closing while syncing
    if (!isSyncing) {
      setShowSyncModal(false);
    }
  };
  
  // Fetch segments from database - using any to bypass TypeScript issues
  const { data: segments = [], isLoading: isLoadingSegments } = useQuery({
    queryKey: ['segments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from('segments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Create segment mutation
  const createSegmentMutation = useMutation({
    mutationFn: async (segmentData: { name: string; group_ids: string[]; total_members: number }) => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await (supabase as any)
        .from('segments')
        .insert([{
          user_id: user.id,
          name: segmentData.name,
          group_ids: segmentData.group_ids,
          total_members: segmentData.total_members
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast({
        title: "קטגוריה נוצרה!",
        description: "הקטגוריה נשמרה בהצלחה.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה ביצירת קטגוריה",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update segment mutation
  const updateSegmentMutation = useMutation({
    mutationFn: async ({ id, ...segmentData }: { id: string; name: string; group_ids: string[]; total_members: number }) => {
      const { data, error } = await (supabase as any)
        .from('segments')
        .update({
          name: segmentData.name,
          group_ids: segmentData.group_ids,
          total_members: segmentData.total_members
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast({
        title: "קטגוריה עודכנה!",
        description: "השינויים נשמרו בהצלחה.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון קטגוריה",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete segment mutation
  const deleteSegmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('segments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast({
        title: "קטגוריה נמחקה",
        description: "הקטגוריה הוסרה בהצלחה.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה במחיקת קטגוריה",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAdminGroups, setShowOnlyAdminGroups] = useState(false);
  
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
    const memberGroups = totalGroups - adminGroups;
    const totalMembers = allGroups.reduce((sum, group) => sum + (group.participants_count || 0), 0);
    
    return { totalGroups, adminGroups, memberGroups, totalMembers };
  }, [allGroups]);

  const handleCreateSegment = () => {
    if (!newSegmentName.trim()) {
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

    createSegmentMutation.mutate({
      name: newSegmentName,
      group_ids: selectedGroupIds,
      total_members: totalMembers
    });

    setNewSegmentName('');
    setSelectedGroupIds([]);
    setIsCreateDialogOpen(false);
  };

  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment);
    setNewSegmentName(segment.name);
    setSelectedGroupIds(segment.group_ids);
    setIsCreateDialogOpen(true);
  };

  const handleUpdateSegment = () => {
    if (!editingSegment) return;

    const totalMembers = selectedGroupIds.reduce((sum, groupId) => {
      const group = allGroups.find(g => g.group_id === groupId);
      return sum + (group?.participants_count || 0);
    }, 0);

    updateSegmentMutation.mutate({
      id: editingSegment.id,
      name: newSegmentName,
      group_ids: selectedGroupIds,
      total_members: totalMembers
    });

    setNewSegmentName('');
    setSelectedGroupIds([]);
    setEditingSegment(null);
    setIsCreateDialogOpen(false);
  };

  const handleDeleteSegment = (id: string) => {
    deleteSegmentMutation.mutate(id);
  };

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    );
  };

  const resetDialog = () => {
    setNewSegmentName('');
    setSelectedGroupIds([]);
    setEditingSegment(null);
    setSearchQuery('');
    setShowOnlyAdminGroups(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const getGroupNames = (groupIds: string[]) => {
    return groupIds.map(id => {
      const group = allGroups.find(g => g.group_id === id);
      return group?.name || 'קבוצה לא ידועה';
    });
  };

  if (isLoadingGroups || isLoadingSegments) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">טוען...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">קבוצות וקטגוריות</h1>
            <p className="text-gray-600">נהל את הקבוצות שלך וצור קטגוריות להודעות ממוקדות</p>
          </div>
          <div className="flex gap-3">
            {/* Updated Sync Groups Button */}
            <ThreeDButton
              variant="secondary"
              onClick={handleEnhancedSyncGroups}
              disabled={isSyncing || !isWhatsAppConnected}
              className={!isWhatsAppConnected ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  מסנכרן...
                </>
              ) : !isWhatsAppConnected ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  סנכרן קבוצות בניהולי
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  סנכרן קבוצות בניהולי
                </>
              )}
            </ThreeDButton>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetDialog();
            }}>
              <DialogTrigger asChild>
                <ThreeDButton
                  variant="primary"
                  disabled={allGroups.length === 0}
                >
                  <Plus className="h-4 w-4 ml-2" />
                  צור קטגוריה
                </ThreeDButton>
              </DialogTrigger>
              <DialogContent className="max-w-2xl h-full flex flex-col sm:h-auto sm:block sm:max-h-[85vh]" hideCloseButton>
                <DialogHeader className="flex-shrink-0 sm:flex-shrink">
                  <DialogTitle className="text-right">
                    {editingSegment ? 'ערוך קטגוריה' : 'צור קטגוריה חדשה'}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto space-y-6 sm:flex-none sm:overflow-visible sm:max-h-[60vh] sm:overflow-y-auto">
                  <div>
                    <Label className="text-lg font-semibold">1. בחר קבוצות</Label>
                    
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <Checkbox
                          id="admin-filter"
                          checked={showOnlyAdminGroups}
                          onCheckedChange={(checked) => setShowOnlyAdminGroups(checked === true)}
                        />
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-600" />
                          <label htmlFor="admin-filter" className="text-sm font-medium text-amber-900 cursor-pointer">
                            הצג רק קבוצות שאני מנהל ({groupStats.adminGroups} מתוך {groupStats.totalGroups})
                          </label>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="חפש קבוצות..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pr-10 pl-10 min-h-[48px] md:min-h-[40px] text-base md:text-sm"
                        />
                        {searchQuery && (
                          <button
                            onClick={clearSearch}
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
                          <div key={group.group_id} className="flex items-center space-x-3 space-x-reverse p-3 hover:bg-gray-50 rounded-lg touch-manipulation">
                            <Checkbox
                              id={group.group_id}
                              checked={selectedGroupIds.includes(group.group_id)}
                              onCheckedChange={() => handleGroupToggle(group.group_id)}
                              className="h-5 w-5 md:h-4 md:w-4"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <label htmlFor={group.group_id} className="text-sm md:text-sm font-medium cursor-pointer truncate">
                                  {group.name}
                                </label>
                                {group.is_admin && (
                                  <Star className="h-4 w-4 md:h-3 md:w-3 text-amber-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {group.participants_count || 0} חברים
                                {group.is_admin && ' • מנהל'}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {selectedGroupIds.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">קבוצות נבחרות ({selectedGroupIds.length}):</h4>
                      <div className="flex flex-wrap gap-2">
                        {getGroupNames(selectedGroupIds).map(name => (
                          <Badge key={name} variant="outline" className="text-green-700 border-green-700">
                            {name}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-green-700 mt-2">
                        סך הכל חברים: {selectedGroupIds.reduce((sum, groupId) => {
                          const group = allGroups.find(g => g.group_id === groupId);
                          return sum + (group?.participants_count || 0);
                        }, 0)}
                      </p>
                    </div>
                   )}

                  <div>
                    <Label htmlFor="segmentName" className="text-lg font-semibold">2. בחר שם לקטגוריה</Label>
                    <Input
                      id="segmentName"
                      placeholder="הכנס שם לקטגוריה..."
                      value={newSegmentName}
                      onChange={(e) => setNewSegmentName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex-shrink-0 pt-4 border-t sm:flex-shrink sm:border-t-0 sm:pt-6">
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      ביטול
                    </Button>
                    <ThreeDButton
                      variant="primary"
                      onClick={editingSegment ? handleUpdateSegment : handleCreateSegment}
                      disabled={createSegmentMutation.isPending || updateSegmentMutation.isPending}
                    >
                      {editingSegment ? 'עדכן קטגוריה' : 'צור קטגוריה'}
                    </ThreeDButton>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Connection Status Warning */}
        {!isWhatsAppConnected && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    וואטסאפ לא מחובר
                  </p>
                  <p className="text-sm text-amber-700">
                    כדי לסנכרן קבוצות, תחילה חבר את הוואטסאפ שלך בעמוד החיבור
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Segments List */}
        <div className="space-y-4">
          {/* Empty state for no synced groups */}
          {allGroups.length === 0 && isWhatsAppConnected ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-6xl mb-4">🌱</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">אין עדיין קבוצות 🌱</h3>
                <p className="text-gray-600 mb-4">
                  סנכרן את הקבוצות שלך כדי לנהל אותן בקלות, להוסיף קטגוריות ולהתחיל לעבוד מרוכז.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  זהו הסנכרון הראשון שלך - ייתכן שתצטרך ללחוץ שוב או להמתין כמה דקות כדי לראות את כל הקבוצות והנתונים.
                </p>
                <ThreeDButton
                  variant="secondary"
                  onClick={handleEnhancedSyncGroups}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      מסנכרן קבוצות...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2" />
                      התחל סנכרון קבוצות
                    </>
                  )}
                </ThreeDButton>
              </CardContent>
            </Card>
          ) : segments.length === 0 && allGroups.length > 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">לא נוצרו קטגוריות</h3>
                <p className="text-gray-600 mb-6">צור את הקטגוריה הראשונה שלך כדי לארגן את הקבוצות שלך להודעות ממוקדות.</p>
                <ThreeDButton 
                  variant="primary"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 ml-2" />
                  צור קטגוריה חדשה
                </ThreeDButton>
              </CardContent>
            </Card>
          ) : (
            segments.map((segment: any) => (
              <Card key={segment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{segment.name}</h3>
                        <Badge variant="outline">
                          {segment.total_members} חברים
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {getGroupNames(segment.group_ids).map((name: string) => (
                          <Badge key={name} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                      
                      <p className="text-sm text-gray-600">
                        נוצר ב-{new Date(segment.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSegment(segment)}
                        disabled={updateSegmentMutation.isPending}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSegment(segment.id)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        disabled={deleteSegmentMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ThreeDButton
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/compose', { state: { selectedSegmentId: segment.id } })}
                      >
                        <MessageSquare className="h-4 w-4 ml-1" />
                        הודעה
                      </ThreeDButton>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Enhanced Sync Loading Modal */}
      <SyncLoadingModal
        isOpen={showSyncModal}
        onClose={handleCloseSyncModal}
      />
    </Layout>
  );
};

export default Segments;
