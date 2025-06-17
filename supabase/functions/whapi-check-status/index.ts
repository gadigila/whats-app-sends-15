
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckStatusRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: CheckStatusRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!whapiPartnerToken) {
      console.error('❌ Missing WHAPI partner token')
      return new Response(
        JSON.stringify({ connected: false, error: 'WHAPI partner token not configured' }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('🔍 Checking status for user:', userId)

    // Get user instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.instance_id) {
      console.log('❌ No instance found for user:', userId)
      return new Response(
        JSON.stringify({ connected: false, error: 'No instance found' }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('🔍 Found instance:', profile.instance_id, 'current status:', profile.instance_status)

    // Check instance status using Partner Token
    const statusResponse = await fetch(`https://gateway.whapi.cloud/partner/v1/instances/${profile.instance_id}/status`, {
      headers: {
        'x-api-key': whapiPartnerToken
      }
    })

    if (!statusResponse.ok) {
      console.error('❌ Status check failed:', statusResponse.status)
      return new Response(
        JSON.stringify({ connected: false, error: 'Status check failed' }),
        { status: 200, headers: corsHeaders }
      )
    }

    const statusData = await statusResponse.json()
    console.log('📊 Instance status response:', statusData)
    
    const isConnected = statusData.status === 'active' || statusData.status === 'connected'

    // Update status in database if connected
    if (isConnected && profile.instance_status !== 'connected') {
      console.log('✅ Updating database status to connected')
      await supabase
        .from('profiles')
        .update({
          instance_status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    console.log('✅ Status check completed:', statusData.status, 'Connected:', isConnected)

    return new Response(
      JSON.stringify({
        connected: isConnected,
        status: statusData.status,
        instance_id: profile.instance_id
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
