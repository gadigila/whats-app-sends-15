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

// Phone matching utility (simplified)
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

// 🚀 TIMEOUT-SAFE: Smart Batch Processing
async function fetchGroupsWithTimeLimit(token: string, maxTimeSeconds: number = 120) {
  console.log(`🚀 Starting TIMEOUT-SAFE group sync (max ${maxTimeSeconds}s)...`)
  
  const startTime = Date.now()
  const allGroups = new Map()
  let totalApiCalls = 0
  let stage = 'discovery'
  
  // 🔥 STRATEGY: Adaptive batching that respects time limits
  const timeLimit = maxTimeSeconds * 1000 // Convert to ms
  
  try {
    // STAGE 1: Fast discovery with larger batches
    console.log('🔍 STAGE 1: Fast group discovery...')
    let offset = 0
    let hasMore = true
    let discoveryApiCalls = 0
    
    while (hasMore && discoveryApiCalls < 6) { // Max 6 discovery calls
      const elapsed = Date.now() - startTime
      if (elapsed > timeLimit * 0.3) { // Use max 30% of time for discovery
        console.log('⏰ Discovery time limit reached, moving to processing...')
        break
      }
      
      discoveryApiCalls++
      totalApiCalls++
      
      console.log(`📊 Discovery call ${discoveryApiCalls}: offset ${offset}`)
      
      if (discoveryApiCalls > 1) {
        await delay(1500) // Faster delays for discovery
      }
      
      const response = await fetch(
        `https://gate.whapi.cloud/groups?count=300&offset=${offset}`, // Larger batches
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
      
      console.log(`📊 Discovered ${groups.length} groups`)
      
      // Store groups with participant data if available
      groups.forEach(group => {
        if (group.id) {
          allGroups.set(group.id, group)
        }
      })
      
      if (groups.length === 0) {
        hasMore = false
      } else if (groups.length < 300) {
        hasMore = false
      } else {
        offset += 300
      }
    }
    
    console.log(`🎯 Discovery complete: ${allGroups.size} groups found in ${discoveryApiCalls} calls`)
    
    // STAGE 2: Smart processing with time awareness
    stage = 'processing'
    console.log(`🔍 STAGE 2: Processing ${allGroups.size} groups...`)
    
    const groupsArray = Array.from(allGroups.values())
    const processedGroups = []
    let processed = 0
    
    for (const group of groupsArray) {
      const elapsed = Date.now() - startTime
      const remainingTime = timeLimit - elapsed
      
      // Stop if we're running out of time (keep 10s buffer)
      if (remainingTime < 10000) {
        console.log(`⏰ Time limit approaching (${Math.round(remainingTime/1000)}s left), stopping processing...`)
        break
      }
      
      processed++
      
      // Calculate dynamic delay based on remaining time
      const remainingGroups = groupsArray.length - processed
      const timePerGroup = remainingGroups > 0 ? Math.max(200, (remainingTime - 5000) / remainingGroups) : 1000
      const delayMs = Math.min(2000, Math.max(200, timePerGroup * 0.8)) // Use 80% of available time per group
      
      if (processed > 1 && delayMs > 200) {
        await delay(delayMs)
      }
      
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
      
      if (processed % 20 === 0) {
        const timeElapsed = Math.round((Date.now() - startTime) / 1000)
        console.log(`📊 Processed ${processed}/${groupsArray.length} groups (${timeElapsed}s elapsed)`)
      }
    }
    
    const finalTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`🎯 Processing complete: ${processedGroups.length} groups processed in ${finalTime}s`)
    
    return {
      groups: processedGroups,
      totalApiCalls,
      totalProcessed: processedGroups.length,
      timeElapsed: finalTime,
      completed: processed >= groupsArray.length
    }
    
  } catch (error) {
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.error(`❌ Error in ${stage} stage after ${elapsed}s:`, error.message)
    
    return {
      groups: Array.from(allGroups.values()),
      totalApiCalls,
      totalProcessed: allGroups.size,
      timeElapsed: elapsed,
      completed: false,
      error: error.message
    }
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
    console.log('🚀 TIMEOUT-SAFE GROUP SYNC: Optimized for Supabase limits')
    
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_status, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get phone number
    let userPhone = profile.phone_number
    if (!userPhone) {
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
      return new Response(
        JSON.stringify({ error: 'Could not determine phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🚀 TIMEOUT-SAFE GROUP FETCHING (120 second limit)
    const fetchResult = await fetchGroupsWithTimeLimit(profile.whapi_token, 120)
    
    // Process groups for admin status
    const { adminGroups, stats } = processGroupsForAdmin(fetchResult.groups, userPhone, userId)
    
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000)

    console.log(`\n🎯 TIMEOUT-SAFE SYNC COMPLETED!`)
    console.log(`📊 Groups processed: ${fetchResult.totalProcessed}`)
    console.log(`🔑 Admin groups found: ${adminGroups.length}`)
    console.log(`⚡ Total time: ${totalSyncTime}s`)
    console.log(`✅ Completed: ${fetchResult.completed}`)

    // 🛡️ SAFETY CHECK: Don't clear existing if we got 0 results due to timeout
    const { data: existingGroups } = await supabase
      .from('whatsapp_groups')
      .select('id')
      .eq('user_id', userId)

    if (adminGroups.length === 0 && existingGroups && existingGroups.length > 0 && !fetchResult.completed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Sync incomplete due to time limits',
          existing_groups_count: existingGroups.length,
          groups_processed: fetchResult.totalProcessed,
          time_elapsed: totalSyncTime,
          recommendation: 'Try again - the function was cut short due to time limits',
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
        return new Response(
          JSON.stringify({ error: 'Failed to save groups', details: insertError.message }),
          { status: 500, headers: corsHeaders }
    )
  }
})
        )
      }
    }

    // Calculate stats
    const adminCount = adminGroups.filter(g => !g.is_creator).length
    const creatorCount = adminGroups.filter(g => g.is_creator).length
    const totalMembers = adminGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: adminGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMembers,
        total_groups_processed: fetchResult.totalProcessed,
        total_api_calls: fetchResult.totalApiCalls,
        sync_time_seconds: totalSyncTime,
        completed_full_sync: fetchResult.completed,
        processing_stats: stats,
        message: adminGroups.length > 0 
          ? `נמצאו ${adminGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
          : 'לא נמצאו קבוצות בניהולך',
        sync_method: 'Timeout-Safe Adaptive',
        optimization_notes: [
          'Respects Supabase 150s timeout limit',
          'Adaptive delays based on remaining time',
          'Processes as many groups as possible within time limit',
          'Preserves existing data if sync incomplete'
        ]
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Timeout-Safe Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }