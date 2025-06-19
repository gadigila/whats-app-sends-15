
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

export const useWhatsAppInstance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  // Create WhatsApp instance using Partner API
  const createInstance = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      // Prevent concurrent instance creation
      if (isCreatingInstance) {
        throw new Error('Instance creation already in progress');
      }
      
      setIsCreatingInstance(true);
      
      try {
        console.log('Creating WhatsApp instance for user:', user.id);
        
        const { data, error } = await supabase.functions.invoke('whapi-partner-login', {
          body: { userId: user.id }
        });
        
        if (error) {
          console.error('Supabase function error:', error);
          throw error;
        }
        if (data?.error) {
          console.error('Function returned error:', data.error);
          throw new Error(data.error);
        }
        
        console.log('✅ Instance creation successful:', data);
        return data;
      } finally {
        setIsCreatingInstance(false);
      }
    },
    onSuccess: (data) => {
      console.log('WhatsApp instance created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast({
        title: "אינסטנס נוצר בהצלחה",
        description: data.message || "כעת תוכל להתחבר לוואטסאפ",
      });
    },
    onError: (error: any) => {
      console.error('Failed to create WhatsApp instance:', error);
      setIsCreatingInstance(false);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      
      // More specific error handling
      if (error.message) {
        if (error.message.includes('Failed to save channel data')) {
          errorMessage = "שגיאה בשמירת נתוני החיבור - נסה שוב";
        } else if (error.message.includes('Failed to create channel')) {
          errorMessage = "שגיאה ביצירת ערוץ WHAPI - בדוק את ההגדרות";
        } else if (error.message.includes('Database update verification failed')) {
          errorMessage = "שגיאה באימות שמירת נתונים - נסה שוב";
        } else if (error.message.includes('Both RPC and direct update failed')) {
          errorMessage = "שגיאה במסד הנתונים - צור קשר עם התמיכה";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "שגיאה ביצירת אינסטנס",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Get QR code using Partner API
  const getQrCode = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Getting QR code for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-get-qr', {
        body: { userId: user.id }
      });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      return data;
    },
    onError: (error: any) => {
      console.error('Failed to get QR code:', error);
      
      let errorMessage = "נסה שוב מאוחר יותר";
      if (error.message) {
        if (error.message.includes('No instance or token found')) {
          errorMessage = "נדרש instance חדש - צור אחד תחילה";
        } else if (error.message.includes('Channel not found')) {
          errorMessage = "הערוץ לא נמצא - צור instance חדש";
        } else if (error.message.includes('requiresNewInstance')) {
          errorMessage = "נדרש instance חדש - הקיים לא תקין";
        }
      }
      
      toast({
        title: "שגיאה בקבלת קוד QR",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Manual status sync - NEW FEATURE
  const manualStatusSync = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Manual status sync for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-manual-status-sync', {
        body: { userId: user.id }
      });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: (data) => {
      console.log('Manual status sync successful:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      if (data.updated) {
        toast({
          title: "סטטוס עודכן",
          description: `סטטוס שונה מ-${data.oldStatus} ל-${data.newStatus}`,
        });
      } else {
        toast({
          title: "סטטוס מסונכרן",
          description: "הסטטוס כבר מעודכן",
        });
      }
    },
    onError: (error: any) => {
      console.error('Failed to sync status:', error);
      toast({
        title: "שגיאה בסנכרון סטטוס",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Check instance status using Partner API
  const checkInstanceStatus = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await supabase.functions.invoke('whapi-check-status', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      console.log('Instance status:', data);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    }
  });

  // Delete instance - now includes WHAPI deletion
  const deleteInstance = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('Deleting WhatsApp instance for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-delete-instance', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      console.log('Instance deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast({
        title: "אינסטנס נמחק",
        description: "החיבור לוואטסאפ נותק",
      });
    },
    onError: (error: any) => {
      console.error('Failed to delete instance:', error);
      toast({
        title: "שגיאה במחיקת אינסטנס",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  return {
    createInstance,
    getQrCode,
    checkInstanceStatus,
    deleteInstance,
    manualStatusSync,
    isCreatingInstance
  };
};
