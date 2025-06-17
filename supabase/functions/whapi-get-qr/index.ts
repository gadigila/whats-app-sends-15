
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
    
    console.log('📱 Getting QR for user:', (await req.json()).userId)
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: GetQrRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's channel info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (!profile.instance_id || !profile.whapi_token) {
      console.log('🚨 No instance or token found, requires new instance')
      return new Response(
        JSON.stringify({ 
          error: 'No WhatsApp instance found',
          requiresNewInstance: true 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Found channel ID:', profile.instance_id)

    // Use Partner API endpoint for QR code
    const qrEndpoint = `https://partner-api.whapi.cloud/api/v1/channels/${profile.instance_id}/qr`
    
    console.log('📡 Requesting QR from Partner API:', qrEndpoint)

    try {
      const qrResponse = await fetch(qrEndpoint, {
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      console.log('📥 QR response status:', qrResponse.status)

      if (qrResponse.ok) {
        const qrData = await qrResponse.json()
        console.log('✅ QR data received:', Object.keys(qrData))
        
        // Handle different possible response formats from Partner API
        let qrCodeUrl = null
        if (qrData.qr_code) {
          qrCodeUrl = qrData.qr_code.startsWith('data:') ? qrData.qr_code : `data:image/png;base64,${qrData.qr_code}`
        } else if (qrData.qr) {
          qrCodeUrl = qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`
        } else if (qrData.image) {
          qrCodeUrl = qrData.image.startsWith('data:') ? qrData.image : `data:image/png;base64,${qrData.image}`
        } else if (qrData.data && qrData.data.qr_code) {
          qrCodeUrl = qrData.data.qr_code.startsWith('data:') ? qrData.data.qr_code : `data:image/png;base64,${qrData.data.qr_code}`
        }
        
        if (qrCodeUrl) {
          console.log('✅ QR code processed successfully')
          return new Response(
            JSON.stringify({
              success: true,
              qr_code: qrCodeUrl,
              message: 'QR code retrieved successfully'
            }),
            { status: 200, headers: corsHeaders }
          )
        } else {
          console.error('⚠️ No QR code found in Partner API response:', qrData)
          return new Response(
            JSON.stringify({ 
              error: 'No QR code in Partner API response',
              details: { responseKeys: Object.keys(qrData), response: qrData }
            }),
            { status: 400, headers: corsHeaders }
          )
        }
      } else {
        const errorText = await qrResponse.text()
        console.error('❌ Partner API QR request failed:', {
          status: qrResponse.status,
          error: errorText,
          endpoint: qrEndpoint
        })
        
        // If it's a 404, the channel probably doesn't exist
        if (qrResponse.status === 404) {
          console.log('🗑️ Channel not found (404), cleaning up database...')
          
          // Clear the invalid instance from database
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
              error: 'WhatsApp instance not found',
              requiresNewInstance: true 
            }),
            { status: 404, headers: corsHeaders }
          )
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to get QR code from Partner API',
            details: { status: qrResponse.status, error: errorText }
          }),
          { status: qrResponse.status, headers: corsHeaders }
        )
      }
    } catch (networkError) {
      console.error('❌ Network error calling Partner API:', networkError)
      return new Response(
        JSON.stringify({ 
          error: 'Network error connecting to Partner API',
          details: networkError.message 
        }),
        { status: 500, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('💥 QR Code Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
