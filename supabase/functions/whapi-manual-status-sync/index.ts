
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ManualSyncRequest {
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

    const { userId }: ManualSyncRequest = await req.json()
    console.log('🔄 Manual status sync requested for user:', userId)

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, updated_at')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('👤 Current profile status:', {
      instanceId: profile.instance_id,
      currentStatus: profile.instance_status,
      hasToken: !!profile.whapi_token,
      lastUpdated: profile.updated_at
    })

    if (!profile.instance_id || !profile.whapi_token) {
      console.log('⚠️ No instance or token found for user')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No WhatsApp instance found',
          requiresNewInstance: true 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Check actual WHAPI status
    try {
      console.log('🔍 Checking WHAPI status directly...')
      
      const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!statusResponse.ok) {
        console.error('❌ WHAPI status check failed:', statusResponse.status)
        const errorText = await statusResponse.text()
        console.error('❌ WHAPI error details:', errorText)
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to check WHAPI status',
            details: `Status: ${statusResponse.status}, Error: ${errorText}`
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      const whapiStatus = await statusResponse.json()
      console.log('📊 Current WHAPI status:', whapiStatus)

      // Map WHAPI status to our internal status
      let newStatus = profile.instance_status // Default to current
      let statusChanged = false

      if (whapiStatus.status === 'unauthorized' || whapiStatus.status === 'qr') {
        newStatus = 'unauthorized'
        statusChanged = newStatus !== profile.instance_status
        console.log('✅ Channel ready for QR generation')
      } else if (whapiStatus.status === 'active' || whapiStatus.status === 'ready' || whapiStatus.status === 'launched') {
        newStatus = 'unauthorized'
        statusChanged = newStatus !== profile.instance_status
        console.log('📱 Channel ready for authentication')
      } else if (whapiStatus.status === 'authenticated' || whapiStatus.status === 'connected') {
        newStatus = 'connected'
        statusChanged = newStatus !== profile.instance_status
        console.log('🎉 WhatsApp session connected')
      } else if (whapiStatus.status === 'initializing') {
        newStatus = 'initializing'
        statusChanged = newStatus !== profile.instance_status
        console.log('⏳ Channel still initializing')
      } else if (whapiStatus.status === 'disconnected' || whapiStatus.status === 'error') {
        newStatus = 'disconnected'
        statusChanged = newStatus !== profile.instance_status
        console.log('❌ Channel disconnected or error')
      }

      // Update database if status changed
      if (statusChanged) {
        console.log('🔄 Updating database status:', {
          oldStatus: profile.instance_status,
          newStatus: newStatus,
          whapiStatus: whapiStatus.status
        })

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            instance_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (updateError) {
          console.error('❌ Error updating profile status:', updateError)
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to update profile status',
              details: updateError.message
            }),
            { status: 500, headers: corsHeaders }
          )
        }

        console.log('✅ Profile status updated successfully')
      } else {
        console.log('ℹ️ Status unchanged, no database update needed')
      }

      return new Response(
        JSON.stringify({
          success: true,
          oldStatus: profile.instance_status,
          newStatus: newStatus,
          whapiStatus: whapiStatus.status,
          statusChanged: statusChanged,
          message: statusChanged ? 'Status updated successfully' : 'Status unchanged'
        }),
        { status: 200, headers: corsHeaders }
      )

    } catch (whapiError) {
      console.error('❌ Error calling WHAPI:', whapiError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to communicate with WHAPI',
          details: whapiError.message
        }),
        { status: 500, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('💥 Manual sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
