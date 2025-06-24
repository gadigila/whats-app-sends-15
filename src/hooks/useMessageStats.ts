
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useMessageStats = () => {
  const { user } = useAuth();

  const {
    data: stats,
    isLoading,
    error
  } = useQuery({
    queryKey: ['message-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return {
        totalSent: 0,
        totalScheduled: 0,
        totalGroups: 0,
        successRate: 100
      };
      
      // Get sent messages count
      const { count: sentCount } = await supabase
        .from('scheduled_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['sent', 'delivered']);
      
      // Get scheduled messages count
      const { count: scheduledCount } = await supabase
        .from('scheduled_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');
      
      // Get groups count
      const { count: groupsCount } = await supabase
        .from('whatsapp_groups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // Get failed messages count for success rate
      const { count: failedCount } = await supabase
        .from('scheduled_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'failed');
      
      const totalMessages = (sentCount || 0) + (failedCount || 0);
      const successRate = totalMessages > 0 ? Math.round(((sentCount || 0) / totalMessages) * 100) : 100;
      
      return {
        totalSent: sentCount || 0,
        totalScheduled: scheduledCount || 0,
        totalGroups: groupsCount || 0,
        successRate
      };
    },
    enabled: !!user?.id
  });

  return {
    stats: stats || { totalSent: 0, totalScheduled: 0, totalGroups: 0, successRate: 100 },
    isLoading,
    error
  };
};
