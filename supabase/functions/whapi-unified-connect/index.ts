
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface ConnectRequest {
  userId: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: ConnectRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔄 Unified Connect for user:', userId)

    // Check if user already has a working instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // If user has a connected instance, return success
    if (profile?.instance_status === 'connected' && profile?.instance_id && profile?.whapi_token) {
      console.log('✅ User already connected:', profile.instance_id)
      return new Response(
        JSON.stringify({
          success: true,
          already_connected: true,
          instance_id: profile.instance_id,
          message: 'Already connected to WhatsApp'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // If user has an instance but it's not connected, try to get QR
    if (profile?.instance_id && profile?.whapi_token) {
      console.log('🔍 Checking existing instance:', profile.instance_id)
      
      try {
        const qrResponse = await fetch(`https://gate.whapi.cloud/screenshot`, {
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Accept': 'image/png'
          }
        })

        if (qrResponse.ok) {
          const qrBlob = await qrResponse.blob()
          const qrArrayBuffer = await qrBlob.arrayBuffer()
          const qrBase64 = btoa(String.fromCharCode(...new Uint8Array(qrArrayBuffer)))
          
          // Update status to unauthorized (ready for QR)
          await supabase
            .from('profiles')
            .update({
              instance_status: 'unauthorized',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          console.log('✅ QR code generated for existing instance')
          return new Response(
            JSON.stringify({
              success: true,
              qr_code: `data:image/png;base64,${qrBase64}`,
              instance_id: profile.instance_id,
              message: 'QR code ready for scanning'
            }),
            { status: 200, headers: corsHeaders }
          )
        }
      } catch (error) {
        console.log('⚠️ Existing instance not working, will create new one:', error.message)
      }
    }

    // Create new instance
    console.log('🆕 Creating new instance...')
    
    const { data: createResult, error: createError } = await supabase.functions.invoke('whapi-partner-login', {
      body: { userId }
    })

    if (createError || !createResult?.success) {
      console.error('❌ Failed to create instance:', createError || createResult)
      return new Response(
        JSON.stringify({ error: 'Failed to create new instance' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ New instance created successfully')
    return new Response(
      JSON.stringify({
        success: true,
        instance_id: createResult.channel_id,
        message: 'New instance created, initializing...',
        retry_after: 5000
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Unified Connect Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
