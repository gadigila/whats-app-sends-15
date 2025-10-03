import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// 📱 PHONE MATCHING CLASS (from your working code)
class PhoneMatcher {
  private userPhoneVariants: string[]

  constructor(userPhone: string) {
    const cleanPhone = userPhone.replace(/[^\d]/g, '')
    
    // Pre-compute phone variants for Israeli numbers
    this.userPhoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('972') ? '0' + cleanPhone.substring(3) : null,
      cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : null,
      cleanPhone.slice(-9) // Last 9 digits for Israeli mobile
    ].filter(Boolean) as string[]
    
    console.log(`📱 Will match phone variants: ${this.userPhoneVariants.join(', ')}`)
  }

  isUserPhone(participantPhone: string): boolean {
    if (!participantPhone) return false
    
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '')
    
    // Fast exact match
    if (this.userPhoneVariants.includes(cleanParticipant)) return true
    
    // Israeli mobile number matching (last 9 digits)
    if (cleanParticipant.length >= 9) {
      const lastNine = cleanParticipant.slice(-9)
      return this.userPhoneVariants.some(variant => 
        variant.length >= 9 && variant.slice(-9) === lastNine
      )
    }
    
    return false
  }
}

// 🔍 ADMIN DETECTION FUNCTION (from your working code)
function detectAdminStatus(group: any, phoneMatcher: PhoneMatcher) {
  const groupName = group.name || group.subject || `Group ${group.id}`
  
  // Default values
  let isAdmin = false
  let isCreator = false
  let userFound = false
  
  // Check if we have participants data
  if (!group.participants || !Array.isArray(group.participants) || group.participants.length === 0) {
    return { isAdmin, isCreator, userFound, reason: 'no_participants' }
  }

  // Find user in participants
  const userParticipant = group.participants.find(participant => {
    const participantId = participant.id || participant.phone || participant.number
    return phoneMatcher.isUserPhone(participantId)
  })

  if (!userParticipant) {
    return { isAdmin, isCreator, userFound, reason: 'user_not_found' }
  }

  userFound = true

  // Check user role (your working logic)
  const participantRank = (userParticipant.rank || userParticipant.role || 'member').toLowerCase()
  isCreator = participantRank === 'creator' || participantRank === 'owner'
  isAdmin = participantRank === 'admin' || participantRank === 'administrator' || isCreator

  // Log the detection
  if (isCreator) {
    console.log(`👑 CREATOR: ${groupName} (${group.participants.length} members)`)
  } else if (isAdmin) {
    console.log(`⭐ ADMIN: ${groupName} (${group.participants.length} members)`)
  } else {
    console.log(`👤 MEMBER: ${groupName} (rank: ${participantRank})`)
  }

  return { isAdmin, isCreator, userFound, reason: 'detected', rank: participantRank }
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
    console.log('🚀 ALL GROUPS SYNC + ADMIN DETECTION')
    
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

    console.log('👤 Starting sync for user:', userId)

    // Get user's WHAPI credentials and phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get phone number if not stored
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
          console.log('📱 Phone retrieved from health:', userPhone)
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

    // Initialize phone matcher
    const phoneMatcher = new PhoneMatcher(userPhone)

    // 📦 STEP 1: GET ALL GROUPS FROM WHAPI
    console.log('\n📦 === STEP 1: FETCH ALL GROUPS ===')
    
    let allGroups: any[] = []
    let currentOffset = 0
    let hasMoreGroups = true
    let apiCallsCount = 0
    const batchSize = 100
    const maxApiCalls = 15
    const syncStartTime = Date.now()

    // Keep fetching until we get all groups
    while (hasMoreGroups && apiCallsCount < maxApiCalls) {
      apiCallsCount++
      
      console.log(`📊 API call ${apiCallsCount}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
      
      try {
        if (apiCallsCount > 1) {
          await delay(2000) // 2 second delay
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
          console.error(`❌ Groups API failed (call ${apiCallsCount}):`, groupsResponse.status)
          
          if (groupsResponse.status === 429) {
            console.log(`🔄 Rate limited, waiting longer...`)
            await delay(10000)
            continue
          } else {
            console.log(`💥 Stopping due to error`)
            break
          }
        }

        const groupsData = await groupsResponse.json()
        const batchGroups = groupsData.groups || []
        
        console.log(`📊 Batch ${apiCallsCount}: Received ${batchGroups.length} groups`)
        
        if (batchGroups.length === 0) {
          console.log(`📊 Empty batch - no more groups`)
          hasMoreGroups = false
        } else {
          allGroups = allGroups.concat(batchGroups)
          currentOffset += batchSize
          
          if (batchGroups.length < batchSize) {
            hasMoreGroups = false
          }
        }

      } catch (batchError) {
        console.error(`❌ API Error in batch ${apiCallsCount}:`, batchError)
        await delay(5000)
        continue
      }
    }

    const fetchTime = Math.round((Date.now() - syncStartTime) / 1000)
    console.log(`\n📊 FETCH COMPLETE: ${allGroups.length} total groups in ${fetchTime}s`)

    if (allGroups.length === 0) {
      console.log('⚠️ No groups found')
      return new Response(
        JSON.stringify({
          success: true,
          groups_count: 0,
          message: 'לא נמצאו קבוצות בחשבון שלך'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // 🔍 STEP 2: DETECT ADMIN STATUS FOR ALL GROUPS
    console.log('\n🔍 === STEP 2: ADMIN DETECTION FOR ALL GROUPS ===')
    
    const groupsToStore: any[] = []
    let adminGroupsDetected = 0
    let creatorGroupsDetected = 0
    let groupsWithParticipants = 0
    let groupsWhereUserFound = 0

    for (const group of allGroups) {
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      // Use your working admin detection logic
      const adminStatus = detectAdminStatus(group, phoneMatcher)
      
      // Track statistics
      if (group.participants && group.participants.length > 0) {
        groupsWithParticipants++
      }
      
      if (adminStatus.userFound) {
        groupsWhereUserFound++
      }
      
      if (adminStatus.isCreator) {
        creatorGroupsDetected++
      } else if (adminStatus.isAdmin) {
        adminGroupsDetected++
      }
      
      // Store ALL groups with detected admin status
      const groupData = {
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: group.participants?.length || group.size || 0,
        is_admin: adminStatus.isAdmin,
        is_creator: adminStatus.isCreator,
        avatar_url: group.chat_pic || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      groupsToStore.push(groupData)
    }

    console.log(`\n🔍 ADMIN DETECTION RESULTS:`)
    console.log(`📊 Total groups processed: ${allGroups.length}`)
    console.log(`📊 Groups with participant data: ${groupsWithParticipants}`)
    console.log(`📊 Groups where user was found: ${groupsWhereUserFound}`)
    console.log(`👑 Creator groups detected: ${creatorGroupsDetected}`)
    console.log(`⭐ Admin groups detected: ${adminGroupsDetected}`)
    console.log(`🎯 Total admin/creator groups: ${adminGroupsDetected + creatorGroupsDetected}`)

    // 💽 STEP 3: SAVE TO DATABASE (FIXED - Remove duplicates then upsert)
      console.log('\n💽 === STEP 3: SAVE TO DATABASE ===')
      
      const storeStartTime = Date.now()
      
      // ✅ FIXED: Remove duplicates from groupsToStore BEFORE inserting
      const uniqueGroups = Array.from(
        new Map(groupsToStore.map(group => [group.group_id, group])).values()
      )
      
      if (uniqueGroups.length < groupsToStore.length) {
        console.log(`⚠️ Found ${groupsToStore.length - uniqueGroups.length} duplicate groups, removing them`)
      }
      
      console.log(`📊 Unique groups to store: ${uniqueGroups.length}`)
      
      // Clear existing groups FIRST and WAIT for it to complete
      console.log('🧹 Clearing existing groups...')
      const { error: deleteError } = await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)
      
      if (deleteError) {
        console.error('❌ Error deleting existing groups:', deleteError)
        // Continue anyway - we'll handle duplicates with upsert
      }
      
      console.log('✅ Existing groups cleared')
      
      // Use UPSERT to handle any remaining duplicates
      const dbBatchSize = 50
      let storedCount = 0
      
      for (let i = 0; i < uniqueGroups.length; i += dbBatchSize) {
        const batch = uniqueGroups.slice(i, i + dbBatchSize)
        
        // Use upsert with onConflict
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .upsert(batch, {
            onConflict: 'user_id,group_id',  // Handle duplicates
            ignoreDuplicates: false           // Update existing records
          })
      
        if (insertError) {
          console.error('❌ Database upsert error:', insertError)
          return new Response(
            JSON.stringify({ 
              error: 'Failed to save groups to database', 
              details: insertError.message 
            }),
            { status: 500, headers: corsHeaders }
          )
        }
        
        storedCount += batch.length
        console.log(`💾 Upserted batch: ${storedCount}/${uniqueGroups.length}`)
        
        if (i + dbBatchSize < uniqueGroups.length) {
          await delay(200)
        }
      }
      
      const storeTime = Math.round((Date.now() - storeStartTime) / 1000)
      const totalTime = Math.round((Date.now() - syncStartTime) / 1000)
      
      console.log(`\n🎯 SYNC COMPLETE WITH ADMIN DETECTION!`)
      console.log(`📊 Total groups stored: ${storedCount}`)
      console.log(`👑 Creator groups: ${creatorGroupsDetected}`)
      console.log(`⭐ Admin groups: ${adminGroupsDetected}`)
      console.log(`🎯 Total managed: ${adminGroupsDetected + creatorGroupsDetected}`)
      console.log(`⚡ Total time: ${totalTime} seconds`)

    const totalMembersInManagedGroups = groupsToStore
      .filter(g => g.is_admin || g.is_creator)
      .reduce((sum, g) => sum + (g.participants_count || 0), 0)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: storedCount,
        admin_groups_count: adminGroupsDetected,
        creator_groups_count: creatorGroupsDetected,
        total_managed_groups: adminGroupsDetected + creatorGroupsDetected,
        total_members_in_managed_groups: totalMembersInManagedGroups,
        groups_with_participants: groupsWithParticipants,
        groups_where_user_found: groupsWhereUserFound,
        total_sync_time_seconds: totalTime,
        api_calls_made: apiCallsCount,
        fetch_time_seconds: fetchTime,
        storage_time_seconds: storeTime,
        user_phone: userPhone,
        strategy: 'all_groups_with_working_admin_detection',
        message: storedCount > 0 
          ? `נמצאו ${storedCount} קבוצות! ${adminGroupsDetected + creatorGroupsDetected} בניהולך`
          : 'לא נמצאו קבוצות',
        admin_detection_stats: {
          detection_rate: groupsWithParticipants > 0 ? Math.round((groupsWhereUserFound / groupsWithParticipants) * 100) : 0,
          admin_rate: groupsWhereUserFound > 0 ? Math.round(((adminGroupsDetected + creatorGroupsDetected) / groupsWhereUserFound) * 100) : 0
        },
        groups_sample: groupsToStore.slice(0, 10).map(g => ({
          name: g.name,
          participants: g.participants_count,
          is_admin: g.is_admin,
          is_creator: g.is_creator,
          id: g.group_id
        }))
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})