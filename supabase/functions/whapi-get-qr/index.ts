
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

    console.log('📡 Getting QR with channel token...')

    // Get QR code from channel using channel token
    const qrResponse = await fetch(`https://gate.whapi.cloud/channels/${profile.instance_id}/qr`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    console.log('📥 QR response status:', qrResponse.status)

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('❌ QR request failed:', {
        status: qrResponse.status,
        error: errorText,
        channelId: profile.instance_id
      })

      // If it's a 404, the channel probably doesn't exist
      if (qrResponse.status === 404) {
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
