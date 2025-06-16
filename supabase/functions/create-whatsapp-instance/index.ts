
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateInstanceRequest {
  userId: string
  webhookUrl?: string
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
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')
    
    console.log('=== Create WhatsApp Instance: Starting ===')
    console.log('Request method:', req.method)
    console.log('Environment check - WHAPI_PARTNER_TOKEN exists:', !!whapiPartnerToken)
    console.log('Environment check - WHAPI_PARTNER_TOKEN length:', whapiPartnerToken?.length || 0)
    
    if (!whapiPartnerToken) {
      console.error('❌ WHAPI_PARTNER_TOKEN is missing from environment variables')
      return new Response(
        JSON.stringify({ error: 'WHAPI Partner token not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body with error handling
    let requestBody
    try {
      requestBody = await req.json()
      console.log('📥 Request body received:', requestBody)
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const { userId, webhookUrl }: CreateInstanceRequest = requestBody

    if (!userId) {
      console.error('❌ User ID is missing from request')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔧 Creating WHAPI channel for user:', userId)
    console.log('🔗 Using webhook URL:', webhookUrl || 'No webhook URL provided')

    // Step 1: Get projects to find the main projectId
    console.log('📡 Step 1: Getting projects from WHAPI...')
    console.log('🔑 Using WHAPI Partner Token (first 10 chars):', whapiPartnerToken.substring(0, 10) + '...')
    
    const projectsResponse = await fetch('https://manager.whapi.cloud/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    console.log('📡 Projects response status:', projectsResponse.status)
    console.log('📡 Projects response headers:', Object.fromEntries(projectsResponse.headers.entries()))

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text()
      console.error('❌ Failed to get projects from WHAPI:', {
        status: projectsResponse.status,
        statusText: projectsResponse.statusText,
        error: errorText
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get WHAPI projects', 
          details: errorText,
          status: projectsResponse.status 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const projectsData = await projectsResponse.json()
    console.log('📥 Projects response data:', JSON.stringify(projectsData, null, 2))
    
    // Handle the correct response structure from WHAPI
    let projectId = null
    if (projectsData.projects && Array.isArray(projectsData.projects) && projectsData.projects.length > 0) {
      projectId = projectsData.projects[0].id
      console.log('✅ Found project ID in projects array:', projectId)
    } else if (projectsData.id) {
      projectId = projectsData.id
      console.log('✅ Found project ID directly:', projectId)
    } else {
      console.error('❌ No project ID found in response structure:', {
        hasProjects: !!projectsData.projects,
        isProjectsArray: Array.isArray(projectsData.projects),
        projectsLength: projectsData.projects?.length,
        hasDirectId: !!projectsData.id,
        allKeys: Object.keys(projectsData)
      })
    }
    
    if (!projectId) {
      console.error('❌ No project ID available:', projectsData)
      return new Response(
        JSON.stringify({ error: 'No project ID available in WHAPI response' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🎯 Using project ID:', projectId)

    // Step 2: Create new channel using correct WHAPI API
    console.log('🚀 Step 2: Creating channel...')
    const channelData = {
      name: `reecher_user_${userId}`,
      projectId: projectId
    }

    console.log('📤 Channel creation payload:', JSON.stringify(channelData, null, 2))

    const channelResponse = await fetch('https://manager.whapi.cloud/channels', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(channelData)
    })

    console.log('📡 Channel creation response status:', channelResponse.status)
    console.log('📡 Channel creation response headers:', Object.fromEntries(channelResponse.headers.entries()))

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text()
      console.error('❌ WHAPI channel creation failed:', {
        status: channelResponse.status,
        statusText: channelResponse.statusText,
        error: errorText
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create WHAPI channel', 
          details: errorText,
          status: channelResponse.status 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const channelResponseData = await channelResponse.json()
    console.log('✅ WHAPI channel created successfully:', JSON.stringify(channelResponseData, null, 2))

    const { id: instanceId, token: whapiToken } = channelResponseData

    if (!instanceId || !whapiToken) {
      console.error('❌ Missing instanceId or whapiToken in response:', {
        hasInstanceId: !!instanceId,
        hasWhapiToken: !!whapiToken,
        responseKeys: Object.keys(channelResponseData)
      })
      return new Response(
        JSON.stringify({ error: 'Invalid response from WHAPI channel creation' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Step 3: Configure webhook if provided
    if (webhookUrl) {
      console.log('🔗 Step 3: Configuring webhook for URL:', webhookUrl)
      const webhookConfig = {
        webhooks: [
          {
            events: [
              { type: "users", method: "post" },
              { type: "channel", method: "post" }
            ],
            mode: "body",
            url: webhookUrl
          }
        ],
        callback_persist: true
      }

      console.log('📤 Webhook config:', JSON.stringify(webhookConfig, null, 2))

      const webhookResponse = await fetch('https://gate.whapi.cloud/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(webhookConfig)
      })

      console.log('📡 Webhook response status:', webhookResponse.status)

      if (!webhookResponse.ok) {
        const webhookError = await webhookResponse.text()
        console.warn('⚠️ Failed to configure webhook:', webhookError)
        // Don't fail the whole process if webhook config fails
      } else {
        console.log('✅ Webhook configured successfully')
      }
    } else {
      console.log('⏭️ Step 3: Skipping webhook configuration - no URL provided')
    }

    // Calculate trial expiration (3 days from now)
    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    // Update user profile with instance details
    console.log('💾 Step 4: Updating user profile with instance details...')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: instanceId,
        whapi_token: whapiToken,
        instance_status: 'created',
        payment_plan: 'trial',
        trial_expires_at: trialExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to save instance data', details: updateError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ User profile updated successfully')
    console.log('🎉 Instance creation completed successfully for user:', userId)

    return new Response(
      JSON.stringify({
        success: true,
        instance_id: instanceId,
        trial_expires_at: trialExpiresAt,
        message: 'WhatsApp instance created successfully'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Create WhatsApp Instance Error:', error)
    console.error('📍 Error stack:', error.stack)
    console.error('🏷️ Error name:', error.name)
    console.error('💬 Error message:', error.message)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
