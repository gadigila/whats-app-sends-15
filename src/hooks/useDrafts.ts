import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface DraftData {
  message: string;
  groupIds: string[];
  groupNames: string[];
  mediaUrl?: string;
  totalGroups: number;
}

export const useDrafts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all drafts
  const {
    data: drafts,
    isLoading,
    error
  } = useQuery({
    queryKey: ['drafts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_draft', true)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Save new draft
  const saveDraft = useMutation({
    mutationFn: async (data: DraftData) => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data: result, error } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: user.id,
          message: data.message,
          group_ids: data.groupIds,
          group_names: data.groupNames,
          media_url: data.mediaUrl,
          is_draft: true,
          status: 'draft',
          send_at: null,
          total_groups: data.totalGroups
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast({
        title: "טיוטה נשמרה ✅",
        description: "ההודעה נשמרה בטיוטות",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בשמירת טיוטה",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Update existing draft
  const updateDraft = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DraftData }) => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data: result, error } = await supabase
        .from('scheduled_messages')
        .update({
          message: data.message,
          group_ids: data.groupIds,
          group_names: data.groupNames,
          media_url: data.mediaUrl,
          total_groups: data.totalGroups,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast({
        title: "טיוטה עודכנה ✅",
        description: "השינויים נשמרו בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון טיוטה",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Delete draft
  const deleteDraft = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', draftId)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast({
        title: "טיוטה נמחקה",
        description: "הטיוטה נמחקה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה במחיקה",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  return {
    drafts: drafts || [],
    isLoading,
    error,
    saveDraft,
    updateDraft,
    deleteDraft
  };
};
