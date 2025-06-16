
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

  // Sync groups from WHAPI
  const syncGroups = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Syncing WhatsApp groups for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('Groups synced successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast({
        title: "קבוצות סונכרנו בהצלחה",
        description: `נמצאו ${data.groups_count || 0} קבוצות`,
      });
    },
    onError: (error: any) => {
      console.error('Failed to sync groups:', error);
      toast({
        title: "שגיאה בסנכרון קבוצות",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  return {
    groups: groups || [],
    isLoadingGroups,
    groupsError,
    syncGroups
  };
};
