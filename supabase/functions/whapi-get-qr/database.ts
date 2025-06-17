
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { UserProfile } from './types.ts'

export class DatabaseService {
  private supabase: any

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
  }

  async getUserProfile(userId: string): Promise<{ profile: UserProfile | null, error: any }> {
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, updated_at')
      .eq('id', userId)
      .single()

    return { profile, error }
  }

  async getChannelAge(userId: string): Promise<number | null> {
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('updated_at')
      .eq('id', userId)
      .single()

    if (error || !profile?.updated_at) {
      return null
    }

    const updatedAt = new Date(profile.updated_at)
    const now = new Date()
    return now.getTime() - updatedAt.getTime()
  }

  async clearInvalidInstance(userId: string): Promise<void> {
    console.log('🗑️ Clearing invalid instance for user:', userId)
    
    const { error } = await this.supabase
      .from('profiles')
      .update({
        instance_id: null,
        whapi_token: null,
        instance_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      console.error('❌ Error clearing invalid instance:', error)
    } else {
      console.log('✅ Successfully cleared invalid instance')
    }
  }

  async updateChannelStatus(userId: string, status: string): Promise<void> {
    console.log('📝 Updating channel status for user:', userId, 'to:', status)
    
    const { error } = await this.supabase
      .from('profiles')
      .update({
        instance_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      console.error('❌ Error updating channel status:', error)
    } else {
      console.log('✅ Successfully updated channel status')
    }
  }
}
