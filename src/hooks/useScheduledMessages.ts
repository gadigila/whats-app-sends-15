
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useScheduledMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch scheduled messages
  const messagesQuery = useQuery({
    queryKey: ['scheduled-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('send_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Create scheduled message
  const createMessageMutation = useMutation({
    mutationFn: async (messageData: {
      message: string;
      group_ids: string[];
      group_names: string[];
      send_at: string;
      media_url?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: user.id,
          message: messageData.message,
          group_ids: messageData.group_ids,
          group_names: messageData.group_names,
          total_groups: messageData.group_ids.length,
          send_at: messageData.send_at,
          media_url: messageData.media_url,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({
        title: "הודעה נוצרה!",
        description: "ההודעה תישלח בזמן המתוכנן",
      });
    },
    onError: (error: any) => {
      console.error('Create message error:', error);
      toast({
        title: "שגיאה ביצירת הודעה",
        description: error.message || "לא ניתן ליצור הודעה כרגע",
        variant: "destructive",
      });
    },
  });

  // Send message now
  const sendNowMutation = useMutation({
    mutationFn: async (messageData: {
      message: string;
      group_ids: string[];
      group_names: string[];
      media_url?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Create message with immediate send time
      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: user.id,
          message: messageData.message,
          group_ids: messageData.group_ids,
          group_names: messageData.group_names,
          total_groups: messageData.group_ids.length,
          send_at: new Date().toISOString(),
          media_url: messageData.media_url,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({
        title: "הודעה נשלחה!",
        description: "ההודעה נשלחה לקבוצות שנבחרו",
      });
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
      toast({
        title: "שגיאה בשליחת הודעה",
        description: error.message || "לא ניתן לשלוח הודעה כרגע",
        variant: "destructive",
      });
    },
  });

  // Delete scheduled message
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({
        title: "הודעה נמחקה",
        description: "ההודעה המתוזמנת נמחקה בהצלחה",
      });
    },
    onError: (error: any) => {
      console.error('Delete message error:', error);
      toast({
        title: "שגיאה במחיקת הודעה",
        description: error.message || "לא ניתן למחוק הודעה כרגע",
        variant: "destructive",
      });
    },
  });

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    createMessage: createMessageMutation.mutate,
    isCreating: createMessageMutation.isPending,
    sendNow: sendNowMutation.mutate,
    isSending: sendNowMutation.isPending,
    deleteMessage: deleteMessageMutation.mutate,
    isDeleting: deleteMessageMutation.isPending,
    refetch: messagesQuery.refetch,
  };
};
