import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
  background?: boolean // NEW: Flag for background sync
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

    // 🚀 DIFFERENT STRATEGIES FOR BACKGROUND VS MANUAL SYNC
    if (background) {
      console.log('🔄 BACKGROUND SYNC: Comprehensive 4-pass strategy for completeness...')
    } else {
      console.log('⚡ MANUAL SYNC: Checking if background sync already completed...')
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('👤 Starting sync for user:', userId, background ? '(background)' : '(manual)')

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

    // 🎯 MANUAL SYNC: Check if we already have recent data
    if (!background) {
      const { data: existingGroups, error: groupsError } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('user_id', userId)
        .order('last_synced_at', { ascending: false })
        .limit(1)

      if (!groupsError && existingGroups && existingGroups.length > 0) {
        const lastSync = new Date(existingGroups[0].last_synced_at)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        
        if (lastSync > fiveMinutesAgo) {
          console.log('⚡ Recent sync data found, returning cached results...')
          
          const { data: allGroups } = await supabase
            .from('whatsapp_groups')
            .select('*')
            .eq('user_id', userId)

          const adminCount = allGroups?.filter(g => !g.is_creator).length || 0
          const creatorCount = allGroups?.filter(g => g.is_creator).length || 0
          const totalMemberCount = allGroups?.reduce((sum, g) => sum + (g.participants_count || 0), 0) || 0

          return new Response(
            JSON.stringify({
              success: true,
              cached: true,
              user_phone: profile.phone_number,
              groups_count: allGroups?.length || 0,
              total_groups_scanned: 'Cached results from recent background sync',
              admin_groups_count: adminCount,
              creator_groups_count: creatorCount,
              total_members_in_managed_groups: totalMemberCount,
              sync_passes: 0,
              total_api_calls: 0,
              sync_time_seconds: 0,
              message: allGroups?.length ? `נמצאו ${allGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)` : 'לא נמצאו קבוצות בניהולך',
              managed_groups: allGroups?.map(g => ({
                name: g.name,
                members: g.participants_count,
                id: g.group_id,
                role: g.is_creator ? 'creator' : 'admin'
              })).slice(0, 20) || []
            }),
            { status: 200, headers: corsHeaders }
          )
        }
      }
      
      console.log('📊 No recent sync data found, performing fresh sync...')
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

    // 🚀 ADAPTIVE SYNC STRATEGY BASED ON CONTEXT
    let passConfig;
    
    if (background) {
      // BACKGROUND: Comprehensive 4-pass strategy for maximum completeness
      passConfig = [
        { pass: 1, delay: 0,     batchSize: 50,  description: "Background immediate scan" },
        { pass: 2, delay: 25000, batchSize: 80,  description: "Background 25s scan" },
        { pass: 3, delay: 30000, batchSize: 120, description: "Background 55s comprehensive" },
        { pass: 4, delay: 35000, batchSize: 150, description: "Background 90s final sweep" }
      ];
    } else {
      // MANUAL: Fast 3-pass strategy for speed
      passConfig = [
        { pass: 1, delay: 0,     batchSize: 60,  description: "Manual immediate scan" },
        { pass: 2, delay: 15000, batchSize: 100, description: "Manual 15s quick scan" },
        { pass: 3, delay: 20000, batchSize: 150, description: "Manual 35s final scan" }
      ];
    }

    let allFoundGroups = new Map();
    let totalApiCalls = 0;
    let consecutiveEmptyPasses = 0;
    const syncStartTime = Date.now();

    for (const config of passConfig) {
      // Add delay before pass (except first pass)
      if (config.delay > 0) {
        console.log(`⏳ Waiting ${config.delay/1000}s before pass ${config.pass} (${config.description})...`)
        await delay(config.delay);
      }

      console.log(`\n🔄 === PASS ${config.pass}/${passConfig.length} === (${config.description})`)
      
      const passStartTime = Date.now();
      let passFoundGroups = 0;

      // Get all groups with pagination for this pass
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let passApiCalls = 0
      const maxPassApiCalls = background ? 10 : 8 // More calls for background

      while (hasMoreGroups && passApiCalls < maxPassApiCalls) {
        passApiCalls++
        totalApiCalls++
        
        console.log(`📊 Pass ${config.pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + config.batchSize}`)
        
        try {
          // API delays - more patient for background sync
          const apiDelay = background ? 
            Math.min(2000 + (config.pass * 400), 4000) : // Background: 2s-3.6s
            Math.min(1500 + (config.pass * 300), 3000);  // Manual: 1.5s-2.4s
            
          if (passApiCalls > 1) {
            console.log(`⏳ API delay: ${apiDelay}ms...`)
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
            
            if (groupsResponse.status === 429 || groupsResponse.status >= 500) {
              const retryDelay = apiDelay * 1.5;
              console.log(`🔄 Rate limited, waiting ${retryDelay}ms and retrying...`)
              await delay(retryDelay)
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
            hasMoreGroups = false
            console.log(`📊 No more groups in pass ${config.pass}`)
          } else {
            allGroups = allGroups.concat(batchGroups)
            currentOffset += config.batchSize
            
            if (batchGroups.length < config.batchSize) {
              hasMoreGroups = false
              console.log(`📊 Last batch in pass ${config.pass} (fewer groups than requested)`)
            }
          }

        } catch (batchError) {
          console.error(`❌ Error in pass ${config.pass}, batch ${passApiCalls}:`, batchError)
          
          if (batchError.message.includes('timeout') || batchError.message.includes('429')) {
            console.log(`🔄 Retrying after error in pass ${config.pass}...`)
            await delay(apiDelay * 1.5)
            continue
          } else {
            console.error(`💥 Fatal error in pass ${config.pass}, stopping`)
            break
          }
        }
      }

      console.log(`📊 Pass ${config.pass} collected: ${allGroups.length} groups from ${passApiCalls} API calls`)

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
        
        // Enhanced group processing
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
              if (isCreatorRole) {
                isCreator = true;
                isAdmin = true;
                console.log(`👑 Pass ${config.pass}: Found CREATOR role in ${groupName}`);
              } else if (isAdminRole) {
                isAdmin = true;
                console.log(`⭐ Pass ${config.pass}: Found ADMIN role in ${groupName}`);
              } else {
                console.log(`👤 Pass ${config.pass}: Found MEMBER role in ${groupName} (skipping)`);
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
          console.log(`✅ Pass ${config.pass}: ADDED ${groupName} (${participantsCount} members) - ${isCreator ? 'CREATOR' : 'ADMIN'}`)
        }
      }

      const passTime = Math.round((Date.now() - passStartTime) / 1000);
      const totalElapsedTime = Math.round((Date.now() - syncStartTime) / 1000);
      console.log(`🎯 Pass ${config.pass} completed in ${passTime}s: Found ${passFoundGroups} new admin groups`)
      console.log(`📊 Total found so far: ${allFoundGroups.size} admin groups (${totalElapsedTime}s elapsed)`)

      // Smart stopping logic - different for background vs manual
      if (passFoundGroups === 0) {
        consecutiveEmptyPasses++;
        console.log(`📊 No new groups in pass ${config.pass} (${consecutiveEmptyPasses} consecutive empty passes)`);
      } else {
        consecutiveEmptyPasses = 0;
      }

      // Stopping conditions based on sync type
      let shouldStopEarly = false;
      
      if (background) {
        // BACKGROUND: More patient, only stop if really necessary
        shouldStopEarly = (
          (consecutiveEmptyPasses >= 2 && config.pass >= 3) ||
          (totalElapsedTime >= 120) // 2 minute safety for background
        );
      } else {
        // MANUAL: More aggressive stopping for speed
        shouldStopEarly = (
          (consecutiveEmptyPasses >= 2) ||
          (allFoundGroups.size >= 5 && consecutiveEmptyPasses >= 1 && config.pass >= 2) ||
          (totalElapsedTime >= 45) // 45 second limit for manual
        );
      }

      if (shouldStopEarly) {
        let stopReason = '';
        if (consecutiveEmptyPasses >= 2) {
          stopReason = `2 consecutive empty passes`;
        } else if (!background && allFoundGroups.size >= 5 && consecutiveEmptyPasses >= 1) {
          stopReason = `good results (${allFoundGroups.size} groups) with 1 empty pass`;
        } else if (totalElapsedTime >= (background ? 120 : 45)) {
          stopReason = `${background ? '2 minute' : '45 second'} safety limit`;
        }
        
        console.log(`🏁 ${background ? 'Background' : 'Manual'} stopping after pass ${config.pass}: ${stopReason}`);
        break;
      }

      // Don't add delay after last pass
      if (config.pass < passConfig.length) {
        console.log(`📊 Pass ${config.pass} summary: ${passFoundGroups} new groups, ${allFoundGroups.size} total`);
      }
    }

    const managedGroups = Array.from(allFoundGroups.values());
    const adminCount = managedGroups.filter(g => !g.is_creator).length;
    const creatorCount = managedGroups.filter(g => g.is_creator).length;
    const totalMemberCount = managedGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);

    console.log(`\n🎯 ${background ? 'BACKGROUND' : 'MANUAL'} SYNC COMPLETE!`)
    console.log(`📱 User phone: ${userPhoneNumber}`)
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`)
    console.log(`🔄 Passes completed: ${passConfig.length}`)
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
          await delay(50)
        }
      }
    }

    const message = managedGroups.length > 0
      ? `נמצאו ${managedGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות בניהולך'

    return new Response(
      JSON.stringify({
        success: true,
        background: background || false,
        user_phone: userPhoneNumber,
        groups_count: managedGroups.length,
        total_groups_scanned: `${background ? 'Background' : 'Manual'} sync completed in ${totalSyncTime}s`,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        sync_passes: passConfig.length,
        total_api_calls: totalApiCalls,
        sync_time_seconds: totalSyncTime,
        message: message,
        managed_groups: managedGroups.map(g => ({
          name: g.name,
          members: g.participants_count,
          id: g.group_id,
          role: g.is_creator ? 'creator' : 'admin'
        })).slice(0, 20)
      }),
      { status: 200, headers: corsHeaders }
    )

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