
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface ConnectRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const partnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    const projectId = Deno.env.get('WHAPI_PROJECT_ID')!
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-simple-webhook`
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: ConnectRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🚀 Simple WhatsApp Connect for user:', userId)

    // Check if user already has a working connection
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile?.instance_id && profile?.whapi_token) {
      // Check if already connected
      try {
        const meResponse = await fetch(`https://gate.whapi.cloud/me`, {
          headers: { 'Authorization': `Bearer ${profile.whapi_token}` }
        })

        if (meResponse.ok) {
          const meData = await meResponse.json()
          if (meData.phone) {
            console.log('✅ Already connected:', meData.phone)
            return new Response(
              JSON.stringify({
                success: true,
                already_connected: true,
                phone: meData.phone
              }),
              { status: 200, headers: corsHeaders }
            )
          }
        }
      } catch (error) {
        console.log('🔍 Existing connection not working, creating new one')
      }
    }

    // Create new channel
    const channelId = `CHANNEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('🆕 Creating channel:', channelId)
    
    const createResponse = await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${partnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: projectId,
        name: channelId,
        mode: 'webhook'
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(`Failed to create channel: ${errorText}`)
    }

    const channelData = await createResponse.json()
    console.log('✅ Channel created:', channelData)

    // Configure webhook
    console.log('🔗 Configuring webhook...')
    
    const webhookResponse = await fetch(`https://gate.whapi.cloud/settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${channelData.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhooks: [{
          url: webhookUrl,
          events: {
            messages: false,
            statuses: false,
            channels: true,
            users: true
          }
        }]
      })
    })

    if (webhookResponse.ok) {
      console.log('✅ Webhook configured')
    } else {
      console.log('⚠️ Webhook configuration failed, continuing anyway')
    }

    // Get QR code
    console.log('📱 Getting QR code...')
    
    const qrResponse = await fetch(`https://gate.whapi.cloud/screen`, {
      headers: { 'Authorization': `Bearer ${channelData.token}` }
    })

    if (!qrResponse.ok) {
      throw new Error('Failed to get QR code')
    }

    const qrData = await qrResponse.json()

    // Update user profile
    await supabase
      .from('profiles')
      .update({
        instance_id: channelId,
        whapi_token: channelData.token,
        instance_status: 'unauthorized',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    console.log('✅ Simple connection setup complete')
    
    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrData.qr || qrData.qr_code,
        instance_id: channelId,
        message: 'Scan QR code to connect'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Simple Connect Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Connection failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
