
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackgroundCollectionRequest {
  userId: string
}

// Helper function to add delays between requests
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userId }: BackgroundCollectionRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 BACKGROUND GROUP COLLECTION: Starting comprehensive scan for user:', userId)

    // Get user's WHAPI token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      console.error('❌ No WHAPI token found for user')
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      console.error('❌ Instance not connected')
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📱 User phone for collection:', profile.phone_number)

    // 🚀 COMPREHENSIVE GROUP COLLECTION - NO TIMEOUTS!
    let allGroups: any[] = []
    let currentOffset = 0
    let hasMoreGroups = true
    let totalApiCalls = 0
    const batchSize = 150 // Large batches for efficiency
    const maxApiCalls = 50 // Generous limit - should find hundreds of groups
    const startTime = Date.now()

    console.log('🔍 Starting comprehensive group collection (NO admin filtering)...')

    while (hasMoreGroups && totalApiCalls < maxApiCalls) {
      totalApiCalls++
      
      console.log(`📊 Collection API call ${totalApiCalls}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
      
      try {
        // More patient delays - we have time in background
        if (totalApiCalls > 1) {
          const apiDelay = Math.min(3000 + (totalApiCalls * 200), 6000) // 3-6 second delays
          console.log(`⏳ API delay: ${apiDelay}ms...`)
          await delay(apiDelay)
        }

        const groupsResponse = await fetch(
          `https://gate.whapi.cloud/groups?count=${batchSize}&offset=${currentOffset}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${profile.whapi_token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!groupsResponse.ok) {
          console.error(`❌ Groups API failed (call ${totalApiCalls}):`, groupsResponse.status)
          
          if (groupsResponse.status === 429 || groupsResponse.status >= 500) {
            const retryDelay = 8000 + (totalApiCalls * 1000) // Progressive backoff
            console.log(`🔄 Rate limited, waiting ${retryDelay}ms and retrying...`)
            await delay(retryDelay)
            continue // Retry same call
          } else {
            console.log(`💥 Non-retryable error, stopping collection`)
            break
          }
        }

        const groupsData = await groupsResponse.json()
        const batchGroups = groupsData.groups || []
        
        console.log(`📊 Collection batch ${totalApiCalls}: Received ${batchGroups.length} groups`)
        
        if (batchGroups.length === 0) {
          hasMoreGroups = false
          console.log(`📊 No more groups found`)
        } else {
          allGroups = allGroups.concat(batchGroups)
          currentOffset += batchSize
          
          if (batchGroups.length < batchSize) {
            hasMoreGroups = false
            console.log(`📊 Last batch (fewer groups than requested)`)
          }
        }

      } catch (batchError) {
        console.error(`❌ Error in collection batch ${totalApiCalls}:`, batchError)
        
        if (batchError.message.includes('timeout') || batchError.message.includes('429')) {
          console.log(`🔄 Retrying after error...`)
          const retryDelay = 10000 + (totalApiCalls * 1000)
          await delay(retryDelay)
          continue // Retry same call
        } else {
          console.error(`💥 Fatal error in collection, stopping`)
          break
        }
      }
    }

    const collectionTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`\n🎯 COLLECTION PHASE COMPLETE!`)
    console.log(`📊 Total groups collected: ${allGroups.length}`)
    console.log(`🔄 API calls made: ${totalApiCalls}`)
    console.log(`⚡ Collection time: ${collectionTime} seconds`)

    // 🗄️ STORE ALL GROUPS (without admin status checking)
    console.log('💾 Storing all collected groups...')
    
    // Clear existing groups for this user
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    const groupsToStore = allGroups.map(group => ({
      user_id: userId,
      group_id: group.id,
      name: group.name || group.subject || `Group ${group.id}`,
      description: group.description || null,
      participants_count: group.participants?.length || group.size || 0,
      is_admin: false, // Will be determined in Phase 2
      is_creator: false, // Will be determined in Phase 2
      admin_status: 'unknown', // NEW FIELD - indicates needs admin check
      avatar_url: group.chat_pic || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    if (groupsToStore.length > 0) {
      // Insert in batches to avoid database limits
      const dbBatchSize = 100
      for (let i = 0; i < groupsToStore.length; i += dbBatchSize) {
        const batch = groupsToStore.slice(i, i + dbBatchSize)
        console.log(`💾 Storing batch: ${batch.length} groups`)
        
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(batch)

        if (insertError) {
          console.error('❌ Database batch error:', insertError)
          return new Response(
            JSON.stringify({ error: 'Failed to save groups to database', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          )
        }
        
        if (i + dbBatchSize < groupsToStore.length) {
          await delay(100) // Small delay between database batches
        }
      }
    }

    console.log(`✅ Background collection completed successfully!`)
    console.log(`📊 Stored ${groupsToStore.length} groups for admin filtering`)

    return new Response(
      JSON.stringify({
        success: true,
        phase: 'background_collection',
        groups_collected: allGroups.length,
        groups_stored: groupsToStore.length,
        collection_time_seconds: collectionTime,
        api_calls_made: totalApiCalls,
        message: `Collected ${allGroups.length} groups in background. Ready for admin filtering.`,
        next_step: 'User can now run manual sync for admin status'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Background Collection Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        phase: 'background_collection'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
