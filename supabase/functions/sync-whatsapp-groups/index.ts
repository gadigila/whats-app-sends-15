import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
  chunk?: number // NEW: For chunked processing
  batchSize?: number // NEW: How many groups per chunk
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Phone matching utility (kept your existing logic)
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

// NEW: Real-time progress update
async function updateSyncProgress(
  supabase: any, 
  userId: string, 
  progress: {
    stage: string
    current: number
    total: number
    adminFound?: number
    creatorFound?: number
    lastGroup?: string
  }
) {
  try {
    await supabase
      .from('sync_progress')
      .upsert({
        user_id: userId,
        stage: progress.stage,
        current: progress.current,
        total: progress.total,
        admin_found: progress.adminFound || 0,
        creator_found: progress.creatorFound || 0,
        last_group: progress.lastGroup || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
    
    console.log(`📊 Progress: ${progress.current}/${progress.total} - ${progress.stage}`)
  } catch (error) {
    console.error('❌ Failed to update progress:', error)
  }
}

// NEW: Add admin group to database immediately for real-time UI
async function addAdminGroupImmediately(supabase: any, adminGroup: any) {
  try {
    const { error } = await supabase
      .from('whatsapp_groups')
      .upsert(adminGroup)
      .eq('group_id', adminGroup.group_id)
    
    if (!error) {
      console.log(`✅ Added to UI: ${adminGroup.name}`)
    }
  } catch (error) {
    console.error('❌ Error adding admin group:', error)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 ENHANCED GROUP SYNC: Real-time updates + chunked processing')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, chunk = 0, batchSize = 30 }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const startTime = Date.now()
    console.log(`👤 Processing chunk ${chunk} for user: ${userId}`)

    // Get user profile and validate (kept your existing logic)
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

    // Get phone number (kept your existing logic)
    let userPhone = profile.phone_number
    if (!userPhone) {
      console.log('📱 Fetching phone from /health...')
      
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

    const phoneMatcher = new PhoneMatcher(userPhone)

    // CHUNK 0: Initial discovery phase
    if (chunk === 0) {
      console.log('🔍 CHUNK 0: Group discovery phase')
      
      await updateSyncProgress(supabase, userId, {
        stage: 'מגלה קבוצות...',
        current: 0,
        total: 100
      })

      // Clear existing data for fresh start
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
      await supabase.from('sync_progress').delete().eq('user_id', userId)
      await supabase.from('sync_groups_temp').delete().eq('user_id', userId)

      // Fast discovery with timeout protection
      const allGroups = []
      let offset = 0
      let hasMore = true
      let discoveryCount = 0
      const maxDiscoveryTime = 30000 // 30 seconds max for discovery

      while (hasMore && discoveryCount < 6 && (Date.now() - startTime) < maxDiscoveryTime) {
        discoveryCount++
        
        await updateSyncProgress(supabase, userId, {
          stage: `מגלה קבוצות... (${discoveryCount}/6)`,
          current: discoveryCount * 15,
          total: 100
        })

        if (discoveryCount > 1) {
          await delay(1500) // Shorter delays for discovery
        }

        try {
          const response = await fetch(
            `https://gate.whapi.cloud/groups?count=250&offset=${offset}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${profile.whapi_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (!response.ok) {
            console.error(`❌ Discovery failed: ${response.status}`)
            if (response.status === 429) {
              await delay(4000)
              continue
            }
            break
          }

          const data = await response.json()
          const groups = data.groups || []
          
          console.log(`📊 Discovery ${discoveryCount}: Found ${groups.length} groups`)
          allGroups.push(...groups)
          
          if (groups.length === 0 || groups.length < 250) {
            hasMore = false
          } else {
            offset += 250
          }

        } catch (error) {
          console.error(`❌ Discovery error:`, error.message)
          await delay(3000)
          continue
        }
      }

      console.log(`🎯 Discovery complete: ${allGroups.length} groups found`)

      // Store discovered groups for chunked processing
      if (allGroups.length > 0) {
        const groupsToStore = allGroups.map(group => ({
          user_id: userId,
          group_id: group.id,
          group_data: group,
          processed: false,
          created_at: new Date().toISOString()
        }))

        // Insert in small batches to avoid payload limits
        const insertBatchSize = 50
        for (let i = 0; i < groupsToStore.length; i += insertBatchSize) {
          const batch = groupsToStore.slice(i, i + insertBatchSize)
          try {
            await supabase.from('sync_groups_temp').insert(batch)
          } catch (insertError) {
            console.error('❌ Error storing groups batch:', insertError)
          }
        }
      }

      await updateSyncProgress(supabase, userId, {
        stage: 'גילוי הושלם! מתחיל לבדוק קבוצות...',
        current: 100,
        total: allGroups.length,
        adminFound: 0,
        creatorFound: 0
      })

      return new Response(
        JSON.stringify({
          success: true,
          phase: 'discovery_complete',
          total_groups: allGroups.length,
          next_chunk: 1,
          message: `נמצאו ${allGroups.length} קבוצות - מתחיל לבדוק סטטוס מנהל...`
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // CHUNKS 1+: Process groups in small, timeout-safe batches
    console.log(`🔍 CHUNK ${chunk}: Processing groups in batches`)

    // Get unprocessed groups for this chunk
    const offset = (chunk - 1) * batchSize
    const { data: tempGroups, error: tempError } = await supabase
      .from('sync_groups_temp')
      .select('*')
      .eq('user_id', userId)
      .eq('processed', false)
      .range(offset, offset + batchSize - 1)
      .order('created_at')

    if (tempError || !tempGroups || tempGroups.length === 0) {
      console.log('🏁 No more groups to process - sync complete')
      
      // Get final counts
      const { data: finalGroups } = await supabase
        .from('whatsapp_groups')
        .select('is_creator')
        .eq('user_id', userId)

      const adminCount = finalGroups?.filter(g => !g.is_creator).length || 0
      const creatorCount = finalGroups?.filter(g => g.is_creator).length || 0
      const totalFound = adminCount + creatorCount

      // Clean up temp data
      await supabase.from('sync_groups_temp').delete().eq('user_id', userId)
      await supabase.from('sync_progress').delete().eq('user_id', userId)

      return new Response(
        JSON.stringify({
          success: true,
          phase: 'complete',
          groups_count: totalFound,
          admin_groups_count: adminCount,
          creator_groups_count: creatorCount,
          message: totalFound > 0 
            ? `נמצאו ${totalFound} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
            : 'לא נמצאו קבוצות בניהולך',
          sync_method: 'Enhanced Real-time Chunked'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Process this chunk of groups with timeout protection
    let processed = 0
    let adminFound = 0
    let creatorFound = 0
    const chunkStartTime = Date.now()
    const maxChunkTime = 45000 // 45 seconds max per chunk

    for (const tempGroup of tempGroups) {
      // Timeout protection - stop if we're taking too long
      if ((Date.now() - chunkStartTime) > maxChunkTime) {
        console.log(`⏰ Chunk timeout protection activated - processed ${processed} groups`)
        break
      }

      const group = tempGroup.group_data
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      processed++
      
      // Update progress in real-time
      await updateSyncProgress(supabase, userId, {
        stage: `בודק ${groupName}...`,
        current: offset + processed,
        total: 999, // Will be updated as we know the real total
        adminFound,
        creatorFound,
        lastGroup: groupName
      })

      // Conservative delay to respect rate limits  
      if (processed > 1) {
        await delay(1200)
      }

      try {
        // Get detailed group info if needed
        let groupWithParticipants = group
        if (!group.participants || group.participants.length === 0) {
          const detailResponse = await fetch(
            `https://gate.whapi.cloud/groups/${group.id}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${profile.whapi_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (detailResponse.ok) {
            const detailData = await detailResponse.json()
            if (detailData.participants) {
              groupWithParticipants = { ...group, participants: detailData.participants }
            }
          }
        }

        // Check if user is admin (kept your existing logic)
        if (groupWithParticipants.participants && Array.isArray(groupWithParticipants.participants)) {
          const userParticipant = groupWithParticipants.participants.find(participant => {
            const participantId = participant.id || participant.phone || participant.number
            return phoneMatcher.isUserPhone(participantId)
          })

          if (userParticipant) {
            const participantRank = (userParticipant.rank || userParticipant.role || 'member').toLowerCase()
            const isCreator = participantRank === 'creator' || participantRank === 'owner'
            const isAdmin = participantRank === 'admin' || participantRank === 'administrator' || isCreator

            if (isAdmin) {
              if (isCreator) {
                creatorFound++
                console.log(`👑 ${groupName}: CREATOR (${groupWithParticipants.participants.length} members)`)
              } else {
                adminFound++
                console.log(`⭐ ${groupName}: ADMIN (${groupWithParticipants.participants.length} members)`)
              }

              // Add to database immediately for real-time UI update
              const adminGroup = {
                user_id: userId,
                group_id: group.id,
                name: groupName,
                description: group.description || null,
                participants_count: groupWithParticipants.participants.length,
                is_admin: true,
                is_creator: isCreator,
                avatar_url: group.chat_pic || null,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }

              await addAdminGroupImmediately(supabase, adminGroup)
            }
          }
        }

        // Mark this group as processed
        await supabase
          .from('sync_groups_temp')
          .update({ processed: true })
          .eq('id', tempGroup.id)

      } catch (error) {
        console.error(`❌ Error processing ${groupName}:`, error.message)
        await delay(2000)
      }
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000)
    console.log(`🎯 Chunk ${chunk} complete: ${processed} groups processed in ${elapsedTime}s`)

    return new Response(
      JSON.stringify({
        success: true,
        phase: 'processing',
        chunk_processed: chunk,
        groups_in_chunk: processed,
        admin_found_in_chunk: adminFound,
        creator_found_in_chunk: creatorFound,
        next_chunk: chunk + 1,
        processing_time: elapsedTime,
        message: `עיבדתי ${processed} קבוצות בחבילה זו`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Enhanced Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})