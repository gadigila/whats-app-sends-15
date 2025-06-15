import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateInstanceRequest {
  userId: string
}

interface DeleteInstanceRequest {
  userId: string
  instanceId: string
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

    const { method } = req
    const body = method === 'POST' || method === 'DELETE' ? await req.json() : null

    console.log(`Instance Manager: ${method} request received`)

    if (method === 'POST') {
      // Create new channel using Partner API
      const { userId } = body as CreateInstanceRequest

      console.log(`Creating channel for user: ${userId}`)

      // Check user's current status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('billing_status, whapi_channel_id, trial_expires_at, payment_plan')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        return new Response(
          JSON.stringify({ error: 'User profile not found' }),
          { status: 404, headers: corsHeaders }
        )
      }

      // Check if user already has an active channel
      if (profile.whapi_channel_id && profile.billing_status !== 'expired') {
        return new Response(
          JSON.stringify({ 
            error: 'User already has an active channel',
            channelId: profile.whapi_channel_id 
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Check if trial has expired
      if (profile.trial_expires_at && new Date() > new Date(profile.trial_expires_at) && profile.billing_status === 'trial') {
        return new Response(
          JSON.stringify({ error: 'Trial period has expired. Please upgrade to continue.' }),
          { status: 403, headers: corsHeaders }
        )
      }

      console.log(`User status: ${profile.billing_status} - creating channel`)

      // Add more logging
      console.log(`User profile fetched:`, profile);

      // Create channel via WHAPI Partner API (corrected URL)
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

      // Calculate trial expiration for new users
      const trialExpiresAt = profile.billing_status === 'trial' && !profile.trial_expires_at 
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days from now
        : profile.trial_expires_at

      // Update user profile with channel info - using instance_id from WHAPI response
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          whapi_channel_id: channelData.instance_id || channelData.id, // Use instance_id if available
          whapi_token: channelData.whapi_token || channelData.token,
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          channelId: channelData.instance_id || channelData.id,
          instanceId: channelData.instance_id || channelData.id,
          token: channelData.whapi_token || channelData.token,
          status: 'created',
          trialExpiresAt: trialExpiresAt
        }),
        { status: 200, headers: corsHeaders }
      )

    } else if (method === 'DELETE') {
      // Delete channel
      const { userId, instanceId } = body as DeleteInstanceRequest

      console.log(`Deleting channel ${instanceId} for user: ${userId}`)

      // Verify channel belongs to user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('whapi_channel_id')
        .eq('id', userId)
        .single()

      if (profileError || profile.whapi_channel_id !== instanceId) {
        return new Response(
          JSON.stringify({ error: 'Channel not found or unauthorized' }),
          { status: 404, headers: corsHeaders }
        )
      }

      // Delete channel via WHAPI Partner API (corrected URL)
      const deleteChannelResponse = await fetch(`https://partner-api.whapi.cloud/api/v1/channels/${instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!deleteChannelResponse.ok) {
        const errorText = await deleteChannelResponse.text()
        console.error('WHAPI channel deletion failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to delete WhatsApp channel' }),
          { status: 500, headers: corsHeaders }
        )
      }

      // Update user profile to remove channel
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          whapi_channel_id: null,
          whapi_token: null,
          instance_status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update user profile' }),
          { status: 500, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      )

    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('Instance Manager Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
