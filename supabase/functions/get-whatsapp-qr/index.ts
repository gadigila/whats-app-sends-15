
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

    // Parse request body
    const { userId }: GetQrRequest = await req.json()

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

    if (profileError || !profile) {
      console.error('❌ Profile query error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (!profile.instance_id || !profile.whapi_token) {
      console.error('❌ Missing instance data')
      return new Response(
        JSON.stringify({ error: 'No WhatsApp instance found for user' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('✅ Found user profile with instance:', {
      instanceId: profile.instance_id,
      tokenLength: profile.whapi_token.length
    })

    // Try the main QR endpoint with proper parameters
    const qrUrl = 'https://gate.whapi.cloud/users/login?wakeup=true'
    
    console.log('🔄 Requesting QR from:', qrUrl)
    
    const qrResponse = await fetch(qrUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    console.log('📡 QR Response status:', qrResponse.status)
    console.log('📡 QR Response headers:', Object.fromEntries(qrResponse.headers.entries()))

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('❌ QR request failed:', {
        status: qrResponse.status,
        statusText: qrResponse.statusText,
        error: errorText
      })
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to get QR code: ${qrResponse.status}`, 
          details: errorText,
          suggestion: 'Make sure the instance is in the correct state'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Parse the response
    const responseText = await qrResponse.text()
    console.log('📥 Raw response (first 200 chars):', responseText.substring(0, 200) + '...')
    
    let qrData
    try {
      qrData = JSON.parse(responseText)
      console.log('✅ QR JSON data received:', {
        status: qrData.status,
        hasBase64: !!qrData.base64,
        hasImage: !!qrData.image,
        hasQr: !!qrData.qr_code,
        keys: Object.keys(qrData)
      })
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid response format from QR API' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Check if we got a timeout or error status
    if (qrData.status === 'TIMEOUT' || qrData.status === 'ERROR') {
      console.warn('⚠️ QR request returned status:', qrData.status)
      return new Response(
        JSON.stringify({ 
          error: 'QR code not available', 
          status: qrData.status,
          suggestion: 'The instance might need to be restarted or is in wrong state'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Extract QR code - check for base64 field first
    let qrCode = null
    if (qrData.base64) {
      qrCode = qrData.base64
      console.log('🎯 Found base64 QR code, length:', qrCode.length)
    } else if (qrData.image) {
      qrCode = qrData.image
      console.log('🎯 Found image QR code')
    } else if (qrData.qr_code) {
      qrCode = qrData.qr_code
      console.log('🎯 Found qr_code field')
    }

    if (!qrCode) {
      console.error('❌ No QR code found in response:', qrData)
      return new Response(
        JSON.stringify({ 
          error: 'QR code not found in response', 
          responseData: qrData,
          suggestion: 'Instance might not be ready for QR generation'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Ensure we have a proper data URL
    let finalQrCode = qrCode
    if (typeof qrCode === 'string' && !qrCode.startsWith('data:')) {
      finalQrCode = `data:image/png;base64,${qrCode}`
      console.log('🔧 Added data URL prefix to QR code')
    }

    console.log('✅ QR code ready for display')

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: finalQrCode,
        instance_id: profile.instance_id,
        status: qrData.status
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Get WhatsApp QR Error:', error)
    console.error('📍 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
