
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetQrRequest {
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: GetQrRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!whapiPartnerToken) {
      console.error('❌ Missing WHAPI partner token')
      return new Response(
        JSON.stringify({ error: 'WHAPI partner token not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('📱 Getting QR for user:', userId)

    // Get user instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.instance_id) {
      console.error('❌ No instance found for user:', userId)
      return new Response(
        JSON.stringify({ error: 'No instance found. Please create an instance first.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Found instance ID:', profile.instance_id)

    // First, verify the instance exists on WHAPI's side
    console.log('🔍 Verifying instance exists on WHAPI...')
    const verifyResponse = await fetch('https://gateway.whapi.cloud/partner/v1/instances', {
      headers: {
        'x-api-key': whapiPartnerToken
      }
    })

    if (verifyResponse.ok) {
      const instances = await verifyResponse.json()
      const instanceExists = instances?.some((inst: any) => 
        inst.instanceId === profile.instance_id || inst.id === profile.instance_id
      )
      
      if (!instanceExists) {
        console.error('❌ Instance not found on WHAPI side, cleaning up database...')
        
        // Clean up the database
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        return new Response(
          JSON.stringify({ 
            error: 'Instance no longer exists on WHAPI. Please create a new instance.',
            requiresNewInstance: true
          }),
          { status: 400, headers: corsHeaders }
        )
      }
    }

    console.log('📡 Getting QR with Partner Token...')

    // Get QR code from instance using Partner Token
    const qrResponse = await fetch(`https://gateway.whapi.cloud/partner/v1/instances/${profile.instance_id}/qr`, {
      headers: {
        'x-api-key': whapiPartnerToken
      }
    })

    console.log('📥 QR response status:', qrResponse.status)

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('❌ QR request failed:', {
        status: qrResponse.status,
        error: errorText,
        instanceId: profile.instance_id
      })

      // If it's a 404, the instance probably doesn't exist
      if (qrResponse.status === 404) {
        console.log('🗑️ Instance not found (404), cleaning up database...')
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        return new Response(
          JSON.stringify({ 
            error: 'Instance not found. Please create a new instance.',
            requiresNewInstance: true
          }),
          { status: 400, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get QR code', 
          details: `Status: ${qrResponse.status}, Error: ${errorText}` 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const qrData = await qrResponse.json()
    console.log('📥 QR data received:', {
      hasImage: !!qrData?.image,
      hasQrCode: !!qrData?.qr_code,
      keys: Object.keys(qrData || {})
    })

    const qrImageUrl = qrData?.image || qrData?.qr_code

    if (!qrImageUrl) {
      console.error('❌ No QR image in response:', qrData)
      return new Response(
        JSON.stringify({ error: 'No QR code available', responseData: qrData }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ QR code retrieved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrImageUrl,
        instance_id: profile.instance_id
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Get QR Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
