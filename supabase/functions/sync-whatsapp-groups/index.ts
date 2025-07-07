import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
  isAutoRetry?: boolean
  retryAttempt?: number
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
    console.log('🚀 ENHANCED SMART SYNC: Adaptive timing based on connection age...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, isAutoRetry = false, retryAttempt = 0 }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const syncType = isAutoRetry ? `AUTO-RETRY ${retryAttempt + 1}` : 'MANUAL';
    console.log(`👤 Starting ${syncType} sync for user:`, userId)

    // Get user's WHAPI token AND phone number AND connection timing
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, phone_number, updated_at')
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

    // 🆕 SMART TIMING: Calculate how long since connection
    const now = new Date();
    const lastUpdated = new Date(profile.updated_at);
    const connectionAgeMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));
    
    console.log(`⏰ Connection age: ${connectionAgeMinutes} minutes`);

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

    // 🚀 ADAPTIVE STRATEGY based on connection age and retry attempt
    let strategy;
    
    if (connectionAgeMinutes < 2) {
      // Very fresh connection - be patient
      strategy = {
        passes: 2,
        delays: [10000, 20000], // 10s, then 20s
        batchSizes: [30, 50],
        maxApiCalls: 6,
        description: "Fresh connection - patient approach"
      };
    } else if (connectionAgeMinutes < 5) {
      // Recent connection - balanced approach
      strategy = {
        passes: 3,
        delays: [5000, 10000, 15000], // 5s, 10s, 15s
        batchSizes: [50, 75, 100],
        maxApiCalls: 10,
        description: "Recent connection - balanced approach"
      };
    } else if (isAutoRetry) {
      // Auto-retry - focused approach
      strategy = {
        passes: 2,
        delays: [2000, 8000], // 2s, 8s
        batchSizes: [75, 125],
        maxApiCalls: 8,
        description: `Auto-retry ${retryAttempt + 1} - focused approach`
      };
    } else {
      // Established connection - aggressive approach
      strategy = {
        passes: 3,
        delays: [1000, 3000, 5000], // 1s, 3s, 5s
        batchSizes: [100, 150, 200],
        maxApiCalls: 12,
        description: "Established connection - aggressive approach"
      };
    }

    console.log(`🎯 Using strategy: ${strategy.description}`);

    let allFoundGroups = new Map(); // Use Map to avoid duplicates
    let totalApiCalls = 0;
    let consecutiveEmptyPasses = 0;
    const syncStartTime = Date.now();

    for (let passIndex = 0; passIndex < strategy.passes; passIndex++) {
      const pass = passIndex + 1;
      
      // Add delay before pass (except first pass)
      if (passIndex > 0) {
        const delayMs = strategy.delays[passIndex];
        console.log(`⏳ Waiting ${delayMs/1000}s before pass ${pass}...`);
        await delay(delayMs);
      }

      console.log(`\n🔄 === PASS ${pass}/${strategy.passes} === (${strategy.description})`);
      
      const passStartTime = Date.now();
      let passFoundGroups = 0;
      const batchSize = strategy.batchSizes[passIndex];

      // Get all groups with pagination for this pass
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let passApiCalls = 0
      const maxPassApiCalls = Math.floor(strategy.maxApiCalls / strategy.passes) + 2; // Distribute API calls

      while (hasMoreGroups && passApiCalls < maxPassApiCalls) {
        passApiCalls++
        totalApiCalls++
        
        console.log(`📊 Pass ${pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
        
        try {
          // 🚀 ADAPTIVE API DELAYS based on connection age
          let apiDelay;
          if (connectionAgeMinutes < 2) {
            apiDelay = 3000 + (passApiCalls * 500); // Start slow for fresh connections
          } else if (isAutoRetry) {
            apiDelay = 1500 + (passApiCalls * 300); // Faster for retries
          } else {
            apiDelay = 1000 + (passApiCalls * 200); // Fastest for established connections
          }
          
          if (passApiCalls > 1) {
            console.log(`⏳ API delay: ${apiDelay}ms...`)
            await delay(apiDelay)
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
              const retryDelay = apiDelay * 2; // Double delay for rate limits
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
            await delay(apiDelay * 1.5)
            continue
          } else {
            console.error(`💥 Fatal error in pass ${pass}, stopping`)
            break
          }
        }
      }

      console.log(`📊 Pass ${pass} collected: ${allGroups.length} groups from ${passApiCalls} API calls`)

      // Process groups from this pass
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
              userRole = participantRank;
              
              if (isCreatorRole) {
                isCreator = true;
                isAdmin = true;
                console.log(`👑 Pass ${pass}: Found CREATOR role in ${groupName}`);
              } else if (isAdminRole) {
                isAdmin = true;
                console.log(`⭐ Pass ${pass}: Found ADMIN role in ${groupName}`);
              } else {
                console.log(`👤 Pass ${pass}: Found MEMBER role in ${groupName} (skipping)`);
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
            is_creator: isCreator,
            avatar_url: group.chat_pic || null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
          passFoundGroups++;
          console.log(`✅ Pass ${pass}: ADDED ${groupName} (${participantsCount} members) - ${isCreator ? 'CREATOR' : 'ADMIN'}`)
        }
      }

      const passTime = Math.round((Date.now() - passStartTime) / 1000);
      const totalElapsedTime = Math.round((Date.now() - syncStartTime) / 1000);
      console.log(`🎯 Pass ${pass} completed in ${passTime}s: Found ${passFoundGroups} new admin groups`)
      console.log(`📊 Total found so far: ${allFoundGroups.size} admin groups (${totalElapsedTime}s elapsed)`)

      // 🚀 ENHANCED STOPPING LOGIC based on strategy
      if (passFoundGroups === 0) {
        consecutiveEmptyPasses++;
        console.log(`📊 No new groups in pass ${pass} (${consecutiveEmptyPasses} consecutive empty passes)`);
      } else {
        consecutiveEmptyPasses = 0; // Reset counter when we find groups
      }

      // Adaptive stopping conditions
      const shouldStopEarly = (
        // Stop after 2 empty passes (always)
        (consecutiveEmptyPasses >= 2) ||
        
        // For fresh connections, be more patient
        (connectionAgeMinutes < 2 && allFoundGroups.size >= 3 && consecutiveEmptyPasses >= 1 && pass >= 2) ||
        
        // For established connections, stop faster with good results
        (connectionAgeMinutes >= 5 && allFoundGroups.size >= 5 && consecutiveEmptyPasses >= 1) ||
        
        // For auto-retry, stop if we got some results
        (isAutoRetry && allFoundGroups.size >= 2 && consecutiveEmptyPasses >= 1) ||
        
        // Safety timeout
        (totalElapsedTime >= 60)
      );

      if (shouldStopEarly) {
        let stopReason = '';
        if (consecutiveEmptyPasses >= 2) {
          stopReason = `2 consecutive empty passes`;
        } else if (connectionAgeMinutes < 2) {
          stopReason = `fresh connection with ${allFoundGroups.size} groups found`;
        } else if (isAutoRetry) {
          stopReason = `auto-retry with ${allFoundGroups.size} groups found`;
        } else if (totalElapsedTime >= 60) {
          stopReason = `60 second safety limit`;
        } else {
          stopReason = `good results (${allFoundGroups.size} groups)`;
        }
        
        console.log(`🏁 Stopping after pass ${pass}: ${stopReason}`);
        break;
      }
    }

    const managedGroups = Array.from(allFoundGroups.values());
    const adminCount = managedGroups.filter(g => !g.is_creator).length;
    const creatorCount = managedGroups.filter(g => g.is_creator).length;
    const totalMemberCount = managedGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);

    console.log(`\n🎯 ENHANCED SYNC COMPLETE!`)
    console.log(`📱 User phone: ${userPhoneNumber}`)
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`)
    console.log(`🔄 Strategy used: ${strategy.description}`)
    console.log(`📊 Total API calls: ${totalApiCalls}`)
    console.log(`✅ Final admin groups found: ${managedGroups.length}`)
    console.log(`👑 Creator groups: ${creatorCount}`)
    console.log(`⭐ Admin groups: ${adminCount}`)
    console.log(`👥 Total members: ${totalMemberCount}`)
    console.log(`⏰ Connection age: ${connectionAgeMinutes} minutes`)

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
          await delay(50) // Small delay between batches
        }
      }
    }

    const message = managedGroups.length > 0
      ? `נמצאו ${managedGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : isAutoRetry 
        ? `ניסיון אוטומטי ${retryAttempt + 1} - לא נמצאו קבוצות נוספות`
        : 'לא נמצאו קבוצות בניהולך'

    return new Response(
      JSON.stringify({
        success: true,
        user_phone: userPhoneNumber,
        groups_count: managedGroups.length,
        total_groups_scanned: `${strategy.description} completed in ${totalSyncTime}s`,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        sync_strategy: strategy.description,
        connection_age_minutes: connectionAgeMinutes,
        is_auto_retry: isAutoRetry,
        retry_attempt: retryAttempt,
        total_api_calls: totalApiCalls,
        sync_time_seconds: totalSyncTime,
        message: message,
        managed_groups: managedGroups.map(g => ({
          name: g.name,
          members: g.participants_count,
          id: g.group_id,
          role: g.is_creator ? 'creator' : 'admin'
        })).slice(0, 20),
        // 🆕 Indicate if this looks like an incomplete result
        looks_incomplete: managedGroups.length < 3 && totalSyncTime < 30 && !isAutoRetry
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Enhanced Smart Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        suggestion: 'Enhanced sync failed - check network connectivity'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})