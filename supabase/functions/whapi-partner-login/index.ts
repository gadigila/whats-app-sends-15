
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    let whapiProjectId = Deno.env.get('WHAPI_PROJECT_ID')
    
    console.log('🔐 WHAPI Channel Check/Creation: Starting for user...')
    
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

    // Start a database transaction to check and prevent duplicate channels
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
    if (profile?.instance_id && profile?.whapi_token && profile?.instance_status !== 'deleted') {
      console.log('✅ User already has existing instance:', profile.instance_id, 'Status:', profile.instance_status)
      return new Response(
        JSON.stringify({
          success: true,
          channel_id: profile.instance_id,
          message: 'Using existing instance',
          channel_ready: true
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Only create new instance if user doesn't have one
    console.log('🏗️ No existing instance found, creating new one...')

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

    // Save channel data to user profile with atomic operation
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const updateData = {
      instance_id: channelId,
      whapi_token: channelToken,
      instance_status: 'unauthorized',
      payment_plan: 'trial',
      trial_expires_at: trialExpiresAt,
      updated_at: new Date().toISOString()
    }

    console.log('💾 Saving channel data to database...', {
      userId,
      channelId,
      hasToken: !!channelToken,
      status: 'unauthorized'
    })

    // Use a transaction-like approach with immediate verification
    const { data: updateResult, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select('instance_id, whapi_token, instance_status')

    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError)
      
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
          error: 'Failed to save channel data to database', 
          details: updateError.message 
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Verify the data was actually saved
    if (!updateResult || updateResult.length === 0 || !updateResult[0]?.instance_id || !updateResult[0]?.whapi_token) {
      console.error('❌ Database update verification failed:', {
        hasResult: !!updateResult,
        resultLength: updateResult?.length || 0,
        hasInstanceId: !!updateResult?.[0]?.instance_id,
        hasToken: !!updateResult?.[0]?.whapi_token
      })
      
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
          error: 'Database update verification failed - data not properly saved'
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Database update verified successfully:', {
      savedInstanceId: updateResult[0].instance_id,
      savedStatus: updateResult[0].instance_status,
      hasToken: !!updateResult[0].whapi_token
    })

    console.log('✅ New channel creation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        project_id: whapiProjectId,
        trial_expires_at: trialExpiresAt,
        channel_ready: false, // Channel needs 1.5-2 minutes to initialize
        initialization_time: 120000, // 2 minutes in milliseconds
        message: 'New channel created successfully. Please wait 2 minutes before requesting QR code.'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Channel Check/Creation Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
