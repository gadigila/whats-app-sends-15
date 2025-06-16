
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

    // Get user's channel ID and token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_channel_id, whapi_token, instance_status, billing_status, trial_expires_at')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Profile not found:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (action === 'get_qr') {
      let instanceId = profile.whapi_channel_id
      let whapiToken = profile.whapi_token

      // If no channel exists, create one automatically
      if (!instanceId || !whapiToken) {
        console.log('No channel found, creating new channel for user:', userId)

        // Check if trial has expired
        if (profile.trial_expires_at && new Date() > new Date(profile.trial_expires_at) && profile.billing_status === 'trial') {
          return new Response(
            JSON.stringify({ error: 'Trial period has expired. Please upgrade to continue.' }),
            { status: 403, headers: corsHeaders }
          )
        }

        // Create channel via WHAPI Partner API
        const createChannelResponse = await fetch('https://partner-api.whapi.cloud/api/v1/channels', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `reecher_user_${userId}`,
            webhook_url: `${supabaseUrl}/functions/v1/whatsapp-webhook`
          })
        })

        if (!createChannelResponse.ok) {
          const errorText = await createChannelResponse.text()
          console.error('WHAPI channel creation failed:', errorText)
          return new Response(
            JSON.stringify({ error: 'Failed to create WhatsApp channel', details: errorText }),
            { status: 500, headers: corsHeaders }
          )
        }

        const channelData = await createChannelResponse.json()
        console.log('Channel created:', channelData)

        instanceId = channelData.instance_id || channelData.id
        whapiToken = channelData.whapi_token || channelData.token

        // Calculate trial expiration for new users
        const trialExpiresAt = profile.billing_status === 'trial' && !profile.trial_expires_at 
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days from now
          : profile.trial_expires_at

        // Update user profile with channel info
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            whapi_channel_id: instanceId,
            whapi_token: whapiToken,
            instance_status: 'created',
            trial_expires_at: trialExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Profile update error:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update user profile', details: updateError }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // Now get QR code
      console.log('Fetching QR code for instance:', instanceId);
      const qrResponse = await fetch(`https://gate.whapi.cloud/instance/qr?instance_id=${instanceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${whapiToken}`
        }
      })

      if (!qrResponse.ok) {
        const errorText = await qrResponse.text()
        console.error('QR fetch failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to get QR code', details: errorText }),
          { status: 500, headers: corsHeaders }
        )
      }

      const qrData = await qrResponse.json()
      console.log('QR data received for instance:', instanceId, qrData)

      // QR can be at qrData.qr_code or qrData.qr. Try both.
      const qrCode = qrData.qr_code || qrData.qr
      if (!qrCode) {
        console.error('No QR code found in response:', qrData)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          qr_code: qrCode,
          status: qrData.status,
          details: qrData
        }),
        { status: 200, headers: corsHeaders }
      )

    } else if (action === 'check_status') {
      const instanceId = profile.whapi_channel_id
      const whapiToken = profile.whapi_token

      if (!whapiToken || !instanceId) {
        return new Response(
          JSON.stringify({ error: 'WhatsApp channel not found. Please get QR code first.' }),
          { status: 404, headers: corsHeaders }
        )
      }

      // Check connection status using instance_id with token
      const statusResponse = await fetch(`https://gate.whapi.cloud/instance/status?instance_id=${instanceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${whapiToken}`
        }
      })

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error('Status check failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to check status', details: errorText }),
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
      const instanceId = profile.whapi_channel_id
      const whapiToken = profile.whapi_token

      if (!whapiToken || !instanceId) {
        return new Response(
          JSON.stringify({ error: 'WhatsApp channel not found' }),
          { status: 404, headers: corsHeaders }
        )
      }

      // Disconnect WhatsApp using the instance's token
      const disconnectResponse = await fetch(`https://gate.whapi.cloud/instance/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instance_id: instanceId
        })
      })

      if (!disconnectResponse.ok) {
        const errorText = await disconnectResponse.text()
        console.error('Disconnect failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect', details: errorText }),
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
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
