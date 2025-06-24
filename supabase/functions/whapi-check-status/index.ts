import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 CORRECTED Status Check for user:', userId)

    // Get user's WHAPI token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_id, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ 
          connected: false,
          status: 'no_channel',
          message: 'No WhatsApp channel found'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('📊 Current DB status:', profile.instance_status)

    try {
      // Use ONLY the documented /health endpoint
      console.log('📊 Checking /health endpoint...')
      const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!healthResponse.ok) {
        console.log('❌ Health check failed:', healthResponse.status)
        
        if (healthResponse.status === 401) {
          // Token invalid, clean up
          await supabase
            .from('profiles')
            .update({
              instance_status: 'disconnected',
              whapi_token: null,
              instance_id: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
        }

        return new Response(
          JSON.stringify({
            connected: false,
            status: 'unhealthy',
            message: 'Channel not responding'
          }),
          { status: 200, headers: corsHeaders }
        )
      }

      const healthData = await healthResponse.json()
      console.log('📊 Health data:', healthData)

      // Determine status based on /health response only
      let connected = false
      let currentStatus = 'unknown'
      let message = 'Unknown status'
      let phone = null

      if (healthData.status === 'connected' && healthData.me?.phone) {
        // Connected with phone number
        connected = true
        currentStatus = 'connected'
        phone = healthData.me.phone
        message = 'WhatsApp is connected and ready'
        console.log('✅ CONNECTED! Phone:', phone)
      } else if (healthData.status === 'unauthorized' || healthData.status === 'qr') {
        // Needs QR scan
        currentStatus = 'unauthorized'
        message = 'Waiting for QR scan'
        console.log('🔲 Needs QR scan')
      } else if (healthData.status === 'initializing' || healthData.status === 'starting') {
        // Still starting up
        currentStatus = 'initializing'
        message = 'Channel still starting up'
        console.log('⏳ Still initializing')
      } else {
        // Other status
        currentStatus = healthData.status || 'unknown'
        message = `Status: ${currentStatus}`
        console.log('📊 Status:', currentStatus)
      }

      // Update database if status changed
      if (profile.instance_status !== currentStatus) {
        console.log(`🔄 Updating status from ${profile.instance_status} to ${currentStatus}`)
        
        await supabase
          .from('profiles')
          .update({
            instance_status: currentStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
      }

      return new Response(
        JSON.stringify({
          connected,
          status: currentStatus,
          phone,
          message,
          instance_id: profile.instance_id,
          health_status: healthData.status,
          changed: profile.instance_status !== currentStatus
        }),
        { status: 200, headers: corsHeaders }
      )

    } catch (fetchError) {
      console.error('💥 Error checking WHAPI health:', fetchError)
      
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'error',
          message: 'Failed to check WhatsApp status',
          error: fetchError.message
        }),
        { status: 200, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('💥 Status Check Error:', error)
    return new Response(
      JSON.stringify({ 
        connected: false,
        status: 'error',
        error: 'Internal server error'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})