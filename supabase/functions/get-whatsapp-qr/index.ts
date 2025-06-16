
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

    // Try first endpoint: /users/login (returns JSON with base64)
    console.log('🔄 Trying QR endpoint 1: /users/login for base64...')
    const qrParams = new URLSearchParams({
      wakeup: 'true',
      width: '400px',
      height: '400px',
      color_light: 'white',
      color_dark: 'black'
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

    let finalQrCode = null

    if (qrResponse1.ok) {
      try {
        const responseData = await qrResponse1.json()
        console.log('📥 JSON response keys:', Object.keys(responseData))
        
        // Look for base64 data in various possible fields
        const possibleFields = ['qr_code', 'base64', 'image', 'data', 'qr']
        for (const field of possibleFields) {
          if (responseData[field]) {
            finalQrCode = responseData[field]
            console.log(`🎯 Found QR base64 in field '${field}'`)
            
            // Ensure proper data URL format
            if (!finalQrCode.startsWith('data:')) {
              finalQrCode = `data:image/png;base64,${finalQrCode}`
              console.log('🔧 Added data URL prefix to QR code')
            }
            break
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse JSON from endpoint 1:', parseError)
      }
    }

    // If first endpoint failed, try second endpoint: /users/login/image (returns direct image)
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

      if (qrResponse2.ok) {
        try {
          const imageBuffer = await qrResponse2.arrayBuffer()
          const base64String = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))
          finalQrCode = `data:image/png;base64,${base64String}`
          console.log('🎯 Successfully converted image to base64, length:', base64String.length)
        } catch (imageError) {
          console.error('❌ Failed to process image from endpoint 2:', imageError)
        }
      }
    }

    // If both endpoints failed
    if (!finalQrCode) {
      console.error('❌ Both QR endpoints failed or returned no QR code')
      const errorText1 = qrResponse1.ok ? 'No QR in JSON' : await qrResponse1.text()
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get QR code from both WHAPI endpoints',
          details: {
            endpoint1: {
              status: qrResponse1.status,
              error: errorText1
            },
            endpoint2: qrResponse1.status === 200 ? 'Tried image endpoint' : 'Skipped image endpoint'
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
