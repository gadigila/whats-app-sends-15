import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
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
    const partnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')! // Your partner token
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: CreateChannelRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🚀 Creating channel for user:', userId)

    // Step 1: Create WHAPI channel via Partner API
    const createResponse = await fetch('https://manager.whapi.cloud/channels/{channel_id}', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${partnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `User-${userId.slice(0, 8)}`, // Unique channel name
        mode: 'trial' // or 'live' based on your needs
      })
    })

    if (!createResponse.ok) {
      throw new Error(`Failed to create channel: ${createResponse.status}`)
    }

    const channelData = await createResponse.json()
    console.log('✅ Channel created:', channelData)

    const channelId = channelData.channel_id
    const channelToken = channelData.token

    // Step 2: 🔧 AUTOMATICALLY configure webhooks for the new channel
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook-simple`
    
    console.log('🔗 Setting up webhooks for channel:', channelId)
    
    const webhookResponse = await fetch(`https://gate.whapi.cloud/settings?token=${channelToken}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhooks: [
          {
            events: [
              {
                type: "users",
                method: "post"
              },
              {
                type: "users", 
                method: "delete"
              },
              {
                type: "messages",
                method: "post"
              }
            ],
            mode: "body",
            url: webhookUrl
          }
        ],
        callback_persist: true,
        callback_backoff_delay_ms: 3000
      })
    })

    if (!webhookResponse.ok) {
      console.error('❌ Failed to set webhook:', webhookResponse.status)
      // Don't fail the entire process, just log the error
    } else {
      console.log('✅ Webhooks configured automatically!')
    }

    // Step 3: Store channel info in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: channelId,
        whapi_token: channelToken,
        instance_status: 'initializing',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError)
      throw new Error('Failed to save channel info')
    }

    // Step 4: Wait for channel to be ready (90 seconds as per WHAPI docs)
    console.log('⏳ Waiting for channel to initialize (90 seconds)...')
    
    // You could implement polling here, but 90 seconds is standard
    await new Promise(resolve => setTimeout(resolve, 90000))
    
    // Update status to ready for QR
    await supabase
      .from('profiles')
      .update({
        instance_status: 'unauthorized', // Ready for QR scan
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        message: 'Channel created with automatic webhook setup',
        webhook_configured: webhookResponse.ok
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Create Channel Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create channel',
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})