import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppGroups = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch groups from database
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

  // 🚀 SMART BACKGROUND SYNC: Non-blocking with real-time progress
  const syncGroups = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚀 Starting background group sync for user:', user.id);
      
      // Start background sync immediately - no blocking
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      console.log('🎉 Background sync initiated successfully');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
    },
    onError: (error: any) => {
      console.error('❌ Background sync failed to start:', error);
      
      // Enhanced error handling
      let errorTitle = "שגיאה בהפעלת סנכרון";
      let errorDescription = "נסה שוב בעוד כמה דקות";
      
      if (error.message?.includes('not connected')) {
        errorTitle = "וואטסאפ לא מחובר";
        errorDescription = "בדוק את החיבור ונסה שוב";
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        errorTitle = "יותר מדי בקשות";
        errorDescription = "המתן 5 דקות ונסה שוב";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
    mutationKey: ['sync-groups-background'],
    retry: 1,
    retryDelay: 5000,
  });

  return {
    groups: groups || [],
    isLoadingGroups,
    groupsError,
    syncGroups,
    
    // 🚀 Enhanced state indicators
    isSyncing: syncGroups.isPending,
    syncError: syncGroups.error,
    lastSyncData: syncGroups.data,
    
    // Helper computed values
    totalGroups: groups?.length || 0,
    adminGroups: groups?.filter(g => g.is_admin)?.length || 0,
    totalMembers: groups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0,
  };
};