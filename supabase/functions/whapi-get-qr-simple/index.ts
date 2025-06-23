
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('🔲 WHAPI Get QR - Enhanced Version with Better Retry Logic')
    
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

    if (profileError || !profile) {
      console.error('❌ Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

      // ⏳ Optional delay if just created
         const bootingStatuses = ['initializing', 'starting', 'booting', 'ready']
          if (bootingStatuses.includes(profile.instance_status)) {
            console.log(`⏳ Channel is still booting (${profile.instance_status}), waiting 90 seconds before QR...`)
            await new Promise(resolve => setTimeout(resolve, 90000))
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

    // Enhanced QR retrieval with comprehensive retry logic
    async function getQRWithEnhancedRetry(token: string, retryCount = 0, maxRetries = 5) {
      try {
        console.log(`🔍 Enhanced QR attempt ${retryCount + 1}/${maxRetries + 1}...`)
        
        // Step 1: Health check first
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(15000)
        })

        if (!healthResponse.ok) {
          if (healthResponse.status === 401) {
            throw new Error('Token invalid or expired')
          }
          throw new Error(`Health check failed: ${healthResponse.status}`)
        }

        const healthData = await healthResponse.json()
        console.log('📊 Detailed health status:', JSON.stringify(healthData, null, 2))

        // If already connected, update DB and return success
        if (healthData.status === 'connected' || healthData.me) {
          console.log('✅ Already connected to WhatsApp!')
          
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
            phone: healthData.me?.phone || healthData.phone,
            message: 'WhatsApp is already connected'
          }
        }

        // Process health status - handle both string and object formats
        const statusValue = (typeof healthData.status === 'object' ? healthData.status.text : healthData.status || '').toLowerCase()
        console.log('📊 Processed health status:', statusValue)
        
        const readyStatuses = ['qr', 'unauthorized']

          
          if (!readyStatuses.includes(statusValue)) {
            // proceed with retry or error
          }

        const initializingStatuses = ['initializing', 'starting', 'booting']
        
        if (!readyStatuses.includes(statusValue)) {
          if (initializingStatuses.includes(statusValue)) {
            console.log(`⏳ Channel still initializing (${statusValue}), will retry...`)
            
            if (retryCount < maxRetries) {
              const retryDelay = Math.min(15000, 3000 * Math.pow(1.5, retryCount)) // Progressive backoff
              console.log(`🔄 Retrying in ${retryDelay/1000} seconds...`)
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              return getQRWithEnhancedRetry(token, retryCount + 1, maxRetries)
            } else {
              throw new Error(`Channel still initializing after ${maxRetries + 1} attempts. Status: ${statusValue}`)
            }
          } else {
            throw new Error(`Channel not ready for QR. Status: ${statusValue}`)
          }
        }

        // Step 3: Get QR code using correct endpoint
        console.log(`🔲 Health check passed, getting QR code from /users/login with wakeup=true...`)
        
        const qrResponse = await fetch(`https://gate.whapi.cloud/users/login?wakeup=true`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(30000)
        })

        if (!qrResponse.ok) {
          const errorText = await qrResponse.text()
          console.error(`❌ QR request failed (${qrResponse.status}):`, errorText)
          
          if (qrResponse.status === 401) {
            throw new Error('Token invalid or expired')
          }
          
          throw new Error(`QR request failed: ${errorText}`)
        }

        const qrData = await qrResponse.json()
        console.log('📊 Detailed QR response:', JSON.stringify(qrData, null, 2))

        // Step 4: Check if connected during QR request
        if (qrData.status === 'connected' || qrData.me) {
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

        // Step 5: Handle TIMEOUT status with enhanced retry
        if (qrData.status === 'TIMEOUT') {
          console.log('⏰ QR generation timed out, will retry with longer delay...')
          
          if (retryCount < maxRetries) {
            const timeoutDelay = Math.min(20000, 5000 * Math.pow(1.8, retryCount)) // Longer delays for timeouts
            console.log(`🔄 Timeout retry in ${timeoutDelay/1000} seconds...`)
            await new Promise(resolve => setTimeout(resolve, timeoutDelay))
            return getQRWithEnhancedRetry(token, retryCount + 1, maxRetries)
          } else {
            throw new Error('QR generation timed out after multiple attempts')
          }
        }

        // Step 6: Validate QR code presence
        if (!qrData.base64 && !qrData.qr) {
          console.error('❌ No QR data in response:', Object.keys(qrData))
          
          if (retryCount < maxRetries) {
            console.log('🔄 No QR data, retrying...')
            await new Promise(resolve => setTimeout(resolve, 3000))
            return getQRWithEnhancedRetry(token, retryCount + 1, maxRetries)
          } else {
            throw new Error('QR code not available in response after multiple attempts')
          }
        }

     // Step 7: Return successful QR response
    const qrBase64 = qrData.base64 || qrData.qr || qrData.image || qrData.qrCode
    console.log('✅ QR code received successfully, length:', qrBase64?.length || 0)

    // Make sure QR has proper format
    let formattedQR = qrBase64
    if (formattedQR && !formattedQR.startsWith('data:image')) {
      formattedQR = `data:image/png;base64,${formattedQR}`
    }

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrBase64,
        qr_code_url: formattedQR,
        status: qrData.status,
        message: 'QR code ready for scanning',
        expires_in: qrData.expire ? `${qrData.expire} seconds` : '60 seconds',
        attempt: retryCount + 1,
        debug_info: {
          response_keys: Object.keys(qrData),
          had_base64: !!qrData.base64,
          had_qr: !!qrData.qr,
          had_image: !!qrData.image
        }
      }),
      { status: 200, headers: corsHeaders }
    )

      } catch (error) {
        console.error(`❌ QR attempt ${retryCount + 1} failed:`, error.message)
        
        // Handle token invalidity immediately
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
          
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Token invalid - cleaned up',
                message: 'הטוקן לא תקין, נוקה מהמערכת. צור ערוץ חדש',
                token_cleaned: true,
                requires_new_channel: true
              }),
              { status: 401, headers: corsHeaders }
            )
          }

        
        // Retry logic for recoverable errors
        const retryableErrors = [
          'timeout', 'TIMEOUT', 'not available', 'still initializing', 
          'network', 'fetch', 'connection'
        ]
        
        const isRetryable = retryableErrors.some(keyword => 
          error.message.toLowerCase().includes(keyword.toLowerCase())
        )
        
        if (isRetryable && retryCount < maxRetries) {
          const retryDelay = Math.min(25000, 4000 * Math.pow(1.6, retryCount))
          console.log(`🔄 Retryable error, trying again in ${retryDelay/1000} seconds...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return getQRWithEnhancedRetry(token, retryCount + 1, maxRetries)
        }
        
        throw error
      }
    }

    // Execute the enhanced QR retrieval
    const result = await getQRWithEnhancedRetry(profile.whapi_token)

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 Final QR Error:', error.message, error.stack)
    
    let errorMessage = 'Failed to get QR code'
    let suggestion = 'Try again or create a new channel if the problem persists'
    
    if (error.message.includes('still initializing')) {
      errorMessage = 'Channel is still initializing. This can take up to 2 minutes.'
      suggestion = 'Please wait a moment and try again'
    } else if (error.message.includes('timed out')) {
      errorMessage = 'QR generation timed out. The service may be busy.'
      suggestion = 'Wait a few seconds and try again, or create a new channel'
    } else if (error.message.includes('Token invalid')) {
      errorMessage = 'Token invalid. Channel needs to be recreated.'
      suggestion = 'Go back and create a new channel'
    } else if (error.message.includes('not available')) {
      errorMessage = 'QR code not available. Channel may need more time.'
      suggestion = 'Wait 30 seconds and try again'
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message,
        suggestion: suggestion,
        retry_recommended: !error.message.includes('Token invalid')
      }),
      { status: 400, headers: corsHeaders }
    )
  }
})
