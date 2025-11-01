import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
}

interface CreateChannelRequest {
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
    console.log('🚀 WHAPI Create Channel - With COMPLETE Automatic Notification Fix')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    const whapiProjectId = Deno.env.get('WHAPI_PROJECT_ID')!
    
    if (!supabaseUrl || !supabaseServiceKey || !whapiPartnerToken || !whapiProjectId) {
      console.error('❌ Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration missing' }),
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

    console.log('👤 Creating channel for user:', userId)

    // Check if user already has a valid channel
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Clean up any existing invalid channel
    if (profile?.instance_id) {
      console.log('🧹 Cleaning up existing channel before creating new one')
      await supabase
        .from('profiles')
        .update({
          instance_id: null,
          whapi_token: null,
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    // Generate unique friendly channel name
    const channelName = `REECHER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    console.log('🆔 Generated friendly channel name:', channelName)

    // Step 1: Create channel using Partner API
    console.log('📱 Creating channel with Partner API...')
    const createChannelResponse = await fetch('https://manager.whapi.cloud/channels', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: channelName,
        projectId: whapiProjectId
      })
    });

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text()
      console.error('❌ Channel creation failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create channel', 
          details: errorText 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const channelData = await createChannelResponse.json()
    const channelToken = channelData?.token

    if (!channelToken) {
      console.error('❌ No token received from WHAPI')
      return new Response(
        JSON.stringify({ error: 'No token received from WHAPI' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🔑 CRITICAL: Extract canonical WHAPI ChannelID
    const WHAPI_ID_REGEX = /^(?:[A-Z]{6}-[A-Z0-9]{5}|[A-Z0-9]{12})$/
    const idCandidates = [
      channelData?.id,
      channelData?.channel?.id,
      channelData?.result?.id,
      channelData?.data?.id,
      channelData?.ChannelID,
      channelData?.channelId
    ]
    
    const whapiChannelId = idCandidates.find(
      (v) => typeof v === 'string' && WHAPI_ID_REGEX.test(v)
    )

    if (!whapiChannelId) {
      console.error('❌ No valid canonical WHAPI ChannelID found in response:', channelData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to extract canonical WHAPI ChannelID from response',
          received: channelData 
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Channel created successfully')
    console.log('📋 Canonical WHAPI ChannelID:', whapiChannelId)
    console.log('📋 Friendly channel name:', channelName)

    // Step 2: Setup webhooks with notification fix
    console.log('🔗 Setting up webhooks with complete notification fix...')
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook-simple?userId=${userId}`
    
    const webhookResponse = await fetch(`https://gate.whapi.cloud/settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // 🔔 COMPLETE NOTIFICATION FIX
        offline_mode: true,               // Don't send online status automatically
        callback_backoff_delay_ms: 3000,
        max_callback_backoff_delay_ms: 900000,
        
        webhooks: [{
          url: webhookUrl,
          events: [
            { type: 'ready', method: 'post' },
            { type: 'auth_failure', method: 'post' },
            { type: 'groups', method: 'post' },
            { type: 'statuses', method: 'post' }
          ],
          callback_persist: true
        }]
      })
    })

    if (!webhookResponse.ok) {
      const webhookError = await webhookResponse.text()
      console.error('⚠️ Webhook setup failed:', webhookError)
    } else {
      console.log('✅ Webhook configured with offline_mode')
    }

    // Step 3: Check existing subscription status before saving
    console.log('🔍 Checking user subscription status before channel setup...')

    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('payment_plan, subscription_status, subscription_expires_at')
      .eq('id', userId)
      .single()

    if (profileCheckError) {
      console.error('❌ Error checking profile:', profileCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to check user profile' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Determine if user has active paid subscription
    const hasPaidSubscription = existingProfile?.subscription_status === 'active' && 
                                ['monthly', 'yearly'].includes(existingProfile.payment_plan || '')

    console.log('📊 User subscription status:', {
      subscription_status: existingProfile?.subscription_status,
      payment_plan: existingProfile?.payment_plan,
      hasPaidSubscription
    })

    // Prepare update data - preserve payment plan if user already paid
    // 🔑 CRITICAL: Store canonical WHAPI ChannelID, not friendly name
    const updateData: any = {
      instance_id: whapiChannelId,
      whapi_channel_id: whapiChannelId,
      whapi_token: channelToken,
      instance_status: 'initializing',
      updated_at: new Date().toISOString()
    }

    // Only set trial data if user is NOT already paid
    if (!hasPaidSubscription) {
      console.log('📝 Setting trial plan (user has not paid yet)')
      updateData.payment_plan = 'trial'
      updateData.trial_expires_at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    } else {
      console.log('✅ Preserving existing paid plan:', existingProfile.payment_plan)
      // Don't override payment_plan or trial_expires_at - keep existing values
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Database update failed:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to save channel data' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Step 4: Poll /health until channel is ready
    console.log('🔍 Starting health polling until channel is ready...')
    
    let healthStatus = 'initializing'
    let pollAttempts = 0
    const maxPollAttempts = 24
    
    while (pollAttempts < maxPollAttempts && !['qr', 'unauthorized', 'connected', 'QR'].includes(healthStatus)) {
      pollAttempts++
      console.log(`🔍 Health check attempt ${pollAttempts}/${maxPollAttempts}...`)
    
      try {
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${channelToken}`,
            'Content-Type': 'application/json'
          }
        })
    
        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          healthStatus = typeof healthData.status === 'object' ? healthData.status.text : healthData.status
          console.log(`📊 Health status: ${healthStatus}`)
        } else {
          console.log(`⚠️ Health check failed: ${healthResponse.status}`)
        }
      } catch (error) {
        console.log(`⚠️ Health check error: ${error.message}`)
      }
    
      if (pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    
    // Step 5: Determine final status
    let finalStatus = 'initializing'
    const normalizedStatus = (healthStatus || '').toLowerCase()
    
    if (normalizedStatus === 'connected') {
      finalStatus = 'connected'
    } else if (['qr', 'unauthorized'].includes(normalizedStatus)) {
      finalStatus = 'unauthorized'
    } else {
      console.log(`⚠️ Channel did not become ready in time. Final health status: ${normalizedStatus}`)
    }

    // Step 6: 🔔 AUTOMATIC PRESENCE FIX - Set to offline when channel is ready
    if (['unauthorized', 'connected'].includes(finalStatus)) {
      console.log('🔄 Setting presence to OFFLINE automatically for notifications...')
      
      try {
        const presenceResponse = await fetch(`https://gate.whapi.cloud/presences/me`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${channelToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            presence: 'offline'
          })
        })

        if (presenceResponse.ok) {
          console.log('✅ AUTOMATIC presence set to offline - notifications should work!')
        } else {
          const presenceError = await presenceResponse.text()
          console.log('⚠️ Failed to set automatic presence:', presenceError)
        }
      } catch (presenceError) {
        console.log('⚠️ Error setting automatic presence:', presenceError)
      }
    }

    // Step 7: 🚀 AUTO-UPGRADE to LIVE if user has paid subscription
    let channelUpgradedToLive = false
    if (['unauthorized', 'connected'].includes(finalStatus) && hasPaidSubscription) {
      console.log('💰 User has paid subscription - upgrading channel to LIVE mode...')
      console.log('🔑 Using canonical WHAPI ChannelID:', whapiChannelId)
      
      try {
        const upgradeResponse = await fetch(`https://manager.whapi.cloud/channels/${whapiChannelId}/mode`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mode: 'live'
          })
        })

        if (upgradeResponse.ok) {
          console.log('✅ Channel automatically upgraded to LIVE mode!')
          channelUpgradedToLive = true
        } else {
          const upgradeError = await upgradeResponse.text()
          console.log('⚠️ Failed to auto-upgrade channel:', upgradeError)
        }
      } catch (upgradeError) {
        console.log('⚠️ Error auto-upgrading channel:', upgradeError)
      }
    }

    await supabase
      .from('profiles')
      .update({
        instance_status: finalStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    console.log(`🎯 Channel creation completed with final status: ${finalStatus}`)

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: whapiChannelId,
        channel_name: channelName,
        final_status: finalStatus,
        health_polls: pollAttempts,
        is_paid_user: hasPaidSubscription,
        channel_mode: hasPaidSubscription ? 'live' : 'trial',
        auto_upgraded_to_live: channelUpgradedToLive,
        message: finalStatus === 'connected' 
          ? (hasPaidSubscription ? 'Channel created, connected, and upgraded to LIVE' : 'Channel created and already connected') 
          : (hasPaidSubscription ? 'Channel created as LIVE, ready for QR code' : 'Channel created as TRIAL, ready for QR code'),
        next_step: finalStatus === 'connected' ? 'Already connected' : 'Get QR code',
        webhook_configured: true,
        notification_fix_applied: true,
        automatic_presence_set: true,
        notification_method: 'offline_mode + automatic offline presence',
        webhook_optimization: 'Complete notification fix applied automatically'
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