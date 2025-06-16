
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

    // Try different QR endpoints with the correct WHAPI URLs
    const qrEndpoints = [
      {
        url: 'https://gate.whapi.cloud/users/login',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        params: 'wakeup=true'
      },
      {
        url: 'https://gate.whapi.cloud/users/login/image',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Accept': 'image/png',
          'Content-Type': 'application/json'
        },
        params: 'wakeup=true'
      },
      {
        url: 'https://gate.whapi.cloud/users/login/rowdata',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        params: 'wakeup=true'
      }
    ]

    let qrData = null
    let lastError = null

    for (const endpoint of qrEndpoints) {
      const urlWithParams = `${endpoint.url}?${endpoint.params}`
      console.log(`🔄 Trying QR endpoint: ${endpoint.method} ${urlWithParams}`)
      
      try {
        const qrResponse = await fetch(urlWithParams, {
          method: endpoint.method,
          headers: endpoint.headers
        })

        console.log(`📡 QR Response status for ${endpoint.url}:`, qrResponse.status)
        console.log(`📡 QR Response headers:`, Object.fromEntries(qrResponse.headers.entries()))

        if (qrResponse.ok) {
          const contentType = qrResponse.headers.get('content-type') || ''
          console.log(`📋 Content-Type: ${contentType}`)
          
          if (contentType.includes('image/')) {
            // Handle image response - convert to base64
            const arrayBuffer = await qrResponse.arrayBuffer()
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
            qrData = { qr_code: `data:${contentType};base64,${base64}` }
            console.log('✅ QR image received and converted to base64')
            break
          } else {
            // Handle JSON or text response
            const responseText = await qrResponse.text()
            console.log(`📥 Raw response from ${endpoint.url}:`, responseText.substring(0, 500) + '...')
            
            try {
              const jsonData = JSON.parse(responseText)
              console.log('✅ QR JSON data received:', { 
                hasImage: !!jsonData.image, 
                hasQr: !!jsonData.qr,
                hasData: !!jsonData.data,
                hasQrCode: !!jsonData.qr_code,
                hasBase64: !!jsonData.base64,
                keys: Object.keys(jsonData)
              })
              qrData = jsonData
              break
            } catch (parseError) {
              // Maybe it's direct base64 or image data
              if (responseText.startsWith('data:image') || responseText.startsWith('iVBOR') || responseText.includes('base64')) {
                qrData = { qr_code: responseText.startsWith('data:') ? responseText : `data:image/png;base64,${responseText}` }
                console.log('✅ Received direct image/base64 data')
                break
              } else {
                console.warn(`⚠️ Could not parse response as JSON from ${endpoint.url}:`, parseError)
              }
            }
          }
        } else {
          const errorText = await qrResponse.text()
          console.warn(`⚠️ QR request failed for ${endpoint.url}:`, {
            status: qrResponse.status,
            statusText: qrResponse.statusText,
            error: errorText
          })
          lastError = `${qrResponse.status}: ${errorText}`
        }
      } catch (fetchError) {
        console.error(`💥 Fetch error for ${endpoint.url}:`, fetchError)
        lastError = fetchError.message
      }
    }

    if (!qrData) {
      console.error('❌ All QR endpoint attempts failed. Last error:', lastError)
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get QR code from all endpoints', 
          details: lastError,
          instanceId: profile.instance_id,
          suggestion: 'Make sure the instance is in the correct state and try again'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Extract QR code from response - check all possible fields
    const qrCode = qrData.qr_code || qrData.image || qrData.qr || qrData.data || qrData.base64 || qrData
    
    if (!qrCode) {
      console.error('❌ No QR code found in response:', qrData)
      return new Response(
        JSON.stringify({ 
          error: 'QR code not found in response', 
          responseKeys: Object.keys(qrData),
          responseData: qrData
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🎯 QR code extracted successfully, type:', typeof qrCode, 'length:', qrCode.length)

    // Make sure we have a proper data URL for images
    let finalQrCode = qrCode
    if (typeof qrCode === 'string' && !qrCode.startsWith('data:')) {
      finalQrCode = `data:image/png;base64,${qrCode}`
    }

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: finalQrCode,
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
