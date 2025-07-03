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
      .select('whapi_token, instance_id, instance_status, phone_number')
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

    console.log('📊 Current DB status:', profile.instance_status)

    // 🔧 FIXED: Use /users/profile endpoint to detect connection
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
      
      // If unauthorized, update DB status
      if (profileResponse.status === 401 || profileResponse.status === 403) {
        await supabase
          .from('profiles')
          .update({
            instance_status: 'unauthorized',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
      }
      
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
    console.log('📊 Profile response data:', JSON.stringify(profileData, null, 2))

    // 🔧 ENHANCED: Better connection detection
    const isConnected = !!(
      profileData.phone ||                     // Phone number is the strongest indicator
      profileData.name ||                      // Profile name indicates connection
      profileData.id ||                        // WhatsApp ID indicates connection
      (profileData.about !== undefined &&     // Profile data exists
       profileData.status !== 'unauthorized') // And not unauthorized
    )

    if (isConnected) {
      const phoneNumber = profileData.phone || profileData.id || 'Connected'
      const userName = profileData.name || 'User'
      
      console.log('✅ User is connected:', { phone: phoneNumber, name: userName })
      
      // 🚀 CRUCIAL: Update database status AND phone number
      const updateData: any = {
        instance_status: 'connected',
        updated_at: new Date().toISOString()
      }
      
      // 🎯 NEW: Save phone number if we have it
      if (phoneNumber && phoneNumber !== 'Connected') {
        updateData.phone_number = phoneNumber
        console.log('📱 Saving phone number to database:', phoneNumber)
      }
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)

      if (updateError) {
        console.error('❌ Failed to update database:', updateError)
      } else {
        console.log('✅ Database updated with connection status and phone number')
      }

      return new Response(
        JSON.stringify({
          connected: true,
          status: 'connected',
          phone: phoneNumber,
          name: userName,
          message: 'WhatsApp is connected',
          profile_data: profileData // Include for debugging
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Not connected - profile exists but no user data
    console.log('📊 Profile endpoint succeeded but no user data found - likely not connected')

    await supabase
      .from('profiles')
      .update({
        instance_status: 'unauthorized',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    return new Response(
      JSON.stringify({
        connected: false,
        status: 'unauthorized',
        message: 'WhatsApp not connected - no profile data',
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