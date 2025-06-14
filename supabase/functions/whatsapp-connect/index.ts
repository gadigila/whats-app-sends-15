
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConnectRequest {
  userId: string
  action: 'get_qr' | 'check_status' | 'disconnect'
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
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      )
    }

    const { userId, action } = await req.json() as ConnectRequest

    console.log(`WhatsApp Connect: ${action} for user ${userId}`)

    // Get user's instance ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile.instance_id) {
      console.error('Profile or instance not found:', profileError)
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found. Please create an instance first.' }),
        { status: 404, headers: corsHeaders }
      )
    }

    const instanceId = profile.instance_id

    if (action === 'get_qr') {
      // Get QR code for WhatsApp connection
      const qrResponse = await fetch(`https://gate.whapi.cloud/instances/${instanceId}/qr`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!qrResponse.ok) {
        const errorText = await qrResponse.text()
        console.error('QR fetch failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to get QR code' }),
          { status: 500, headers: corsHeaders }
        )
      }

      const qrData = await qrResponse.json()
      console.log('QR data received for instance:', instanceId)

      return new Response(
        JSON.stringify({ 
          success: true, 
          qr_code: qrData.qr_code || qrData.qr,
          status: qrData.status 
        }),
        { status: 200, headers: corsHeaders }
      )

    } else if (action === 'check_status') {
      // Check connection status
      const statusResponse = await fetch(`https://gate.whapi.cloud/instances/${instanceId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error('Status check failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to check status' }),
          { status: 500, headers: corsHeaders }
        )
      }

      const statusData = await statusResponse.json()
      console.log('Status data for instance:', instanceId, statusData)

      // Update instance status in database
      const newStatus = statusData.status === 'authenticated' ? 'connected' : 'disconnected'
      
      await supabase
        .from('profiles')
        .update({ 
          instance_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: statusData.status,
          connected: statusData.status === 'authenticated'
        }),
        { status: 200, headers: corsHeaders }
      )

    } else if (action === 'disconnect') {
      // Disconnect WhatsApp
      const disconnectResponse = await fetch(`https://gate.whapi.cloud/instances/${instanceId}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!disconnectResponse.ok) {
        const errorText = await disconnectResponse.text()
        console.error('Disconnect failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect' }),
          { status: 500, headers: corsHeaders }
        )
      }

      // Update instance status
      await supabase
        .from('profiles')
        .update({ 
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      )

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('WhatsApp Connect Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
