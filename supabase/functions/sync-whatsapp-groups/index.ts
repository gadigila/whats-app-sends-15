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
    console.log('🚀 ROBUST MULTI-PASS SYNC: Ensuring ALL admin groups are found...')
    
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

    console.log('👤 Starting ROBUST sync for user:', userId)

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
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📱 User phone for matching: ${userPhoneNumber}`)

    // 🚀 MULTI-PASS SYNC STRATEGY
    const maxPasses = 3; // Try up to 3 complete syncs
    let allFoundGroups = new Map(); // Use Map to avoid duplicates
    let totalApiCalls = 0;

    for (let pass = 1; pass <= maxPasses; pass++) {
      console.log(`\n🔄 === SYNC PASS ${pass}/${maxPasses} ===`)
      
      // 🎯 INCREASED DELAYS for better reliability
      const baseDelay = pass === 1 ? 3000 : (pass * 2000); // 3s, 4s, 6s
      const batchSize = pass === 1 ? 50 : 30; // Smaller batches on retry
      
      console.log(`⚙️ Pass ${pass} settings: ${baseDelay}ms delay, ${batchSize} batch size`)

      // Get all groups with pagination
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let passApiCalls = 0
      const maxPassApiCalls = 15 // Limit per pass

      while (hasMoreGroups && passApiCalls < maxPassApiCalls) {
        passApiCalls++
        totalApiCalls++
        
        console.log(`📊 Pass ${pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
        
        try {
          // Enhanced delay between requests
          if (passApiCalls > 1) {
            console.log(`⏳ Adding ${baseDelay}ms delay for rate limiting...`)
            await delay(baseDelay)
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
            console.error(`❌ Groups API failed (pass ${pass}, call ${passApiCalls}):`, groupsResponse.status)
            
            if (groupsResponse.status === 429 || groupsResponse.status >= 500) {
              const retryDelay = baseDelay * 2;
              console.log(`🔄 Rate limited, waiting ${retryDelay}ms and retrying...`)
              await delay(retryDelay)
              continue // Retry same offset
            } else {
              console.log(`💥 Non-retryable error, stopping pass ${pass}`)
              break
            }
          }

          const groupsData = await groupsResponse.json()
          const batchGroups = groupsData.groups || []
          
          console.log(`📊 Pass ${pass}, batch ${passApiCalls}: Received ${batchGroups.length} groups`)
          
          if (batchGroups.length === 0) {
            hasMoreGroups = false
            console.log(`📊 No more groups in pass ${pass}`)
          } else {
            allGroups = allGroups.concat(batchGroups)
            currentOffset += batchSize
            
            if (batchGroups.length < batchSize) {
              hasMoreGroups = false
              console.log(`📊 Last batch in pass ${pass} (fewer groups than requested)`)
            }
          }

        } catch (batchError) {
          console.error(`❌ Error in pass ${pass}, batch ${passApiCalls}:`, batchError)
          
          if (batchError.message.includes('timeout') || batchError.message.includes('429')) {
            console.log(`🔄 Retrying after error in pass ${pass}...`)
            await delay(baseDelay * 2)
            continue
          } else {
            console.error(`💥 Fatal error in pass ${pass}, stopping`)
            break
          }
        }
      }

      console.log(`📊 Pass ${pass} collected: ${allGroups.length} groups from ${passApiCalls} API calls`)

      // Process groups from this pass
      let passFoundGroups = 0;
      
      for (const group of allGroups) {
        const groupName = group.name || group.subject || `Group ${group.id}`
        const participantsCount = group.participants?.length || group.size || 0
        
        // Skip if already found in previous pass
        if (allFoundGroups.has(group.id)) {
          continue;
        }
        
        let isAdmin = false
        let isCreator = false
        let userRole = 'member'
        let foundUser = false
        
        // 🎯 ENHANCED group processing with better error handling
        if (group.participants && Array.isArray(group.participants)) {
          for (const participant of group.participants) {
            const participantId = participant.id || participant.phone || participant.number;
            const participantRank = participant.rank || participant.role || participant.admin || 'member';
            
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
                console.log(`👑 Pass ${pass}: Found CREATOR role in ${groupName}`);
              } else if (isAdminRole) {
                isAdmin = true;
                console.log(`⭐ Pass ${pass}: Found ADMIN role in ${groupName}`);
              } else {
                console.log(`👤 Pass ${pass}: Found MEMBER role in ${groupName}`);
              }
              break;
            }
          }
        }

        // Add to found groups if admin/creator
        if (isAdmin) {
          allFoundGroups.set(group.id, {
            user_id: userId,
            group_id: group.id,
            name: groupName,
            description: group.description || null,
            participants_count: participantsCount,
            is_admin: true,
            avatar_url: group.chat_pic || null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
          passFoundGroups++;
          console.log(`✅ Pass ${pass}: ADDED ${groupName} (${participantsCount} members)`)
        }

        // Add delay for large groups
        if (participantsCount > 500) {
          await delay(1000) // 1 second for large groups
        }
      }

      console.log(`🎯 Pass ${pass} results: Found ${passFoundGroups} new admin groups`)
      console.log(`📊 Total found so far: ${allFoundGroups.size} admin groups`)

      // If we found groups in this pass, continue to next pass
      // If no new groups found, we can stop
      if (passFoundGroups === 0 && pass > 1) {
        console.log(`🏁 No new groups found in pass ${pass}, stopping`)
        break;
      }

      // Add delay between passes
      if (pass < maxPasses) {
        const betweenPassDelay = 5000; // 5 seconds between passes
        console.log(`⏳ Waiting ${betweenPassDelay}ms before pass ${pass + 1}...`)
        await delay(betweenPassDelay);
      }
    }

    const managedGroups = Array.from(allFoundGroups.values());
    const adminCount = managedGroups.filter(g => !g.is_creator).length;
    const creatorCount = managedGroups.filter(g => g.is_creator).length;
    const totalMemberCount = managedGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);

    console.log(`\n🎯 MULTI-PASS SYNC COMPLETE!`)
    console.log(`📱 User phone: ${userPhoneNumber}`)
    console.log(`🔄 Total passes: ${maxPasses}`)
    console.log(`📊 Total API calls: ${totalApiCalls}`)
    console.log(`✅ Final admin groups found: ${managedGroups.length}`)
    console.log(`👑 Creator groups: ${creatorCount}`)
    console.log(`⭐ Admin groups: ${adminCount}`)
    console.log(`👥 Total members: ${totalMemberCount}`)

    // Save ALL found groups to database
    console.log('💾 Saving all found groups...')
    
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (managedGroups.length > 0) {
      // Insert in batches
      const dbBatchSize = 100
      for (let i = 0; i < managedGroups.length; i += dbBatchSize) {
        const batch = managedGroups.slice(i, i + dbBatchSize)
        console.log(`💾 Saving batch: ${batch.length} groups`)
        
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
        
        if (i + dbBatchSize < managedGroups.length) {
          await delay(100)
        }
      }
    }

    const message = managedGroups.length > 0
      ? `נמצאו ${managedGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות בניהולך'

    return new Response(
      JSON.stringify({
        success: true,
        user_phone: userPhoneNumber,
        groups_count: managedGroups.length,
        total_groups_scanned: `Multi-pass scan completed`,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        sync_passes: maxPasses,
        total_api_calls: totalApiCalls,
        message: message,
        managed_groups: managedGroups.map(g => ({
          name: g.name,
          members: g.participants_count,
          id: g.group_id
        })).slice(0, 20)
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Robust Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        suggestion: 'Multi-pass sync failed - try again in a few minutes'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})