import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface StatusCheckRequest {
  userId?: string
  action?: 'check_user' | 'set_all_offline' // NEW: Add action parameter
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, action }: StatusCheckRequest = await req.json()

    // NEW: Handle cron job action
    if (action === 'set_all_offline') {
      console.log('🔄 Starting automatic presence fix for all users...')
      
      // Get all connected users
      const { data: connectedUsers, error: fetchError } = await supabase
        .from('profiles')
        .select('id, whapi_token, instance_id')
        .eq('instance_status', 'connected')
        .not('whapi_token', 'is', null)

      if (fetchError) {
        console.error('❌ Error fetching users:', fetchError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch users' }),
          { status: 500, headers: corsHeaders }
        )
      }

      if (!connectedUsers || connectedUsers.length === 0) {
        console.log('ℹ️ No connected users found')
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No users to process',
            processed: 0 
          }),
          { status: 200, headers: corsHeaders }
        )
      }

      console.log(`📊 Found ${connectedUsers.length} connected users to process`)

      let successCount = 0
      let errorCount = 0

      // Process each user
      for (const user of connectedUsers) {
        try {
          console.log(`🔧 Setting presence to offline for user ${user.id}...`)
          
          const presenceResponse = await fetch(`https://gate.whapi.cloud/presences/me`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${user.whapi_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              presence: 'offline'
            })
          })

          if (presenceResponse.ok) {
            console.log(`✅ Successfully set offline for user ${user.id}`)
            successCount++
          } else {
            const errorText = await presenceResponse.text()
            console.error(`❌ Failed to set offline for user ${user.id}:`, errorText)
            errorCount++
          }

          // Small delay between users to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))

        } catch (error) {
          console.error(`❌ Error processing user ${user.id}:`, error)
          errorCount++
        }
      }

      const result = {
        success: true,
        message: 'Presence fix completed',
        total_users: connectedUsers.length,
        successful: successCount,
        errors: errorCount,
        timestamp: new Date().toISOString()
      }

      console.log('🎯 Cron job completed:', result)

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: corsHeaders }
      )
    }

    // EXISTING: Check single user status
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required for status check' }),
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

    // Check /health endpoint and ensure phone is stored
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

    // Extract phone number from correct location
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

    // Better connection detection
    const isConnected = !!(
      phoneNumber ||
      healthData?.user?.name ||
      healthData?.me?.name ||
      (healthData?.status === 'connected') ||
      (healthData?.user && Object.keys(healthData.user).length > 0)
    )

    if (isConnected) {
      const userName = healthData?.user?.name || healthData?.me?.name || 'User'
      
      console.log('✅ User is connected:', { phone: cleanPhone, name: userName })
      
      // Update database status AND phone number
      const updateData: any = {
        instance_status: 'connected',
        updated_at: new Date().toISOString()
      }
      
      if (cleanPhone) {
        updateData.phone_number = cleanPhone
        console.log('📱 Storing phone number in database:', cleanPhone)
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
          phone: cleanPhone || profile.phone_number,
          name: userName,
          message: 'WhatsApp is connected',
          phone_stored: !!cleanPhone,
          profile_data: healthData
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Not connected
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
        profile_data: healthData
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