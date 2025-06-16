
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhatsAppGroups = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch groups from database
  const groupsQuery = useQuery({
    queryKey: ['whatsapp-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Sync groups from WHAPI
  const syncGroupsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast({
        title: "סנכרון הושלם!",
        description: `${data.synced_count} קבוצות סונכרנו בהצלחה`,
      });
    },
    onError: (error: any) => {
      console.error('Sync error:', error);
      toast({
        title: "שגיאה בסנכרון",
        description: error.message || "לא ניתן לסנכרן קבוצות כרגע",
        variant: "destructive",
      });
    },
  });

  return {
    groups: groupsQuery.data || [],
    isLoading: groupsQuery.isLoading,
    error: groupsQuery.error,
    syncGroups: syncGroupsMutation.mutate,
    isSyncing: syncGroupsMutation.isPending,
    refetch: groupsQuery.refetch,
  };
};
