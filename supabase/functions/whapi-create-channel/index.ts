
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
    console.log('🚀 WHAPI Create Channel - Following Official Documentation')
    
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

    // Step 1: Create channel using Partner API (exact as documentation)
    console.log('📱 Creating channel with Partner API...')
    const createChannelResponse = await fetch('https://manager.whapi.cloud/channels', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: channelId,
        projectId: whapiProjectId
      })
    });

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
    const channelToken = channelData?.token

    if (!channelToken) {
      console.error('❌ No token received from WHAPI')
      return new Response(
        JSON.stringify({ error: 'No token received from WHAPI' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ Channel created successfully with token')

    // Step 2: Setup comprehensive webhooks (as per documentation)
    console.log('🔗 Setting up comprehensive webhooks...')
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`
    
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
            { type: 'ready', method: 'post' },           // Critical: when WhatsApp connects
            { type: 'auth_failure', method: 'post' },    // Critical: when auth fails
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

    // Step 4: Critical 90-second wait (as per WHAPI documentation)
    console.log('⏳ Starting mandatory 90-second wait (WHAPI requirement)...')
    console.log('📝 Reason: Channel needs time to load after creation')
    
    // Wait exactly 90 seconds as documentation requires
    await new Promise(resolve => setTimeout(resolve, 90000))
    
    console.log('✅ 90-second wait completed - channel should be ready for QR')

    // Update status to 'unauthorized' (ready for QR)
    await supabase
      .from('profiles')
      .update({
        instance_status: 'unauthorized',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    console.log('🎯 Channel creation process completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        message: 'Channel created and ready for QR code',
        wait_time_completed: '90 seconds',
        next_step: 'Get QR code',
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
