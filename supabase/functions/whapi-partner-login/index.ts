
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PartnerLoginRequest {
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
    
    console.log('🔐 WHAPI Partner Login: Starting...')
    console.log('🔍 Environment check:', {
      hasToken: !!whapiPartnerToken,
      tokenLength: whapiPartnerToken ? whapiPartnerToken.length : 0
    })
    
    if (!whapiPartnerToken) {
      console.error('❌ Missing WHAPI partner token')
      return new Response(
        JSON.stringify({ error: 'WHAPI partner token not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: PartnerLoginRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🏗️ Creating instance with Partner Token...')

    // Create new instance using Partner Token
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`
    
    console.log('🏗️ Creating instance with webhook:', webhookUrl)
    const createInstanceResponse = await fetch('https://gateway.whapi.cloud/partner/v1/instances', {
      method: 'POST',
      headers: {
        'x-api-key': whapiPartnerToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `reecher_user_${userId}`,
        webhook: webhookUrl
      })
    })

    console.log('📥 Instance creation response status:', createInstanceResponse.status)

    if (!createInstanceResponse.ok) {
      const errorText = await createInstanceResponse.text()
      console.error('❌ Instance creation failed:', {
        status: createInstanceResponse.status,
        error: errorText
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create instance', 
          details: `Status: ${createInstanceResponse.status}, Error: ${errorText}` 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const instanceData = await createInstanceResponse.json()
    console.log('✅ Instance created:', {
      hasInstanceId: !!instanceData?.instanceId || !!instanceData?.id,
      hasToken: !!instanceData?.token
    })

    const instanceId = instanceData?.instanceId || instanceData?.id
    const instanceToken = instanceData?.token

    if (!instanceId) {
      console.error('❌ No instance ID received from WHAPI')
      return new Response(
        JSON.stringify({ error: 'No instance ID received from WHAPI' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Save instance data to user profile
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    console.log('💾 Saving instance data to database...')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: instanceId,
        whapi_token: instanceToken,
        instance_status: 'created',
        payment_plan: 'trial',
        trial_expires_at: trialExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to save instance data', details: updateError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Instance creation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        instance_id: instanceId,
        trial_expires_at: trialExpiresAt,
        message: 'Instance created successfully'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Partner Login Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
