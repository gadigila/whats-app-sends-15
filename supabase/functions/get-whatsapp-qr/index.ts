
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

    console.log('=== Get WhatsApp QR: Starting ===')
    console.log('Request method:', req.method)

    // Parse request body with error handling
    let requestBody
    try {
      requestBody = await req.json()
      console.log('📥 Request body received:', requestBody)
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const { userId }: GetQrRequest = requestBody

    if (!userId) {
      console.error('❌ User ID is missing from request')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Getting QR for user:', userId)

    // Get user's instance details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile query error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Database error', details: profileError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!profile) {
      console.error('❌ User profile not found for ID:', userId)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (!profile.instance_id || !profile.whapi_token) {
      console.error('❌ Missing instance data:', {
        hasInstanceId: !!profile.instance_id,
        hasWhapiToken: !!profile.whapi_token,
        instanceId: profile.instance_id || 'missing',
        tokenLength: profile.whapi_token?.length || 0
      })
      return new Response(
        JSON.stringify({ error: 'No WhatsApp instance found for user' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('✅ Found user profile with instance:', {
      instanceId: profile.instance_id,
      tokenLength: profile.whapi_token.length
    })

    // Get QR code using the channel token with multiple URL attempts
    const qrUrls = [
      `https://gate.whapi.cloud/instance/qr?id=${profile.instance_id}`,
      `https://gate.whapi.cloud/instance/qr`,
      `https://gate.whapi.cloud/qr?instance_id=${profile.instance_id}`,
      `https://gate.whapi.cloud/qr`
    ]

    let qrData = null
    let lastError = null

    for (const url of qrUrls) {
      console.log(`🔄 Trying QR URL: ${url}`)
      
      try {
        const qrResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })

        console.log(`📡 QR Response status for ${url}:`, qrResponse.status)
        console.log(`📡 QR Response headers:`, Object.fromEntries(qrResponse.headers.entries()))

        if (qrResponse.ok) {
          qrData = await qrResponse.json()
          console.log('✅ QR data received successfully:', { 
            hasImage: !!qrData.image, 
            hasQr: !!qrData.qr,
            hasData: !!qrData.data,
            keys: Object.keys(qrData)
          })
          break
        } else {
          const errorText = await qrResponse.text()
          console.warn(`⚠️ QR request failed for ${url}:`, {
            status: qrResponse.status,
            statusText: qrResponse.statusText,
            error: errorText
          })
          lastError = `${qrResponse.status}: ${errorText}`
        }
      } catch (fetchError) {
        console.error(`💥 Fetch error for ${url}:`, fetchError)
        lastError = fetchError.message
      }
    }

    if (!qrData) {
      console.error('❌ All QR URL attempts failed. Last error:', lastError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get QR code from all endpoints', 
          details: lastError,
          instanceId: profile.instance_id
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Extract QR code from response
    const qrCode = qrData.image || qrData.qr || qrData.data || qrData.qr_code
    
    if (!qrCode) {
      console.error('❌ No QR code found in response:', qrData)
      return new Response(
        JSON.stringify({ 
          error: 'QR code not found in response', 
          responseKeys: Object.keys(qrData)
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🎯 QR code extracted successfully, length:', qrCode.length)

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrCode,
        instance_id: profile.instance_id
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Get WhatsApp QR Error:', error)
    console.error('📍 Error stack:', error.stack)
    console.error('🏷️ Error name:', error.name)
    console.error('💬 Error message:', error.message)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
