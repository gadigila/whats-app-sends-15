
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface FixWebhookRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔧 WHAPI Fix Webhook Function Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`

    const { userId }: FixWebhookRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Fixing webhook for user:', userId)

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!profile.instance_id || !profile.whapi_token) {
      console.error('❌ No WhatsApp instance found for user')
      return new Response(
        JSON.stringify({ 
          error: 'No WhatsApp instance found',
          message: 'Please create a WhatsApp connection first'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔗 Configuring webhook for instance:', profile.instance_id)
    console.log('🌐 Webhook URL:', webhookUrl)

    // Configure webhook
    const response = await fetch(`https://gate.whapi.cloud/settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
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

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Webhook configuration failed:', errorText)
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid token',
            message: 'Your WhatsApp token is invalid. Please create a new connection.',
            token_invalid: true
          }),
          { status: 400, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to configure webhook',
          details: errorText
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    const result = await response.json()
    console.log('✅ Webhook configured successfully:', result)

    return new Response(
      JSON.stringify({
        success: true,
        webhook_url: webhookUrl,
        message: 'Webhook configured successfully for existing channel',
        instance_id: profile.instance_id
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Fix Webhook Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
