import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from '@/hooks/use-toast';

export const useGroupManagement = () => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const queryClient = useQueryClient();
  const [showGroupSelection, setShowGroupSelection] = useState(false);
  const [isFetchingAll, setIsFetchingAll] = useState(false);

  // Check if WhatsApp is connected
  const isConnected = profile?.instance_status === 'connected' && profile?.whapi_token;

  // Get user's selected groups (the ones they chose to manage)
  const {
    data: selectedGroups,
    isLoading: isLoadingSelected,
    error: selectedError
  } = useQuery({
    queryKey: ['user-selected-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log('Fetching user selected groups for:', user.id);
      
      const { data, error } = await supabase
        .from('user_selected_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      
      console.log('Selected groups:', data);
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch all groups from WhatsApp (for user selection)
  const fetchAllGroups = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      if (!isConnected) throw new Error('WhatsApp not connected');
      
      console.log('🚀 Fetching all groups for selection...');
      setIsFetchingAll(true);

      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ All groups fetched:', data);
      
      toast({
        title: "קבוצות נטענו! 📋",
        description: data.message,
      });

      // Open group selection modal
      setShowGroupSelection(true);
    },
    onError: (error: any) => {
      console.error('❌ Failed to fetch all groups:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      if (error.message?.includes('not connected')) {
        errorMessage = "בדוק את החיבור לוואטסאפ ונסה שוב";
      } else if (error.message?.includes('timeout')) {
        errorMessage = "הרשת עמוסה, נסה שוב בעוד כמה דקות";
      }
      
      toast({
        title: "שגיאה בטעינת קבוצות",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsFetchingAll(false);
    }
  });

  // Refresh member counts for selected groups
  const refreshMemberCounts = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      if (!isConnected) throw new Error('WhatsApp not connected');
      
      console.log('🔄 Refreshing member counts for selected groups...');

      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { 
          userId: user.id, 
          refreshMemberCounts: true 
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Member counts refreshed:', data);
      
      // Invalidate queries to show updated data
      queryClient.invalidateQueries({ queryKey: ['user-selected-groups'] });
      
      toast({
        title: "עודכן בהצלחה! ✅",
        description: data.message,
      });
    },
    onError: (error: any) => {
      console.error('❌ Failed to refresh member counts:', error);
      
      toast({
        title: "שגיאה בעדכון",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Start the group selection process
  const startGroupSelection = () => {
    if (!user?.id) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לזהות משתמש",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "וואטסאפ לא מחובר",
        description: "חבר את הוואטסאפ שלך כדי לנהל קבוצות",
        variant: "destructive",
      });
      return;
    }

    console.log('🚀 Starting group selection process...');
    fetchAllGroups.mutate();
  };

  // Close group selection modal
  const closeGroupSelection = () => {
    setShowGroupSelection(false);
    
    // Refresh selected groups in case user made changes
    queryClient.invalidateQueries({ queryKey: ['user-selected-groups'] });
  };

  // Handle group selection completion
  const handleSelectionComplete = () => {
    setShowGroupSelection(false);
    
    // Refresh selected groups and message stats
    queryClient.invalidateQueries({ queryKey: ['user-selected-groups'] });
    queryClient.invalidateQueries({ queryKey: ['message-stats'] });
    
    toast({
      title: "קבוצות נשמרו! 🎉",
      description: "כעת תוכל לשלוח הודעות לקבוצות שבחרת",
    });
  };

  return {
    // Selected groups data
    selectedGroups: selectedGroups || [],
    isLoadingSelected,
    selectedError,
    
    // Actions
    startGroupSelection,
    closeGroupSelection,
    handleSelectionComplete,
    refreshMemberCounts,
    
    // States
    showGroupSelection,
    isFetchingAll,
    isRefreshing: refreshMemberCounts.isPending,
    
    // Computed values
    totalGroups: selectedGroups?.length || 0,
    totalMembers: selectedGroups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0,
    
    // Helper functions
    hasSelectedGroups: selectedGroups && selectedGroups.length > 0,
    needsRefresh: selectedGroups?.some(g => 
      !g.last_refreshed_at || 
      new Date(g.last_refreshed_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ) || false
  };
};