
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StatusSyncRequest {
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
    
    console.log('🔄 Enhanced Manual Status Sync Started')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: StatusSyncRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Enhanced sync for user:', userId)

    // Get user's current instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!profile?.instance_id || !profile?.whapi_token) {
      console.log('⚠️ No instance found for user')
      return new Response(
        JSON.stringify({ 
          error: 'No WhatsApp instance found for user',
          currentStatus: profile?.instance_status || 'disconnected'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📊 Current profile state:', {
      instanceId: profile.instance_id,
      currentStatus: profile.instance_status,
      hasToken: !!profile.whapi_token
    })

    // Enhanced validation: First check if channel exists in WHAPI
    try {
      console.log('🔍 Validating channel exists in WHAPI...')
      
      const channelsResponse = await fetch('https://manager.whapi.cloud/channels', {
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`
        }
      })
      
      if (channelsResponse.ok) {
        const channels = await channelsResponse.json()
        const channelExists = channels.find((ch: any) => ch.id === profile.instance_id)
        
        if (!channelExists) {
          console.log('🧹 Channel not found in WHAPI, cleaning from database')
          
          // Clean from database
          await supabase
            .from('profiles')
            .update({
              instance_id: null,
              whapi_token: null,
              instance_status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          
          return new Response(
            JSON.stringify({
              success: true,
              action: 'cleaned',
              message: 'Channel not found in WHAPI and removed from database',
              oldStatus: profile.instance_status,
              newStatus: 'disconnected'
            }),
            { status: 200, headers: corsHeaders }
          )
        }
        
        console.log('✅ Channel exists in WHAPI, checking health...')
      } else {
        console.log('⚠️ Could not verify channel existence in WHAPI')
      }
    } catch (validationError) {
      console.error('⚠️ WHAPI validation failed:', validationError)
      // Continue with health check even if validation fails
    }

    // Enhanced health check with multiple attempts
    let healthCheckAttempts = 0
    const maxHealthCheckAttempts = 3
    let healthData = null
    
    while (healthCheckAttempts < maxHealthCheckAttempts && !healthData) {
      healthCheckAttempts++
      console.log(`📊 Enhanced health check attempt ${healthCheckAttempts}/${maxHealthCheckAttempts}`)
      
      try {
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        console.log('📊 Health response status:', healthResponse.status)
        
        if (healthResponse.ok) {
          healthData = await healthResponse.json()
          console.log('📊 Enhanced health data:', healthData)
          break
        } else if (healthResponse.status === 401) {
          console.log('🔐 Health check: Unauthorized - token might be invalid')
          
          return new Response(
            JSON.stringify({
              success: true,
              action: 'token_invalid',
              message: 'Channel token is invalid',
              currentStatus: profile.instance_status,
              recommendation: 'Create new channel'
            }),
            { status: 200, headers: corsHeaders }
          )
        } else if (healthResponse.status === 404) {
          console.log('❌ Health check: Channel not found')
          
          // Clean from database
          await supabase
            .from('profiles')
            .update({
              instance_id: null,
              whapi_token: null,
              instance_status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          
          return new Response(
            JSON.stringify({
              success: true,
              action: 'cleaned',
              message: 'Channel not found and removed from database',
              oldStatus: profile.instance_status,
              newStatus: 'disconnected'
            }),
            { status: 200, headers: corsHeaders }
          )
        } else {
          const errorText = await healthResponse.text()
          console.log(`⚠️ Health check attempt ${healthCheckAttempts} failed:`, healthResponse.status, errorText)
          
          if (healthCheckAttempts < maxHealthCheckAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      } catch (healthError) {
        console.error(`❌ Health check attempt ${healthCheckAttempts} error:`, healthError)
        
        if (healthCheckAttempts < maxHealthCheckAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }

    if (!healthData) {
      console.log('❌ All health check attempts failed')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to get channel health after multiple attempts',
          currentStatus: profile.instance_status,
          attempts: healthCheckAttempts
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Enhanced status mapping
    console.log('🎯 Enhanced status mapping for health data:', healthData)
    
    let newStatus = profile.instance_status
    let statusChanged = false
    
    // Comprehensive status mapping
    switch (healthData.status?.toLowerCase()) {
      case 'unauthorized':
      case 'qr':
      case 'ready':
      case 'active':
      case 'launched':
        if (profile.instance_status !== 'unauthorized') {
          newStatus = 'unauthorized'
          statusChanged = true
          console.log('✅ Channel ready for connection! Status: unauthorized')
        }
        break
        
      case 'authenticated':
      case 'connected':
      case 'online':
        if (profile.instance_status !== 'connected') {
          newStatus = 'connected'
          statusChanged = true
          console.log('🎉 WhatsApp is connected! Status: connected')
        }
        break
        
      case 'initializing':
      case 'creating':
      case 'starting':
        if (profile.instance_status !== 'initializing') {
          newStatus = 'initializing'
          statusChanged = true
          console.log('⏳ Channel still initializing... Status: initializing')
        }
        break
        
      case 'disconnected':
      case 'error':
      case 'failed':
      case 'offline':
        if (profile.instance_status !== 'disconnected') {
          newStatus = 'disconnected'
          statusChanged = true
          console.log('❌ Channel disconnected/failed! Status: disconnected')
        }
        break
        
      default:
        console.log('⚠️ Unknown health status:', healthData.status)
        // For unknown statuses, don't change anything but report it
        break
    }

    // Update database if status changed
    if (statusChanged) {
      console.log('🔄 Enhanced status update:', {
        userId: userId,
        oldStatus: profile.instance_status,
        newStatus: newStatus,
        healthStatus: healthData.status
      })
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          instance_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('❌ Enhanced status update failed:', updateError)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update status in database',
            details: updateError.message
          }),
          { status: 500, headers: corsHeaders }
        )
      }
      
      console.log('✅ Enhanced status updated successfully')
      
      return new Response(
        JSON.stringify({
          success: true,
          action: 'updated',
          message: 'Status synchronized successfully',
          oldStatus: profile.instance_status,
          newStatus: newStatus,
          healthStatus: healthData.status,
          healthData: healthData
        }),
        { status: 200, headers: corsHeaders }
      )
    } else {
      console.log('ℹ️ Enhanced status already current')
      
      return new Response(
        JSON.stringify({
          success: true,
          action: 'no_change',
          message: 'Status is already current',
          currentStatus: profile.instance_status,
          healthStatus: healthData.status,
          healthData: healthData
        }),
        { status: 200, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('💥 Enhanced Manual Status Sync Error:', error)
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
