import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface StatusCheckRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: StatusCheckRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Checking status for user:', userId)

    // Get user's WHAPI token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      console.error('❌ No WHAPI token found for user')
      return new Response(
        JSON.stringify({ 
          connected: false,
          status: 'no_token',
          error: 'No WhatsApp instance found'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // 🔧 FIXED: Use correct /health endpoint
    console.log('📊 Checking health endpoint...')
    const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!healthResponse.ok) {
      console.log('❌ Health endpoint failed:', healthResponse.status)
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'unauthorized',
          message: 'WhatsApp not connected',
          http_status: healthResponse.status
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    const healthData = await healthResponse.json()
    console.log('📊 Health response:', JSON.stringify(healthData, null, 2))

    // 🔧 FIXED: Check for connection based on WHAPI health response format
    // According to WHAPI docs, when connected the response includes user info
    const isConnected = !!(
      healthData.me?.phone || 
      healthData.phone || 
      healthData.user?.phone ||
      (healthData.status === 'connected') ||
      (healthData.health?.status?.text === 'CONNECTED')
    )

    if (isConnected) {
      const phoneNumber = healthData.me?.phone || healthData.phone || healthData.user?.phone || 'Unknown'
      console.log('✅ User is connected:', phoneNumber)
      
      // Update database status
      await supabase
        .from('profiles')
        .update({
          instance_status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return new Response(
        JSON.stringify({
          connected: true,
          status: 'connected',
          phone: phoneNumber,
          message: 'WhatsApp is connected',
          health_data: healthData // Include for debugging
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Not connected - check specific status
    const healthStatus = healthData.health?.status?.text || healthData.status || 'unknown'
    console.log('📊 Health status:', healthStatus)

    return new Response(
      JSON.stringify({
        connected: false,
        status: healthStatus.toLowerCase(),
        message: `WhatsApp status: ${healthStatus}`,
        health_data: healthData // Include for debugging
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Status Check Error:', error)
    return new Response(
      JSON.stringify({ 
        connected: false,
        status: 'error',
        error: 'Failed to check status',
        details: error.message
      }),
      { status: 200, headers: corsHeaders }
    )
  }
})