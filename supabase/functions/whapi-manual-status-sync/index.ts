
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncStatusRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: SyncStatusRequest = await req.json()
    console.log('🔄 Manual status sync for user:', userId)

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's instance info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('📊 Current profile state:', {
      instanceId: profile.instance_id,
      hasToken: !!profile.whapi_token,
      currentStatus: profile.instance_status
    })

    if (!profile.instance_id || !profile.whapi_token) {
      console.log('🚨 No instance found for user')
      return new Response(
        JSON.stringify({ 
          error: 'No instance found for user',
          requiresNewInstance: true 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📡 Checking WHAPI channel status directly...')

    // Check actual status from WHAPI
    const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error('❌ WHAPI status check failed:', {
        status: statusResponse.status,
        error: errorText
      })
      
      // If channel not found, mark for recreation
      if (statusResponse.status === 404) {
        console.log('🗑️ Channel not found on WHAPI, marking for cleanup')
        return new Response(
          JSON.stringify({ 
            error: 'Channel not found on WHAPI',
            requiresNewInstance: true,
            shouldCleanup: true
          }),
          { status: 404, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check WHAPI status',
          details: errorText,
          status: statusResponse.status
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const whapiStatus = await statusResponse.json()
    console.log('📥 WHAPI status response:', whapiStatus)

    // Enhanced status mapping with better logic
    let newStatus = profile.instance_status
    let statusChanged = false

    if (whapiStatus.status === 'qr' || whapiStatus.status === 'unauthorized') {
      newStatus = 'unauthorized'
      statusChanged = newStatus !== profile.instance_status
    } else if (whapiStatus.status === 'authenticated' || whapiStatus.status === 'ready') {
      newStatus = 'connected'
      statusChanged = newStatus !== profile.instance_status
    } else if (whapiStatus.status === 'initializing' || whapiStatus.status === 'loading') {
      newStatus = 'initializing'
      statusChanged = newStatus !== profile.instance_status
    } else if (whapiStatus.status === 'disconnected' || whapiStatus.status === 'failed') {
      newStatus = 'disconnected'
      statusChanged = newStatus !== profile.instance_status
    }

    console.log('🔄 Status mapping:', {
      whapiStatus: whapiStatus.status,
      currentStatus: profile.instance_status,
      newStatus: newStatus,
      willUpdate: statusChanged
    })

    // Update database if status changed
    if (statusChanged) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          instance_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('❌ Failed to update status:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update status in database' }),
          { status: 500, headers: corsHeaders }
        )
      }

      console.log('✅ Status updated successfully:', {
        oldStatus: profile.instance_status,
        newStatus: newStatus
      })
    } else {
      console.log('ℹ️ Status already up to date')
    }

    return new Response(
      JSON.stringify({
        success: true,
        oldStatus: profile.instance_status,
        newStatus: newStatus,
        whapiStatus: whapiStatus.status,
        updated: statusChanged,
        message: statusChanged ? 'Status synchronized' : 'Status already up to date'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Manual status sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
