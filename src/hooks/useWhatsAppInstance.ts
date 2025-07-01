import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

export const useWhatsAppInstance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Check instance status
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

  // Hard disconnect (NEW)
  const hardDisconnect = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔌 Starting hard disconnect for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('whapi-hard-disconnect', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      console.log('✅ Hard disconnect successful');
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      setShowDisconnectDialog(false);
      toast({
        title: "נותקת בהצלחה",
        description: "נותקת לחלוטין מוואטסאפ! תצטרך לסרוק QR מחדש כדי להתחבר.",
      });
    },
    onError: (error: any) => {
      console.error('❌ Hard disconnect failed:', error);
      toast({
        title: "שגיאה בניתוק",
        description: "נסה שוב מאוחר יותר: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Delete instance (OLD - keeping for backward compatibility)
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
  console.log('✅ Hard disconnect successful');
  queryClient.invalidateQueries({ queryKey: ['user-profile'] });
  queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
  setShowDisconnectDialog(false);
  
  toast({
    title: "נותקת בהצלחה",
    description: "נותקת לחלוטין מוואטסאפ! לחץ על 'חבר וואטסאפ' כדי להתחבר מחדש.",
  });
},
    onError: (error: any) => {
      console.error('Failed to delete instance:', error);
      toast({
        title: "שגיאה בניתוק",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  });

  // Helper functions for disconnect dialog
  const openDisconnectDialog = () => setShowDisconnectDialog(true);
  const closeDisconnectDialog = () => setShowDisconnectDialog(false);
  const confirmHardDisconnect = () => hardDisconnect.mutate();

  return {
    checkInstanceStatus,
    deleteInstance, // Keep old one for now
    hardDisconnect, // New hard disconnect
    showDisconnectDialog,
    openDisconnectDialog,
    closeDisconnectDialog,
    confirmHardDisconnect,
    isHardDisconnecting: hardDisconnect.isPending
  };
};