import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
}

interface GetQRRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('🔲 WHAPI Get QR - Corrected to Match Documentation')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: GetQRRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Getting QR for user:', userId)

    // Get user's channel info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      console.error('❌ Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found or no token' }),
        { status: 400, headers: corsHeaders }
      )
    }
    
    if (!profile.instance_id || !profile.whapi_token) {
      console.error('❌ No channel found for user')
      return new Response(
        JSON.stringify({ 
          error: 'No channel found',
          message: 'Please create a channel first'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📊 Channel status:', profile.instance_status)

    // Enhanced QR retrieval function
    async function getQRWithRetry(token: string, retryCount = 0, maxRetries = 3) {
      try {
        console.log(`🔍 QR attempt ${retryCount + 1}/${maxRetries + 1}...`)
        
        // Step 1: Check health status first
        console.log('📊 Checking channel health...')
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        })

        if (!healthResponse.ok) {
          if (healthResponse.status === 401) {
            console.error('❌ Token is invalid or expired')
            throw new Error('Token invalid - channel needs to be recreated')
          }
          console.error('❌ Health check failed:', healthResponse.status)
          throw new Error(`Health check failed: ${healthResponse.status}`)
        }

        const healthData = await healthResponse.json()
        console.log('📊 Health data:', JSON.stringify(healthData, null, 2))

        // Check if already connected
        if (healthData.status === 'connected' || healthData.me?.phone) {
  console.log('✅ Already connected to WhatsApp!');
  const phoneNumber = healthData.me?.phone || healthData.phone || healthData.user?.id;

  // Update database status AND phone number if present
  await supabase
    .from('profiles')
    .update({
      instance_status: 'connected',
      phone_number: phoneNumber,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  return {
    success: true,
    already_connected: true,
    phone: phoneNumber,
    message: 'WhatsApp is already connected'
  }
}

        // Process health status
        const status = (typeof healthData.status === 'object' ? healthData.status.text : healthData.status || '').toLowerCase()
        console.log('📊 Processed status:', status)
        
        // Check if channel is ready for QR
        const readyStatuses = ['unauthorized', 'qr', 'ready']
        const initializingStatuses = ['initializing', 'starting', 'booting', 'launching', 'created']
        
        if (!readyStatuses.includes(status)) {
          if (initializingStatuses.includes(status)) {
            console.log(`⏳ Channel still initializing (${status})`)
            if (retryCount < maxRetries) {
              const delay = Math.min(15000, 5000 + (retryCount * 3000)) // Progressive delay
              console.log(`🔄 Retrying in ${delay/1000} seconds...`)
              await new Promise(resolve => setTimeout(resolve, delay))
              return getQRWithRetry(token, retryCount + 1, maxRetries)
            } else {
              throw new Error(`Channel still initializing after ${maxRetries + 1} attempts. Current status: ${status}`)
            }
          } else {
            throw new Error(`Channel not ready for QR. Status: ${status}`)
          }
        }

        // Step 2: Get QR code using the EXACT endpoint from documentation
        console.log('🔲 Getting QR code from /users/login with wakeup=true...')
        
        // EXACT endpoint from WHAPI documentation
        const qrResponse = await fetch(`https://gate.whapi.cloud/users/login?wakeup=true&size=400&width=400`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout for QR
        })

        console.log('📤 QR Response status:', qrResponse.status)

        if (!qrResponse.ok) {
          const errorText = await qrResponse.text()
          console.error(`❌ QR request failed (${qrResponse.status}):`, errorText)
          
          if (qrResponse.status === 401) {
            throw new Error('Token invalid or expired')
          }
          
          if (qrResponse.status === 408 || errorText.includes('timeout') || errorText.includes('TIMEOUT')) {
            console.log('⏰ QR request timed out')
            if (retryCount < maxRetries) {
              console.log(`🔄 Timeout retry in 5 seconds...`)
              await new Promise(resolve => setTimeout(resolve, 5000))
              return getQRWithRetry(token, retryCount + 1, maxRetries)
            } else {
              throw new Error('QR generation timed out after multiple attempts')
            }
          }
          
          throw new Error(`QR request failed: ${errorText}`)
        }

        const qrData = await qrResponse.json()
        console.log('📤 QR Response keys:', Object.keys(qrData))
        console.log('📤 QR Response status:', qrData.status)

        // Step 3: Check if connected during QR request
        if (qrData.status === 'connected' || qrData.me?.phone) {
          console.log('✅ Connected during QR request!')
          
          await supabase
            .from('profiles')
            .update({
              instance_status: 'connected',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          return {
            success: true,
            already_connected: true,
            phone: qrData.me?.phone || qrData.phone,
            message: 'WhatsApp connected during QR request'
          }
        }

        // Step 4: Handle QR response formats - try all possible fields
        let qrCode = null
        
        // According to WHAPI docs, it should return base64 image
        if (qrData.base64) {
          qrCode = qrData.base64
          console.log('✅ Found QR in base64 field')
        } else if (qrData.qr) {
          qrCode = qrData.qr
          console.log('✅ Found QR in qr field')
        } else if (qrData.image) {
          qrCode = qrData.image
          console.log('✅ Found QR in image field')
        } else if (qrData.qrCode) {
          qrCode = qrData.qrCode
          console.log('✅ Found QR in qrCode field')
        }

        // Handle special cases
        if (!qrCode && qrData.status === 'TIMEOUT') {
          console.log('⏰ QR generation timed out, retrying...')
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 3000))
            return getQRWithRetry(token, retryCount + 1, maxRetries)
          } else {
            throw new Error('QR generation timed out after multiple attempts')
          }
        }

        if (!qrCode) {
          console.error('❌ No QR code in response. Full response:', JSON.stringify(qrData, null, 2))
          
          if (retryCount < maxRetries) {
            console.log('🔄 No QR data found, retrying...')
            await new Promise(resolve => setTimeout(resolve, 2000))
            return getQRWithRetry(token, retryCount + 1, maxRetries)
          } else {
            throw new Error('QR code not available in response after multiple attempts')
          }
        }

        // Step 5: Format QR code for display
        let formattedQR = qrCode
        if (formattedQR && !formattedQR.startsWith('data:image')) {
          formattedQR = `data:image/png;base64,${formattedQR}`
        }

        console.log('✅ QR code received successfully, length:', qrCode.length)

        return {
          success: true,
          qr_code: qrCode,
          qr_code_url: formattedQR,
          status: qrData.status || 'qr_ready',
          message: 'QR code ready for scanning',
          expires_in: qrData.expire ? `${qrData.expire} seconds` : '60 seconds',
          attempt: retryCount + 1
        }

      } catch (error) {
        console.error(`❌ QR attempt ${retryCount + 1} failed:`, error.message)
        
        // Handle token invalidity immediately - clean up database
        if (error.message.includes('Token invalid') || error.message.includes('401')) {
          console.log('🧹 Token invalid, cleaning up profile...')
          
          await supabase
            .from('profiles')
            .update({
              instance_id: null,
              whapi_token: null,
              instance_status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          
          throw new Error('Token invalid - channel cleaned up. Please create a new channel.')
        }
        
        // Retry for recoverable errors
        const retryableErrors = [
          'timeout', 'TIMEOUT', 'not available', 'still initializing', 
          'network', 'fetch', 'connection', 'ECONNRESET'
        ]
        
        const isRetryable = retryableErrors.some(keyword => 
          error.message.toLowerCase().includes(keyword.toLowerCase())
        )
        
        if (isRetryable && retryCount < maxRetries) {
          const delay = Math.min(20000, 4000 * Math.pow(1.5, retryCount)) // Exponential backoff
          console.log(`🔄 Retryable error, trying again in ${delay/1000} seconds...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return getQRWithRetry(token, retryCount + 1, maxRetries)
        }
        
        // Not retryable or max retries reached
        throw error
      }
    }

    // Execute QR retrieval with retry logic
    const result = await getQRWithRetry(profile.whapi_token)

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 Final QR Error:', error.message)
    
    // Provide helpful error messages
    let errorMessage = 'Failed to get QR code'
    let suggestion = 'Try again or create a new channel'
    
    if (error.message.includes('still initializing')) {
      errorMessage = 'Channel is still starting up (can take up to 2 minutes)'
      suggestion = 'Please wait 30 seconds and try again'
    } else if (error.message.includes('timed out')) {
      errorMessage = 'QR generation timed out. WHAPI service may be busy.'
      suggestion = 'Wait a few seconds and try again'
    } else if (error.message.includes('Token invalid')) {
      errorMessage = 'Channel token expired'
      suggestion = 'Create a new channel to get a fresh token'
    } else if (error.message.includes('not ready')) {
      errorMessage = 'Channel not ready for QR code'
      suggestion = 'Wait for channel to finish initializing'
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: error.message,
        suggestion: suggestion,
        retry_recommended: !error.message.includes('Token invalid')
      }),
      { status: 400, headers: corsHeaders }
    )
  }
})