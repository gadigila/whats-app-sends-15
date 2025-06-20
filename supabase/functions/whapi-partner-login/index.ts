
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateChannelRequest {
  userId: string
}

// Helper function to wait/delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to check WHAPI status with retries
async function checkWhapiStatus(channelToken: string, maxAttempts = 10): Promise<{ status: string; ready: boolean }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔍 Status check attempt ${attempt + 1}/${maxAttempts}`)
      
      const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (statusResponse.ok) {
        const whapiStatus = await statusResponse.json()
        console.log('📊 WHAPI status:', whapiStatus)
        
        if (whapiStatus.status === 'qr' || whapiStatus.status === 'unauthorized' || whapiStatus.status === 'active') {
          console.log('✅ Channel is ready for QR generation!')
          return { status: whapiStatus.status, ready: true }
        } else if (whapiStatus.status === 'ready' || whapiStatus.status === 'launched') {
          console.log('📱 Channel is ready for authentication')
          return { status: whapiStatus.status, ready: true }
        } else {
          console.log(`⏳ Channel status: ${whapiStatus.status}, waiting...`)
        }
      } else {
        console.log(`⚠️ Status check failed: ${statusResponse.status}`)
      }
    } catch (error) {
      console.log(`❌ Status check error on attempt ${attempt + 1}:`, error.message)
    }
    
    // Wait before next attempt (exponential backoff)
    if (attempt < maxAttempts - 1) {
      const waitTime = Math.min(2000 * Math.pow(1.5, attempt), 10000) // Max 10 seconds
      console.log(`⏳ Waiting ${waitTime}ms before next attempt...`)
      await delay(waitTime)
    }
  }
  
  return { status: 'unknown', ready: false }
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

    // Check if user already has a valid instance
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
          channel_ready: profile.instance_status === 'unauthorized' || profile.instance_status === 'connected'
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
      channelId: channelData?.id,
      managerStatus: channelData?.status
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

    // Setup webhook
    console.log('🔗 Setting up webhook for channel:', channelId)
    const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`
    
    try {
      console.log('📡 Webhook URL:', webhookUrl)
      
      const webhookResponse = await fetch(`https://gate.whapi.cloud/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhooks: [{
            url: webhookUrl,
            events: [
              {"type": "users", "method": "post"},
              {"type": "channel", "method": "post"}
            ],
            callback_persist: true
          }]
        })
      })

      console.log('📥 Webhook setup response status:', webhookResponse.status)
      
      if (webhookResponse.ok) {
        const webhookResult = await webhookResponse.json()
        console.log('✅ Webhook setup successful:', webhookResult)
      } else {
        const webhookError = await webhookResponse.text()
        console.error('⚠️ Webhook setup failed:', {
          status: webhookResponse.status,
          error: webhookError,
          url: webhookUrl
        })
      }
    } catch (webhookError) {
      console.error('⚠️ Webhook setup error:', webhookError)
    }

    // Save initial channel data with 'initializing' status
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    
    console.log('💾 Saving channel data to database with INITIALIZING status...')

    const { error: updateError, data: updateData } = await supabase
      .from('profiles')
      .update({
        instance_id: channelId,
        whapi_token: channelToken,
        instance_status: 'initializing',
        payment_plan: 'trial',
        trial_expires_at: trialExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()

    if (updateError) {
      console.error('❌ Database update failed:', updateError)
      
      // Cleanup the created channel
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
          error: 'Failed to save channel data to database', 
          details: updateError.message 
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!updateData || updateData.length === 0) {
      console.error('❌ Database update verification failed: No rows affected')
      
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
          error: 'Database update failed - no rows affected'
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Database update verified successfully')

    // NEW: Active status checking with intelligent polling
    console.log('🔄 Starting active status polling...')
    
    try {
      // Initial delay to let the channel initialize
      await delay(3000)
      
      const statusResult = await checkWhapiStatus(channelToken, 10)
      
      if (statusResult.ready) {
        console.log('🎯 Channel is ready! Updating database status to unauthorized')
        
        const { error: statusUpdateError } = await supabase
          .from('profiles')
          .update({
            instance_status: 'unauthorized',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          
        if (statusUpdateError) {
          console.error('❌ Error updating channel status:', statusUpdateError)
        } else {
          console.log('✅ Successfully updated status to unauthorized')
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            channel_id: channelId,
            project_id: whapiProjectId,
            trial_expires_at: trialExpiresAt,
            channel_ready: true,
            message: 'Channel created and ready for QR generation',
            webhook_url: webhookUrl
          }),
          { status: 200, headers: corsHeaders }
        )
      } else {
        console.log('⏳ Channel not ready yet, will rely on webhook for status updates')
        
        return new Response(
          JSON.stringify({
            success: true,
            channel_id: channelId,
            project_id: whapiProjectId,
            trial_expires_at: trialExpiresAt,
            channel_ready: false,
            initialization_time: 60000,
            webhook_url: webhookUrl,
            message: 'Channel created. Waiting for initialization to complete via webhook.'
          }),
          { status: 200, headers: corsHeaders }
        )
      }
    } catch (statusError) {
      console.log('⚠️ Status polling failed, will rely on webhook:', statusError.message)
      
      return new Response(
        JSON.stringify({
          success: true,
          channel_id: channelId,
          project_id: whapiProjectId,
          trial_expires_at: trialExpiresAt,
          channel_ready: false,
          initialization_time: 60000,
          webhook_url: webhookUrl,
          message: 'Channel created. Status will be updated via webhook.'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('💥 Channel Creation Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
