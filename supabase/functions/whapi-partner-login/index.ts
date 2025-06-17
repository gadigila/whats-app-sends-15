
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

    // Check if user already has a channel in database with transaction
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

    // If user already has instance_id and token, return them
    if (profile?.instance_id && profile?.whapi_token) {
      console.log('✅ User already has existing instance:', profile.instance_id, 'Status:', profile.instance_status)
      return new Response(
        JSON.stringify({
          success: true,
          channel_id: profile.instance_id,
          message: 'Using existing instance'
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

    // Save channel data to user profile with retry mechanism
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const updateData = {
      instance_id: channelId,
      whapi_token: channelToken,
      instance_status: 'created',
      payment_plan: 'trial',
      trial_expires_at: trialExpiresAt,
      updated_at: new Date().toISOString()
    }

    console.log('💾 Saving channel data to database...', {
      userId,
      channelId,
      hasToken: !!channelToken
    })

    // First attempt to save
    let { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    // If first attempt fails, try a second time
    if (updateError) {
      console.warn('⚠️ First database save attempt failed, retrying...', updateError)
      await delay(1000) // Wait 1 second before retry
      
      const { error: retryError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
      
      if (retryError) {
        console.error('❌ Failed to update user profile after retry:', retryError)
        
        // Attempt to delete the created channel since we couldn't save it
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
            details: retryError.message 
          }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    // Verify the data was actually saved
    console.log('🔍 Verifying data was saved...')
    const { data: verifyData, error: verifyError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (verifyError || !verifyData?.instance_id || !verifyData?.whapi_token) {
      console.error('❌ Database verification failed:', {
        verifyError,
        hasInstanceId: !!verifyData?.instance_id,
        hasToken: !!verifyData?.whapi_token
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
          error: 'Database verification failed - data not properly saved'
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Database verification successful:', {
      savedInstanceId: verifyData.instance_id,
      savedStatus: verifyData.instance_status,
      hasToken: !!verifyData.whapi_token
    })

    console.log('✅ New channel creation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        project_id: whapiProjectId,
        trial_expires_at: trialExpiresAt,
        channel_ready: false, // Indicates QR should wait for initialization
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
