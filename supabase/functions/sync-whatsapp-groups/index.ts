import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Simple phone matching (no cache)
function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const clean1 = phone1.replace(/[^\d]/g, '');
  const clean2 = phone2.replace(/[^\d]/g, '');
  
  // Direct exact match
  if (clean1 === clean2) return true;
  
  // Israeli format handling (972 vs 0 prefix)
  if (clean1.startsWith('972') && clean2.startsWith('0')) {
    return clean1.substring(3) === clean2.substring(1);
  }
  
  if (clean2.startsWith('972') && clean1.startsWith('0')) {
    return clean2.substring(3) === clean1.substring(1);
  }
  
  // Last 9 digits match (Israeli mobile standard)
  if (clean1.length >= 9 && clean2.length >= 9) {
    return clean1.slice(-9) === clean2.slice(-9);
  }
  
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 NO CACHE SYNC: Fixed version without problematic cache...')
    
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

    console.log('👤 Starting NO CACHE sync for user:', userId)

    // Get existing groups for safety
    const { data: existingGroups, error: existingError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', userId)

    const existingCount = existingGroups?.length || 0
    console.log(`🔍 Existing groups in database: ${existingCount}`)

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

    // Get/update phone number
    let userPhoneNumber = profile.phone_number

    if (!userPhoneNumber) {
      console.log('📱 Fetching phone from /health...')
      
      try {
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          
          if (healthData?.user?.id) {
            userPhoneNumber = healthData.user.id.replace(/[^\d]/g, '');
            
            await supabase
              .from('profiles')
              .update({
                phone_number: userPhoneNumber,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            
            console.log('📱 Phone retrieved and saved:', userPhoneNumber)
          }
        }
      } catch (healthError) {
        console.error('❌ Error calling /health:', healthError)
      }
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine your phone number',
          suggestion: 'Please check connection status first'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📱 User phone for matching: ${userPhoneNumber}`)

    // SIMPLIFIED 2-PASS STRATEGY (no cache, fresh processing)
    const passConfig = [
      { pass: 1, delay: 0,     batchSize: 100, description: "Fresh scan", maxCalls: 6 },
      { pass: 2, delay: 15000, batchSize: 150, description: "Deep scan", maxCalls: 6 }
    ];

    let allFoundGroups: any[] = [] // Simple array, no Map/cache
    let totalApiCalls = 0
    let hasApiErrors = false
    let totalGroupsScanned = 0
    let totalAdminGroups = 0
    let totalCreatorGroups = 0
    const syncStartTime = Date.now()

    for (const config of passConfig) {
      if (config.delay > 0) {
        console.log(`⏳ Waiting ${config.delay/1000}s before pass ${config.pass}...`)
        await delay(config.delay);
      }

      console.log(`\n🔄 === NO CACHE PASS ${config.pass}/2 === (${config.description})`)
      
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let passApiCalls = 0

      // Get all groups with pagination
      while (hasMoreGroups && passApiCalls < config.maxCalls) {
        passApiCalls++
        totalApiCalls++
        
        console.log(`📊 Pass ${config.pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + config.batchSize}`)
        
        try {
          const apiDelay = 2500 + (config.pass * 500) // Conservative delays
          if (passApiCalls > 1) {
            await delay(apiDelay)
          }

          const groupsResponse = await fetch(
            `https://gate.whapi.cloud/groups?count=${config.batchSize}&offset=${currentOffset}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${profile.whapi_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (!groupsResponse.ok) {
            console.error(`❌ Groups API failed (pass ${config.pass}, call ${passApiCalls}):`, groupsResponse.status)
            hasApiErrors = true
            
            if (groupsResponse.status === 429 || groupsResponse.status >= 500) {
              console.log(`🔄 Retryable error, waiting and continuing...`)
              await delay(apiDelay * 2)
              continue
            } else {
              console.log(`💥 Non-retryable error, stopping pass ${config.pass}`)
              break
            }
          }

          const groupsData = await groupsResponse.json()
          const batchGroups = groupsData.groups || []
          
          console.log(`📊 Pass ${config.pass}, batch ${passApiCalls}: Received ${batchGroups.length} groups`)
          
          if (batchGroups.length === 0) {
            console.log(`📭 Empty batch in pass ${config.pass}`)
            hasMoreGroups = false
          } else {
            allGroups = allGroups.concat(batchGroups)
            totalGroupsScanned += batchGroups.length
            currentOffset += config.batchSize
            
            if (batchGroups.length < config.batchSize) {
              hasMoreGroups = false
            }
          }

        } catch (batchError) {
          console.error(`❌ API Error in pass ${config.pass}:`, batchError)
          hasApiErrors = true
          await delay(3000)
          continue
        }
      }

      // PROCESS ALL GROUPS WITHOUT CACHE
      console.log(`🔍 Processing ${allGroups.length} groups WITHOUT cache...`)
      
      for (const group of allGroups) {
        const groupName = group.name || group.subject || `Group ${group.id}`
        const participantsCount = group.participants?.length || 0
        
        // Skip if already found in allFoundGroups (simple duplicate check)
        const alreadyFound = allFoundGroups.find(g => g.group_id === group.id)
        if (alreadyFound) {
          console.log(`🔄 Already processed: ${groupName} (skipping duplicate)`)
          continue
        }

        console.log(`🔍 PROCESSING: ${groupName} (${participantsCount} participants)`)
        
        // Skip if no participants
        if (!group.participants || !Array.isArray(group.participants) || group.participants.length === 0) {
          console.log(`⚠️ No participants for: ${groupName} (skipping)`)
          continue
        }

        // Find user in participants
        let isAdmin = false
        let isCreator = false
        let userFound = false
        
        for (const participant of group.participants) {
          const participantId = participant.id || participant.phone || participant.number
          
          if (isPhoneMatch(userPhoneNumber, participantId)) {
            userFound = true
            const participantRank = participant.rank || participant.role || 'member'
            const normalizedRank = participantRank.toLowerCase()
            
            const isCreatorRole = normalizedRank === 'creator' || normalizedRank === 'owner'
            const isAdminRole = normalizedRank === 'admin' || 
                              normalizedRank === 'administrator' || 
                              isCreatorRole ||
                              participant.admin === true

            if (isCreatorRole) {
              isCreator = true
              isAdmin = true
              totalCreatorGroups++
              console.log(`👑 FOUND CREATOR: ${groupName} (role: ${participantRank})`)
            } else if (isAdminRole) {
              isAdmin = true
              totalAdminGroups++
              console.log(`⭐ FOUND ADMIN: ${groupName} (role: ${participantRank})`)
            } else {
              console.log(`👤 FOUND MEMBER: ${groupName} (role: ${participantRank}) - skipping`)
            }
            break
          }
        }

        if (!userFound) {
          console.log(`❌ User NOT found in: ${groupName}`)
          continue
        }

        // Add to results if admin/creator
        if (isAdmin) {
          const groupData = {
            user_id: userId,
            group_id: group.id,
            name: groupName,
            description: group.description || null,
            participants_count: participantsCount,
            is_admin: true,
            is_creator: isCreator,
            avatar_url: group.chat_pic || null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          allFoundGroups.push(groupData)
          console.log(`✅ ADDED: ${groupName} (${participantsCount} members) - ${isCreator ? 'CREATOR' : 'ADMIN'}`)
        }
      }

      const totalElapsedTime = Math.round((Date.now() - syncStartTime) / 1000)
      console.log(`🎯 Pass ${config.pass} completed: ${allFoundGroups.length} total admin groups found (${totalElapsedTime}s elapsed)`)
    }

    const newGroupsCount = allFoundGroups.length
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000)

    console.log(`\n🎯 NO CACHE SYNC COMPLETE!`)
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`)
    console.log(`📊 API calls made: ${totalApiCalls}`)
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`)
    console.log(`🆕 Admin groups found: ${newGroupsCount}`)
    console.log(`👑 Creator groups: ${totalCreatorGroups}`)
    console.log(`⭐ Admin groups: ${totalAdminGroups}`)
    console.log(`📁 Existing groups: ${existingCount}`)
    console.log(`❌ API errors occurred: ${hasApiErrors}`)

    // Safety checks
    if (hasApiErrors && newGroupsCount === 0) {
      console.log('🛡️ SAFETY: API errors + 0 groups found - preserving existing')
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API errors occurred during sync',
          existing_groups_preserved: existingCount,
          total_groups_scanned: totalGroupsScanned,
          cache_disabled: true,
          message: `API errors detected. Your ${existingCount} existing groups are safe.`,
          recommendation: 'Try again in a few minutes when WHAPI is more stable'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (existingCount > 0 && newGroupsCount < existingCount * 0.3) {
      console.log(`🛡️ SAFETY: Found ${newGroupsCount} but had ${existingCount} - suspicious`)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Sync found significantly fewer groups than expected',
          new_found: newGroupsCount,
          existing_preserved: existingCount,
          total_groups_scanned: totalGroupsScanned,
          cache_disabled: true,
          message: `Found only ${newGroupsCount} groups but you had ${existingCount} before. Keeping existing groups safe.`,
          recommendation: 'This might be a WHAPI issue. Try again later.'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Update database
    if (newGroupsCount > 0 || existingCount === 0) {
      console.log(`✅ SAFE TO UPDATE: Found ${newGroupsCount} groups, replacing ${existingCount}`)
      
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
      
      if (newGroupsCount > 0) {
        const dbBatchSize = 100
        for (let i = 0; i < allFoundGroups.length; i += dbBatchSize) {
          const batch = allFoundGroups.slice(i, i + dbBatchSize)
          
          const { error: insertError } = await supabase
            .from('whatsapp_groups')
            .insert(batch)

          if (insertError) {
            console.error('❌ Database insert error:', insertError)
            return new Response(
              JSON.stringify({ error: 'Failed to save groups to database', details: insertError.message }),
              { status: 500, headers: corsHeaders }
            )
          }
          
          if (i + dbBatchSize < allFoundGroups.length) {
            await delay(100)
          }
        }
      }

      const totalMemberCount = allFoundGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0)

      const message = newGroupsCount > 0
        ? `נמצאו ${newGroupsCount} קבוצות בניהולך! (${totalCreatorGroups} כיוצר, ${totalAdminGroups} כמנהל)`
        : 'לא נמצאו קבוצות בניהולך'

      return new Response(
        JSON.stringify({
          success: true,
          groups_count: newGroupsCount,
          admin_groups_count: totalAdminGroups,
          creator_groups_count: totalCreatorGroups,
          total_members_in_managed_groups: totalMemberCount,
          total_api_calls: totalApiCalls,
          total_groups_scanned: totalGroupsScanned,
          sync_time_seconds: totalSyncTime,
          cache_disabled: true,
          message: message,
          managed_groups: allFoundGroups.map(g => ({
            name: g.name,
            members: g.participants_count,
            id: g.group_id,
            role: g.is_creator ? 'creator' : 'admin'
          })).slice(0, 20)
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Preserve existing groups
    console.log(`🛡️ SAFETY: Preserving ${existingCount} existing groups`)
    
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: existingCount,
        message: `לא נמצאו קבוצות חדשות. שומר על ${existingCount} הקבוצות הקיימות שלך`,
        existing_groups_preserved: true,
        cache_disabled: true,
        total_groups_scanned: totalGroupsScanned,
        recommendation: 'יתכן שאין לך הרשאות מנהל בקבוצות או שיש בעיה זמנית'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 No Cache Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        cache_disabled: true,
        safety_note: 'Your existing groups should be preserved'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})