
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
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')
    
    console.log('Create WhatsApp Instance: Starting...')
    console.log('Environment check - WHAPI_PARTNER_TOKEN exists:', !!whapiPartnerToken)
    console.log('Environment check - WHAPI_PARTNER_TOKEN length:', whapiPartnerToken?.length || 0)
    
    if (!whapiPartnerToken) {
      console.error('WHAPI_PARTNER_TOKEN is missing from environment variables')
      return new Response(
        JSON.stringify({ error: 'WHAPI Partner token not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, webhookUrl }: CreateInstanceRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Creating WHAPI channel for user:', userId)
    console.log('Using webhook URL:', webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-webhook`)

    // Create new channel via WHAPI Partner API
    const channelData = {
      name: `reecher_user_${userId}`,
      webhook_url: webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-webhook`
    }

    console.log('Sending request to WHAPI Partner API...')
    console.log('Request payload:', JSON.stringify(channelData, null, 2))

    const whapiResponse = await fetch('https://partner-api.whapi.cloud/api/v1/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(channelData)
    })

    console.log('WHAPI Response status:', whapiResponse.status)
    console.log('WHAPI Response headers:', JSON.stringify(Object.fromEntries(whapiResponse.headers.entries())))

    if (!whapiResponse.ok) {
      const errorText = await whapiResponse.text()
      console.error('WHAPI channel creation failed:', errorText)
      console.error('Response status:', whapiResponse.status)
      console.error('Response statusText:', whapiResponse.statusText)
      return new Response(
        JSON.stringify({ error: 'Failed to create WhatsApp instance', details: errorText, status: whapiResponse.status }),
        { status: 400, headers: corsHeaders }
      )
    }

    const whapiData = await whapiResponse.json()
    console.log('WHAPI channel created successfully:', { 
      instance_id: whapiData.instance_id,
      hasToken: !!whapiData.token 
    })

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
        JSON.stringify({ error: 'Failed to save instance data', details: updateError.message }),
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
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
