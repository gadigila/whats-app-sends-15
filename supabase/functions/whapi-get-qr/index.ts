
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: GetQrRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📱 Getting QR for user:', userId)

    // Get user channel
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.instance_id || !profile?.whapi_token) {
      console.error('❌ No channel found for user:', userId)
      return new Response(
        JSON.stringify({ error: 'No channel found. Please create a channel first.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Found channel ID:', profile.instance_id)

    // Try both possible QR endpoints to handle API differences
    const qrEndpoints = [
      `https://gate.whapi.cloud/qr`,
      `https://gate.whapi.cloud/channels/${profile.instance_id}/qr`
    ]

    let qrData = null
    let lastError = null

    for (const endpoint of qrEndpoints) {
      try {
        console.log('📡 Trying QR endpoint:', endpoint)
        
        const qrResponse = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`
          }
        })

        console.log('📥 QR response status:', qrResponse.status, 'for endpoint:', endpoint)

        if (qrResponse.ok) {
          qrData = await qrResponse.json()
          console.log('✅ QR data received from:', endpoint)
          break
        } else {
          const errorText = await qrResponse.text()
          lastError = {
            status: qrResponse.status,
            error: errorText,
            endpoint
          }
          console.log('❌ QR request failed for endpoint:', endpoint, 'Status:', qrResponse.status)
        }
      } catch (error) {
        console.error('❌ Error with endpoint:', endpoint, error)
        lastError = { error: error.message, endpoint }
      }
    }

    // If no endpoint worked, handle the error
    if (!qrData) {
      console.error('❌ All QR endpoints failed. Last error:', lastError)
      
      // If it's a 404, the channel probably doesn't exist
      if (lastError?.status === 404) {
        console.log('🗑️ Channel not found (404), cleaning up database...')
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
            error: 'Channel not found. Please create a new channel.',
            requiresNewInstance: true
          }),
          { status: 400, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get QR code from all endpoints', 
          details: lastError
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📥 QR data received:', {
      hasImage: !!qrData?.image,
      hasQrCode: !!qrData?.qr_code,
      hasBase64: !!qrData?.base64,
      keys: Object.keys(qrData || {})
    })

    // QR might be base64 encoded directly or in different field
    const qrImageUrl = qrData?.image || qrData?.qr_code || qrData?.base64

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
        channel_id: profile.instance_id
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
