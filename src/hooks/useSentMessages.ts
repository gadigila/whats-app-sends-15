
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useSentMessages = () => {
  const { user } = useAuth();

  // Fetch sent messages
  const {
    data: sentMessages,
    isLoading,
    error
  } = useQuery({
    queryKey: ['sent-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['sent', 'delivered', 'failed'])
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  return {
    sentMessages: sentMessages || [],
    isLoading,
    error
  };
};
