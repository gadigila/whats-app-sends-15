
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

    // Retry mechanism for WHAPI API calls
    const maxRetries = 3
    const retryDelay = 1000 // 1 second

    const tryEndpointWithRetry = async (endpoint: string, retryCount = 0): Promise<any> => {
      try {
        console.log(`📡 Trying QR endpoint (attempt ${retryCount + 1}):`, endpoint)
        
        const qrResponse = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })

        console.log('📥 QR response status:', qrResponse.status, 'for endpoint:', endpoint)

        if (qrResponse.ok) {
          // Handle different response types based on endpoint
          if (endpoint.includes('/image')) {
            // For /image endpoint, we get direct image data
            const imageBlob = await qrResponse.blob()
            const arrayBuffer = await imageBlob.arrayBuffer()
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
            const qrCodeUrl = `data:image/png;base64,${base64}`
            console.log('✅ QR image received from:', endpoint)
            return { success: true, data: { qr_code: qrCodeUrl } }
          } else {
            // For regular endpoint, we expect JSON with base64
            const qrData = await qrResponse.json()
            console.log('✅ QR data received from:', endpoint, 'Keys:', Object.keys(qrData))
            
            // Handle different possible response formats
            let qrCodeUrl = null
            if (qrData.qr_code) {
              qrCodeUrl = qrData.qr_code.startsWith('data:') ? qrData.qr_code : `data:image/png;base64,${qrData.qr_code}`
            } else if (qrData.qr) {
              qrCodeUrl = qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`
            } else if (qrData.image) {
              qrCodeUrl = qrData.image.startsWith('data:') ? qrData.image : `data:image/png;base64,${qrData.image}`
            }
            
            if (qrCodeUrl) {
              return { success: true, data: { qr_code: qrCodeUrl } }
            } else {
              console.log('⚠️ No QR code found in response:', qrData)
              return { success: false, error: { error: 'No QR code in response', endpoint, responseKeys: Object.keys(qrData) } }
            }
          }
        } else {
          const errorText = await qrResponse.text()
          console.log('❌ QR request failed for endpoint:', endpoint, 'Status:', qrResponse.status, 'Error:', errorText)
          
          // If it's a 503 (service unavailable) or 502 (bad gateway), retry
          if ((qrResponse.status === 503 || qrResponse.status === 502) && retryCount < maxRetries) {
            console.log(`⏳ Retrying in ${retryDelay}ms due to service unavailable...`)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            return tryEndpointWithRetry(endpoint, retryCount + 1)
          }
          
          return {
            success: false,
            error: {
              status: qrResponse.status,
              error: errorText,
              endpoint
            }
          }
        }
      } catch (error) {
        console.error('❌ Network error with endpoint:', endpoint, error)
        
        // Retry on network errors too
        if (retryCount < maxRetries) {
          console.log(`⏳ Retrying in ${retryDelay}ms due to network error...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return tryEndpointWithRetry(endpoint, retryCount + 1)
        }
        
        return {
          success: false,
          error: { error: error.message, endpoint }
        }
      }
    }

    // Use the correct endpoints from WHAPI documentation
    const qrEndpoints = [
      `https://gate.whapi.cloud/users/login/image`,  // Returns direct image
      `https://gate.whapi.cloud/users/login`         // Returns JSON with base64
    ]

    let qrData = null
    let lastError = null

    for (const endpoint of qrEndpoints) {
      const result = await tryEndpointWithRetry(endpoint)
      
      if (result.success) {
        qrData = result.data
        break
      } else {
        lastError = result.error
      }
    }

    // If no endpoint worked, handle the error
    if (!qrData) {
      console.error('❌ All QR endpoints failed after retries. Last error:', lastError)
      
      // If it's a 404, the channel probably doesn't exist
      if (lastError?.status === 404) {
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
      
      // For 503 errors, provide a more helpful message
      if (lastError?.status === 503) {
        return new Response(
          JSON.stringify({ 
            error: 'שירות WHAPI זמנית לא זמין. אנא נסה שוב בעוד כמה רגעים.',
            isTemporary: true,
            details: lastError
          }),
          { status: 503, headers: corsHeaders }
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

    console.log('✅ QR code retrieved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrData.qr_code,
        message: 'QR code retrieved successfully'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 QR Code Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
