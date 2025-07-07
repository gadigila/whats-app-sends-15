import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback } from 'react';

export const useWhatsAppGroups = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // 🆕 Smart cooldown state
  const [syncCooldownSeconds, setSyncCooldownSeconds] = useState(0);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const [autoRetryActive, setAutoRetryActive] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Fetch groups from database
  const {
    data: groups,
    isLoading: isLoadingGroups,
    error: groupsError
  } = useQuery({
    queryKey: ['whatsapp-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log('Fetching WhatsApp groups for user:', user.id);
      
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      
      console.log('Fetched groups:', data);
      return data || [];
    },
    enabled: !!user?.id
  });

  // 🆕 Cooldown countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (syncCooldownSeconds > 0) {
      setIsInCooldown(true);
      interval = setInterval(() => {
        setSyncCooldownSeconds((prev) => {
          if (prev <= 1) {
            setIsInCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncCooldownSeconds]);

  // 🆕 Auto-retry logic with intelligent stopping
  const performSmartSync = useCallback(async (isAutoRetry = false) => {
    if (!user?.id) return null;

    console.log(`🚀 ${isAutoRetry ? 'Auto-retry' : 'Manual'} sync attempt ${retryAttempt + 1}`);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { 
          userId: user.id,
          isAutoRetry,
          retryAttempt: retryAttempt
        }
      });
      
      if (error) throw error;
      
      const groupsFound = data?.groups_count || 0;
      console.log(`📊 Sync result: ${groupsFound} groups found`);
      
      // 🎯 Intelligent stopping conditions
      const shouldStopRetrying = (
        groupsFound >= 5 ||  // Good result threshold
        retryAttempt >= 8 ||  // Max retry limit
        data?.sync_time_seconds > 45  // Took too long, probably got everything
      );
      
      if (isAutoRetry && !shouldStopRetrying) {
        // Continue auto-retry with progressive delay
        const nextDelay = Math.min(15000 + (retryAttempt * 5000), 30000); // 15s to 30s
        console.log(`🔄 Scheduling next auto-retry in ${nextDelay/1000}s...`);
        
        setTimeout(() => {
          setRetryAttempt(prev => prev + 1);
          performSmartSync(true);
        }, nextDelay);
      } else {
        // Stop auto-retry
        setAutoRetryActive(false);
        setRetryAttempt(0);
        
        if (isAutoRetry) {
          console.log(`🏁 Auto-retry complete: ${groupsFound} groups found after ${retryAttempt + 1} attempts`);
          
          if (groupsFound > 0) {
            toast({
              title: "סנכרון הושלם אוטומטית!",
              description: `נמצאו ${groupsFound} קבוצות לאחר ${retryAttempt + 1} ניסיונות`,
            });
          }
        }
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Smart sync failed:', error);
      
      if (isAutoRetry && retryAttempt < 3) {
        // Retry on error (limited retries for auto-retry)
        setTimeout(() => {
          setRetryAttempt(prev => prev + 1);
          performSmartSync(true);
        }, 10000);
      } else {
        setAutoRetryActive(false);
        setRetryAttempt(0);
        throw error;
      }
    }
  }, [user?.id, retryAttempt]);

  // 🚀 Enhanced sync with smart cooldown
  const syncGroups = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      // Start manual sync
      return await performSmartSync(false);
    },
    onSuccess: (data) => {
      console.log('🎉 Manual sync completed:', data);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      
      const {
        groups_count = 0,
        total_groups_scanned = 0,
        admin_groups_count = 0,
        creator_groups_count = 0,
        total_members_in_managed_groups = 0,
        large_groups_skipped = 0,
        api_calls_made = 0,
        sync_time_seconds = 0
      } = data;

      // Success toast with comprehensive info
      toast({
        title: "✅ סנכרון ידני הושלם!",
        description: `נמצאו ${groups_count} קבוצות בניהולך`,
      });

      // 🆕 Start auto-retry if results seem incomplete
      if (groups_count < 3 && sync_time_seconds < 30) {
        console.log('🔄 Starting auto-retry sequence for better results...');
        setAutoRetryActive(true);
        setRetryAttempt(0);
        
        // Start first auto-retry after 15 seconds
        setTimeout(() => {
          performSmartSync(true);
        }, 15000);
        
        toast({
          title: "🔄 מתחיל חיפוש נוסף",
          description: "מחפש עוד קבוצות ברקע...",
        });
      }

      // Additional info toast for power users
      if (groups_count > 0) {
        setTimeout(() => {
          toast({
            title: "📊 פרטי הסנכרון",
            description: `${creator_groups_count} קבוצות כיוצר • ${admin_groups_count} קבוצות כמנהל • ${total_members_in_managed_groups.toLocaleString()} חברים סה"כ`,
          });
        }, 2000);
      }

      // Warning if large groups were skipped
      if (large_groups_skipped > 0) {
        setTimeout(() => {
          toast({
            title: "⚠️ שים לב",
            description: `${large_groups_skipped} קבוצות גדולות לא נסרקו בגלל מגבלות API`,
            variant: "destructive",
          });
        }, 4000);
      }
    },
    onError: (error: any) => {
      console.error('❌ Manual sync failed:', error);
      
      // Enhanced error handling with helpful suggestions
      let errorTitle = "שגיאה בסנכרון קבוצות";
      let errorDescription = "נסה שוב בעוד כמה דקות";
      
      if (error.message?.includes('not connected')) {
        errorTitle = "וואטסאפ לא מחובר";
        errorDescription = "בדוק את החיבור ונסה שוב";
      } else if (error.message?.includes('phone number')) {
        errorTitle = "לא נמצא מספר טלפון";
        errorDescription = "בדוק סטטוס החיבור תחילה";
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        errorTitle = "יותר מדי בקשות";
        errorDescription = "המתן 5 דקות ונסה שוב";
      } else if (error.message?.includes('timeout')) {
        errorTitle = "פג זמן הבקשה";
        errorDescription = "הרשת עמוסה, נסה שוב בעוד כמה דקות";
      } else if (error.message?.includes('high load')) {
        errorTitle = "השרת עמוס";
        errorDescription = "שירות WHAPI עמוס כרגע, נסה שוב מאוחר יותר";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
    retry: 1,
    retryDelay: 10000,
  });

  // 🆕 Function to start post-connection cooldown
  const startPostConnectionCooldown = useCallback(() => {
    console.log('🕐 Starting post-connection cooldown (60 seconds)');
    setSyncCooldownSeconds(60);
    setAutoRetryActive(false);
    setRetryAttempt(0);
    
    toast({
      title: "חיבור הצליח!",
      description: "כפתור הסנכרון יהיה זמין בעוד 60 שניות",
    });
  }, []);

  // 🆕 Function to trigger immediate sync (for testing)
  const triggerImmediateSync = useCallback(() => {
    if (!isInCooldown && !syncGroups.isPending) {
      syncGroups.mutate();
    }
  }, [isInCooldown, syncGroups]);

  return {
    groups: groups || [],
    isLoadingGroups,
    groupsError,
    syncGroups,
    
    // 🆕 Enhanced state indicators
    isSyncing: syncGroups.isPending,
    syncError: syncGroups.error,
    lastSyncData: syncGroups.data,
    
    // 🆕 Cooldown and auto-retry state
    isInCooldown,
    syncCooldownSeconds,
    autoRetryActive,
    retryAttempt,
    
    // 🆕 Control functions
    startPostConnectionCooldown,
    triggerImmediateSync,
    
    // Helper computed values
    totalGroups: groups?.length || 0,
    adminGroups: groups?.filter(g => g.is_admin)?.length || 0,
    totalMembers: groups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0,
  };
};