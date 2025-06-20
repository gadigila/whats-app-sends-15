
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUserProfile = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('🔍 No user ID available for profile query');
        throw new Error('User not authenticated');
      }

      console.log('🔍 Fetching profile for user:', user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle missing profiles

      if (error) {
        console.error('❌ Profile query error:', error);
        throw error;
      }

      // If no profile exists, create one
      if (!data) {
        console.log('📝 No profile found, creating new profile for user:', user.id);
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: user.name || user.email?.split('@')[0] || 'User',
            instance_status: 'disconnected',
            payment_plan: 'trial',
            trial_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Profile creation error:', createError);
          throw createError;
        }

        console.log('✅ Profile created successfully:', newProfile);
        return newProfile;
      }

      console.log('✅ Profile found:', {
        id: data.id,
        instance_id: data.instance_id,
        instance_status: data.instance_status,
        has_token: !!data.whapi_token
      });

      return data;
    },
    enabled: !!user?.id,
    retry: 1,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};
