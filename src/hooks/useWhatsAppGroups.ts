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

  // 🚀 ENHANCED: Comprehensive sync with proper loading states
  const syncGroups = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚀 Starting comprehensive group sync for user:', user.id);
      
      // Show initial loading toast
      toast({
        title: "🔄 מתחיל סנכרון קבוצות",
        description: "מחפש את כל הקבוצות שלך... זה יכול לקחת עד דקה",
      });

      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('🎉 Comprehensive sync completed:', data);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      
      // Enhanced success message with detailed info
      const {
        groups_count = 0,
        total_groups_scanned = 0,
        admin_groups_count = 0,
        creator_groups_count = 0,
        total_members_in_managed_groups = 0,
        large_groups_skipped = 0,
        api_calls_made = 0
      } = data;

      // Simple success toast without confusing numbers
      toast({
        title: "✅ סנכרון הושלם בהצלחה!",
        description: "הקבוצות שלך עודכנו במערכת",
      });

      // Warning if large groups were skipped
      if (large_groups_skipped > 0) {
        setTimeout(() => {
          toast({
            title: "⚠️ שים לב",
            description: `${large_groups_skipped} קבוצות גדולות לא נסרקו בגלל מגבלות API`,
            variant: "destructive",
          });
        }, 4000);
      }
    },
    onError: (error: any) => {
      console.error('❌ Comprehensive sync failed:', error);
      
      // Enhanced error handling with helpful suggestions
      let errorTitle = "שגיאה בסנכרון קבוצות";
      let errorDescription = "נסה שוב בעוד כמה דקות";
      
      if (error.message?.includes('not connected')) {
        errorTitle = "וואטסאפ לא מחובר";
        errorDescription = "בדוק את החיבור ונסה שוב";
      } else if (error.message?.includes('phone number')) {
        errorTitle = "לא נמצא מספר טלפון";
        errorDescription = "בדוק סטטוס החיבור תחילה";
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        errorTitle = "יותר מדי בקשות";
        errorDescription = "המתן 5 דקות ונסה שוב";
      } else if (error.message?.includes('timeout')) {
        errorTitle = "פג זמן הבקשה";
        errorDescription = "הרשת עמוסה, נסה שוב בעוד כמה דקות";
      } else if (error.message?.includes('high load')) {
        errorTitle = "השרת עמוס";
        errorDescription = "שירות WHAPI עמוס כרגע, נסה שוב מאוחר יותר";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
    // 🎯 IMPORTANT: Longer timeout for comprehensive sync
    mutationKey: ['sync-groups-comprehensive'],
    retry: 1, // Only retry once for failed syncs
    retryDelay: 10000, // Wait 10 seconds before retry
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