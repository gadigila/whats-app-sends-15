import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const TRIAL_LIMITS = {
  messages: 150,
  chats: 5,
};

export const useTrialUsage = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['trial-usage', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return {
          messagesSent: 0,
          uniqueChats: 0,
          messagesLimit: TRIAL_LIMITS.messages,
          chatsLimit: TRIAL_LIMITS.chats,
        };
      }

      // Fetch sent/delivered messages
      const { data: messages, error } = await supabase
        .from('scheduled_messages')
        .select('group_ids, status')
        .eq('user_id', user.id)
        .in('status', ['sent', 'delivered']);

      if (error) {
        console.error('Error fetching trial usage:', error);
        throw error;
      }

      const messagesSent = messages?.length || 0;

      // Calculate unique chats from group_ids arrays
      const uniqueGroupIds = new Set<string>();
      messages?.forEach((msg) => {
        if (msg.group_ids && Array.isArray(msg.group_ids)) {
          msg.group_ids.forEach((id) => uniqueGroupIds.add(id));
        }
      });

      return {
        messagesSent,
        uniqueChats: uniqueGroupIds.size,
        messagesLimit: TRIAL_LIMITS.messages,
        chatsLimit: TRIAL_LIMITS.chats,
      };
    },
    enabled: !!user?.id,
    staleTime: 10000, // Cache for 10 seconds
  });
};
