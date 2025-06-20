
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateRequest {
  userId?: string
  action: 'validate_user' | 'cleanup_all' | 'sync_status'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    console.log('🔍 WHAPI Validation & Cleanup Function Started')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId, action }: ValidateRequest = await req.json()

    // Validate all channels exist in WHAPI
    const validateChannelsInWhapi = async () => {
      console.log('📋 Getting all channels from WHAPI...')
      
      try {
        const whapiResponse = await fetch('https://manager.whapi.cloud/channels', {
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })
        
        if (!whapiResponse.ok) {
          throw new Error(`WHAPI API error: ${whapiResponse.status}`)
        }
        
        const whapiChannels = await whapiResponse.json()
        console.log('📊 WHAPI channels found:', whapiChannels.length)
        
        // Get all channels from our database
        const { data: dbChannels, error: dbError } = await supabase
          .from('profiles')
          .select('id, instance_id, instance_status')
          .not('instance_id', 'is', null)
        
        if (dbError) {
          throw new Error(`DB error: ${dbError.message}`)
        }
        
        console.log('💾 DB channels found:', dbChannels?.length || 0)
        
        const results = {
          validated: 0,
          cleaned: 0,
          errors: []
        }
        
        for (const dbChannel of dbChannels || []) {
          try {
            const whapiChannel = whapiChannels.find((ch: any) => ch.id === dbChannel.instance_id)
            
            if (!whapiChannel) {
              console.log('🧹 Cleaning non-existent channel:', dbChannel.instance_id)
              
              // Channel doesn't exist in WHAPI, clean it from DB
              const { error: cleanError } = await supabase
                .from('profiles')
                .update({
                  instance_id: null,
                  whapi_token: null,
                  instance_status: 'disconnected',
                  updated_at: new Date().toISOString()
                })
                .eq('id', dbChannel.id)
              
              if (cleanError) {
                results.errors.push(`Failed to clean ${dbChannel.instance_id}: ${cleanError.message}`)
              } else {
                results.cleaned++
              }
            } else {
              console.log('✅ Channel validated:', dbChannel.instance_id)
              results.validated++
            }
          } catch (error) {
            results.errors.push(`Error processing ${dbChannel.instance_id}: ${error.message}`)
          }
        }
        
        return results
      } catch (error) {
        console.error('❌ Validation failed:', error)
        throw error
      }
    }

    // Sync status with WHAPI for a specific user
    const syncUserStatus = async (userId: string) => {
      console.log('🔄 Syncing status for user:', userId)
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('instance_id, whapi_token, instance_status')
        .eq('id', userId)
        .single()
      
      if (profileError || !profile?.instance_id || !profile?.whapi_token) {
        return { error: 'No valid channel found for user' }
      }
      
      try {
        // Check if channel exists in WHAPI
        const whapiResponse = await fetch('https://manager.whapi.cloud/channels', {
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })
        
        if (whapiResponse.ok) {
          const whapiChannels = await whapiResponse.json()
          const channelExists = whapiChannels.find((ch: any) => ch.id === profile.instance_id)
          
          if (!channelExists) {
            console.log('🧹 Channel not found in WHAPI, cleaning from DB')
            
            await supabase
              .from('profiles')
              .update({
                instance_id: null,
                whapi_token: null,
                instance_status: 'disconnected',
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            
            return { cleaned: true, reason: 'Channel not found in WHAPI' }
          }
        }
        
        // Check channel health
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          console.log('📊 Health data:', healthData)
          
          let newStatus = profile.instance_status
          
          if (healthData.status === 'unauthorized' || healthData.status === 'qr') {
            newStatus = 'unauthorized'
          } else if (healthData.status === 'connected' || healthData.status === 'ready') {
            newStatus = 'connected'
          } else if (healthData.status === 'initializing') {
            newStatus = 'initializing'
          } else if (healthData.status === 'error' || healthData.status === 'failed') {
            newStatus = 'disconnected'
          }
          
          if (newStatus !== profile.instance_status) {
            await supabase
              .from('profiles')
              .update({
                instance_status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            
            return { updated: true, oldStatus: profile.instance_status, newStatus }
          }
          
          return { validated: true, status: profile.instance_status }
        } else {
          console.log('⚠️ Health check failed:', healthResponse.status)
          return { error: 'Health check failed', status: healthResponse.status }
        }
      } catch (error) {
        console.error('❌ Sync failed:', error)
        return { error: error.message }
      }
    }

    // Execute based on action
    switch (action) {
      case 'validate_user':
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID required for validate_user action' }),
            { status: 400, headers: corsHeaders }
          )
        }
        
        const userResult = await syncUserStatus(userId)
        return new Response(
          JSON.stringify({ success: true, result: userResult }),
          { status: 200, headers: corsHeaders }
        )
      
      case 'cleanup_all':
        const cleanupResult = await validateChannelsInWhapi()
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Validated ${cleanupResult.validated} channels, cleaned ${cleanupResult.cleaned} invalid channels`,
            details: cleanupResult
          }),
          { status: 200, headers: corsHeaders }
        )
      
      case 'sync_status':
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID required for sync_status action' }),
            { status: 400, headers: corsHeaders }
          )
        }
        
        const syncResult = await syncUserStatus(userId)
        return new Response(
          JSON.stringify({ success: true, result: syncResult }),
          { status: 200, headers: corsHeaders }
        )
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: corsHeaders }
        )
    }

  } catch (error) {
    console.error('💥 Validation & Cleanup Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
