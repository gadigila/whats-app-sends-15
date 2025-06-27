
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Segment {
  id: string;
  name: string;
  group_ids: string[];
  total_members: number;
  created_at: string;
  updated_at: string;
}

export const useSegments = () => {
  const { user } = useAuth();

  const { data: segments = [], isLoading: isLoadingSegments } = useQuery({
    queryKey: ['segments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  return {
    segments: segments as Segment[],
    isLoadingSegments
  };
};
