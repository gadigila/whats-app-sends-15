
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

    // First check instance health to see if it's accessible
    console.log('🔄 Checking instance health first...')
    const healthResponse = await fetch('https://gate.whapi.cloud/health', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Accept': 'application/json'
      }
    })

    console.log('📡 Health check status:', healthResponse.status)
    
    if (!healthResponse.ok) {
      const healthError = await healthResponse.text()
      console.error('❌ Health check failed:', {
        status: healthResponse.status,
        error: healthError
      })
      return new Response(
        JSON.stringify({ 
          error: 'Instance not accessible', 
          details: `Health check failed: ${healthError}`,
          status: healthResponse.status 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const healthData = await healthResponse.json()
    console.log('✅ Health check result:', healthData)

    // Now try to get QR code - Method 1: JSON response with base64
    console.log('🔄 Trying QR endpoint 1: /users/login for JSON base64...')
    
    const qrParams = new URLSearchParams({
      wakeup: 'true',
      width: '400',
      height: '400',
      color_light: 'ffffff',
      color_dark: '000000'
    })
    
    console.log('📤 QR request URL:', `https://gate.whapi.cloud/users/login?${qrParams.toString()}`)
    console.log('📤 QR request headers:', {
      'Authorization': `Bearer ${profile.whapi_token.substring(0, 10)}...`,
      'Accept': 'application/json'
    })

    const qrResponse1 = await fetch(`https://gate.whapi.cloud/users/login?${qrParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    console.log('📡 QR Response 1 status:', qrResponse1.status)
    console.log('📡 QR Response 1 headers:', Object.fromEntries(qrResponse1.headers.entries()))

    let finalQrCode = null

    if (qrResponse1.ok) {
      try {
        const responseData = await qrResponse1.json()
        console.log('📥 JSON response received:', {
          keys: Object.keys(responseData),
          hasQrCode: 'qr_code' in responseData,
          hasBase64: 'base64' in responseData,
          hasImage: 'image' in responseData,
          hasData: 'data' in responseData
        })
        
        // Look for base64 data in various possible fields
        const possibleFields = ['qr_code', 'base64', 'image', 'data', 'qr']
        for (const field of possibleFields) {
          if (responseData[field]) {
            finalQrCode = responseData[field]
            console.log(`🎯 Found QR base64 in field '${field}', length: ${finalQrCode.length}`)
            
            // Ensure proper data URL format
            if (!finalQrCode.startsWith('data:')) {
              finalQrCode = `data:image/png;base64,${finalQrCode}`
              console.log('🔧 Added data URL prefix to QR code')
            }
            break
          }
        }

        if (!finalQrCode) {
          console.log('📝 Full response data:', JSON.stringify(responseData, null, 2))
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse JSON from endpoint 1:', parseError)
      }
    } else {
      const errorText = await qrResponse1.text()
      console.error('❌ QR endpoint 1 failed:', {
        status: qrResponse1.status,
        statusText: qrResponse1.statusText,
        error: errorText
      })
    }

    // If first endpoint failed, try second endpoint: direct image
    if (!finalQrCode) {
      console.log('🔄 Trying QR endpoint 2: /users/login/image for direct image...')
      
      const qrResponse2 = await fetch(`https://gate.whapi.cloud/users/login/image?${qrParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Accept': 'image/png'
        }
      })

      console.log('📡 QR Response 2 status:', qrResponse2.status)
      console.log('📡 QR Response 2 headers:', Object.fromEntries(qrResponse2.headers.entries()))

      if (qrResponse2.ok) {
        try {
          const imageBuffer = await qrResponse2.arrayBuffer()
          const base64String = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))
          finalQrCode = `data:image/png;base64,${base64String}`
          console.log('🎯 Successfully converted image to base64, length:', base64String.length)
        } catch (imageError) {
          console.error('❌ Failed to process image from endpoint 2:', imageError)
        }
      } else {
        const errorText2 = await qrResponse2.text()
        console.error('❌ QR endpoint 2 failed:', {
          status: qrResponse2.status,
          statusText: qrResponse2.statusText,
          error: errorText2
        })
      }
    }

    // If both endpoints failed
    if (!finalQrCode) {
      console.error('❌ Both QR endpoints failed or returned no QR code')
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get QR code from WHAPI endpoints',
          details: {
            healthCheck: healthData,
            endpoint1Status: qrResponse1.status,
            endpoint2Status: qrResponse1.status === 200 ? 'Tried image endpoint' : 'Skipped image endpoint',
            instanceId: profile.instance_id,
            tokenLength: profile.whapi_token?.length
          }
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ QR code obtained successfully')
    
    return new Response(
      JSON.stringify({
        success: true,
        qr_code: finalQrCode,
        instance_id: profile.instance_id,
        status: 'OK'
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
