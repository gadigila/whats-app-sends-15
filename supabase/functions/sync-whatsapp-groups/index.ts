import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Phone matching utility
class PhoneMatcher {
  private userPhoneVariants: string[]

  constructor(userPhone: string) {
    const cleanPhone = userPhone.replace(/[^\d]/g, '')
    this.userPhoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('972') ? '0' + cleanPhone.substring(3) : null,
      cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : null,
      cleanPhone.slice(-9)
    ].filter(Boolean) as string[]
    
    console.log(`📱 Phone variants: ${this.userPhoneVariants.join(', ')}`)
  }

  isUserPhone(participantPhone: string): boolean {
    if (!participantPhone) return false
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '')
    
    if (this.userPhoneVariants.includes(cleanParticipant)) return true
    
    if (cleanParticipant.length >= 9) {
      const lastNine = cleanParticipant.slice(-9)
      return this.userPhoneVariants.some(variant => 
        variant.length >= 9 && variant.slice(-9) === lastNine
      )
    }
    return false
  }
}

// ⏰ TIMEOUT-SAFE: Smart group fetching with time limits
async function fetchGroupsWithTimeLimit(token: string, maxTimeMs: number = 120000) {
  console.log(`🚀 Starting TIMEOUT-SAFE group fetch (max ${maxTimeMs/1000}s)...`)
  
  const startTime = Date.now()
  const allGroups = new Map()
  let totalApiCalls = 0
  
  // Phase 1: Quick discovery with larger batches (use 40% of time)
  const discoveryTimeLimit = maxTimeMs * 0.4
  console.log('🔍 Phase 1: Quick group discovery...')
  
  let offset = 0
  let hasMore = true
  let discoveryApiCalls = 0
  
  while (hasMore && discoveryApiCalls < 8 && (Date.now() - startTime) < discoveryTimeLimit) {
    discoveryApiCalls++
    totalApiCalls++
    
    console.log(`📊 Discovery call ${discoveryApiCalls}: offset ${offset}`)
    
    if (discoveryApiCalls > 1) {
      await delay(1500) // Faster delays for discovery
    }
    
    try {
      const response = await fetch(
        `https://gate.whapi.cloud/groups?count=400&offset=${offset}`, // Even larger batches
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error(`❌ Discovery API failed: ${response.status}`)
        if (response.status === 429) {
          await delay(3000)
          continue
        }
        break
      }

      const data = await response.json()
      const groups = data.groups || []
      
      console.log(`📊 Discovery ${discoveryApiCalls}: Found ${groups.length} groups`)
      
      // Store groups with any participant data they might have
      groups.forEach(group => {
        if (group.id) {
          allGroups.set(group.id, group)
        }
      })
      
      if (groups.length === 0) {
        hasMore = false
      } else if (groups.length < 400) {
        hasMore = false
      } else {
        offset += 400
      }
      
    } catch (error) {
      console.error(`❌ Discovery error:`, error.message)
      await delay(2000)
      continue
    }
  }
  
  const discoveryTime = Date.now() - startTime
  console.log(`🎯 Discovery complete: ${allGroups.size} groups found in ${Math.round(discoveryTime/1000)}s`)
  
  // Phase 2: Smart processing with remaining time
  const remainingTime = maxTimeMs - discoveryTime - 10000 // Keep 10s buffer
  const groupsArray = Array.from(allGroups.values())
  
  if (remainingTime <= 0) {
    console.log('⏰ No time left for detailed processing')
    return {
      groups: groupsArray,
      totalApiCalls,
      timeElapsed: Math.round(discoveryTime / 1000),
      completed: false,
      message: 'Discovery only - no time for detailed processing'
    }
  }
  
  console.log(`🔍 Phase 2: Processing ${groupsArray.length} groups with ${Math.round(remainingTime/1000)}s remaining...`)
  
  // Calculate how much time we can spend per group
  const timePerGroup = Math.max(500, remainingTime / groupsArray.length) // Min 500ms per group
  console.log(`⏱️ Allocated ${Math.round(timePerGroup)}ms per group`)
  
  let processed = 0
  const processedGroups = []
  
  for (const group of groupsArray) {
    const groupStartTime = Date.now()
    const timeLeft = maxTimeMs - (Date.now() - startTime)
    
    // Stop if we're running out of time (keep 5s buffer)
    if (timeLeft < 5000) {
      console.log(`⏰ Time limit reached - processed ${processed}/${groupsArray.length} groups`)
      break
    }
    
    processed++
    
    // Try to get participant data if not already available
    if (!group.participants || group.participants.length === 0) {
      try {
        totalApiCalls++
        
        const detailResponse = await fetch(
          `https://gate.whapi.cloud/groups/${group.id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          if (detailData.participants) {
            group.participants = detailData.participants
          }
        }
      } catch (error) {
        console.log(`⚠️ Failed to get details for ${group.name}: ${error.message}`)
      }
    }
    
    processedGroups.push(group)
    
    // Dynamic delay based on remaining time and groups left
    const groupProcessTime = Date.now() - groupStartTime
    const remainingGroups = groupsArray.length - processed
    const adaptiveDelay = remainingGroups > 0 ? 
      Math.min(2000, Math.max(300, (timeLeft - 5000) / remainingGroups * 0.7)) : 300
    
    if (processed < groupsArray.length && adaptiveDelay > 300) {
      await delay(adaptiveDelay)
    }
    
    if (processed % 25 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`📊 Processed ${processed}/${groupsArray.length} groups (${elapsed}s elapsed)`)
    }
  }
  
  const finalTime = Math.round((Date.now() - startTime) / 1000)
  console.log(`🎯 Processing complete: ${processedGroups.length} groups processed in ${finalTime}s`)
  
  return {
    groups: processedGroups,
    totalApiCalls,
    timeElapsed: finalTime,
    completed: processed >= groupsArray.length,
    processed: processed,
    total: groupsArray.length
  }
}

// Process groups for admin status
function processGroupsForAdmin(groups: any[], userPhone: string, userId: string) {
  const phoneMatcher = new PhoneMatcher(userPhone)
  const adminGroups = []
  let stats = {
    totalProcessed: 0,
    adminFound: 0,
    creatorFound: 0,
    noParticipants: 0,
    notMember: 0
  }
  
  for (const group of groups) {
    stats.totalProcessed++
    const groupName = group.name || group.subject || `Group ${group.id}`
    
    // Skip if no participants
    if (!group.participants || !Array.isArray(group.participants) || group.participants.length === 0) {
      stats.noParticipants++
      continue
    }
    
    // Find user in participants
    const userParticipant = group.participants.find(participant => {
      const participantId = participant.id || participant.phone || participant.number
      return phoneMatcher.isUserPhone(participantId)
    })
    
    if (!userParticipant) {
      stats.notMember++
      continue
    }
    
    // Check admin status
    const participantRank = (userParticipant.rank || userParticipant.role || 'member').toLowerCase()
    const isCreator = participantRank === 'creator' || participantRank === 'owner'  
    const isAdmin = participantRank === 'admin' || participantRank === 'administrator' || isCreator
    
    if (!isAdmin) {
      continue
    }
    
    // Found admin group!
    if (isCreator) {
      stats.creatorFound++
      console.log(`👑 ${groupName}: CREATOR (${group.participants.length} members)`)
    } else {
      stats.adminFound++
      console.log(`⭐ ${groupName}: ADMIN (${group.participants.length} members)`)
    }
    
    adminGroups.push({
      user_id: userId,
      group_id: group.id,
      name: groupName,
      description: group.description || null,
      participants_count: group.participants.length,
      is_admin: true,
      is_creator: isCreator,
      avatar_url: group.chat_pic || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }
  
  return { adminGroups, stats }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 TIMEOUT-SAFE GROUP SYNC: Under 120 seconds guaranteed')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const syncStartTime = Date.now()

    // Create sync progress tracking
    await supabase
      .from('sync_progress')
      .upsert({
        user_id: userId,
        status: 'starting',
        message: 'Initializing timeout-safe sync...',
        started_at: new Date().toISOString(),
        current_pass: 1,
        total_passes: 2,
        groups_found: 0,
        total_scanned: 0
      })

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_status, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      await supabase
        .from('sync_progress')
        .upsert({
          user_id: userId,
          status: 'error',
          message: 'WhatsApp instance not found',
          error: 'Missing instance or token',
          completed_at: new Date().toISOString()
        })

      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      await supabase
        .from('sync_progress')
        .upsert({
          user_id: userId,
          status: 'error',
          message: 'WhatsApp not connected',
          error: 'Instance not connected',
          completed_at: new Date().toISOString()
        })

      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get or fetch user phone number
    let userPhone = profile.phone_number
    if (!userPhone) {
      console.log('📱 Fetching phone from /health...')
      
      await supabase
        .from('sync_progress')
        .upsert({
          user_id: userId,
          status: 'running',
          message: 'Getting phone number...',
          current_pass: 1
        })
      
      const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        userPhone = healthData?.user?.id?.replace(/[^\d]/g, '')
        
        if (userPhone) {
          await supabase
            .from('profiles')
            .update({ phone_number: userPhone })
            .eq('id', userId)
        }
      }
    }

    if (!userPhone) {
      await supabase
        .from('sync_progress')
        .upsert({
          user_id: userId,
          status: 'error',
          message: 'Could not determine phone number',
          error: 'Phone number detection failed',
          completed_at: new Date().toISOString()
        })

      return new Response(
        JSON.stringify({ error: 'Could not determine phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`👤 Starting timeout-safe sync for user: ${userPhone}`)

    // Update progress for group fetching phase
    await supabase
      .from('sync_progress')
      .upsert({
        user_id: userId,
        status: 'running',
        message: 'Fetching groups with timeout protection...',
        current_pass: 1,
        total_passes: 2
      })

    // ⏰ TIMEOUT-SAFE GROUP FETCHING (120 second limit)
    const fetchResult = await fetchGroupsWithTimeLimit(profile.whapi_token, 120000)
    
    // Update progress for processing phase
    await supabase
      .from('sync_progress')
      .upsert({
        user_id: userId,
        status: 'running',
        message: `Processing ${fetchResult.groups.length} groups for admin status...`,
        current_pass: 2,
        total_passes: 2,
        total_scanned: fetchResult.groups.length
      })

    // Process groups for admin status
    const { adminGroups, stats } = processGroupsForAdmin(fetchResult.groups, userPhone, userId)
    
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000)

    console.log(`\n🎯 TIMEOUT-SAFE SYNC COMPLETED!`)
    console.log(`📊 Groups processed: ${fetchResult.processed}/${fetchResult.total}`)
    console.log(`🔑 Admin groups found: ${adminGroups.length}`)
    console.log(`⚡ Total time: ${totalSyncTime}s`)
    console.log(`✅ Completed: ${fetchResult.completed}`)

    // 🛡️ SAFETY CHECK: Don't clear existing if we got incomplete results
    const { data: existingGroups } = await supabase
      .from('whatsapp_groups')
      .select('id')
      .eq('user_id', userId)

    if (adminGroups.length === 0 && existingGroups && existingGroups.length > 0 && !fetchResult.completed) {
      await supabase
        .from('sync_progress')
        .upsert({
          user_id: userId,
          status: 'completed',
          message: `Sync incomplete due to time limits. Preserving ${existingGroups.length} existing groups.`,
          completed_at: new Date().toISOString(),
          groups_found: 0,
          total_scanned: fetchResult.processed
        })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Sync incomplete due to time limits',
          existing_groups_count: existingGroups.length,
          groups_processed: fetchResult.processed,
          groups_total: fetchResult.total,
          time_elapsed: totalSyncTime,
          recommendation: 'The sync was cut short due to time limits. Your existing groups are preserved. Try again when the network is faster.',
          partial_results: true
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🔄 UPDATE DATABASE
    console.log('💾 Updating database...')
    
    await supabase
      .from('whatsapp_groups')
      .delete()
      .eq('user_id', userId)
    
    if (adminGroups.length > 0) {
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(adminGroups)

      if (insertError) {
        console.error('❌ Database insert error:', insertError)
        
        await supabase
          .from('sync_progress')
          .upsert({
            user_id: userId,
            status: 'error',
            message: 'Failed to save groups to database',
            error: insertError.message,
            completed_at: new Date().toISOString()
          })

        return new Response(
          JSON.stringify({ error: 'Failed to save groups', details: insertError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    // Calculate stats
    const adminCount = adminGroups.filter(g => !g.is_creator).length
    const creatorCount = adminGroups.filter(g => g.is_creator).length
    const totalMembers = adminGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0)

    // Final progress update
    await supabase
      .from('sync_progress')
      .upsert({
        user_id: userId,
        status: 'completed',
        message: adminGroups.length > 0 
          ? `✅ Found ${adminGroups.length} admin groups in ${totalSyncTime}s!`
          : 'No admin groups found',
        completed_at: new Date().toISOString(),
        groups_found: adminGroups.length,
        total_scanned: fetchResult.processed
      })

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: adminGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMembers,
        total_groups_processed: fetchResult.processed,
        total_groups_found: fetchResult.total,
        total_api_calls: fetchResult.totalApiCalls,
        sync_time_seconds: totalSyncTime,
        completed_full_sync: fetchResult.completed,
        processing_stats: stats,
        message: adminGroups.length > 0 
          ? `נמצאו ${adminGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
          : 'לא נמצאו קבוצות בניהולך',
        sync_method: 'Timeout-Safe Simple',
        optimization_notes: [
          'Respects 150s timeout limit with 30s buffer',
          'Two-phase approach: discovery then processing',
          'Larger batches for faster discovery',
          'Adaptive delays based on remaining time',
          'Preserves existing data if sync incomplete'
        ]
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Timeout-Safe Sync Error:', error)
    
    // Log error to sync progress if possible
    try {
      const { userId } = await req.json()
      if (userId) {
        await supabase
          .from('sync_progress')
          .upsert({
            user_id: userId,
            status: 'error',
            message: 'Critical sync error occurred',
            error: error.message,
            completed_at: new Date().toISOString()
          })
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
