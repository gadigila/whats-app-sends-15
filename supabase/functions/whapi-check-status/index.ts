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

    // 🔧 FIXED: Use /users/profile endpoint to detect connection properly
    console.log('📊 Checking users/profile endpoint...')
    const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('📊 Profile response status:', profileResponse.status)

    if (!profileResponse.ok) {
      console.log('❌ Profile endpoint failed:', profileResponse.status)
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'unauthorized',
          message: 'WhatsApp not connected',
          http_status: profileResponse.status
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    const profileData = await profileResponse.json()
    console.log('📊 Profile response:', JSON.stringify(profileData, null, 2))

    // 🔧 FIXED: Check for connection based on user profile response
    // If we get a successful response with phone number, user is connected
    const isConnected = !!(
      profileData.phone || 
      profileData.id ||
      profileData.name
    )

    if (isConnected) {
      const phoneNumber = profileData.phone || profileData.id || 'Connected'
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
          profile_data: profileData // Include for debugging
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Not connected
    console.log('📊 No connection detected from profile response')

    return new Response(
      JSON.stringify({
        connected: false,
        status: 'unauthorized',
        message: 'WhatsApp not connected',
        profile_data: profileData // Include for debugging
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