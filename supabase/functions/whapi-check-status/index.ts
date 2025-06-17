
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckStatusRequest {
  userId: string
}

class WhapiService {
  private baseURL = 'https://gate.whapi.cloud'

  async checkChannelStatus(instanceId: string, channelToken: string) {
    try {
      const response = await fetch(`${this.baseURL}/channels/${instanceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Channel not found',
            requiresCleanup: true,
            status: 404
          }
        }
        const errorText = await response.text()
        throw new Error(`Status check failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const isConnected = data.status === 'active' || !!data.phone
      
      return {
        success: true,
        status: data.status,
        phone: data.phone || null,
        connected: isConnected,
        data: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requiresCleanup: false
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: CheckStatusRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Checking status for user:', userId)

    // Get user channel info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.instance_id || !profile?.whapi_token) {
      console.log('❌ No channel found for user:', userId)
      return new Response(
        JSON.stringify({ connected: false, error: 'No channel found' }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('🔍 Found channel:', profile.instance_id, 'current status:', profile.instance_status)

    const whapiService = new WhapiService()
    
    // Check channel status using the new service
    const statusResult = await whapiService.checkChannelStatus(profile.instance_id, profile.whapi_token)

    if (!statusResult.success) {
      console.error('❌ Status check failed:', statusResult.error)

      // If channel not found (404), clean up the database
      if (statusResult.requiresCleanup) {
        console.log('🗑️ Channel not found (404), cleaning up database...')
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        return new Response(
          JSON.stringify({ 
            connected: false, 
            error: 'Channel not found. Please create a new channel.',
            requiresNewInstance: true
          }),
          { status: 200, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ connected: false, error: statusResult.error }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('📊 Channel status response:', statusResult.data)
    
    // Update status in database if connected
    if (statusResult.connected && profile.instance_status !== 'connected') {
      console.log('✅ Updating database status to connected')
      await supabase
        .from('profiles')
        .update({
          instance_status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    console.log('✅ Status check completed:', statusResult.status, 'Connected:', statusResult.connected)

    return new Response(
      JSON.stringify({
        connected: statusResult.connected,
        status: statusResult.status,
        phone: statusResult.phone,
        channel_id: profile.instance_id
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Check Status Error:', error)
    return new Response(
      JSON.stringify({ connected: false, error: error.message }),
      { status: 200, headers: corsHeaders }
    )
  }
})
