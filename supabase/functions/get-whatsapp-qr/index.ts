
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

    // Try multiple endpoints to get QR code
    const endpoints = [
      {
        name: 'login-image',
        url: `https://gate.whapi.cloud/users/login/image?wakeup=true`,
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Accept': 'image/png',
        },
        method: 'GET'
      },
      {
        name: 'login-json',
        url: `https://gate.whapi.cloud/users/login?wakeup=true`,
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'GET'
      }
    ]

    for (const endpoint of endpoints) {
      console.log(`🔄 Trying ${endpoint.name} endpoint...`)
      console.log('📡 URL:', endpoint.url)
      console.log('🔑 Token (first 8 chars):', profile.whapi_token.substring(0, 8) + '...')
      
      const qrResponse = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: endpoint.headers
      })

      console.log(`📡 ${endpoint.name} Response status:`, qrResponse.status)
      console.log(`📡 ${endpoint.name} Response headers:`, Object.fromEntries(qrResponse.headers.entries()))

      if (!qrResponse.ok) {
        const errorText = await qrResponse.text()
        console.error(`❌ ${endpoint.name} request failed:`, {
          status: qrResponse.status,
          statusText: qrResponse.statusText,
          errorBody: errorText
        })
        continue // Try next endpoint
      }

      const contentType = qrResponse.headers.get('content-type') || ''
      console.log(`📄 ${endpoint.name} Content type:`, contentType)

      // Handle image response (direct PNG)
      if (contentType.includes('image/png') || endpoint.name === 'login-image') {
        console.log('🖼️ Processing image response...')
        const arrayBuffer = await qrResponse.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        const dataUrl = `data:image/png;base64,${base64}`
        
        console.log('✅ QR image processed successfully, length:', dataUrl.length)
        
        return new Response(
          JSON.stringify({
            success: true,
            qr_code: dataUrl,
            instance_id: profile.instance_id,
            status: 'OK',
            source: endpoint.name
          }),
          { status: 200, headers: corsHeaders }
        )
      }

      // Handle JSON response
      if (contentType.includes('application/json')) {
        console.log('📄 Processing JSON response...')
        const responseBody = await qrResponse.text()
        console.log('📥 Raw response length:', responseBody.length)
        console.log('📥 Raw response (first 500 chars):', responseBody.substring(0, 500))

        let parsedResponse
        try {
          parsedResponse = JSON.parse(responseBody)
          console.log('✅ Successfully parsed JSON response')
          console.log('📊 Response keys:', Object.keys(parsedResponse))
        } catch (parseError) {
          console.error('❌ Failed to parse JSON:', parseError)
          continue // Try next endpoint
        }

        // Check for error status
        if (parsedResponse.status === 'TIMEOUT' || parsedResponse.status === 'ERROR') {
          console.warn(`⚠️ ${endpoint.name} returned error status:`, parsedResponse.status)
          continue // Try next endpoint
        }

        // Look for QR code in various possible fields
        const possibleFields = ['qr_code', 'base64', 'image', 'data', 'qr']
        let qrCode = null
        
        for (const field of possibleFields) {
          if (parsedResponse[field]) {
            qrCode = parsedResponse[field]
            console.log(`🎯 Found QR code in field '${field}', length:`, qrCode.length)
            break
          }
        }

        if (qrCode) {
          // Ensure proper data URL format
          let finalQrCode = qrCode
          if (typeof qrCode === 'string' && !qrCode.startsWith('data:')) {
            finalQrCode = `data:image/png;base64,${qrCode}`
            console.log('🔧 Added data URL prefix to QR code')
          }

          console.log('✅ QR code processed successfully from JSON')
          
          return new Response(
            JSON.stringify({
              success: true,
              qr_code: finalQrCode,
              instance_id: profile.instance_id,
              status: parsedResponse.status || 'OK',
              source: endpoint.name
            }),
            { status: 200, headers: corsHeaders }
          )
        }

        console.error(`❌ No QR code found in ${endpoint.name} response`)
        console.error('🔍 Available fields:', Object.keys(parsedResponse))
      }
    }

    // If we get here, all endpoints failed
    console.error('❌ All endpoints failed to provide QR code')
    return new Response(
      JSON.stringify({ 
        error: 'QR code not available from any endpoint', 
        suggestion: 'Instance might need to be restarted or recreated',
        instanceId: profile.instance_id,
        instanceStatus: profile.instance_status
      }),
      { status: 400, headers: corsHeaders }
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
