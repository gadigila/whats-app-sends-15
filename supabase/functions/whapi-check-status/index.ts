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
    console.log('📱 Current stored phone:', profile.phone_number || 'none')

    // 🔧 FIXED: Always check /health endpoint and ensure phone is stored
    console.log('📊 Checking /health endpoint...')
    const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('📊 Health response status:', healthResponse.status)

    if (!healthResponse.ok) {
      console.log('❌ Health endpoint failed:', healthResponse.status)
      
      if (healthResponse.status === 401 || healthResponse.status === 403) {
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
          http_status: healthResponse.status
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    const healthData = await healthResponse.json()
    console.log('📊 Health response data:', JSON.stringify(healthData, null, 2))

    // 🎯 FIXED: Extract phone number from correct location
    let phoneNumber = null;
    
    if (healthData?.user?.id) {
      phoneNumber = healthData.user.id;
      console.log('📱 Found phone in user.id:', phoneNumber);
    } else if (healthData?.me?.phone) {
      phoneNumber = healthData.me.phone;
      console.log('📱 Found phone in me.phone:', phoneNumber);
    } else if (healthData?.phone) {
      phoneNumber = healthData.phone;
      console.log('📱 Found phone in phone field:', phoneNumber);
    }

    // Clean phone number if found
    let cleanPhone = null;
    if (phoneNumber) {
      cleanPhone = phoneNumber.replace(/[^\d]/g, '');
      console.log('📱 Cleaned phone number:', cleanPhone);
    }

    // 🔧 ENHANCED: Better connection detection
    const isConnected = !!(
      phoneNumber ||                        // Phone number is the strongest indicator
      healthData?.user?.name ||             // User name indicates connection
      healthData?.me?.name ||               // Alternative user name field
      (healthData?.status === 'connected') || // Explicit connected status
      (healthData?.user && Object.keys(healthData.user).length > 0) // User object exists with data
    )

    if (isConnected) {
      const userName = healthData?.user?.name || healthData?.me?.name || 'User'
      
      console.log('✅ User is connected:', { phone: cleanPhone, name: userName })
      
      // 🚀 CRUCIAL: Update database status AND phone number
      const updateData: any = {
        instance_status: 'connected',
        updated_at: new Date().toISOString()
      }
      
      // 🎯 ALWAYS STORE PHONE NUMBER if we have it
      if (cleanPhone) {
        updateData.phone_number = cleanPhone
        console.log('📱 Storing phone number in database:', cleanPhone)
      } else if (!profile.phone_number) {
        // If no phone found and none stored, log warning
        console.log('⚠️ No phone number found in health response and none stored in DB')
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
          phone: cleanPhone || profile.phone_number, // Return stored phone if current call didn't find one
          name: userName,
          message: 'WhatsApp is connected',
          phone_stored: !!cleanPhone, // Indicate if phone was captured this time
          profile_data: healthData // Include for debugging
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Not connected - profile exists but no user data
    console.log('📊 Health endpoint succeeded but no user data found - likely not connected')

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
        profile_data: healthData // Include for debugging
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