
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface ValidateWebhookRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔍 WHAPI Validate Webhook Function Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`

    const { userId }: ValidateWebhookRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Validating webhook for user:', userId)

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

    console.log('🔍 Checking webhook configuration for instance:', profile.instance_id)

    // Get current webhook settings
    const response = await fetch(`https://gate.whapi.cloud/settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed to get webhook settings:', errorText)
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid token',
            message: 'Your WhatsApp token is invalid',
            token_invalid: true,
            webhook_valid: false
          }),
          { status: 400, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get webhook settings',
          details: errorText,
          webhook_valid: false
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    const settings = await response.json()
    console.log('📋 Current webhook settings:', settings)

    // Check if webhook is properly configured
    const webhooks = settings.webhooks || []
    const webhookConfigured = webhooks.some((webhook: any) => 
      webhook.url === expectedWebhookUrl && 
      webhook.events?.channels === true
    )

    console.log('🔍 Webhook validation result:', {
      expectedUrl: expectedWebhookUrl,
      currentWebhooks: webhooks,
      isConfigured: webhookConfigured
    })

    return new Response(
      JSON.stringify({
        success: true,
        webhook_valid: webhookConfigured,
        expected_url: expectedWebhookUrl,
        current_webhooks: webhooks,
        message: webhookConfigured ? 
          'Webhook is properly configured' : 
          'Webhook is not configured or incorrect',
        instance_id: profile.instance_id
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Validate Webhook Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        webhook_valid: false
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
