import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateChannelRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 WHAPI Partner Login Function Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    const whapiProjectId = Deno.env.get('WHAPI_PROJECT_ID')!
    
    console.log('🔍 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasPartnerToken: !!whapiPartnerToken,
      hasProjectId: !!whapiProjectId,
      partnerTokenPrefix: whapiPartnerToken ? whapiPartnerToken.substring(0, 8) + '...' : 'missing',
      projectId: whapiProjectId || 'missing'
    })
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { status: 500, headers: corsHeaders }
      )
    }
    
    if (!whapiPartnerToken || !whapiProjectId) {
      console.error('❌ Missing WHAPI configuration')
      return new Response(
        JSON.stringify({ error: 'WHAPI configuration missing' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    let userId: string;
    try {
      const requestBody = await req.json()
      userId = requestBody?.userId
      console.log('📋 Request parsed:', { userId, hasUserId: !!userId })
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!userId) {
      console.error('❌ Missing userId in request')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Processing request for user:', userId)

    // Check if user already has a valid instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, updated_at')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Current profile:', {
      hasInstanceId: !!profile?.instance_id,
      hasToken: !!profile?.whapi_token,
      status: profile?.instance_status,
      lastUpdated: profile?.updated_at
    })

    // Enhanced validation of existing instance
    if (profile?.instance_id && profile?.whapi_token && profile?.instance_status !== 'disconnected') {
      console.log('🔍 Verifying existing instance:', profile.instance_id)
      
      try {
        // FIXED: Use correct endpoint and method for health check
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        console.log('📊 Health check response:', healthResponse.status)
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          console.log('📊 Health check data:', healthData)
          
          // Check if channel is functional
          if (healthData && (healthData.status !== 'error' && healthData.status !== 'failed')) {
            console.log('✅ Existing instance is valid, returning it')
            return new Response(
              JSON.stringify({
                success: true,
                channel_id: profile.instance_id,
                message: 'Using existing valid instance',
                channel_ready: healthData.status === 'unauthorized' || healthData.status === 'connected' || healthData.status === 'qr',
                existing_instance: true
              }),
              { status: 200, headers: corsHeaders }
            )
          }
        }
        
        console.log('⚠️ Existing instance is invalid, will clean up and create new one')
        
        // Clean up invalid instance from database
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          
        console.log('🧹 Cleaned up invalid instance from database')
        
      } catch (verifyError) {
        console.log('⚠️ Failed to verify existing instance:', verifyError.message)
        
        // Clean up unverifiable instance
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          
        console.log('🧹 Cleaned up unverifiable instance from database')
      }
    }

    console.log('🏗️ Creating new channel...')

    // Generate unique channel ID
    const channelId = `REECHER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    console.log('🆔 Generated channel ID:', channelId)

    // Create new channel using Manager API
    const createChannelPayload = {
      name: channelId,
      projectId: whapiProjectId
    }

    console.log('📤 Creating channel with payload:', createChannelPayload)

    let createChannelResponse;
    try {
      createChannelResponse = await fetch('https://manager.whapi.cloud/channels', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createChannelPayload)
      });
      
      console.log('📥 Channel creation response status:', createChannelResponse.status)
      
    } catch (fetchError) {
      console.error('❌ Network error calling WHAPI:', fetchError)
      return new Response(
        JSON.stringify({ 
          error: 'Network error connecting to WHAPI', 
          details: fetchError.message 
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text()
      console.error('❌ Channel creation failed:', {
        status: createChannelResponse.status,
        statusText: createChannelResponse.statusText,
        error: errorText
      })
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create channel with WHAPI', 
          details: `Status: ${createChannelResponse.status}, Error: ${errorText}`,
          whapiError: true
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    let channelData;
    try {
      channelData = await createChannelResponse.json()
      console.log('✅ Channel created successfully:', channelData)
    } catch (jsonError) {
      console.error('❌ Failed to parse WHAPI response as JSON:', jsonError)
      const responseText = await createChannelResponse.text()
      console.error('❌ Raw response text:', responseText)
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response from WHAPI',
          details: responseText
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const finalChannelId = channelData?.id || channelId
    const channelToken = channelData?.token

    if (!channelToken || !finalChannelId) {
      console.error('❌ No token or id received from WHAPI:', channelData)
      return new Response(
        JSON.stringify({ 
          error: 'Incomplete data received from WHAPI',
          details: channelData
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🎯 Channel creation successful:', {
      channelId: finalChannelId,
      hasToken: !!channelToken
    })

    // Setup webhook
    console.log('🔗 Setting up webhook for channel:', finalChannelId)
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`
    
    try {
      const webhookResponse = await fetch(`https://gate.whapi.cloud/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhooks: [{
            url: webhookUrl,
            events: [
              {"type": "users", "method": "post"},
              {"type": "channel", "method": "post"}
            ],
            callback_persist: true
          }]
        })
      })

      console.log('🔗 Webhook setup response:', webhookResponse.status)
      if (!webhookResponse.ok) {
        const webhookError = await webhookResponse.text()
        console.error('⚠️ Webhook setup failed:', webhookError)
      }
    } catch (webhookError) {
      console.error('⚠️ Webhook setup error:', webhookError)
    }

    // Save channel data with 'initializing' status
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    
    console.log('💾 Saving channel data to database...')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: finalChannelId,
        whapi_token: channelToken,
        instance_status: 'initializing',
        payment_plan: 'trial',
        trial_expires_at: trialExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Database update failed:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save channel data to database', 
          details: updateError.message 
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Database updated successfully')

    // ENHANCED: Extended polling with better retry logic and exponential backoff
    console.log('⏳ Starting enhanced channel initialization polling with extended timeout...')
    
    let channelReady = false;
    let pollingAttempts = 0;
    const maxPollingAttempts = 30; // Extended from 15 to 30 (90 seconds total)
    
    while (!channelReady && pollingAttempts < maxPollingAttempts) {
      pollingAttempts++;
      console.log(`🔄 Enhanced polling attempt ${pollingAttempts}/${maxPollingAttempts}...`)
      
      // Progressive delay with exponential backoff
      const baseDelay = 2000; // 2 seconds base
      const maxDelay = 5000; // 5 seconds max
      const delayMs = Math.min(baseDelay + (pollingAttempts * 300), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      try {
        console.log('📊 Checking channel health...')
        
        // FIXED: Use health endpoint instead of status
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${channelToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        console.log('📊 Health check response:', healthResponse.status)
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          console.log('📊 Channel health data:', healthData)
          
          // IMPROVED: Better status mapping and multiple success conditions
          const readyStatuses = ['qr', 'unauthorized', 'ready', 'active', 'launched', 'connected']
          
          if (healthData.status && readyStatuses.includes(healthData.status)) {
            channelReady = true
            console.log('🎉 Channel is ready for connection! Status:', healthData.status)
            
            // Update status to unauthorized (ready for QR)
            await supabase
              .from('profiles')
              .update({
                instance_status: 'unauthorized',
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
              
            console.log('✅ Updated database status to unauthorized')
            break;
          } else if (healthData.status === 'connected') {
            channelReady = true
            console.log('🎉 Channel is already connected!')
            
            await supabase
              .from('profiles')
              .update({
                instance_status: 'connected',
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
              
            console.log('✅ Updated database status to connected')
            break;
          } else if (healthData.status === 'initializing' || healthData.status === 'creating') {
            console.log('⏳ Channel still initializing, continuing to poll...')
          } else if (healthData.status === 'error' || healthData.status === 'failed') {
            console.error('❌ Channel failed to initialize:', healthData)
            break;
          } else {
            console.log('📊 Unknown status, continuing to poll:', healthData.status)
          }
        } else if (healthResponse.status === 404) {
          console.log('📊 Channel not found yet, likely still initializing...')
        } else {
          const errorText = await healthResponse.text()
          console.log('⚠️ Health check failed:', healthResponse.status, errorText)
        }
      } catch (healthError) {
        console.log('⚠️ Health check error:', healthError.message)
        
        // Don't break on network errors, continue polling
        if (pollingAttempts < maxPollingAttempts) {
          console.log('🔄 Continuing polling despite error...')
        }
      }
    }

    // Final status update with better handling
    if (!channelReady) {
      console.log('⚠️ Channel initialization timeout after', pollingAttempts, 'attempts (90 seconds)')
      
      // Keep as initializing but mark timeout reached
      await supabase
        .from('profiles')
        .update({
          instance_status: 'initializing',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    console.log('🎯 Function completed:', {
      channelId: finalChannelId,
      channelReady,
      pollingAttempts,
      totalTimeSeconds: pollingAttempts * 3
    })

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: finalChannelId,
        project_id: whapiProjectId,
        trial_expires_at: trialExpiresAt,
        channel_ready: channelReady,
        polling_attempts: pollingAttempts,
        total_wait_time: `${pollingAttempts * 3} seconds`,
        message: channelReady ? 'Channel created and ready for QR' : 'Channel created, may still be initializing. You can try getting QR code now.',
        webhook_url: webhookUrl,
        timeout_reached: !channelReady && pollingAttempts >= maxPollingAttempts
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Channel Creation Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
