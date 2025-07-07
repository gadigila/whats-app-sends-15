import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

export const useWhatsAppGroups = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // 🚀 NEW: Cooldown state management
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  
  const SYNC_COOLDOWN_SECONDS = 90; // 90 second cooldown

  // 🕐 Cooldown timer effect
  useEffect(() => {
    if (lastSyncTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
        const remaining = Math.max(0, SYNC_COOLDOWN_SECONDS - elapsed);
        setCooldownRemaining(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [lastSyncTime]);

  // Load last sync time from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const storedSyncTime = localStorage.getItem(`lastSync_${user.id}`);
      if (storedSyncTime) {
        const syncTime = new Date(storedSyncTime);
        const elapsed = Math.floor((Date.now() - syncTime.getTime()) / 1000);
        
        if (elapsed < SYNC_COOLDOWN_SECONDS) {
          setLastSyncTime(syncTime);
          setCooldownRemaining(SYNC_COOLDOWN_SECONDS - elapsed);
        }
      }
    }
  }, [user?.id]);

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

  // 🚀 ENHANCED: Sync with cooldown and better error handling
  const syncGroups = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      // Check cooldown
      if (cooldownRemaining > 0) {
        throw new Error(`Please wait ${cooldownRemaining} seconds before syncing again`);
      }
      
      console.log('🚀 Starting enhanced group sync for user:', user.id);
      
      // Show initial loading toast with cooldown info
      toast({
        title: "🔄 מתחיל סנכרון קבוצות מחוזק",
        description: "מחפש את כל הקבוצות שלך עם הגנה מפני הגבלות API...",
      });

      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onMutate: () => {
      // Set sync time immediately when starting
      const syncTime = new Date();
      setLastSyncTime(syncTime);
      setCooldownRemaining(SYNC_COOLDOWN_SECONDS);
      
      // Store in localStorage
      if (user?.id) {
        localStorage.setItem(`lastSync_${user.id}`, syncTime.toISOString());
      }
    },
    onSuccess: (data) => {
      console.log('🎉 Enhanced sync completed:', data);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      
      // Enhanced success message with detailed info
      const {
        groups_count = 0,
        total_groups_scanned = 'unknown',
        admin_groups_count = 0,
        creator_groups_count = 0,
        total_members_in_managed_groups = 0,
        sync_time_seconds = 0,
        total_api_calls = 0
      } = data;

      // Main success toast
      toast({
        title: "✅ סנכרון הושלם בהצלחה!",
        description: `נמצאו ${groups_count} קבוצות בניהולך תוך ${sync_time_seconds} שניות`,
      });

      // Additional info toast for detailed results
      if (groups_count > 0) {
        setTimeout(() => {
          toast({
            title: "📊 פרטי הסנכרון המחוזק",
            description: `${creator_groups_count} קבוצות כיוצר • ${admin_groups_count} קבוצות כמנהל • ${total_members_in_managed_groups.toLocaleString()} חברים סה"כ`,
          });
        }, 2000);
      }

      // Performance info for power users
      if (total_api_calls > 0) {
        setTimeout(() => {
          toast({
            title: "⚡ ביצועים",
            description: `${total_api_calls} קריאות API • הגנה מפני הגבלות פעילה • בהצלחה!`,
          });
        }, 4000);
      }
    },
    onError: (error: any) => {
      console.error('❌ Enhanced sync failed:', error);
      
      // Enhanced error handling with helpful suggestions
      let errorTitle = "שגיאה בסנכרון קבוצות";
      let errorDescription = "נסה שוב בעוד כמה דקות";
      
      if (error.message?.includes('wait') && error.message?.includes('seconds')) {
        errorTitle = "יותר מדי מהר!";
        errorDescription = error.message;
      } else if (error.message?.includes('not connected')) {
        errorTitle = "וואטסאפ לא מחובר";
        errorDescription = "בדוק את החיבור ונסה שוב";
      } else if (error.message?.includes('phone number')) {
        errorTitle = "לא נמצא מספר טלפון";
        errorDescription = "בדוק סטטוס החיבור תחילה";
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        errorTitle = "יותר מדי בקשות";
        errorDescription = "שירות WHAPI עמוס, המתן 3 דקות ונסה שוב";
      } else if (error.message?.includes('timeout')) {
        errorTitle = "פג זמן הבקשה";
        errorDescription = "הרשת עמוסה, נסה שוב בעוד 2 דקות";
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
    // 🎯 IMPORTANT: Longer timeout for enhanced sync
    mutationKey: ['sync-groups-enhanced'],
    retry: 1, // Only retry once for failed syncs
    retryDelay: 30000, // Wait 30 seconds before retry
  });

  // 🚀 NEW: Auto-sync functionality
  const triggerAutoSync = useMutation({
    mutationFn: async () => {
      if (!user?.id || hasAutoSynced) return null;
      
      console.log('🤖 Triggering auto-sync after connection...');
      setHasAutoSynced(true);
      
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        console.log('🤖 Auto-sync completed:', data);
        queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
        
        toast({
          title: "🤖 קבוצות סונכרנו אוטומטית",
          description: `נמצאו ${data.groups_count || 0} קבוצות לאחר החיבור`,
        });
      }
    },
    onError: (error: any) => {
      console.log('🤖 Auto-sync failed (user can manually retry):', error.message);
      // Don't show error toast for auto-sync failures
    }
  });

  // Helper function to manually trigger sync with cooldown check
  const handleManualSync = () => {
    if (cooldownRemaining > 0) {
      toast({
        title: "יותר מדי מהר!",
        description: `המתן עוד ${cooldownRemaining} שניות לפני סנכרון נוסף`,
        variant: "destructive",
      });
      return;
    }
    
    syncGroups.mutate();
  };

  // Helper function to check if sync is available
  const isSyncAvailable = cooldownRemaining === 0 && !syncGroups.isPending;

  // Helper function to get cooldown status
  const getCooldownStatus = () => {
    if (cooldownRemaining > 0) {
      const minutes = Math.floor(cooldownRemaining / 60);
      const seconds = cooldownRemaining % 60;
      
      if (minutes > 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      } else {
        return `${seconds}s`;
      }
    }
    return null;
  };

  return {
    groups: groups || [],
    isLoadingGroups,
    groupsError,
    syncGroups: handleManualSync, // Use wrapped function
    triggerAutoSync,
    
    // 🚀 Enhanced state indicators
    isSyncing: syncGroups.isPending,
    isAutoSyncing: triggerAutoSync.isPending,
    syncError: syncGroups.error,
    lastSyncData: syncGroups.data,
    
    // 🕐 Cooldown management
    cooldownRemaining,
    lastSyncTime,
    isSyncAvailable,
    cooldownStatus: getCooldownStatus(),
    hasAutoSynced,
    setHasAutoSynced,
    
    // Helper computed values
    totalGroups: groups?.length || 0,
    adminGroups: groups?.filter(g => g.is_admin)?.length || 0,
    totalMembers: groups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0,
  };
};