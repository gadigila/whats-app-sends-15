
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
    let whapiProjectId = Deno.env.get('WHAPI_PROJECT_ID')
    
    console.log('🔐 WHAPI Channel Creation: Starting for user...')
    
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

    console.log('👤 Processing request for user:', userId)

    // Check if user profile exists first
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, updated_at')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // If user already has a valid instance, return it
    if (profile?.instance_id && profile?.whapi_token && profile?.instance_status !== 'disconnected') {
      console.log('✅ User already has existing instance:', profile.instance_id, 'Status:', profile.instance_status)
      return new Response(
        JSON.stringify({
          success: true,
          channel_id: profile.instance_id,
          message: 'Using existing instance',
          channel_ready: profile.instance_status === 'authorized' || profile.instance_status === 'connected'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('🏗️ Creating new instance...')

    // Get project ID with fallback mechanism
    if (!whapiProjectId) {
      console.log('🔍 No WHAPI_PROJECT_ID set, fetching from API...')
      
      try {
        const projectsResponse = await fetch('https://manager.whapi.cloud/projects', {
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })

        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json()
          console.log('📥 Projects response:', projectsData)
          
          if (projectsData && projectsData.length > 0) {
            whapiProjectId = projectsData[0].id
            console.log('✅ Using fallback project ID:', whapiProjectId)
          } else {
            console.error('❌ No projects found in account')
            return new Response(
              JSON.stringify({ error: 'No projects found in WHAPI account' }),
              { status: 400, headers: corsHeaders }
            )
          }
        } else {
          console.error('❌ Failed to fetch projects:', projectsResponse.status)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch project ID from WHAPI' }),
            { status: 400, headers: corsHeaders }
          )
        }
      } catch (error) {
        console.error('❌ Error fetching projects:', error)
        return new Response(
          JSON.stringify({ error: 'Error fetching project ID' }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    console.log('🏗️ Creating new channel with project ID:', whapiProjectId)

    // Create new channel using Manager API
    const createChannelResponse = await fetch('https://manager.whapi.cloud/channels', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `reecher_user_${userId.substring(0, 8)}`,
        projectId: whapiProjectId
      })
    })

    console.log('📥 Channel creation response status:', createChannelResponse.status)

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text()
      console.error('❌ Channel creation failed:', {
        status: createChannelResponse.status,
        error: errorText,
        projectId: whapiProjectId
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
      projectId: whapiProjectId,
      channelId: channelData?.id
    })

    const channelId = channelData?.id
    const channelToken = channelData?.token

    if (!channelId || !channelToken) {
      console.error('❌ No channel ID or token received:', channelData)
      return new Response(
        JSON.stringify({ 
          error: 'No channel ID or token received from WHAPI'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Verify the channel is accessible before saving to database
    console.log('🔍 Verifying channel accessibility...')
    try {
      const verifyResponse = await fetch(`https://gate.whapi.cloud/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${channelToken}`
        }
      })
      
      if (!verifyResponse.ok) {
        console.error('❌ Channel verification failed:', verifyResponse.status)
        throw new Error(`Channel not accessible: ${verifyResponse.status}`)
      }
      console.log('✅ Channel verified as accessible')
    } catch (verifyError) {
      console.error('❌ Channel verification error:', verifyError)
      
      // Cleanup the created channel since it's not accessible
      try {
        await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })
        console.log('✅ Cleaned up inaccessible channel')
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup channel:', cleanupError)
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Created channel is not accessible',
          details: verifyError.message
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Setup webhook for the channel using correct WHAPI format
    console.log('🔗 Setting up webhook for channel:', channelId)
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`
    
    try {
      const webhookResponse = await fetch(`https://gate.whapi.cloud/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhooks: [{
            url: webhookUrl,
            events: ['users', 'channel'],
            mode: 'body'
          }]
        })
      })

      if (webhookResponse.ok) {
        console.log('✅ Webhook setup successful')
      } else {
        const webhookError = await webhookResponse.text()
        console.error('⚠️ Webhook setup failed:', webhookError)
        // Continue anyway - webhook failure shouldn't block channel creation
      }
    } catch (webhookError) {
      console.error('⚠️ Webhook setup error:', webhookError)
      // Continue anyway
    }

    // Save channel data to user profile with comprehensive error handling
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    
    console.log('💾 Saving channel data to database...', {
      userId,
      channelId,
      hasToken: !!channelToken,
      tokenLength: channelToken.length
    })

    // First, try using the RPC function
    console.log('🔄 Attempting RPC function update...')
    const { error: rpcError } = await supabase.rpc('update_user_instance', {
      user_id: userId,
      new_instance_id: channelId,
      new_whapi_token: channelToken,
      new_status: 'unauthorized',
      new_plan: 'trial',
      new_trial_expires: trialExpiresAt
    })

    if (rpcError) {
      console.error('❌ RPC update failed:', rpcError)
      
      // Fallback to direct update
      console.log('🔄 Attempting direct database update...')
      const { error: updateError, data: updateData } = await supabase
        .from('profiles')
        .update({
          instance_id: channelId,
          whapi_token: channelToken,
          instance_status: 'unauthorized',
          payment_plan: 'trial',
          trial_expires_at: trialExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()

      if (updateError) {
        console.error('❌ Direct update also failed:', updateError)
        
        // Cleanup the created channel since we couldn't save it
        try {
          console.log('🗑️ Attempting to cleanup channel from WHAPI due to DB error...')
          const deleteResponse = await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${whapiPartnerToken}`
            }
          })
          
          if (deleteResponse.ok) {
            console.log('✅ Successfully cleaned up channel from WHAPI')
          } else {
            console.error('❌ Failed to cleanup channel from WHAPI:', deleteResponse.status)
          }
        } catch (cleanupError) {
          console.error('❌ Error during channel cleanup:', cleanupError)
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Both RPC and direct update failed', 
            details: `RPC: ${rpcError.message}, Direct: ${updateError.message}` 
          }),
          { status: 500, headers: corsHeaders }
        )
      }

      // Verify the direct update worked
      if (!updateData || updateData.length === 0) {
        console.error('❌ Database update verification failed: No rows affected')
        
        // Try to cleanup the channel
        try {
          await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${whapiPartnerToken}`
            }
          })
        } catch (cleanupError) {
          console.error('❌ Cleanup error:', cleanupError)
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Database update verification failed'
          }),
          { status: 500, headers: corsHeaders }
        )
      }

      console.log('✅ Direct database update verified:', {
        savedInstanceId: updateData[0].instance_id,
        savedStatus: updateData[0].instance_status,
        hasToken: !!updateData[0].whapi_token
      })
    } else {
      console.log('✅ RPC update successful')
      
      // Verify RPC update worked
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('instance_id, whapi_token, instance_status')
        .eq('id', userId)
        .single()

      if (verifyError || !verifyData?.instance_id || !verifyData?.whapi_token) {
        console.error('❌ RPC update verification failed:', { verifyError, verifyData })
        
        // Cleanup and return error
        try {
          await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${whapiPartnerToken}`
            }
          })
        } catch (cleanupError) {
          console.error('❌ Cleanup error:', cleanupError)
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'RPC update verification failed'
          }),
          { status: 500, headers: corsHeaders }
        )
      }

      console.log('✅ RPC update verified:', {
        savedInstanceId: verifyData.instance_id,
        savedStatus: verifyData.instance_status,
        hasToken: !!verifyData.whapi_token
      })
    }

    console.log('✅ New channel creation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        project_id: whapiProjectId,
        trial_expires_at: trialExpiresAt,
        channel_ready: false,
        initialization_time: 60000, // 1 minute
        message: 'New channel created successfully. Webhooks configured. Channel ready for QR generation.'
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
