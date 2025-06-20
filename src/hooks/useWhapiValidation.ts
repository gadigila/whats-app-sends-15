
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useWhapiValidation = () => {
  const { user } = useAuth();

  // Validate and sync user's channel status
  const validateUserChannel = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔍 Validating user channel:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-validate-and-cleanup', {
        body: { 
          userId: user.id,
          action: 'validate_user'
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Channel validation result:', data);
      
      if (data.result?.cleaned) {
        toast({
          title: "ערוץ נוקה",
          description: `הערוץ שלא היה קיים ב-WHAPI נמחק מהמערכת: ${data.result.reason}`,
          variant: "destructive",
        });
      } else if (data.result?.updated) {
        toast({
          title: "סטטוס עודכן",
          description: `הסטטוס עודכן מ-${data.result.oldStatus} ל-${data.result.newStatus}`,
        });
      } else if (data.result?.validated) {
        toast({
          title: "ערוץ תקין",
          description: "הערוץ שלך תקין ומסונכרן עם WHAPI",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Channel validation failed:', error);
      toast({
        title: "שגיאה בבדיקת ערוץ",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Sync user's channel status
  const syncChannelStatus = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔄 Syncing channel status:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-validate-and-cleanup', {
        body: { 
          userId: user.id,
          action: 'sync_status'
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('🔄 Status sync result:', data);
      
      if (data.result?.cleaned) {
        toast({
          title: "ערוץ נוקה",
          description: "הערוץ לא נמצא ב-WHAPI ונמחק מהמערכת",
          variant: "destructive",
        });
      } else if (data.result?.updated) {
        toast({
          title: "סטטוס סונכרן",
          description: `עודכן מ-${data.result.oldStatus} ל-${data.result.newStatus}`,
        });
      } else if (data.result?.error) {
        toast({
          title: "בעיה בסנכרון",
          description: data.result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "סטטוס מסונכרן",
          description: "הסטטוס כבר מעודכן",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Status sync failed:', error);
      toast({
        title: "שגיאה בסנכרון סטטוס",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Clean up stuck channels for current user
  const cleanupStuckChannel = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🧹 Cleaning up stuck channel for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-validate-and-cleanup', {
        body: { 
          userId: user.id,
          action: 'cleanup_stuck'
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('🧹 Cleanup result:', data);
      toast({
        title: "ניקוי הושלם",
        description: data.message || "הערוץ התקוע נוקה בהצלחה",
      });
    },
    onError: (error: any) => {
      console.error('❌ Cleanup failed:', error);
      toast({
        title: "שגיאה בניקוי",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Global cleanup function (admin only)
  const cleanupAllChannels = useMutation({
    mutationFn: async () => {
      console.log('🧹 Starting global cleanup...');
      
      const { data, error } = await supabase.functions.invoke('whapi-validate-and-cleanup', {
        body: { 
          action: 'cleanup_all'
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('🧹 Global cleanup result:', data);
      toast({
        title: "ניקוי הושלם",
        description: data.message || "ניקוי גלובלי הושלם בהצלחה",
      });
    },
    onError: (error: any) => {
      console.error('❌ Global cleanup failed:', error);
      toast({
        title: "שגיאה בניקוי",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  return {
    validateUserChannel,
    syncChannelStatus,
    cleanupStuckChannel,
    cleanupAllChannels,
    isValidating: validateUserChannel.isPending,
    isSyncing: syncChannelStatus.isPending,
    isCleaning: cleanupStuckChannel.isPending || cleanupAllChannels.isPending
  };
};
