
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
    console.log('🔲 WHAPI Get QR - Following Official Documentation')
    
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

    // QR Code retrieval with retry logic (as per documentation)
    async function getQRWithRetry(retryCount = 0, maxRetries = 3) {
      try {
        console.log(`🔲 Getting QR code (attempt ${retryCount + 1}/${maxRetries + 1})...`)
        
        // Use /screen endpoint as per documentation
        const qrResponse = await fetch(`https://gate.whapi.cloud/screen`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })

        if (!qrResponse.ok) {
          const errorText = await qrResponse.text()
          console.error(`❌ QR request failed (${qrResponse.status}):`, errorText)
          throw new Error(`QR request failed: ${errorText}`)
        }

        const qrData = await qrResponse.json()
        console.log('📊 QR response received:', { hasQR: !!qrData.qr_code, status: qrData.status })

        // Check if already connected
        if (qrData.status === 'connected' || qrData.me) {
          console.log('✅ Already connected to WhatsApp!')
          
          // Update database status
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
            message: 'WhatsApp is already connected'
          }
        }

        // Check if QR code is available
        if (!qrData.qr_code) {
          throw new Error('QR code not available yet - channel may still be initializing')
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
        console.error(`❌ QR attempt ${retryCount + 1} failed:`, error.message)
        
        // Retry logic for temporary failures
        if (retryCount < maxRetries && 
            (error.name === 'TimeoutError' || 
             error.message.includes('still be initializing') ||
             error.message.includes('not available yet'))) {
          
          console.log(`🔄 Retrying in 30 seconds... (attempt ${retryCount + 2}/${maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, 30000))
          return getQRWithRetry(retryCount + 1, maxRetries)
        }
        
        throw error
      }
    }

    // Get QR code with retry logic
    const qrResult = await getQRWithRetry()

    return new Response(
      JSON.stringify(qrResult),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 QR Error:', error)
    
    let errorMessage = 'Failed to get QR code'
    if (error.message.includes('still be initializing')) {
      errorMessage = 'Channel is still loading. Please wait and try again.'
    } else if (error.message.includes('not available yet')) {
      errorMessage = 'QR code not ready yet. Channel may need more time to initialize.'
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message,
        suggestion: 'Try again in 30-60 seconds'
      }),
      { status: 400, headers: corsHeaders }
    )
  }
})
