
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateInstanceRequest {
  userId: string
  webhookUrl?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Create WhatsApp Instance: Starting...')

    const { userId, webhookUrl }: CreateInstanceRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Creating WHAPI channel for user:', userId)

    // Create new channel via WHAPI Partner API
    const channelData = {
      name: `reecher_user_${userId}`,
      webhook_url: webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-webhook`
    }

    const whapiResponse = await fetch('https://partner-api.whapi.cloud/api/v1/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(channelData)
    })

    if (!whapiResponse.ok) {
      const errorText = await whapiResponse.text()
      console.error('WHAPI channel creation failed:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create WhatsApp instance', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const whapiData = await whapiResponse.json()
    console.log('WHAPI channel created:', { instance_id: whapiData.instance_id })

    // Calculate trial expiration (3 days from now)
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    // Update user profile with instance details
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: whapiData.instance_id,
        whapi_token: whapiData.token,
        instance_status: 'created',
        payment_plan: 'trial',
        trial_expires_at: trialExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to update user profile:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to save instance data' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('User profile updated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        instance_id: whapiData.instance_id,
        trial_expires_at: trialExpiresAt,
        message: 'WhatsApp instance created successfully'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Create WhatsApp Instance Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
