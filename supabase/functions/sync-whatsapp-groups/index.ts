import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Helper function to add delays between requests
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced phone matching with more logging
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
    console.log('🚀 ENHANCED SYNC: Getting ALL admin groups in one operation...')
    
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

    console.log('👤 Starting comprehensive sync for user:', userId)

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

    // 🎯 Get phone number with fallback
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
            
            // Save to database
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

    // 🚀 ENHANCED: Get ALL groups with pagination and retry logic
    let allGroups: any[] = []
    let currentOffset = 0
    const batchSize = 50 // Smaller batches to avoid timeouts
    let hasMoreGroups = true
    let totalApiCalls = 0
    const maxApiCalls = 10 // Safety limit

    console.log('📊 Starting paginated group fetching...')

    while (hasMoreGroups && totalApiCalls < maxApiCalls) {
      totalApiCalls++
      console.log(`📊 API call ${totalApiCalls}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
      
      try {
        // Add delay between requests to respect rate limits
        if (totalApiCalls > 1) {
          console.log('⏳ Adding 3-second delay for rate limiting...')
          await delay(3000)
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
          console.error(`❌ Groups API failed (attempt ${totalApiCalls}):`, groupsResponse.status)
          
          // Retry logic for failed requests
          if (groupsResponse.status === 429 || groupsResponse.status >= 500) {
            console.log('🔄 Rate limited or server error, waiting 5 seconds and retrying...')
            await delay(5000)
            continue // Retry same offset
          } else {
            throw new Error(`Groups API failed: ${groupsResponse.status}`)
          }
        }

        const groupsData = await groupsResponse.json()
        const batchGroups = groupsData.groups || []
        
        console.log(`📊 Batch ${totalApiCalls}: Received ${batchGroups.length} groups`)
        
        if (batchGroups.length === 0) {
          hasMoreGroups = false
          console.log('📊 No more groups to fetch')
        } else {
          allGroups = allGroups.concat(batchGroups)
          currentOffset += batchSize
          
          // Check if we got fewer than requested (indicates last page)
          if (batchGroups.length < batchSize) {
            hasMoreGroups = false
            console.log('📊 Last batch detected (fewer groups than requested)')
          }
        }

      } catch (batchError) {
        console.error(`❌ Error in batch ${totalApiCalls}:`, batchError)
        
        // If it's a rate limit or timeout, wait and retry
        if (batchError.message.includes('timeout') || batchError.message.includes('429')) {
          console.log('🔄 Retrying after error...')
          await delay(5000)
          continue
        } else {
          // For other errors, stop the loop
          console.error('💥 Fatal error, stopping group fetch')
          break
        }
      }
    }

    console.log(`📊 TOTAL GROUPS COLLECTED: ${allGroups.length} from ${totalApiCalls} API calls`)

    // 🎯 Process ALL groups to find admin/creator roles
    const managedGroups = []
    let adminCount = 0
    let creatorCount = 0
    let totalMemberCount = 0
    let processedCount = 0
    let skippedLargeGroups = 0

    console.log('🔍 Starting admin role detection across all groups...')

    for (const group of allGroups) {
      processedCount++
      const groupName = group.name || group.subject || `Group ${group.id}`
      const participantsCount = group.participants?.length || group.size || 0
      
      // Progress logging
      if (processedCount % 10 === 0) {
        console.log(`🔄 Progress: ${processedCount}/${allGroups.length} groups processed`)
      }
      
      console.log(`\n👥 [${processedCount}/${allGroups.length}] ${groupName} (${participantsCount} members)`)
      
      let isAdmin = false
      let isCreator = false
      let userRole = 'member'
      let foundUser = false
      
      // 🚀 ENHANCED: Handle large groups differently
      if (participantsCount > 500) {
        console.log('⚠️ Large group detected, using optimized processing...')
        
        // For very large groups, we might need to handle differently
        // Some groups might not load all participants due to WHAPI limitations
        if (!group.participants || group.participants.length === 0) {
          console.log('⚠️ Large group has no participant data, skipping...')
          skippedLargeGroups++
          continue
        }
      }
      
      // Check if user is admin/creator in this group
      if (group.participants && Array.isArray(group.participants)) {
        for (const participant of group.participants) {
          const participantId = participant.id || participant.phone || participant.number;
          const participantRank = participant.rank || participant.role || participant.admin || 'member';
          
          // 🎯 ENHANCED: More admin role variations
          const normalizedRank = participantRank.toLowerCase();
          const isAdminRole = normalizedRank === 'admin' || 
                            normalizedRank === 'administrator' || 
                            normalizedRank === 'creator' ||
                            normalizedRank === 'owner' ||
                            participant.admin === true;
          
          const isCreatorRole = normalizedRank === 'creator' || 
                               normalizedRank === 'owner';
          
          if (isPhoneMatch(userPhoneNumber, participantId)) {
            foundUser = true;
            userRole = participantRank;
            
            if (isCreatorRole) {
              isCreator = true;
              isAdmin = true;
              creatorCount++;
              console.log(`👑 CREATOR: ${groupName}`);
            } else if (isAdminRole) {
              isAdmin = true;
              adminCount++;
              console.log(`⭐ ADMIN: ${groupName}`);
            } else {
              console.log(`👤 MEMBER: ${groupName} (role: ${participantRank})`);
            }
            break;
          }
        }
      } else {
        console.log('⚠️ No participants data for group:', groupName)
        continue;
      }

      // Add to managed groups if user is admin/creator
      if (isAdmin) {
        totalMemberCount += participantsCount

        managedGroups.push({
          user_id: userId,
          group_id: group.id,
          name: groupName,
          description: group.description || null,
          participants_count: participantsCount,
          is_admin: true,
          avatar_url: group.chat_pic || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        console.log(`✅ ADDED: ${groupName} (${participantsCount} members)`)
      } else if (foundUser) {
        console.log(`⏭️ SKIPPED: ${groupName} (member only)`)
      } else {
        console.log(`❌ SKIPPED: ${groupName} (user not found)`)
      }

      // Add small delay for very large groups to prevent timeouts
      if (participantsCount > 800) {
        await delay(500) // 0.5 second delay for huge groups
      }
    }

    console.log(`\n🎯 COMPREHENSIVE SYNC COMPLETE!`)
    console.log(`📱 User phone: ${userPhoneNumber}`)
    console.log(`📊 Total groups scanned: ${allGroups.length}`)
    console.log(`👑 Creator groups found: ${creatorCount}`)
    console.log(`⭐ Admin groups found: ${adminCount}`)
    console.log(`✅ Total managed groups: ${managedGroups.length}`)
    console.log(`👥 Total members across managed groups: ${totalMemberCount}`)
    console.log(`⚠️ Large groups skipped (no data): ${skippedLargeGroups}`)
    console.log(`🔄 API calls made: ${totalApiCalls}`)

    // Save ALL managed groups to database
    console.log('💾 Clearing old groups and saving new ones...')
    
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (managedGroups.length > 0) {
      // Insert in batches to avoid database limits
      const dbBatchSize = 100
      for (let i = 0; i < managedGroups.length; i += dbBatchSize) {
        const batch = managedGroups.slice(i, i + dbBatchSize)
        console.log(`💾 Saving batch ${Math.floor(i/dbBatchSize) + 1}: ${batch.length} groups`)
        
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
        
        // Small delay between database batches
        if (i + dbBatchSize < managedGroups.length) {
          await delay(100)
        }
      }
    }

    const totalManagedGroups = adminCount + creatorCount
    const message = managedGroups.length > 0
      ? `נמצאו ${totalManagedGroups} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות בניהולך'

    const summary = {
      success: true,
      user_phone: userPhoneNumber,
      groups_count: managedGroups.length,
      total_groups_scanned: allGroups.length,
      admin_groups_count: adminCount,
      creator_groups_count: creatorCount,
      total_members_in_managed_groups: totalMemberCount,
      large_groups_skipped: skippedLargeGroups,
      api_calls_made: totalApiCalls,
      processing_time: 'Complete',
      message: message,
      managed_groups: managedGroups.map(g => ({
        name: g.name,
        members: g.participants_count,
        id: g.group_id
      })).slice(0, 20) // Show first 20 groups
    }

    console.log('🎉 Sync completed successfully!')
    console.log('📊 Final summary:', JSON.stringify(summary, null, 2))

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Comprehensive Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        suggestion: 'Try again in a few minutes - WHAPI might be experiencing high load'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})