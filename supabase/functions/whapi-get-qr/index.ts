
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
    const whapiPartnerEmail = Deno.env.get('WHAPI_PARTNER_EMAIL')!
    const whapiPartnerPassword = Deno.env.get('WHAPI_PARTNER_PASSWORD')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: GetQrRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
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

    // Login as partner to get access token
    console.log('🔑 Logging in as partner...')
    const loginResponse = await fetch('https://gateway.whapi.cloud/partner/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: whapiPartnerEmail,
        password: whapiPartnerPassword
      })
    })

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text()
      console.error('❌ Partner login failed:', {
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
    const partnerAccessToken = loginData?.token

    if (!partnerAccessToken) {
      return new Response(
        JSON.stringify({ error: 'No access token received' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ Partner login successful, getting QR...')

    // Get QR code from instance
    const qrResponse = await fetch(`https://gateway.whapi.cloud/partner/v1/instances/${profile.instance_id}/qr`, {
      headers: {
        'Authorization': `Bearer ${partnerAccessToken}`
      }
    })

    console.log('📥 QR response status:', qrResponse.status)

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('❌ QR request failed:', {
        status: qrResponse.status,
        error: errorText
      })
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
