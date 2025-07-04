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
            
            // 🔧 PARSE STRINGIFIED JSON IF NEEDED
            let parsedData = data;
            
            // Check if data is a string that needs parsing
            if (typeof data === 'string') {
              try {
                parsedData = JSON.parse(data);
                console.log('🔄 Parsed string data:', parsedData);
              } catch (e) {
                console.log('⚠️ Data is string but not valid JSON');
              }
            }
            
            // If the raw response contains stringified JSON inside rawData field
            if (parsedData && typeof parsedData === 'object' && typeof parsedData.rawData === 'string') {
              try {
                const innerParsed = JSON.parse(parsedData.rawData);
                console.log('🔄 Parsed inner rawData:', innerParsed);
                parsedData = innerParsed;
              } catch (e) {
                console.log('⚠️ rawData is string but not valid JSON');
              }
            }
            
            console.log('🔍 Raw data inspection:', {
              originalDataType: typeof data,
              parsedDataType: typeof parsedData,
              dataKeys: parsedData && typeof parsedData === 'object' ? Object.keys(parsedData) : 'no keys',
              rawDataPreview: JSON.stringify(data, null, 2).substring(0, 200) + '...'
            });
            
            // 🔧 MULTIPLE WAYS TO CHECK CONNECTION using parsedData
            const isConnectedStrict = parsedData?.connected === true;
            const isConnectedLoose = parsedData?.connected == true;
            const isConnectedString = parsedData?.connected === "true";
            const isConnectedByStatus = parsedData?.status === "connected" && parsedData?.phone;
            
            console.log('🔍 Connection analysis:', {
              parsedDataConnected: parsedData?.connected,
              parsedDataConnectedType: typeof parsedData?.connected,
              parsedDataStatus: parsedData?.status,
              parsedDataPhone: parsedData?.phone,
              isConnectedStrict,
              isConnectedLoose,
              isConnectedString,
              isConnectedByStatus
            });
            
            // 🔧 ROBUST CONNECTION CHECK - Multiple detection methods
            if (isConnectedStrict || isConnectedLoose || isConnectedString || isConnectedByStatus) {
              console.log('✅ Connection detected! Stopping polling...');
              return {
                connected: true,
                phone: parsedData?.phone || 'Connected',
                status: parsedData?.status || 'connected',
                message: 'WhatsApp connected successfully!'
              };
            }
            
            // Additional check: If we have phone and status, consider it connected
            if (parsedData?.phone && parsedData?.phone !== "Connected" && parsedData?.status === "connected") {
              console.log('✅ Connection detected via phone+status! Stopping polling...');
              return {
                connected: true,
                phone: parsedData.phone,
                status: parsedData.status,
                message: 'WhatsApp connected successfully!'
              };
            }
            
            // Fallback: Check if the raw JSON string contains connection indicators
            const dataString = JSON.stringify(data || {});
            console.log('🔍 Checking raw JSON string:', dataString.substring(0, 100));
            
            if (dataString.includes('"connected":true')) {
              console.log('✅ Connection detected via string! Stopping polling...');
              
              // Extract phone number from string
              let phoneMatch = dataString.match(/"phone":"([^"]+)"/);
              let phone = phoneMatch ? phoneMatch[1] : 'Connected';
              
              return {
                connected: true,
                phone: phone,
                status: 'connected',
                message: 'WhatsApp connected successfully!'
              };
            }
            
            // Extra fallback: check for status and phone in string
            if (dataString.includes('"status":"connected"') && dataString.includes('"phone":')) {
              console.log('✅ Connection detected via status+phone string! Stopping polling...');
              
              // Extract phone number from string
              let phoneMatch = dataString.match(/"phone":"([^"]+)"/);
              let phone = phoneMatch ? phoneMatch[1] : 'Connected';
              
              return {
                connected: true,
                phone: phone,
                status: 'connected',
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
      
      // Parse data if it's stringified
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.log('⚠️ Could not parse data as JSON');
        }
      }
      
      // Use the same robust connection detection
      const dataString = JSON.stringify(data || {});
      const isConnected = (
        parsedData?.connected === true ||
        parsedData?.connected == true ||
        parsedData?.connected === "true" ||
        (parsedData?.status === "connected" && parsedData?.phone) ||
        dataString.includes('"connected":true') ||
        (dataString.includes('"status":"connected"') && dataString.includes('"phone":'))
      );
      
      // Extract phone from string if needed
      let phone = parsedData?.phone;
      if (!phone && dataString.includes('"phone":')) {
        let phoneMatch = dataString.match(/"phone":"([^"]+)"/);
        phone = phoneMatch ? phoneMatch[1] : undefined;
      }
      
      return {
        connected: isConnected,
        phone: phone,
        status: parsedData?.status || 'unknown',
        message: parsedData?.message || 'Status checked'
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