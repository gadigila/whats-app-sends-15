import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔲 Getting QR Code - Using CORRECT WHAPI Endpoint')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's channel info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'No WhatsApp channel found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📱 Getting QR for channel:', profile.instance_id)

    // Step 1: Check if already connected using /health
    const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (healthResponse.ok) {
      const healthData = await healthResponse.json()
      console.log('📊 Health status:', healthData.status)

      // If already connected, update database and return
      if (healthData.status === 'connected' && healthData.me?.phone) {
        console.log('✅ Already connected:', healthData.me.phone)
        
        await supabase
          .from('profiles')
          .update({
            instance_status: 'connected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        return new Response(
          JSON.stringify({
            success: true,
            already_connected: true,
            phone: healthData.me.phone,
            message: 'WhatsApp is already connected'
          }),
          { status: 200, headers: corsHeaders }
        )
      }
    }

    // Step 2: Get QR code using CORRECT endpoint from WHAPI docs
    console.log('🔲 Getting QR code using /users/login...')
    
    // Using the EXACT endpoint from WHAPI documentation
    const qrResponse = await fetch(`https://gate.whapi.cloud/users/login?wakeup=true&size=400`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('📤 QR Response status:', qrResponse.status)

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('❌ QR request failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get QR code',
          details: errorText 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const qrData = await qrResponse.json()
    console.log('📤 QR Response data keys:', Object.keys(qrData))
    console.log('📤 QR Status:', qrData.status)

    // Handle if already connected during QR request
    if (qrData.status === 'connected' && qrData.me?.phone) {
      console.log('✅ Connected during QR request!')
      
      await supabase
        .from('profiles')
        .update({
          instance_status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return new Response(
        JSON.stringify({
          success: true,
          already_connected: true,
          phone: qrData.me.phone,
          message: 'WhatsApp connected during QR request'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Extract QR code from response
    // According to WHAPI docs, /users/login returns base64 field
    const qrCode = qrData.base64 || qrData.qr || qrData.image

    if (!qrCode) {
      console.error('❌ No QR code in response:', qrData)
      return new Response(
        JSON.stringify({ 
          error: 'QR code not available',
          details: 'Channel may not be ready yet',
          response: qrData
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Format QR code for display
    let formattedQR = qrCode
    if (!formattedQR.startsWith('data:image')) {
      formattedQR = `data:image/png;base64,${qrCode}`
    }

    console.log('✅ QR code received, length:', qrCode.length)

    // Update status to show QR is being displayed  
    await supabase
      .from('profiles')
      .update({
        instance_status: 'qr_displayed',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrCode,
        qr_code_url: formattedQR,
        message: 'QR code ready for scanning',
        expires_in: qrData.expire || 60
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 QR Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get QR code',
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})