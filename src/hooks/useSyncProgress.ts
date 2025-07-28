import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SyncProgress {
  user_id: string;
  status: string;
  message: string | null;
  current_pass: number | null;
  total_passes: number | null;
  groups_found: number | null;
  total_scanned: number | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export const useSyncProgress = () => {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [lastProgress, setLastProgress] = useState<SyncProgress | null>(null);

  // Query to get current sync progress
  const { data: currentProgress, refetch } = useQuery({
    queryKey: ['sync-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: isListening ? 1000 : false, // Poll every second when listening
  });

  // Real-time subscription to sync progress
  useEffect(() => {
    if (!user?.id || !isListening) return;

    console.log('🎧 Starting real-time sync progress listener');

    const channel = supabase
      .channel('sync-progress-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_progress',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📊 Real-time sync progress update:', payload);
          const progress = payload.new as SyncProgress;
          
          if (progress) {
            setLastProgress(progress);
            refetch(); // Refresh the query data
            
            // Show progress toast
            if (progress.message) {
              toast({
                title: "📊 מתקדם בסנכרון",
                description: progress.message,
                duration: 2000,
              });
            }
            
            // Handle completion
            if (progress.status === 'completed') {
              setIsListening(false);
              toast({
                title: "✅ סנכרון הושלם!",
                description: `נמצאו ${progress.groups_found || 0} קבוצות בניהולך`,
              });
            } else if (progress.status === 'error') {
              setIsListening(false);
              toast({
                title: "❌ שגיאה בסנכרון",
                description: progress.error || "שגיאה לא ידועה",
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔇 Stopping real-time sync progress listener');
      supabase.removeChannel(channel);
    };
  }, [user?.id, isListening, refetch]);

  const startListening = () => {
    console.log('🎧 Starting sync progress monitoring');
    setIsListening(true);
  };

  const stopListening = () => {
    console.log('🔇 Stopping sync progress monitoring');
    setIsListening(false);
  };

  // Helper to determine if sync is in progress
  const isSyncInProgress = currentProgress?.status === 'in_progress' || 
                          currentProgress?.status === 'starting';

  return {
    currentProgress,
    lastProgress,
    isListening,
    isSyncInProgress,
    startListening,
    stopListening,
  };
};