
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetQrRequest {
  userId: string
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Get WhatsApp QR: Starting...')

    const { userId }: GetQrRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Getting QR for user:', userId)

    // Get user's instance details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.instance_id || !profile?.whapi_token) {
      console.error('User profile not found or missing instance data:', profileError)
      return new Response(
        JSON.stringify({ error: 'No WhatsApp instance found for user' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('Getting QR from WHAPI using channel token...')
    console.log('Instance ID:', profile.instance_id)

    // Get QR code using the channel token (NOT partner token!)
    const qrResponse = await fetch(`https://gate.whapi.cloud/instance/qr?id=${profile.instance_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Accept': 'application/json'
      }
    })

    console.log('QR Response status:', qrResponse.status)

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('WHAPI QR request failed:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to get QR code', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const qrData = await qrResponse.json()
    console.log('QR data received:', { 
      hasImage: !!qrData.image, 
      hasQr: !!qrData.qr,
      keys: Object.keys(qrData)
    })

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrData.image || qrData.qr || qrData.data,
        instance_id: profile.instance_id
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Get WhatsApp QR Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
