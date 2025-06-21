
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetQRRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔲 WHAPI Get QR - With Health Pre-Check')
    
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

    // NEW: Health pre-check before requesting QR
    async function checkHealthAndGetQR(token: string, retryCount = 0, maxRetries = 3) {
      try {
        console.log(`🔍 Health pre-check (attempt ${retryCount + 1}/${maxRetries + 1})...`)
        
        // First, check health status
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
        console.log('📊 Health status:', healthData.status)

        // If connected, update DB and return success
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

        // If not ready for QR yet, retry or fail
        if (!['qr', 'unauthorized'].includes(healthData.status)) {
          if (retryCount < maxRetries) {
            console.log(`⏳ Status is "${healthData.status}", retrying in 10 seconds...`)
            await new Promise(resolve => setTimeout(resolve, 10000))
            return checkHealthAndGetQR(token, retryCount + 1, maxRetries)
          } else {
            throw new Error(`Channel not ready for QR. Status: ${healthData.status}`)
          }
        }

        // Now get QR code
        console.log(`🔲 Health check passed, getting QR code...`)
        
        const qrResponse = await fetch(`https://gate.whapi.cloud/screen`, {
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
        console.log('📊 QR response received:', { hasQR: !!qrData.qr_code, status: qrData.status })

        // Double-check for connection status
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

        if (!qrData.qr_code) {
          throw new Error('QR code not available')
        }

        console.log('✅ QR code received successfully')
        return {
          success: true,
          qr_code: qrData.qr_code,
          qr_code_url: `data:image/png;base64,${qrData.qr_code}`,
          status: qrData.status,
          message: 'QR code ready for scanning',
          expires_in: '60 seconds'
        }

      } catch (error) {
        console.error(`❌ Health/QR attempt ${retryCount + 1} failed:`, error.message)
        
        // Handle token invalidity
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
          
          return {
            success: false,
            error: 'Token invalid - cleaned up',
            message: 'הטוקן לא תקין, נוקה מהמערכת. צור ערוץ חדש',
            token_cleaned: true,
            requires_new_channel: true
          }
        }
        
        // Retry logic for temporary failures
        if (retryCount < maxRetries && 
            (error.name === 'TimeoutError' || 
             error.message.includes('not ready') ||
             error.message.includes('not available'))) {
          
          const retryDelay = Math.min(30000, 5000 * Math.pow(2, retryCount)) // Exponential backoff
          console.log(`🔄 Retrying in ${retryDelay/1000} seconds... (attempt ${retryCount + 2}/${maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return checkHealthAndGetQR(token, retryCount + 1, maxRetries)
        }
        
        throw error
      }
    }

    // Execute the improved health check and QR retrieval
    const result = await checkHealthAndGetQR(profile.whapi_token)

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 QR Error:', error)
    
    let errorMessage = 'Failed to get QR code'
    if (error.message.includes('not ready')) {
      errorMessage = 'Channel is not ready for QR yet. Please wait and try again.'
    } else if (error.message.includes('not available')) {
      errorMessage = 'QR code not available. Channel may need more time to initialize.'
    } else if (error.message.includes('Token invalid')) {
      errorMessage = 'Token invalid. Please create a new channel.'
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message,
        suggestion: 'Try again or create a new channel if the problem persists'
      }),
      { status: 400, headers: corsHeaders }
    )
  }
})
