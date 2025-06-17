
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
    const whapiPartnerEmail = Deno.env.get('WHAPI_PARTNER_EMAIL')!
    const whapiPartnerPassword = Deno.env.get('WHAPI_PARTNER_PASSWORD')!
    
    console.log('🔐 WHAPI Partner Login: Starting...')
    
    if (!whapiPartnerToken || !whapiPartnerEmail || !whapiPartnerPassword) {
      console.error('❌ Missing WHAPI partner credentials')
      return new Response(
        JSON.stringify({ error: 'WHAPI partner credentials not configured' }),
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

    // Step 1: Login to WHAPI Partner API to get access token
    console.log('🔑 Authenticating with WHAPI Partner API...')
    const loginResponse = await fetch('https://gateway.whapi.cloud/partner/v1/auth/login', {
      method: 'POST',
      headers: {
        'x-api-key': whapiPartnerToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: whapiPartnerEmail,
        password: whapiPartnerPassword
      })
    })

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text()
      console.error('❌ WHAPI login failed:', {
        status: loginResponse.status,
        error: errorText
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to authenticate with WHAPI', 
          details: `Status: ${loginResponse.status}, Error: ${errorText}` 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const loginData = await loginResponse.json()
    const accessToken = loginData?.accessToken || loginData?.access_token

    if (!accessToken) {
      console.error('❌ No access token received from WHAPI login:', loginData)
      return new Response(
        JSON.stringify({ error: 'No access token received from WHAPI' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ WHAPI authentication successful')

    // Step 2: Check existing instances
    console.log('🔍 Checking existing instances...')
    const instancesResponse = await fetch('https://gateway.whapi.cloud/partner/v1/instances', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!instancesResponse.ok) {
      const errorText = await instancesResponse.text()
      console.error('❌ Failed to list instances:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to list instances' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const existingInstances = await instancesResponse.json()
    console.log('📋 Found existing instances:', existingInstances?.length || 0)

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
            message: 'Instance already exists and is valid',
            access_token: accessToken
          }),
          { status: 200, headers: corsHeaders }
        )
      }
    }

    // Step 3: Create new instance
    console.log('🏗️ Creating new instance...')
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`
    
    const createInstanceResponse = await fetch('https://gateway.whapi.cloud/partner/v1/instances', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
      responseKeys: Object.keys(instanceData || {})
    })

    const instanceId = instanceData?.instanceId || instanceData?.id

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

    // Step 4: Save instance data to user profile
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    console.log('💾 Saving instance data to database...')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: instanceId,
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
            'Authorization': `Bearer ${accessToken}`
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
        access_token: accessToken,
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
