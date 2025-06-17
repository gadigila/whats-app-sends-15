
import { createClient } from 'jsr:@supabase/supabase-js@2'

export class DatabaseService {
  private supabase: any

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
  }

  async getUserProfile(userId: string) {
    console.log('🔍 Fetching user profile for:', userId)
    
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, updated_at')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('❌ Database error fetching profile:', error)
      return { profile: null, error }
    }

    console.log('📋 Profile fetched:', {
      hasInstanceId: !!profile?.instance_id,
      hasToken: !!profile?.whapi_token,
      instanceStatus: profile?.instance_status,
      updatedAt: profile?.updated_at
    })

    return { profile, error: null }
  }

  async getChannelAge(userId: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('updated_at')
      .eq('id', userId)
      .single()

    if (error || !data?.updated_at) {
      console.log('⚠️ Could not determine channel age')
      return null
    }

    const age = Date.now() - new Date(data.updated_at).getTime()
    console.log(`📅 Channel age: ${age}ms`)
    return age
  }

  async clearInvalidInstance(userId: string) {
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
}
