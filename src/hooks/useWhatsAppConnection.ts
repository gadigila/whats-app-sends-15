import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ConnectionResult {
  connected: boolean;
  phone?: string;
  status: string;
  message: string;
}

export const useWhatsAppConnection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Poll for connection after QR scan
  const pollForConnection = useMutation({
    mutationFn: async (): Promise<ConnectionResult> => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔄 Starting connection polling...');
      
      // Poll every 3 seconds for up to 2 minutes (40 attempts)
      for (let attempt = 1; attempt <= 40; attempt++) {
        console.log(`🔍 Connection check attempt ${attempt}/40`);
        
        try {
          const { data, error } = await supabase.functions.invoke('whapi-check-status', {
            body: { userId: user.id }
          });
          
          if (error) {
            console.error('❌ Status check error:', error);
          } else {
            console.log(`📊 Status check result:`, data);
            
            // 🔧 ENHANCED DEBUG: Let's see the raw data structure
            console.log('🔍 Raw data inspection:', {
              dataType: typeof data,
              dataKeys: data ? Object.keys(data) : 'no data',
              rawData: JSON.stringify(data, null, 2)
            });
            
            // 🔧 MULTIPLE WAYS TO CHECK CONNECTION
            const isConnectedStrict = data?.connected === true;
            const isConnectedLoose = data?.connected == true;
            const isConnectedString = data?.connected === "true";
            const isConnectedByStatus = data?.status === "connected" && data?.phone;
            const hasValidData = data && (data.connected !== undefined || data.status === "connected");
            
            console.log('🔍 Connection analysis:', {
              dataConnected: data?.connected,
              dataConnectedType: typeof data?.connected,
              dataStatus: data?.status,
              dataPhone: data?.phone,
              isConnectedStrict,
              isConnectedLoose,
              isConnectedString,
              isConnectedByStatus,
              hasValidData
            });
            
            // 🔧 ROBUST CONNECTION CHECK - Multiple detection methods
            if (isConnectedStrict || isConnectedLoose || isConnectedString || isConnectedByStatus) {
              console.log('✅ Connection detected! Stopping polling...');
              return {
                connected: true,
                phone: data?.phone || 'Connected',
                status: data?.status || 'connected',
                message: 'WhatsApp connected successfully!'
              };
            }
            
            // Additional check: If we have phone and status, consider it connected
            if (data?.phone && data?.phone !== "Connected" && data?.status === "connected") {
              console.log('✅ Connection detected via phone+status! Stopping polling...');
              return {
                connected: true,
                phone: data.phone,
                status: data.status,
                message: 'WhatsApp connected successfully!'
              };
            }
            
            // Fallback: Check if the raw JSON contains connection indicators
            const dataString = JSON.stringify(data || {});
            if (dataString.includes('"connected":true') || 
                (dataString.includes('"status":"connected"') && dataString.includes('"phone":'))) {
              console.log('✅ Connection detected via JSON parsing! Stopping polling...');
              return {
                connected: true,
                phone: data?.phone || 'Connected',
                status: data?.status || 'connected',
                message: 'WhatsApp connected successfully!'
              };
            }
          }
        } catch (checkError) {
          console.error(`❌ Check attempt ${attempt} failed:`, checkError);
        }
        
        // Wait before next attempt (only if not the last attempt)
        if (attempt < 40) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // If we get here, polling timed out
      console.log('❌ Polling completed - no connection detected in 40 attempts');
      throw new Error('Connection timeout - WhatsApp was not connected within 2 minutes');
    },
    onSuccess: (data) => {
      console.log('✅ Connection polling successful:', data);
      
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      
      toast({
        title: "WhatsApp מחובר!",
        description: `התחברת בהצלחה כ: ${data.phone}`,
      });
    },
    onError: (error: any) => {
      console.error('❌ Connection polling failed:', error);
      
      let errorMessage = "לא הצלחנו לזהות חיבור";
      let description = "בדוק שסרקת את הקוד ונסה שוב";
      
      if (error.message?.includes('timeout')) {
        description = "החיבור לקח יותר מדי זמן. נסה ליצור ערוץ חדש";
      } else if (error.message) {
        description = error.message;
      }
      
      toast({
        title: errorMessage,
        description: description,
        variant: "destructive",
      });
    }
  });

  // Check connection status once
  const checkConnection = useMutation({
    mutationFn: async (): Promise<ConnectionResult> => {
      if (!user?.id) throw new Error('No user ID');
      
      console.log('🔍 Checking connection status...');
      
      const { data, error } = await supabase.functions.invoke('whapi-check-status', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      // Use the same robust connection detection
      const isConnected = (
        data?.connected === true ||
        data?.connected == true ||
        data?.connected === "true" ||
        (data?.status === "connected" && data?.phone) ||
        JSON.stringify(data || {}).includes('"connected":true')
      );
      
      return {
        connected: isConnected,
        phone: data?.phone,
        status: data?.status,
        message: data?.message || 'Status checked'
      };
    },
    onSuccess: (data) => {
      console.log('🔍 Connection status:', data);
      
      if (data.connected) {
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      }
    }
  });

  return {
    pollForConnection,
    checkConnection,
    isPolling: pollForConnection.isPending,
    isChecking: checkConnection.isPending
  };
};