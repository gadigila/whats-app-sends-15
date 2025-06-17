
import { supabase } from '@/integrations/supabase/client';

export interface WhapiProfile {
  id: string;
  instance_id: string | null;
  whapi_token: string | null;
  instance_status: string | null;
  updated_at: string;
}

export class WhapiDatabaseService {
  // Get user's WHAPI profile data
  async getUserProfile(userId: string): Promise<WhapiProfile | null> {
    try {
      console.log('🔍 Fetching WHAPI profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, instance_id, whapi_token, instance_status, updated_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Database error fetching profile:', error);
        return null;
      }

      console.log('📋 Profile fetched:', {
        hasInstanceId: !!data?.instance_id,
        hasToken: !!data?.whapi_token,
        instanceStatus: data?.instance_status
      });

      return data;
    } catch (error) {
      console.error('❌ Error in getUserProfile:', error);
      return null;
    }
  }

  // Update user's WHAPI connection status
  async updateConnectionStatus(userId: string, status: string, phone?: string) {
    try {
      console.log('📝 Updating connection status:', { userId, status, phone });
      
      const updateData: any = {
        instance_status: status,
        updated_at: new Date().toISOString()
      };

      // Only update phone if provided and status is connected
      if (phone && status === 'connected') {
        // Note: You might need to add a phone field to the profiles table
        // updateData.phone = phone;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('❌ Error updating connection status:', error);
        return false;
      }

      console.log('✅ Connection status updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in updateConnectionStatus:', error);
      return false;
    }
  }

  // Clear invalid instance data
  async clearInvalidInstance(userId: string) {
    try {
      console.log('🗑️ Clearing invalid instance for user:', userId);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          instance_id: null,
          whapi_token: null,
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error clearing invalid instance:', error);
        return false;
      }

      console.log('✅ Successfully cleared invalid instance');
      return true;
    } catch (error) {
      console.error('❌ Error in clearInvalidInstance:', error);
      return false;
    }
  }

  // Check if instance needs cleanup based on age
  async getInstanceAge(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('updated_at')
        .eq('id', userId)
        .single();

      if (error || !data?.updated_at) {
        console.log('⚠️ Could not determine instance age');
        return null;
      }

      const age = Date.now() - new Date(data.updated_at).getTime();
      console.log(`📅 Instance age: ${age}ms`);
      return age;
    } catch (error) {
      console.error('❌ Error getting instance age:', error);
      return null;
    }
  }
}
