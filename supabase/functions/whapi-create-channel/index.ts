
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
}

interface CreateChannelRequest {
  userId: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('🚀 WHAPI Create Channel - Using Health Polling (Following WHAPI Best Practices)')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    const whapiProjectId = Deno.env.get('WHAPI_PROJECT_ID')!
    
    if (!supabaseUrl || !supabaseServiceKey || !whapiPartnerToken || !whapiProjectId) {
      console.error('❌ Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration missing' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { userId }: CreateChannelRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Creating channel for user:', userId)

    // Check if user already has a valid channel
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Clean up any existing invalid channel
    if (profile?.instance_id) {
      console.log('🧹 Cleaning up existing channel before creating new one')
      await supabase
        .from('profiles')
        .update({
          instance_id: null,
          whapi_token: null,
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    // Generate unique channel ID
    const channelId = `REECHER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    console.log('🆔 Generated channel ID:', channelId)

    // Step 1: Create channel using Partner API
          console.log('📱 Creating channel with Partner API...')
          const createChannelResponse = await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: channelName,
          project_id: whapiProjectId,
          mode: 'TRIAL'  // חשוב להוסיף!
        })
      })
   // const createChannelResponse = await fetch('https://manager.whapi.cloud/channels', {
    //  method: 'PUT',
    //  headers: {
    //    'Authorization': `Bearer ${whapiPartnerToken}`,
    //    'Content-Type': 'application/json'
    //  },
   //   body: JSON.stringify({
   //     name: channelId,
  //      projectId: whapiProjectId
  //    })
 //   });

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text()
      console.error('❌ Channel creation failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create channel', 
          details: errorText 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const channelData = await createChannelResponse.json()
    console.log('📊 Channel data received:', channelData)

    // חשוב: הטוקן מגיע כ-channel_id ולא כ-token
    const channelToken = channelData.id || channelId // השתמש ב-channelId כטוקן

        if (!channelToken) {
      console.error('❌ No channel ID received from WHAPI')
      return new Response(
        JSON.stringify({ error: 'No channel ID received from WHAPI' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ Channel created successfully with ID/token:', channelToken)

    // Step 2: Setup webhooks
    console.log('🔗 Setting up webhooks...')
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook-simple`
    
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
            { type: 'messages', method: 'post' },
            { type: 'statuses', method: 'post' },
            { type: 'ready', method: 'post' },
            { type: 'auth_failure', method: 'post' },
            { type: 'chats', method: 'post' },
            { type: 'groups', method: 'post' },
            { type: 'contacts', method: 'post' }
          ],
          callback_persist: true,
          callback_backoff_delay_ms: 3000,
          max_callback_backoff_delay_ms: 900000
        }]
      })
    })

    if (!webhookResponse.ok) {
      const webhookError = await webhookResponse.text()
      console.error('⚠️ Webhook setup failed:', webhookError)
    } else {
      console.log('✅ Webhooks configured successfully')
    }

    // Step 3: Save to database with 'initializing' status
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: channelId,
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
        JSON.stringify({ error: 'Failed to save channel data' }),
        { status: 500, headers: corsHeaders }
      )
    }

              // Step 4: Poll /health until channel is ready
          console.log('🔍 Starting health polling until channel is ready...')
          
          let healthStatus = 'initializing'
          let pollAttempts = 0
          const maxPollAttempts = 24 // 2 minutes with 5-second intervals
          
          while (pollAttempts < maxPollAttempts && !['qr', 'unauthorized', 'connected', 'QR'].includes(healthStatus)) {
            pollAttempts++
            console.log(`🔍 Health check attempt ${pollAttempts}/${maxPollAttempts}...`)
          
            try {
              const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${channelToken}`,
                  'Content-Type': 'application/json'
                }
              })
          
              if (healthResponse.ok) {
                const healthData = await healthResponse.json()
                healthStatus = typeof healthData.status === 'object' ? healthData.status.text : healthData.status
                console.log(`📊 Health status: ${healthStatus}`)
              } else {
                console.log(`⚠️ Health check failed: ${healthResponse.status}`)
              }
            } catch (error) {
              console.log(`⚠️ Health check error: ${error.message}`)
            }
          
            if (pollAttempts < maxPollAttempts) {
              await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
            }
          }
          
          // ✅ After polling ends, determine final status
          let finalStatus = 'initializing'
          const normalizedStatus = (healthStatus || '').toLowerCase()
          
          if (normalizedStatus === 'connected') {
            finalStatus = 'connected'
          } else if (['qr', 'unauthorized'].includes(normalizedStatus)) {
            finalStatus = 'unauthorized'
          } else {
            console.log(`⚠️ Channel did not become ready in time. Final health status: ${normalizedStatus}`)
          }

      
    await supabase
      .from('profiles')
      .update({
        instance_status: finalStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    console.log(`🎯 Channel creation completed with final status: ${finalStatus}`)

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        final_status: finalStatus,
        health_polls: pollAttempts,
        message: finalStatus === 'connected' ? 'Channel created and already connected' : 'Channel created and ready for QR code',
        next_step: finalStatus === 'connected' ? 'Already connected' : 'Get QR code',
        webhook_configured: true
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
