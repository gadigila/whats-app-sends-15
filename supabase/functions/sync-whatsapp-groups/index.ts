import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to add delays between requests
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface SyncGroupsRequest {
  userId: string
}
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 FAST GROUP SYNC: Fetch ALL groups strategy...')
    
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

    console.log('👤 Starting FAST sync for user:', userId)

    // Get user's WHAPI credentials
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

    console.log('📱 User phone:', profile.phone_number || 'Unknown')

    // 🚀 PHASE 1: FAST BULK GROUP FETCH
    console.log('\n🔥 === PHASE 1: BULK GROUP FETCH ===')
    
    let allGroups: any[] = []
    let currentOffset = 0
    let hasMoreGroups = true
    let apiCallsCount = 0
    const batchSize = 100 // Larger batches for speed
    const maxApiCalls = 10 // Reasonable limit
    const syncStartTime = Date.now()

    // Fetch all groups in batches
    while (hasMoreGroups && apiCallsCount < maxApiCalls) {
      apiCallsCount++
      
      console.log(`📊 API call ${apiCallsCount}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
      
      try {
        // Short delay to avoid overwhelming WHAPI
        if (apiCallsCount > 1) {
          await delay(1500) // 1.5 second delay
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
            await delay(5000)
            continue
          } else {
            console.log(`💥 Non-retryable error, stopping sync`)
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
        await delay(3000)
        continue
      }
    }

    const fetchTime = Math.round((Date.now() - syncStartTime) / 1000)
    console.log(`\n📊 BULK FETCH COMPLETE: ${allGroups.length} groups in ${fetchTime}s (${apiCallsCount} API calls)`)

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

    // 🚀 PHASE 2: PREPARE GROUP DATA FOR DATABASE
    console.log('\n💾 === PHASE 2: PREPARE DATA FOR STORAGE ===')
    
    const processStartTime = Date.now()
    const groupsToStore: any[] = []

    for (const group of allGroups) {
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      // Basic group data - no complex processing
      const groupData = {
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: group.participants?.length || group.size || 0,
        is_admin: false, // Will be determined later if needed
        is_creator: false, // Will be determined later if needed
        avatar_url: group.chat_pic || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Store raw group data for future processing
        raw_data: JSON.stringify({
          type: group.type,
          created_at: group.created_at,
          participants_loaded: !!(group.participants && group.participants.length > 0)
        })
      }

      groupsToStore.push(groupData)
    }

    const processTime = Math.round((Date.now() - processStartTime) / 1000)
    console.log(`📋 Processed ${groupsToStore.length} groups in ${processTime}s`)

    // 🚀 PHASE 3: FAST DATABASE STORAGE
    console.log('\n💽 === PHASE 3: STORE IN DATABASE ===')
    
    const storeStartTime = Date.now()

    // Clear existing groups for this user
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    console.log('🧹 Cleared existing groups')

    // Store new groups in batches
    const dbBatchSize = 100
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
      
      // Small delay between batches
      if (i + dbBatchSize < groupsToStore.length) {
        await delay(100)
      }
    }

    console.log(`\n🎯 FAST SYNC COMPLETE!`)
    console.log(`📊 Total groups: ${storedCount}`)
    console.log(`⚡ Total time: ${totalTime} seconds`)
    console.log(`📡 API calls: ${apiCallsCount}`)
    console.log(`💾 Storage time: ${storeTime} seconds`)

    // 🚀 PHASE 4: QUEUE BACKGROUND ADMIN DETECTION
    console.log('\n🔧 === PHASE 4: QUEUE BACKGROUND ADMIN DETECTION ===')
    console.log('💡 Admin status will be detected in background automatically')
    
    // Mark all groups as needing admin detection
    if (storedCount > 0) {
      await supabase
        .from('whatsapp_groups')
        .update({ 
          admin_detection_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      console.log('✅ Groups queued for background admin detection')
    }

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: storedCount,
        admin_groups_pending: storedCount, // All groups need admin detection
        background_processing: true,
        total_sync_time_seconds: totalTime,
        api_calls_made: apiCallsCount,
        fetch_time_seconds: fetchTime,
        storage_time_seconds: storeTime,
        strategy: 'fast_bulk_sync',
        message: storedCount > 0 
          ? `נמצאו ${storedCount} קבוצות! סטטוס מנהל יתעדכן ברקע`
          : 'לא נמצאו קבוצות',
        optimization_notes: [
          'All groups synced instantly - no filtering',
          'Admin status detection queued for background processing',
          'UI will update automatically as admin status is detected',
          'Users can create categories immediately with all groups visible'
        ],
        groups_sample: groupsToStore.slice(0, 10).map(g => ({
          name: g.name,
          participants: g.participants_count,
          id: g.group_id
        }))
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Fast Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})