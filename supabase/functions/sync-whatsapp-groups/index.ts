import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// 🚀 IMPROVED: Conservative timing to avoid rate limits
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 🎯 ENHANCED: Better phone matching with multiple strategies
function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const clean1 = phone1.replace(/[^\d]/g, '');
  const clean2 = phone2.replace(/[^\d]/g, '');
  
  // Multiple matching strategies for better accuracy
  const strategies = [
    () => clean1 === clean2, // Exact match
    () => clean1.endsWith(clean2.slice(-9)) && clean2.length >= 9, // User ends with participant's last 9
    () => clean2.endsWith(clean1.slice(-9)) && clean1.length >= 9, // Participant ends with user's last 9
    () => clean1.slice(-8) === clean2.slice(-8) && clean1.length >= 8 && clean2.length >= 8, // Last 8 digits
    () => { // Israeli format: 972 vs 0 prefix
      if (clean1.startsWith('972') && clean2.startsWith('0')) {
        return clean1.substring(3) === clean2.substring(1);
      }
      if (clean2.startsWith('972') && clean1.startsWith('0')) {
        return clean2.substring(3) === clean1.substring(1);
      }
      return false;
    }
  ];
  
  return strategies.some(strategy => strategy());
}

// 🛡️ ENHANCED: Better admin role detection
function detectAdminRole(participant: any): { isAdmin: boolean, isCreator: boolean, role: string } {
  const rank = participant.rank || participant.role || participant.admin || 'member';
  const rankText = rank.toString().toLowerCase();
  
  // Multiple ways to detect admin status
  const isAdminByRank = ['admin', 'administrator', 'creator', 'owner', 'superadmin'].some(
    keyword => rankText.includes(keyword)
  );
  const isAdminByBoolean = participant.admin === true || participant.isAdmin === true;
  const isCreatorByRank = ['creator', 'owner'].some(keyword => rankText.includes(keyword));
  
  const isAdmin = isAdminByRank || isAdminByBoolean;
  const isCreator = isCreatorByRank;
  
  return {
    isAdmin: isAdmin,
    isCreator: isCreator,
    role: rank
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 ENHANCED WHATSAPP GROUPS SYNC - Rate Limit Optimized v2.0')
    
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

    console.log('👤 Starting ENHANCED sync for user:', userId)

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

    // 🎯 Get phone number with enhanced fallback
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
          
          // Multiple ways to extract phone number
          const phoneNumber = healthData?.user?.id || 
                            healthData?.me?.phone || 
                            healthData?.phone ||
                            healthData?.profile?.phone;
          
          if (phoneNumber) {
            userPhoneNumber = phoneNumber.replace(/[^\d]/g, '');
            
            // Save phone number for future use
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

    // 🚀 CONSERVATIVE 2-PHASE STRATEGY - Optimized for rate limits
    const phaseConfig = [
      { 
        pass: 1, 
        delay: 0, 
        batchSize: 50, 
        maxCalls: 5, 
        apiDelay: 4000, // 4 seconds between calls
        description: "Initial discovery" 
      },
      { 
        pass: 2, 
        delay: 20000, // 20 second break between phases
        batchSize: 100, 
        maxCalls: 8, 
        apiDelay: 5000, // 5 seconds between calls
        description: "Deep scan" 
      }
    ];

    let allFoundGroups = new Map();
    let totalApiCalls = 0;
    let consecutiveEmptyPasses = 0;
    const syncStartTime = Date.now();

    for (const config of phaseConfig) {
      // Add delay before pass (except first pass)
      if (config.delay > 0) {
        console.log(`⏳ Waiting ${config.delay/1000}s before pass ${config.pass} (${config.description})...`)
        await delay(config.delay);
      }

      console.log(`\n🔄 === PASS ${config.pass}/2 === (${config.description})`)
      
      const passStartTime = Date.now();
      let passFoundGroups = 0;

      // Get groups with pagination for this pass
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let passApiCalls = 0

      while (hasMoreGroups && passApiCalls < config.maxCalls) {
        passApiCalls++
        totalApiCalls++
        
        console.log(`📊 Pass ${config.pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + config.batchSize}`)
        
        try {
          // 🛡️ CONSERVATIVE API DELAYS - Always wait before API calls (except first)
          if (passApiCalls > 1) {
            console.log(`⏳ Conservative API delay: ${config.apiDelay}ms...`)
            await delay(config.apiDelay)
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
            
            if (groupsResponse.status === 429) {
              // 🔄 ENHANCED rate limit handling
              const backoffDelay = Math.min(config.apiDelay * 3, 15000); // 3x delay, max 15s
              console.log(`🚨 Rate limited! Backing off for ${backoffDelay}ms...`)
              await delay(backoffDelay)
              continue // Retry same offset
            } else if (groupsResponse.status >= 500) {
              // Server error - retry with longer delay
              console.log(`🔄 Server error, retrying with longer delay...`)
              await delay(config.apiDelay * 2)
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
          
          // 🛡️ Enhanced error handling
          if (batchError.message.includes('timeout') || batchError.message.includes('429')) {
            console.log(`🔄 Retrying after error in pass ${config.pass}...`)
            await delay(config.apiDelay * 2)
            continue
          } else {
            console.error(`💥 Fatal error in pass ${config.pass}, stopping`)
            break
          }
        }
      }

      console.log(`📊 Pass ${config.pass} collected: ${allGroups.length} groups from ${passApiCalls} API calls`)

      // 🎯 ENHANCED group processing with better error handling
      for (const group of allGroups) {
        const groupName = group.name || group.subject || `Group ${group.id}`
        const participantsCount = group.participants?.length || group.size || 0
        
        // Skip if already found in previous pass
        if (allFoundGroups.has(group.id)) {
          continue;
        }
        
        let userAdminStatus = { isAdmin: false, isCreator: false, role: 'member' };
        
        // Enhanced group processing with better error handling
        if (group.participants && Array.isArray(group.participants)) {
          for (const participant of group.participants) {
            try {
              const participantId = participant.id || participant.phone || participant.number;
              
              if (participantId && isPhoneMatch(userPhoneNumber, participantId)) {
                userAdminStatus = detectAdminRole(participant);
                
                if (userAdminStatus.isCreator) {
                  console.log(`👑 Pass ${config.pass}: Found CREATOR role in ${groupName}`);
                } else if (userAdminStatus.isAdmin) {
                  console.log(`⭐ Pass ${config.pass}: Found ADMIN role in ${groupName}`);
                } else {
                  console.log(`👤 Pass ${config.pass}: Found MEMBER role in ${groupName} (skipping)`);
                }
                break;
              }
            } catch (participantError) {
              console.error(`⚠️ Error processing participant in ${groupName}:`, participantError);
              continue;
            }
          }
        }

        // Add to found groups if admin/creator
        if (userAdminStatus.isAdmin) {
          allFoundGroups.set(group.id, {
            user_id: userId,
            group_id: group.id,
            name: groupName,
            description: group.description || null,
            participants_count: participantsCount,
            is_admin: true,
            is_creator: userAdminStatus.isCreator,
            avatar_url: group.chat_pic || null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
          passFoundGroups++;
          console.log(`✅ Pass ${config.pass}: ADDED ${groupName} (${participantsCount} members) - ${userAdminStatus.isCreator ? 'CREATOR' : 'ADMIN'}`)
        }
      }

      const passTime = Math.round((Date.now() - passStartTime) / 1000);
      const totalElapsedTime = Math.round((Date.now() - syncStartTime) / 1000);
      console.log(`🎯 Pass ${config.pass} completed in ${passTime}s: Found ${passFoundGroups} new admin groups`)
      console.log(`📊 Total found so far: ${allFoundGroups.size} admin groups (${totalElapsedTime}s elapsed)`)

      // 🎯 IMPROVED stopping logic - more conservative
      if (passFoundGroups === 0) {
        consecutiveEmptyPasses++;
        console.log(`📊 No new groups in pass ${config.pass} (${consecutiveEmptyPasses} consecutive empty passes)`);
      } else {
        consecutiveEmptyPasses = 0; // Reset counter when we find groups
      }

      // Conservative stopping conditions
      const shouldStopEarly = (
        // Stop after 2 empty passes always
        (consecutiveEmptyPasses >= 2) ||
        
        // Stop if we have many results and 1 empty pass after pass 1
        (allFoundGroups.size >= 10 && consecutiveEmptyPasses >= 1 && config.pass >= 1) ||
        
        // Safety timeout
        (totalElapsedTime >= 90)
      );

      if (shouldStopEarly) {
        let stopReason = '';
        if (consecutiveEmptyPasses >= 2) {
          stopReason = `2 consecutive empty passes`;
        } else if (allFoundGroups.size >= 10 && consecutiveEmptyPasses >= 1) {
          stopReason = `good results (${allFoundGroups.size} groups) with 1 empty pass`;
        } else if (totalElapsedTime >= 90) {
          stopReason = `90 second safety limit`;
        }
        
        console.log(`🏁 Conservative stopping after pass ${config.pass}: ${stopReason}`);
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
    console.log(`🔄 Passes completed: ${phaseConfig.length}`)
    console.log(`📊 Total API calls: ${totalApiCalls}`)
    console.log(`✅ Final admin groups found: ${managedGroups.length}`)
    console.log(`👑 Creator groups: ${creatorCount}`)
    console.log(`⭐ Admin groups: ${adminCount}`)
    console.log(`👥 Total members: ${totalMemberCount}`)

    // Save ALL found groups to database with better error handling
    console.log('💾 Saving all found groups...')
    
    try {
      // Clear existing groups
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
      
      if (managedGroups.length > 0) {
        // Insert in smaller batches to avoid timeouts
        const dbBatchSize = 50
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
          
          // Small delay between batches
          if (i + dbBatchSize < managedGroups.length) {
            await delay(100)
          }
        }
      }
    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError)
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: dbError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    const message = managedGroups.length > 0
      ? `נמצאו ${managedGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות בניהולך'

    return new Response(
      JSON.stringify({
        success: true,
        user_phone: userPhoneNumber,
        groups_count: managedGroups.length,
        total_groups_scanned: `Enhanced 2-phase scan completed in ${totalSyncTime}s`,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        sync_phases: phaseConfig.length,
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
    console.error('💥 Enhanced Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        suggestion: 'Enhanced sync failed - wait 2 minutes before retrying'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})