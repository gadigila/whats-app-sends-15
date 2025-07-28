import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

export const useWhatsAppGroups = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRealtimeModal, setShowRealtimeModal] = useState(false);

  // Fetch groups from database (your existing logic)
  const {
    data: groups,
    isLoading: isLoadingGroups,
    error: groupsError
  } = useQuery({
    queryKey: ['whatsapp-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log('Fetching WhatsApp groups for user:', user.id);
      
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      
      console.log('Fetched groups:', data);
      return data || [];
    },
    enabled: !!user?.id
  });

  // ENHANCED: Real-time chunked sync with automatic progression
  const syncGroupsRealtime = useMutation({
    mutationFn: async (chunk: number = 0) => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log(`🚀 Starting sync chunk ${chunk} for user:`, user.id);

      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { 
          userId: user.id,
          chunk: chunk,
          batchSize: 30
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data, chunk) => {
      console.log(`✅ Sync chunk ${chunk} completed:`, data);
      
      if (data.phase === 'discovery_complete') {
        console.log(`🔍 Discovery complete: ${data.total_groups} groups found`);
        
        // Start processing chunks automatically
        setTimeout(() => {
          syncGroupsRealtime.mutate(1);
        }, 2000);
        
      } else if (data.phase === 'processing') {
        console.log(`🔄 Processed chunk ${data.chunk_processed}`);
        
        // Continue with next chunk automatically
        setTimeout(() => {
          syncGroupsRealtime.mutate(data.next_chunk);
        }, 1500);
        
      } else if (data.phase === 'complete') {
        console.log('🎉 Sync complete!');
        
        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
        queryClient.invalidateQueries({ queryKey: ['message-stats'] });
        
        // Close modal and show success
        setShowRealtimeModal(false);
        
        toast({
          title: "סנכרון הושלם! 🎉",
          description: data.message,
        });
      }
    },
    onError: (error: any, chunk) => {
      console.error(`❌ Sync chunk ${chunk} failed:`, error);
      
      // Close modal on error
      setShowRealtimeModal(false);
      
      // Enhanced error handling
      let errorTitle = "שגיאה בסנכרון קבוצות";
      let errorDescription = "נסה שוב בעוד כמה דקות";
      
      if (error.message?.includes('not connected')) {
        errorTitle = "וואטסאפ לא מחובר";
        errorDescription = "בדוק את החיבור ונסה שוב";
      } else if (error.message?.includes('phone number')) {
        errorTitle = "לא נמצא מספר טלפון";
        errorDescription = "בדוק סטטוס החיבור תחילה";
      } else if (error.message?.includes('timeout')) {
        errorTitle = "פג זמן הבקשה";
        errorDescription = "הרשת עמוסה, נסה שוב בעוד כמה דקות";
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    }
  });

  // Start the real-time sync process
  const startRealtimeSync = () => {
    if (!user?.id) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לזהות משתמש",
        variant: "destructive",
      });
      return;
    }

    console.log('🚀 Starting real-time group sync...');
    setShowRealtimeModal(true);
    
    // Start with chunk 0 (discovery phase)
    setTimeout(() => {
      syncGroupsRealtime.mutate(0);
    }, 1000);
  };

  // Close modal and stop sync
  const closeRealtimeModal = () => {
    setShowRealtimeModal(false);
    
    // Still invalidate queries in case some groups were found
    queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
  };

  // Legacy sync method (kept for backward compatibility)
  const syncGroups = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚀 Starting legacy group sync for user:', user.id);

      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('🎉 Legacy sync completed:', data);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      
      toast({
        title: "סנכרון הושלם בהצלחה! 🎉",
        description: data.message,
      });
    },
    onError: (error: any) => {
      console.error('❌ Legacy sync failed:', error);
      
      let errorMessage = "נסה שוב בעוד כמה דקות";
      if (error.message?.includes('not connected')) {
        errorMessage = "בדוק את החיבור ונסה שוב";
      } else if (error.message?.includes('timeout')) {
        errorMessage = "הרשת עמוסה, נסה שוב מאוחר יותר";
      }
      
      toast({
        title: "שגיאה בסנכרון קבוצות",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  return {
    groups: groups || [],
    isLoadingGroups,
    groupsError,
    
    // NEW: Real-time sync methods
    startRealtimeSync,
    closeRealtimeModal,
    showRealtimeModal,
    isRealtimeSyncing: syncGroupsRealtime.isPending,
    
    // Legacy methods (kept for compatibility)
    syncGroups,
    isSyncing: syncGroups.isPending,
    syncError: syncGroups.error,
    lastSyncData: syncGroups.data,
    
    // Helper computed values
    totalGroups: groups?.length || 0,
    adminGroups: groups?.filter(g => g.is_admin)?.length || 0,
    totalMembers: groups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0,
  };
};