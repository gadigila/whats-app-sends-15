
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
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
    console.log('🧹 WHAPI Cleanup Stuck Users - Starting')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration missing' }),
        { status: 500, headers: corsHeaders }
      )
    }

    let cleanupResults = {
      stuck_initializing: 0,
      invalid_tokens: 0,
      old_unauthorized: 0,
      total_cleaned: 0
    }

    // 1. Clean up users stuck in "initializing" for more than 10 minutes
    console.log('🧹 Cleaning up users stuck in initializing...')
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: stuckUsers, error: stuckError } = await supabase
      .from('profiles')
      .select('id, instance_id, whapi_token, updated_at')
      .eq('instance_status', 'initializing')
      .lt('updated_at', tenMinutesAgo)

    if (stuckError) {
      console.error('❌ Error finding stuck users:', stuckError)
    } else if (stuckUsers && stuckUsers.length > 0) {
      console.log(`🧹 Found ${stuckUsers.length} users stuck in initializing`)
      
      const { error: cleanupError } = await supabase
        .from('profiles')
        .update({
          instance_id: null,
          whapi_token: null,
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .in('id', stuckUsers.map(u => u.id))

      if (cleanupError) {
        console.error('❌ Error cleaning stuck users:', cleanupError)
      } else {
        cleanupResults.stuck_initializing = stuckUsers.length
        console.log(`✅ Cleaned ${stuckUsers.length} stuck users`)
      }
    }

    // 2. Check tokens for users with "unauthorized" status older than 2 hours
    console.log('🧹 Checking tokens for old unauthorized users...')
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    
    const { data: oldUnauthorized, error: oldError } = await supabase
      .from('profiles')
      .select('id, instance_id, whapi_token, updated_at')
      .eq('instance_status', 'unauthorized')
      .lt('updated_at', twoHoursAgo)
      .not('whapi_token', 'is', null)

    if (oldError) {
      console.error('❌ Error finding old unauthorized users:', oldError)
    } else if (oldUnauthorized && oldUnauthorized.length > 0) {
      console.log(`🧹 Found ${oldUnauthorized.length} old unauthorized users, checking tokens...`)
      
      for (const user of oldUnauthorized) {
        try {
          // Test token validity
          const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${user.whapi_token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!healthResponse.ok) {
            console.log(`🧹 Invalid token for user ${user.id}, cleaning up...`)
            
            await supabase
              .from('profiles')
              .update({
                instance_id: null,
                whapi_token: null,
                instance_status: 'disconnected',
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id)
              
            cleanupResults.invalid_tokens++
          } else {
            const healthData = await healthResponse.json()
            if (healthData.status === 'connected') {
              console.log(`✅ User ${user.id} is actually connected, updating status...`)
              
              await supabase
                .from('profiles')
                .update({
                  instance_status: 'connected',
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id)
            }
          }
        } catch (error) {
          console.log(`⚠️ Error checking token for user ${user.id}:`, error.message)
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // 3. Clean up very old unauthorized users (older than 24 hours)
    console.log('🧹 Cleaning up very old unauthorized users...')
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: veryOldUsers, error: veryOldError } = await supabase
      .from('profiles')
      .select('id')
      .eq('instance_status', 'unauthorized')
      .lt('updated_at', oneDayAgo)

    if (veryOldError) {
      console.error('❌ Error finding very old users:', veryOldError)
    } else if (veryOldUsers && veryOldUsers.length > 0) {
      console.log(`🧹 Found ${veryOldUsers.length} very old unauthorized users`)
      
      const { error: oldCleanupError } = await supabase
        .from('profiles')
        .update({
          instance_id: null,
          whapi_token: null,
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .in('id', veryOldUsers.map(u => u.id))

      if (oldCleanupError) {
        console.error('❌ Error cleaning very old users:', oldCleanupError)
      } else {
        cleanupResults.old_unauthorized = veryOldUsers.length
        console.log(`✅ Cleaned ${veryOldUsers.length} very old users`)
      }
    }

    cleanupResults.total_cleaned = cleanupResults.stuck_initializing + cleanupResults.invalid_tokens + cleanupResults.old_unauthorized

    console.log('🎯 Cleanup completed:', cleanupResults)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        results: cleanupResults,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Cleanup Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Cleanup failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
