import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, Plus, Edit, Trash2, MessageSquare, Search, X, Shield, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
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
  const queryClient = useQueryClient();
  const { groups: allGroups, isLoadingGroups } = useWhatsAppGroups();
  
  // Fetch segments from database
  const { data: segments = [], isLoading: isLoadingSegments } = useQuery({
    queryKey: ['segments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
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
      
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { error } = await supabase
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

    // Reset form
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

    // Reset form
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
            <h1 className="text-3xl font-bold text-gray-900">קטגוריות</h1>
            <p className="text-gray-600">צור ונהל קטגוריות קבוצות להודעות ממוקדות</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetDialog();
          }}>
            <DialogTrigger asChild>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                disabled={allGroups.length === 0}
              >
                <Plus className="h-4 w-4 ml-2" />
                צור קט