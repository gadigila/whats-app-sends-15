import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Helper function for phone matching
class PhoneMatcher {
  private userPhoneVariants: string[];

  constructor(userPhone: string) {
    const cleanPhone = userPhone.replace(/[^\d]/g, '');
    
    this.userPhoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('972') ? '0' + cleanPhone.substring(3) : null,
      cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : null,
      cleanPhone.slice(-9), // Last 9 digits
    ].filter(Boolean) as string[];
  }

  isMatch(participantPhone: string): boolean {
    if (!participantPhone) return false;
    
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '');
    
    // Fast exact match
    if (this.userPhoneVariants.includes(cleanParticipant)) {
      return true;
    }
    
    // Check last 9 digits for Israeli numbers
    if (cleanParticipant.length >= 9) {
      const lastNine = cleanParticipant.slice(-9);
      return this.userPhoneVariants.some(variant => 
        variant.length >= 9 && variant.slice(-9) === lastNine
      );
    }
    
    return false;
  }
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
    console.log('🚀 SIMPLE ALL GROUPS SYNC: Get every single group...')
    
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

    console.log('👤 Starting ALL GROUPS sync for user:', userId)

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

    console.log('📱 User instance:', profile.instance_id)
    console.log('📱 User phone:', profile.phone_number || 'Unknown')

    // Initialize phone matcher for admin detection
    let phoneMatcher: PhoneMatcher | null = null
    if (profile.phone_number) {
      phoneMatcher = new PhoneMatcher(profile.phone_number)
      console.log('✅ Phone matcher initialized for admin detection')
    } else {
      console.log('⚠️ No phone number - admin detection will be skipped')
    }

    // 📦 STEP 1: GET ALL GROUPS FROM WHAPI
    console.log('\n📦 === STEP 1: FETCH ALL GROUPS ===')
    
    let allGroups: any[] = []
    let currentOffset = 0
    let hasMoreGroups = true
    let apiCallsCount = 0
    const batchSize = 100
    const maxApiCalls = 15 // Allow more calls to get ALL groups
    const syncStartTime = Date.now()

    // Keep fetching until we get all groups
    while (hasMoreGroups && apiCallsCount < maxApiCalls) {
      apiCallsCount++
      
      console.log(`📊 API call ${apiCallsCount}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
      
      try {
        // Rate limiting - be gentle with WHAPI
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
            await delay(10000) // Wait 10 seconds
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
          
          // If we got less than requested, probably no more groups
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
          message: 'לא נמצאו קבוצות בחשבון שלך',
          fetch_time_seconds: fetchTime
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // 💾 STEP 2: PREPARE FOR DATABASE WITH SMART ADMIN DETECTION
    console.log('\n💾 === STEP 2: PREPARE DATA WITH ADMIN DETECTION ===')
    
    const groupsToStore: any[] = []
    let adminGroupsDetected = 0
    let creatorGroupsDetected = 0
    let groupsWithParticipants = 0

    for (const group of allGroups) {
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      // Default values
      let isAdmin = false
      let isCreator = false
      
      // 🔍 SMART ADMIN DETECTION: Only if participants are already loaded
      if (phoneMatcher && group.participants && Array.isArray(group.participants) && group.participants.length > 0) {
        groupsWithParticipants++
        
        // Find user in participants
        const userParticipant = group.participants.find((participant: any) => {
          const participantId = participant.id || participant.phone || participant.number;
          return phoneMatcher!.isMatch(participantId);
        });

        if (userParticipant) {
          const participantRank = (userParticipant.rank || userParticipant.role || 'member').toLowerCase()
          
          isCreator = participantRank === 'creator' || participantRank === 'owner'
          isAdmin = participantRank === 'admin' || participantRank === 'administrator' || isCreator

          if (isCreator) {
            creatorGroupsDetected++
            console.log(`👑 CREATOR detected: ${groupName}`)
          } else if (isAdmin) {
            adminGroupsDetected++
            console.log(`⭐ ADMIN detected: ${groupName}`)
          }
        }
      }
      
      // Store ALL groups with detected admin status (if available)
      const groupData = {
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: group.participants?.length || group.size || 0,
        is_admin: isAdmin,
        is_creator: isCreator,
        avatar_url: group.chat_pic || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      groupsToStore.push(groupData)
    }

    console.log(`📋 Prepared ${groupsToStore.length} groups for storage`)
    console.log(`🔍 Admin detection results:`)
    console.log(`   - Groups with participant data: ${groupsWithParticipants}`)
    console.log(`   - Creator groups detected: ${creatorGroupsDetected}`)
    console.log(`   - Admin groups detected: ${adminGroupsDetected}`)
    console.log(`   - Total admin/creator groups: ${adminGroupsDetected + creatorGroupsDetected}`)

    // 💽 STEP 3: SAVE TO DATABASE
    console.log('\n💽 === STEP 3: SAVE TO DATABASE ===')
    
    const storeStartTime = Date.now()

    // Clear existing groups for this user
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    console.log('🧹 Cleared existing groups')

    // Store new groups in batches
    const dbBatchSize = 50 // Smaller batches for reliability
    let storedCount = 0

    for (let i = 0; i < groupsToStore.length; i += dbBatchSize) {
      const batch = groupsToStore.slice(i, i + dbBatchSize)
      
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(batch)

      if (insertError) {
        console.error('❌ Database insert error:', insertError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to save groups to database', 
            details: insertError.message 
          }),
          { status: 500, headers: corsHeaders }
        )
      }
      
      storedCount += batch.length
      console.log(`💾 Stored batch: ${storedCount}/${groupsToStore.length}`)
      
      // Small delay between database batches
      if (i + dbBatchSize < groupsToStore.length) {
        await delay(200)
      }
    }

    const storeTime = Math.round((Date.now() - storeStartTime) / 1000)
    const totalTime = Math.round((Date.now() - syncStartTime) / 1000)

    console.log(`\n🎯 SMART SYNC COMPLETE!`)
    console.log(`📊 Total groups stored: ${storedCount}`)
    console.log(`👑 Creator groups: ${creatorGroupsDetected}`)
    console.log(`⭐ Admin groups: ${adminGroupsDetected}`)
    console.log(`📊 Total admin/creator: ${adminGroupsDetected + creatorGroupsDetected}`)
    console.log(`⚡ Total time: ${totalTime} seconds`)
    console.log(`📡 API calls made: ${apiCallsCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: storedCount,
        admin_groups_count: adminGroupsDetected,
        creator_groups_count: creatorGroupsDetected,
        total_managed_groups: adminGroupsDetected + creatorGroupsDetected,
        groups_with_participants: groupsWithParticipants,
        total_sync_time_seconds: totalTime,
        api_calls_made: apiCallsCount,
        fetch_time_seconds: fetchTime,
        storage_time_seconds: storeTime,
        strategy: 'smart_all_groups_with_admin_detection',
        message: storedCount > 0 
          ? `נמצאו ${storedCount} קבוצות! ${adminGroupsDetected + creatorGroupsDetected} בניהולך`
          : 'לא נמצאו קבוצות',
        groups_sample: groupsToStore.slice(0, 20).map(g => ({
          name: g.name,
          participants: g.participants_count,
          id: g.group_id
        }))
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Simple Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})