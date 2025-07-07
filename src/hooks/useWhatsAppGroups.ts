import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback } from 'react';

interface SyncProgress {
  userId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  groupsFound: number;
  totalScanned: number;
  currentBatch: number;
  message: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export const useWhatsAppGroups = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // 🆕 Background sync state
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isPollingProgress, setIsPollingProgress] = useState(false);

  // Fetch groups from database (existing)
  const {
    data: groups,
    isLoading: isLoadingGroups,
    error: groupsError
  } = useQuery({
    queryKey: ['whatsapp-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // 🆕 Poll for sync progress
  const pollProgress = useCallback(async () => {
    if (!user?.id || !isPollingProgress) return;

    try {
      const { data, error } = await supabase.functions.invoke('background-group-sync', {
        body: { userId: user.id, action: 'status' }
      });

      if (error) {
        console.error('Error polling progress:', error);
        return;
      }

      if (data.status === 'not_running') {
        setIsPollingProgress(false);
        setSyncProgress(null);
        return;
      }

      setSyncProgress(data);

      // Stop polling if completed/failed/cancelled
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        setIsPollingProgress(false);
        
        // Refresh groups data
        queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });

        // Show completion toast
        if (data.status === 'completed') {
          toast({
            title: "🎉 Sync Completed!",
            description: `Found ${data.groupsFound} admin groups from ${data.totalScanned} total groups`,
          });
        } else if (data.status === 'failed') {
          toast({
            title: "❌ Sync Failed",
            description: data.error || "Sync failed for unknown reason",
            variant: "destructive",
          });
        }
      }

    } catch (error) {
      console.error('Polling error:', error);
    }
  }, [user?.id, isPollingProgress, queryClient]);

  // 🆕 Progress polling effect
  useEffect(() => {
    if (!isPollingProgress) return;

    const interval = setInterval(pollProgress, 3000); // Poll every 3 seconds
    
    return () => clearInterval(interval);
  }, [isPollingProgress, pollProgress]);

  // 🆕 Background sync mutation
  const startBackgroundSync = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🚀 Starting background sync...');
      
      const { data, error } = await supabase.functions.invoke('background-group-sync', {
        body: { userId: user.id, action: 'start' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('🎉 Background sync started:', data);
      
      if (data.success) {
        setSyncProgress(data.progress);
        setIsPollingProgress(true);
        
        toast({
          title: "🚀 Background Sync Started",
          description: "Scanning all your groups in the background. You can continue using the app!",
        });
      } else {
        toast({
          title: "ℹ️ Sync Status",
          description: data.message,
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Background sync failed to start:', error);
      
      let errorTitle = "Failed to Start Sync";
      let errorDescription = "Try again in a few minutes";
      
      if (error.message?.includes('Connection too fresh')) {
        errorTitle = "Connection Too Recent";
        errorDescription = error.message;
      } else if (error.message?.includes('not connected')) {
        errorTitle = "WhatsApp Not Connected";
        errorDescription = "Check your connection and try again";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    }
  });

  // 🆕 Cancel sync mutation
  const cancelSync = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await supabase.functions.invoke('background-group-sync', {
        body: { userId: user.id, action: 'cancel' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setIsPollingProgress(false);
      setSyncProgress(null);
      
      toast({
        title: "Sync Cancelled",
        description: "Background sync has been stopped",
      });
    }
  });

  // 🆕 Legacy sync (for backward compatibility)
  const syncGroups = useMutation({
    mutationFn: async () => {
      // Just redirect to background sync
      return startBackgroundSync.mutateAsync();
    },
    onSuccess: startBackgroundSync.onSuccess,
    onError: startBackgroundSync.onError
  });

  return {
    groups: groups || [],
    isLoadingGroups,
    groupsError,
    
    // 🆕 Background sync functionality
    syncGroups, // Backward compatibility
    startBackgroundSync,
    cancelSync,
    syncProgress,
    isPollingProgress,
    
    // State indicators
    isSyncing: startBackgroundSync.isPending || isPollingProgress,
    syncError: startBackgroundSync.error,
    
    // Helper computed values
    totalGroups: groups?.length || 0,
    adminGroups: groups?.filter(g => g.is_admin)?.length || 0,
    totalMembers: groups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0,
    
    // 🆕 Background sync specific values
    isBackgroundSyncRunning: syncProgress?.status === 'running',
    backgroundSyncProgress: syncProgress?.progress || 0,
    backgroundSyncMessage: syncProgress?.message || '',
    groupsFoundSoFar: syncProgress?.groupsFound || 0,
    totalScannedSoFar: syncProgress?.totalScanned || 0,
  };
};