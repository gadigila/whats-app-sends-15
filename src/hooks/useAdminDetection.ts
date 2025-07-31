import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AdminDetectionProgress {
  total_groups: number;
  pending_groups: number;
  completed_groups: number;
  failed_groups: number;
  progress_percentage: number;
}

export const useAdminDetection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query to get background processing progress
  const {
    data: progress,
    isLoading: isLoadingProgress
  } = useQuery({
    queryKey: ['admin-detection-progress', user?.id],
    queryFn: async (): Promise<AdminDetectionProgress> => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await supabase.rpc('get_admin_detection_progress', {
        user_uuid: user.id
      });
      
      if (error) throw error;
      
      // Return the first row or default values
      return data?.[0] || {
        total_groups: 0,
        pending_groups: 0,
        completed_groups: 0,
        failed_groups: 0,
        progress_percentage: 0
      };
    },
    enabled: !!user?.id,
    refetchInterval: 10000 // Poll every 10 seconds
  });

  // Manual trigger for specific groups (optional)
  const triggerAdminDetection = useMutation({
    mutationFn: async (groupIds?: string[]) => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔍 Triggering admin detection...', { 
        groupIds: groupIds?.length || 'all pending' 
      });
      
      const { data, error } = await supabase.functions.invoke('detect-admin-groups', {
        body: { 
          userId: user.id,
          groupIds,
          batchSize: 5 // Smaller batch for manual trigger
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Admin detection triggered:', data);
      
      // Invalidate queries to refresh progress
      queryClient.invalidateQueries({ queryKey: ['admin-detection-progress'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      
      toast({
        title: "זיהוי מנהלים הופעל",
        description: `מעבד ${data.processed || 0} קבוצות ברקע`,
      });
    },
    onError: (error: any) => {
      console.error('❌ Admin detection trigger failed:', error);
      
      toast({
        title: "שגיאה בהפעלת זיהוי מנהלים",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Helper computed values
  const isProcessing = progress && progress.pending_groups > 0;
  const isCompleted = progress && progress.pending_groups === 0 && progress.total_groups > 0;
  const progressPercentage = progress?.progress_percentage || 0;

  return {
    // Background processing status
    progress,
    isLoadingProgress,
    isProcessing,
    isCompleted,
    progressPercentage,
    
    // Manual trigger (optional)
    triggerAdminDetection,
    isTriggering: triggerAdminDetection.isPending,
    
    // Helper text for UI
    getStatusText: () => {
      if (!progress) return 'טוען...';
      
      if (progress.total_groups === 0) {
        return 'אין קבוצות';
      }
      
      if (progress.pending_groups === 0) {
        return `זוהו ${progress.completed_groups} קבוצות (${progress.failed_groups} נכשלו)`;
      }
      
      return `מעבד ${progress.pending_groups} מתוך ${progress.total_groups} קבוצות (${Math.round(progressPercentage)}%)`;
    }
  };
};