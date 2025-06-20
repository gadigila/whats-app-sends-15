
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    const whapiProjectId = Deno.env.get('WHAPI_PROJECT_ID')!
    
    console.log('🔐 WHAPI Channel Creation: Starting...')
    console.log('🔍 Environment check:', {
      hasPartnerToken: !!whapiPartnerToken,
      hasProjectId: !!whapiProjectId
    })
    
    if (!whapiPartnerToken || !whapiProjectId) {
      console.error('❌ Missing WHAPI configuration')
      return new Response(
        JSON.stringify({ error: 'WHAPI configuration missing' }),
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

    // If user already has a valid instance, return it
    if (profile?.instance_id && profile?.whapi_token && profile?.instance_status !== 'disconnected') {
      console.log('✅ User already has existing instance:', profile.instance_id, 'Status:', profile.instance_status)
      return new Response(
        JSON.stringify({
          success: true,
          channel_id: profile.instance_id,
          message: 'Using existing instance',
          channel_ready: profile.instance_status === 'unauthorized' || profile.instance_status === 'connected'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('🏗️ Creating new channel...')

    // Generate unique channel ID
    const channelId = `REECHER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    console.log('🆔 Generated channel ID:', channelId)

    // Create new channel using Manager API with correct format
    const createChannelPayload = {
      name: channelId,
      projectId: whapiProjectId
    }

    console.log('📤 Creating channel with payload:', createChannelPayload)

    const createChannelResponse = await fetch('https://manager.whapi.cloud/channels', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createChannelPayload)
    })

    console.log('📥 Channel creation response status:', createChannelResponse.status)

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text()
      console.error('❌ Channel creation failed:', {
        status: createChannelResponse.status,
        error: errorText,
        payload: createChannelPayload
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create channel', 
          details: `Status: ${createChannelResponse.status}, Error: ${errorText}` 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const channelData = await createChannelResponse.json()
    console.log('✅ Channel created successfully:', {
      hasToken: !!channelData?.token,
      hasId: !!channelData?.id,
      channelId: channelData?.id || channelId
    })

    const finalChannelId = channelData?.id || channelId
    const channelToken = channelData?.token

    if (!channelToken) {
      console.error('❌ No token received from WHAPI:', channelData)
      return new Response(
        JSON.stringify({ 
          error: 'No token received from WHAPI'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

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

      if (webhookResponse.ok) {
        console.log('✅ Webhook setup successful')
      } else {
        console.error('⚠️ Webhook setup failed:', webhookResponse.status)
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

    // Wait a bit for channel to initialize
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check channel status
    let channelReady = false;
    try {
      const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        console.log('📊 Channel status:', statusData)
        
        if (statusData.status === 'qr' || statusData.status === 'unauthorized' || statusData.status === 'ready') {
          channelReady = true
          
          // Update status to unauthorized
          await supabase
            .from('profiles')
            .update({
              instance_status: 'unauthorized',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
        }
      }
    } catch (statusError) {
      console.log('⚠️ Status check failed:', statusError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: finalChannelId,
        project_id: whapiProjectId,
        trial_expires_at: trialExpiresAt,
        channel_ready: channelReady,
        message: channelReady ? 'Channel created and ready' : 'Channel created, initializing...',
        webhook_url: webhookUrl
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
