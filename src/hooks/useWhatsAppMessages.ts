
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SendMessageData {
  groupIds: string[];
  message: string;
  mediaUrl?: string;
}

interface ScheduleMessageData extends SendMessageData {
  sendAt: string;
}

export const useWhatsAppMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Send immediate message
  const sendImmediateMessage = useMutation({
    mutationFn: async (data: SendMessageData) => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Sending immediate message:', data);
      
      const { data: result, error } = await supabase.functions.invoke('send-immediate-message', {
        body: {
          userId: user.id,
          groupIds: data.groupIds,
          message: data.message,
          mediaUrl: data.mediaUrl
        }
      });
      
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      return result;
    },
    onSuccess: (data) => {
      console.log('Message sent successfully:', data);
      toast({
        title: "הודעה נשלחה בהצלחה",
        description: `נשלחה ל-${data.summary?.successful || 0} קבוצות`,
      });
    },
    onError: (error: any) => {
      console.error('Failed to send message:', error);
      toast({
        title: "שגיאה בשליחת הודעה",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Schedule message
  const scheduleMessage = useMutation({
    mutationFn: async (data: ScheduleMessageData) => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Scheduling message:', data);
      
      // Get group names for the scheduled message
      const { data: groups } = await supabase
        .from('whatsapp_groups')
        .select('group_id, name')
        .eq('user_id', user.id)
        .in('group_id', data.groupIds);
      
      const groupNames = groups?.map(g => g.name) || [];
      
      const { data: result, error } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: user.id,
          group_ids: data.groupIds,
          group_names: groupNames,
          message: data.message,
          media_url: data.mediaUrl,
          send_at: data.sendAt,
          total_groups: data.groupIds.length
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return result;
    },
    onSuccess: (data) => {
      console.log('Message scheduled successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast({
        title: "הודעה תוזמנה בהצלחה",
        description: `תישלח ל-${data.total_groups} קבוצות`,
      });
    },
    onError: (error: any) => {
      console.error('Failed to schedule message:', error);
      toast({
        title: "שגיאה בתזמון הודעה",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  return {
    sendImmediateMessage,
    scheduleMessage
  };
};
