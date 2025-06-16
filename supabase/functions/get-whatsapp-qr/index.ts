
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
    console.log('Current time:', new Date().toISOString())

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
    console.log('📥 Fetching user profile from database...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile query error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found', details: profileError.message }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (!profile) {
      console.error('❌ No profile found for user')
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('✅ Profile found:', {
      instanceId: profile.instance_id,
      hasToken: !!profile.whapi_token,
      tokenLength: profile.whapi_token?.length || 0,
      instanceStatus: profile.instance_status
    })

    if (!profile.instance_id || !profile.whapi_token) {
      console.error('❌ Missing instance data:', {
        hasInstanceId: !!profile.instance_id,
        hasToken: !!profile.whapi_token
      })
      return new Response(
        JSON.stringify({ error: 'No WhatsApp instance found for user' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Try to get QR code using the login endpoint
    const qrUrl = 'https://gate.whapi.cloud/users/login'
    
    console.log('🔄 Requesting QR from WHAPI...')
    console.log('📡 URL:', qrUrl)
    console.log('🔑 Token (first 8 chars):', profile.whapi_token.substring(0, 8) + '...')
    
    const qrResponse = await fetch(qrUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    console.log('📡 WHAPI Response status:', qrResponse.status)
    console.log('📡 WHAPI Response status text:', qrResponse.statusText)
    console.log('📡 WHAPI Response headers:', Object.fromEntries(qrResponse.headers.entries()))

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('❌ WHAPI request failed:', {
        status: qrResponse.status,
        statusText: qrResponse.statusText,
        errorBody: errorText
      })
      
      return new Response(
        JSON.stringify({ 
          error: `WHAPI request failed: ${qrResponse.status}`, 
          details: errorText,
          suggestion: 'Check instance status and token validity'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get the response body
    const responseBody = await qrResponse.text()
    console.log('📥 Raw WHAPI response length:', responseBody.length)
    console.log('📥 Raw WHAPI response (first 500 chars):', responseBody.substring(0, 500))

    // Try to parse as JSON first
    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseBody)
      console.log('✅ Successfully parsed JSON response')
      console.log('📊 Response keys:', Object.keys(parsedResponse))
      console.log('📊 Response structure:', JSON.stringify(parsedResponse, null, 2))
    } catch (parseError) {
      console.log('⚠️ Response is not JSON, treating as raw data')
      console.log('📄 Response type:', typeof responseBody)
      
      // If it's not JSON, it might be a direct base64 image
      if (responseBody.startsWith('data:image/') || responseBody.includes('base64')) {
        console.log('🖼️ Detected base64 image format')
        return new Response(
          JSON.stringify({
            success: true,
            qr_code: responseBody,
            instance_id: profile.instance_id,
            status: 'OK'
          }),
          { status: 200, headers: corsHeaders }
        )
      }
      
      console.error('❌ Unable to parse response as JSON or image:', parseError)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response format from WHAPI', 
          details: parseError.message,
          responsePreview: responseBody.substring(0, 200)
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Handle different response structures
    if (parsedResponse.status === 'TIMEOUT' || parsedResponse.status === 'ERROR') {
      console.warn('⚠️ WHAPI returned error status:', parsedResponse.status)
      return new Response(
        JSON.stringify({ 
          error: 'QR code not available', 
          status: parsedResponse.status,
          details: parsedResponse,
          suggestion: 'Instance might need to be restarted'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Look for QR code in various possible fields
    let qrCode = null
    const possibleFields = ['qr_code', 'base64', 'image', 'data', 'qr']
    
    for (const field of possibleFields) {
      if (parsedResponse[field]) {
        qrCode = parsedResponse[field]
        console.log(`🎯 Found QR code in field '${field}', length:`, qrCode.length)
        break
      }
    }

    if (!qrCode) {
      console.error('❌ No QR code found in any expected field')
      console.error('🔍 Available fields:', Object.keys(parsedResponse))
      console.error('📄 Full response:', parsedResponse)
      
      return new Response(
        JSON.stringify({ 
          error: 'QR code not found in WHAPI response', 
          availableFields: Object.keys(parsedResponse),
          responseData: parsedResponse,
          suggestion: 'Check WHAPI documentation for response format'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Ensure proper data URL format
    let finalQrCode = qrCode
    if (typeof qrCode === 'string' && !qrCode.startsWith('data:')) {
      finalQrCode = `data:image/png;base64,${qrCode}`
      console.log('🔧 Added data URL prefix to QR code')
    }

    console.log('✅ QR code processed successfully')
    console.log('📤 Returning QR code with length:', finalQrCode.length)

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: finalQrCode,
        instance_id: profile.instance_id,
        status: parsedResponse.status || 'OK'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Get WhatsApp QR Error:', error)
    console.error('📍 Error name:', error.name)
    console.error('📍 Error message:', error.message)
    console.error('📍 Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        errorType: error.name
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
