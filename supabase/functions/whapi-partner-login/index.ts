
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateChannelRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    console.log('🔐 WHAPI Channel Creation: Starting...')
    
    if (!whapiPartnerToken) {
      console.error('❌ Missing WHAPI partner token')
      return new Response(
        JSON.stringify({ error: 'WHAPI partner token not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: CreateChannelRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Check if user already has a channel
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token')
      .eq('id', userId)
      .single()

    if (profile?.instance_id && profile?.whapi_token) {
      console.log('✅ User already has a channel:', profile.instance_id)
      return new Response(
        JSON.stringify({
          success: true,
          channel_id: profile.instance_id,
          message: 'Channel already exists and is valid'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Create new channel using Manager API
    console.log('🏗️ Creating new channel with Manager API...')
    
    const createChannelResponse = await fetch('https://manager.whapi.cloud/channels', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `reecher_user_${userId}`,
        projectId: `reecher_project_${userId}`
      })
    })

    console.log('📥 Channel creation response status:', createChannelResponse.status)

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text()
      console.error('❌ Channel creation failed:', {
        status: createChannelResponse.status,
        error: errorText
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create channel', 
          details: `Status: ${createChannelResponse.status}, Error: ${errorText}` 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const channelData = await createChannelResponse.json()
    console.log('✅ Channel created successfully:', {
      hasToken: !!channelData?.token,
      hasId: !!channelData?.id,
      responseKeys: Object.keys(channelData || {})
    })

    const channelId = channelData?.id
    const channelToken = channelData?.token

    if (!channelId || !channelToken) {
      console.error('❌ No channel ID or token received:', channelData)
      return new Response(
        JSON.stringify({ 
          error: 'No channel ID or token received from WHAPI', 
          responseData: channelData 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Save channel data to user profile
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    console.log('💾 Saving channel data to database...')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: channelId,
        whapi_token: channelToken,
        instance_status: 'created',
        payment_plan: 'trial',
        trial_expires_at: trialExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError)
      
      // Attempt to delete the created channel since we couldn't save it
      try {
        await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })
        console.log('🗑️ Cleaned up channel from WHAPI due to DB error')
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup channel:', cleanupError)
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to save channel data', details: updateError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Channel creation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        trial_expires_at: trialExpiresAt,
        message: 'Channel created successfully'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Channel Creation Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
