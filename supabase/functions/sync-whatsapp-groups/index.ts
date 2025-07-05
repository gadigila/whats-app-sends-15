import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
  background?: boolean // Keep for backward compatibility
}

// Helper function to add delays between requests
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced phone matching
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
    const { userId, background }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 🎯 NEW APPROACH: Smart Manual Sync (Phase 2)
    if (!background) {
      console.log('👤 Starting SMART MANUAL SYNC for user:', userId)
      
      // Get user's WHAPI token AND phone number
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

      // 🎯 SMART MANUAL SYNC: New Groups + Admin Filtering
      const smartSyncResult = await smartManualSync(supabase, userId, profile)
      
      return new Response(
        JSON.stringify(smartSyncResult),
        { status: 200, headers: corsHeaders }
      )
    }

    // 🔄 FALLBACK: Keep old background sync logic for compatibility
    console.log('🔄 BACKGROUND SYNC: Using old comprehensive sync method...')

    // Get user's WHAPI token AND phone number
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

    // Keep old comprehensive sync for background calls
    return await oldComprehensiveSync(supabase, userId, profile)

  } catch (error) {
    console.error('💥 Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        suggestion: 'Sync failed - check network connectivity'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})

// 🚀 NEW SMART MANUAL SYNC FUNCTION (Phase 2)
async function smartManualSync(supabase: any, userId: string, profile: any) {
  console.log('🎯 SMART MANUAL SYNC: Checking for new groups + admin filtering')
  
  const startTime = Date.now()
  
  // Step 1: Get existing groups from database
  const { data: existingGroups } = await supabase
    .from('whatsapp_groups')
    .select('group_id, admin_status, last_synced_at, name')
    .eq('user_id', userId)

  const existingGroupIds = new Set(existingGroups?.map(g => g.group_id) || [])
  console.log(`📊 Found ${existingGroupIds.size} existing groups in database`)

  // Step 2: Quick scan for NEW groups (only first 200 groups)
  console.log('🔍 Scanning for new groups...')
  
  let newGroups: any[] = []
  const scanLimit = 200
  
  try {
    await delay(1000) // 1 second delay before API call
    
    const quickScanResponse = await fetch(
      `https://gate.whapi.cloud/groups?count=${scanLimit}&offset=0`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (quickScanResponse.ok) {
      const scanData = await quickScanResponse.json()
      const scannedGroups = scanData.groups || []
      
      // Find truly NEW groups
      newGroups = scannedGroups.filter(group => !existingGroupIds.has(group.id))
      
      console.log(`🆕 Found ${newGroups.length} new groups out of ${scannedGroups.length} scanned`)
    } else {
      console.log(`⚠️ New group scan failed: ${quickScanResponse.status}`)
    }
  } catch (error) {
    console.error('⚠️ New group scan failed, continuing with existing groups:', error)
  }

  // Step 3: Add new groups to database (without admin status)
  if (newGroups.length > 0) {
    console.log(`💾 Adding ${newGroups.length} new groups to database...`)
    
    const newGroupsToStore = newGroups.map(group => ({
      user_id: userId,
      group_id: group.id,
      name: group.name || group.subject || `Group ${group.id}`,
      description: group.description || null,
      participants_count: group.participants?.length || group.size || 0,
      is_admin: false,
      is_creator: false,
      admin_status: 'unknown', // Will be checked below
      avatar_url: group.chat_pic || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabase
      .from('whatsapp_groups')
      .insert(newGroupsToStore)

    if (insertError) {
      console.error('❌ Failed to insert new groups:', insertError)
    } else {
      console.log(`✅ Added ${newGroups.length} new groups`)
    }
  }

  // Step 4: Get groups that need admin checking
  const { data: groupsNeedingCheck } = await supabase
    .from('whatsapp_groups')
    .select('*')
    .eq('user_id', userId)
    .or('admin_status.eq.unknown,admin_status.is.null')

  const needsAdminCheck = groupsNeedingCheck || []
  console.log(`🔍 Need to check admin status for ${needsAdminCheck.length} groups`)

  // Step 5: Perform admin filtering on groups that need it
  if (needsAdminCheck.length > 0) {
    await performAdminFiltering(supabase, userId, profile, needsAdminCheck)
  }

  // Step 6: Get final admin groups for response
  const { data: finalAdminGroups } = await supabase
    .from('whatsapp_groups')
    .select('*')
    .eq('user_id', userId)
    .eq('is_admin', true)
    .order('name')

  const adminCount = finalAdminGroups?.filter(g => !g.is_creator).length || 0
  const creatorCount = finalAdminGroups?.filter(g => g.is_creator).length || 0
  const totalMemberCount = finalAdminGroups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0

  const syncTime = Math.round((Date.now() - startTime) / 1000)
  
  return {
    success: true,
    sync_type: 'smart_manual',
    user_phone: profile.phone_number,
    new_groups_found: newGroups.length,
    admin_checks_performed: needsAdminCheck.length,
    groups_count: finalAdminGroups?.length || 0,
    admin_groups_count: adminCount,
    creator_groups_count: creatorCount,
    total_members_in_managed_groups: totalMemberCount,
    sync_time_seconds: syncTime,
    message: finalAdminGroups?.length 
      ? `נמצאו ${finalAdminGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)${newGroups.length > 0 ? ` + ${newGroups.length} קבוצות חדשות` : ''}`
      : 'לא נמצאו קבוצות בניהולך',
    managed_groups: finalAdminGroups?.map(g => ({
      name: g.name,
      members: g.participants_count,
      id: g.group_id,
      role: g.is_creator ? 'creator' : 'admin'
    })) || []
  }
}

// 🔍 ADMIN FILTERING FUNCTION
async function performAdminFiltering(supabase: any, userId: string, profile: any, groupsToCheck: any[]) {
  console.log(`🔍 ADMIN FILTERING: Checking ${groupsToCheck.length} groups for admin status`)
  
  const userPhoneNumber = profile.phone_number
  if (!userPhoneNumber) {
    throw new Error('No phone number available for admin checking')
  }

  let processedGroups = 0
  
  for (const group of groupsToCheck) {
    try {
      console.log(`🔍 Checking admin status for: ${group.name}`)
      
      // Add delay between checks
      if (processedGroups > 0) {
        await delay(1500) // 1.5 second delay
      }

      // Get participants and check admin status
      const participantsResponse = await fetch(
        `https://gate.whapi.cloud/groups/${group.group_id}/participants`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!participantsResponse.ok) {
        console.log(`⚠️ Failed to get participants for ${group.name}: ${participantsResponse.status}`)
        
        // Mark as checked but failed
        await supabase
          .from('whatsapp_groups')
          .update({
            admin_status: 'checked',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('group_id', group.group_id)
          
        processedGroups++
        continue
      }

      const participantsData = await participantsResponse.json()
      const participants = participantsData.participants || []
      
      let isAdmin = false
      let isCreator = false
      
      // Check if user is admin/creator
      for (const participant of participants) {
        const participantId = participant.id || participant.phone || participant.number
        const participantRank = participant.rank || participant.role || participant.admin || 'member'
        
        if (isPhoneMatch(userPhoneNumber, participantId)) {
          const normalizedRank = participantRank.toLowerCase()
          
          if (normalizedRank === 'creator' || normalizedRank === 'owner') {
            isCreator = true
            isAdmin = true
            console.log(`👑 CREATOR: ${group.name}`)
          } else if (normalizedRank === 'admin' || normalizedRank === 'administrator' || participant.admin === true) {
            isAdmin = true
            console.log(`⭐ ADMIN: ${group.name}`)
          } else {
            console.log(`👤 MEMBER: ${group.name} (skipping)`)
          }
          break
        }
      }

      // Update group with admin status
      await supabase
        .from('whatsapp_groups')
        .update({
          is_admin: isAdmin,
          is_creator: isCreator,
          admin_status: 'checked',
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('group_id', group.group_id)

      processedGroups++

    } catch (error) {
      console.error(`❌ Error checking admin for ${group.name}:`, error)
      
      // Mark as checked but failed
      await supabase
        .from('whatsapp_groups')
        .update({
          admin_status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('group_id', group.group_id)
        
      processedGroups++
    }
  }

  console.log(`✅ Admin filtering completed: ${processedGroups} groups processed`)
  return { processed: processedGroups }
}

// 🔄 OLD COMPREHENSIVE SYNC (for background compatibility)
async function oldComprehensiveSync(supabase: any, userId: string, profile: any) {
  console.log('🔄 Using old comprehensive sync method for background compatibility')
  
  // Get phone number with fallback
  let userPhoneNumber = profile.phone_number

  if (!userPhoneNumber) {
    console.log('📱 No phone stored, fetching from /health...')
    
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
      { status: 400, headers: { ...corsHeaders } }
    )
  }

  // Simple comprehensive scan for background
  const startTime = Date.now()
  let allFoundGroups = new Map()
  let totalApiCalls = 0
  
  // Single pass comprehensive scan
  let currentOffset = 0
  let hasMoreGroups = true
  const batchSize = 150
  const maxApiCalls = 10
  
  while (hasMoreGroups && totalApiCalls < maxApiCalls) {
    totalApiCalls++
    
    console.log(`📊 API call ${totalApiCalls}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
    
    try {
      if (totalApiCalls > 1) {
        await delay(3000) // 3 second delay between calls
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
        break
      }

      const groupsData = await groupsResponse.json()
      const batchGroups = groupsData.groups || []
      
      console.log(`📊 Batch ${totalApiCalls}: Received ${batchGroups.length} groups`)
      
      if (batchGroups.length === 0) {
        hasMoreGroups = false
      } else {
        // Process groups for admin status
        for (const group of batchGroups) {
          const groupName = group.name || group.subject || `Group ${group.id}`
          const participantsCount = group.participants?.length || group.size || 0
          
          if (allFoundGroups.has(group.id)) continue
          
          let isAdmin = false
          let isCreator = false
          
          if (group.participants && Array.isArray(group.participants)) {
            for (const participant of group.participants) {
              const participantId = participant.id || participant.phone || participant.number
              const participantRank = participant.rank || participant.role || participant.admin || 'member'
              
              if (isPhoneMatch(userPhoneNumber, participantId)) {
                const normalizedRank = participantRank.toLowerCase()
                
                if (normalizedRank === 'creator' || normalizedRank === 'owner') {
                  isCreator = true
                  isAdmin = true
                } else if (normalizedRank === 'admin' || normalizedRank === 'administrator' || participant.admin === true) {
                  isAdmin = true
                }
                break
              }
            }
          }

          if (isAdmin) {
            allFoundGroups.set(group.id, {
              user_id: userId,
              group_id: group.id,
              name: groupName,
              description: group.description || null,
              participants_count: participantsCount,
              is_admin: true,
              is_creator: isCreator,
              admin_status: 'checked',
              avatar_url: group.chat_pic || null,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        }
        
        currentOffset += batchSize
        
        if (batchGroups.length < batchSize) {
          hasMoreGroups = false
        }
      }

    } catch (batchError) {
      console.error(`❌ Error in batch ${totalApiCalls}:`, batchError)
      break
    }
  }

  const managedGroups = Array.from(allFoundGroups.values())
  const adminCount = managedGroups.filter(g => !g.is_creator).length
  const creatorCount = managedGroups.filter(g => g.is_creator).length
  const totalMemberCount = managedGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0)
  const totalSyncTime = Math.round((Date.now() - startTime) / 1000)

  // Save to database
  await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
  
  if (managedGroups.length > 0) {
    const { error: insertError } = await supabase
      .from('whatsapp_groups')
      .insert(managedGroups)

    if (insertError) {
      throw insertError
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      background: true,
      user_phone: userPhoneNumber,
      groups_count: managedGroups.length,
      admin_groups_count: adminCount,
      creator_groups_count: creatorCount,
      total_members_in_managed_groups: totalMemberCount,
      sync_time_seconds: totalSyncTime,
      total_api_calls: totalApiCalls,
      message: managedGroups.length > 0
        ? `נמצאו ${managedGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
        : 'לא נמצאו קבוצות בניהולך',
      managed_groups: managedGroups.map(g => ({
        name: g.name,
        members: g.participants_count,
        id: g.group_id,
        role: g.is_creator ? 'creator' : 'admin'
      }))
    }),
    { status: 200, headers: { ...corsHeaders } }
  )
}