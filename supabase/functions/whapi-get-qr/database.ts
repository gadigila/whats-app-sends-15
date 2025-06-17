
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
      .select('instance_id, whapi_token')
      .eq('id', userId)
      .single()

    return { profile, error }
  }

  async clearInvalidInstance(userId: string): Promise<void> {
    await this.supabase
      .from('profiles')
      .update({
        instance_id: null,
        whapi_token: null,
        instance_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
  }
}
