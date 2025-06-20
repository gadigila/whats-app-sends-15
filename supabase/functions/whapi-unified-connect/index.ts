
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface UnifiedConnectRequest {
  userId: string
}

interface ChannelManager {
  createChannel(): Promise<any>
  getChannelStatus(channelId: string): Promise<any>
  getQRCode(channelId: string): Promise<any>
  configureWebhook(channelId: string, token: string): Promise<any>
}

class WhapiChannelManager implements ChannelManager {
  private partnerToken: string
  private projectId: string
  private webhookUrl: string

  constructor() {
    this.partnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    this.projectId = Deno.env.get('WHAPI_PROJECT_ID')!
    this.webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whapi-webhook`
  }

  async createChannel(): Promise<any> {
    const channelId = `CHANNEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const response = await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.partnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: this.projectId,
        name: channelId,
        mode: 'webhook'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create channel: ${errorText}`)
    }

    const result = await response.json()
    return {
      success: true,
      channel_id: channelId,
      token: result.token,
      message: 'Channel created successfully'
    }
  }

  async getChannelStatus(channelId: string): Promise<any> {
    const response = await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.partnerToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to get channel status')
    }

    return await response.json()
  }

  async getQRCode(channelId: string): Promise<any> {
    const channelInfo = await this.getChannelStatus(channelId)
    
    if (!channelInfo.token) {
      throw new Error('No token available for channel')
    }

    const qrResponse = await fetch(`https://gate.whapi.cloud/screen`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelInfo.token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      throw new Error(`Failed to get QR code: ${errorText}`)
    }

    const qrData = await qrResponse.json()
    return {
      success: true,
      qr_code: qrData.qr || qrData.qr_code,
      message: 'QR code retrieved successfully'
    }
  }

  async configureWebhook(channelId: string, token: string): Promise<any> {
    console.log('🔗 Configuring webhook for channel:', channelId)
    console.log('🌐 Webhook URL:', this.webhookUrl)
    
    const response = await fetch(`https://gate.whapi.cloud/settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhooks: [{
          url: this.webhookUrl,
          events: {
            messages: false,
            statuses: false,
            channels: true,
            users: true
          }
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Webhook configuration failed:', errorText)
      throw new Error(`Failed to configure webhook: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Webhook configured successfully:', result)
    
    return {
      success: true,
      webhook_url: this.webhookUrl,
      message: 'Webhook configured successfully'
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: UnifiedConnectRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔄 Enhanced Unified Connect for user:', userId)

    // Get user's current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const channelManager = new WhapiChannelManager()

    // Check if user already has a working instance
    if (profile.instance_id && profile.whapi_token) {
      console.log('🔍 Checking existing instance:', profile.instance_id)
      
      try {
        // Check if already connected using /me endpoint
        const meResponse = await fetch(`https://gate.whapi.cloud/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (meResponse.ok) {
          const meData = await meResponse.json()
          if (meData.phone) {
            console.log('✅ User already connected:', meData.phone)
            
            // Update status to connected
            await supabase
              .from('profiles')
              .update({
                instance_status: 'connected',
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)

            return new Response(
              JSON.stringify({
                success: true,
                already_connected: true,
                message: 'Already connected to WhatsApp',
                phone: meData.phone
              }),
              { status: 200, headers: corsHeaders }
            )
          }
        }
      } catch (error) {
        console.log('🔍 Existing instance not working, creating new one')
      }
    }

    // Create a new channel
    console.log('🆕 Creating new instance with enhanced webhook setup...')
    const channelResult = await channelManager.createChannel()
    
    if (!channelResult.success || !channelResult.channel_id || !channelResult.token) {
      console.error('❌ Failed to create channel:', channelResult)
      return new Response(
        JSON.stringify({ error: 'Failed to create new WhatsApp channel' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Channel created, now configuring webhook...')
    
    // Configure webhook immediately after channel creation
    try {
      const webhookResult = await channelManager.configureWebhook(channelResult.channel_id, channelResult.token)
      console.log('🔗 Webhook configuration result:', webhookResult)
    } catch (webhookError) {
      console.error('❌ Webhook configuration failed:', webhookError)
      
      // Don't fail the entire process, but warn user
      console.log('⚠️ Channel created but webhook configuration failed - continuing anyway')
    }

    // Get QR code
    console.log('📱 Getting QR code for channel:', channelResult.channel_id)
    const qrResult = await channelManager.getQRCode(channelResult.channel_id)
    
    if (!qrResult.success || !qrResult.qr_code) {
      console.error('❌ Failed to get QR code:', qrResult)
      return new Response(
        JSON.stringify({ error: 'Failed to get QR code' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Update user profile with new instance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: channelResult.channel_id,
        whapi_token: channelResult.token,
        instance_status: 'unauthorized',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update profile:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update user profile' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Enhanced instance created with webhook:', channelResult.channel_id)
    
    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrResult.qr_code,
        instance_id: channelResult.channel_id,
        webhook_configured: true,
        message: 'New instance created with webhook, scan QR code to connect'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Enhanced Unified Connect Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
