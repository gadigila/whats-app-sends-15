
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

    // First, verify the Partner Token works by checking partner info
    console.log('🔍 Verifying Partner Token...')
    const verifyResponse = await fetch('https://gateway.whapi.cloud/partner/v1/instances', {
      headers: {
        'x-api-key': whapiPartnerToken
      }
    })

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text()
      console.error('❌ Partner Token verification failed:', {
        status: verifyResponse.status,
        error: errorText
      })
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Partner Token or insufficient permissions', 
          details: `Status: ${verifyResponse.status}, Error: ${errorText}` 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const existingInstances = await verifyResponse.json()
    console.log('✅ Partner Token verified. Existing instances:', existingInstances?.length || 0)

    // Check if user already has an instance in our database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id')
      .eq('id', userId)
      .single()

    if (profile?.instance_id) {
      console.log('🔍 User has existing instance in DB:', profile.instance_id)
      
      // Verify if this instance still exists on WHAPI's side
      const existsOnWhapi = existingInstances?.some((inst: any) => 
        inst.instanceId === profile.instance_id || inst.id === profile.instance_id
      )
      
      if (!existsOnWhapi) {
        console.log('🗑️ Instance exists in DB but not on WHAPI. Cleaning up...')
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
      } else {
        console.log('✅ Instance exists on both sides, no need to create new one')
        return new Response(
          JSON.stringify({
            success: true,
            instance_id: profile.instance_id,
            message: 'Instance already exists and is valid'
          }),
          { status: 200, headers: corsHeaders }
        )
      }
    }

    console.log('🏗️ Creating new instance with Partner Token...')

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
          error: 'Failed to create instance on WHAPI', 
          details: `Status: ${createInstanceResponse.status}, Error: ${errorText}` 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const instanceData = await createInstanceResponse.json()
    console.log('✅ Instance created successfully:', {
      hasInstanceId: !!instanceData?.instanceId || !!instanceData?.id,
      hasToken: !!instanceData?.token,
      responseKeys: Object.keys(instanceData || {})
    })

    const instanceId = instanceData?.instanceId || instanceData?.id
    const instanceToken = instanceData?.token

    if (!instanceId) {
      console.error('❌ No instance ID received from WHAPI:', instanceData)
      return new Response(
        JSON.stringify({ 
          error: 'No instance ID received from WHAPI', 
          responseData: instanceData 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Save instance data to user profile ONLY after successful creation
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
      
      // Attempt to delete the created instance since we couldn't save it
      try {
        await fetch(`https://gateway.whapi.cloud/partner/v1/instances/${instanceId}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': whapiPartnerToken
          }
        })
        console.log('🗑️ Cleaned up instance from WHAPI due to DB error')
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup instance:', cleanupError)
      }
      
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
