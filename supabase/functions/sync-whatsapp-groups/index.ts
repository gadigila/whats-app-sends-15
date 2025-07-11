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

// 🔧 IMPROVED: Enhanced phone matching (your original logic + better variants)
class PhoneMatcher {
  private userPhoneClean: string;
  private userPhoneVariants: string[];

  constructor(userPhone: string) {
    this.userPhoneClean = userPhone.replace(/[^\d]/g, '');
    
    // Generate ALL possible phone variants for Israeli numbers
    this.userPhoneVariants = [
      this.userPhoneClean,
      // Israeli format conversions
      this.userPhoneClean.startsWith('972') ? '0' + this.userPhoneClean.substring(3) : null,
      this.userPhoneClean.startsWith('0') ? '972' + this.userPhoneClean.substring(1) : null,
      // Last 9 digits (mobile number without country code)
      this.userPhoneClean.slice(-9),
      // WhatsApp format (with @s.whatsapp.net)
      this.userPhoneClean + '@s.whatsapp.net',
      (this.userPhoneClean.startsWith('972') ? '0' + this.userPhoneClean.substring(3) : null) + '@s.whatsapp.net',
      (this.userPhoneClean.startsWith('0') ? '972' + this.userPhoneClean.substring(1) : null) + '@s.whatsapp.net'
    ].filter(Boolean) as string[];
    
    console.log(`📱 Phone matcher initialized for: ${userPhone}`);
    console.log(`🔍 Will match variants: ${this.userPhoneVariants.join(', ')}`);
  }

  isMatch(participantPhone: string): boolean {
    if (!participantPhone) return false;
    
    // Clean the participant phone and create variants
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '');
    const participantWithSuffix = participantPhone; // Keep original for @s.whatsapp.net format
    
    // Check direct matches first (fastest)
    if (this.userPhoneVariants.includes(cleanParticipant) || 
        this.userPhoneVariants.includes(participantWithSuffix)) {
      return true;
    }
    
    // Check last 9 digits for mobile numbers
    if (cleanParticipant.length >= 9) {
      const lastNine = cleanParticipant.slice(-9);
      const userLastNine = this.userPhoneClean.slice(-9);
      if (lastNine === userLastNine) {
        return true;
      }
    }
    
    return false;
  }
}

// 🔧 IMPROVED: Your original processor with better admin detection
class ImprovedGroupProcessor {
  private phoneMatcher: PhoneMatcher;
  private stats = {
    groupsProcessed: 0,
    groupsSkippedNoParticipants: 0,
    groupsSkippedNotMember: 0,
    adminGroupsFound: 0,
    creatorGroupsFound: 0,
    totalParticipantsChecked: 0,
    phoneMatchAttempts: 0,
    phoneMatchSuccesses: 0
  };

  constructor(userPhone: string, private userId: string) {
    this.phoneMatcher = new PhoneMatcher(userPhone);
  }

  processGroup(group: any): { isAdminGroup: boolean; groupData?: any; skipReason?: string } {
    this.stats.groupsProcessed++;
    
    const groupName = group.name || group.subject || `Group ${group.id}`;
    
    // 🔧 IMPROVED: Check participants with better logging
    if (!group.participants || !Array.isArray(group.participants) || group.participants.length === 0) {
      this.stats.groupsSkippedNoParticipants++;
      return { 
        isAdminGroup: false, 
        skipReason: 'no_participants_loaded'
      };
    }

    this.stats.totalParticipantsChecked += group.participants.length;

    // 🔧 IMPROVED: Enhanced user search with multiple field checks
    let userParticipant = null;
    
    for (const participant of group.participants) {
      this.stats.phoneMatchAttempts++;
      
      // Check multiple possible ID fields
      const possibleIds = [
        participant.id,
        participant.phone, 
        participant.number,
        participant.user_id,
        participant.wa_id
      ].filter(Boolean);
      
      for (const possibleId of possibleIds) {
        if (this.phoneMatcher.isMatch(possibleId)) {
          userParticipant = participant;
          this.stats.phoneMatchSuccesses++;
          console.log(`📱 User found in ${groupName}: ${possibleId} (matched via ${participant.id ? 'id' : participant.phone ? 'phone' : 'other'})`);
          break;
        }
      }
      
      if (userParticipant) break;
    }

    // Early exit if user not in group
    if (!userParticipant) {
      this.stats.groupsSkippedNotMember++;
      return { 
        isAdminGroup: false, 
        skipReason: 'not_member'
      };
    }

    // 🔧 IMPROVED: Enhanced role detection with multiple field checks
    const possibleRankFields = [
      userParticipant.rank,
      userParticipant.role, 
      userParticipant.type,
      userParticipant.admin,
      userParticipant.is_admin
    ];
    
    let isCreatorRole = false;
    let isAdminRole = false;
    
    for (const field of possibleRankFields) {
      if (!field) continue;
      
      const normalizedField = field.toString().toLowerCase();
      
      if (normalizedField === 'creator' || normalizedField === 'owner') {
        isCreatorRole = true;
        isAdminRole = true;
        break;
      } else if (normalizedField === 'admin' || normalizedField === 'administrator' || 
                 normalizedField === 'true' || field === true) {
        isAdminRole = true;
        break;
      }
    }
    
    // Also check if user is the group creator (some APIs use different fields)
    if (group.creator && this.phoneMatcher.isMatch(group.creator)) {
      isCreatorRole = true;
      isAdminRole = true;
    }

    if (!isAdminRole) {
      console.log(`👤 Found user as MEMBER in ${groupName} (role: ${userParticipant.rank || userParticipant.role || 'member'})`);
      return { 
        isAdminGroup: false, 
        skipReason: 'member_only'
      };
    }

    // 🎉 Found admin/creator group!
    if (isCreatorRole) {
      this.stats.creatorGroupsFound++;
      console.log(`👑 Found user as CREATOR in ${groupName}`);
    } else {
      this.stats.adminGroupsFound++;
      console.log(`⭐ Found user as ADMIN in ${groupName}`);
    }

    const participantsCount = group.participants?.length || group.size || 0;

    const groupData = {
      user_id: this.userId,
      group_id: group.id,
      name: groupName,
      description: group.description || null,
      participants_count: participantsCount,
      is_admin: true,
      is_creator: isCreatorRole,
      avatar_url: group.chat_pic || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      isAdminGroup: true,
      groupData
    };
  }

  // Process groups in chunks
  processGroupsInChunks(groups: any[]): Map<string, any> {
    let foundAdminGroups = new Map<string, any>();
    
    console.log(`🔄 Processing ${groups.length} groups with improved admin detection...`);
    
    for (const group of groups) {
      const result = this.processGroup(group);
      
      if (result.isAdminGroup && result.groupData) {
        foundAdminGroups.set(group.id, result.groupData);
        const role = result.groupData.is_creator ? 'CREATOR' : 'ADMIN';
        console.log(`✅ ADDED ${result.groupData.name} (${result.groupData.participants_count} members) - ${role}`);
      }
    }
    
    return foundAdminGroups;
  }

  getStats() {
    return {
      ...this.stats,
      efficiency: {
        participantsPerGroup: Math.round(this.stats.totalParticipantsChecked / Math.max(this.stats.groupsProcessed, 1)),
        adminFindRate: ((this.stats.adminGroupsFound + this.stats.creatorGroupsFound) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        skipRate: ((this.stats.groupsSkippedNoParticipants + this.stats.groupsSkippedNotMember) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        phoneMatchSuccessRate: (this.stats.phoneMatchSuccesses / Math.max(this.stats.phoneMatchAttempts, 1) * 100).toFixed(1) + '%'
      }
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔧 HYBRID SYNC: Bulk scan + selective detail fetching for accurate admin detection')
    
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

    console.log('👤 Starting IMPROVED sync for user:', userId)

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

    // Initialize improved processor
    const groupProcessor = new ImprovedGroupProcessor(userPhoneNumber, userId);
    console.log('🔧 Improved group processor initialized')

    // 🔧 YOUR ORIGINAL LOGIC: Simple but effective scanning
    const syncStartTime = Date.now();
    let allFoundGroups = new Map();
    let totalApiCalls = 0;
    let hasApiErrors = false;
    let totalGroupsScanned = 0;

    // Single-pass comprehensive scan (based on your original approach)
    console.log('📡 Fetching groups with comprehensive scan...')
    
    try {
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let apiCalls = 0
      const maxApiCalls = 8; // Reasonable limit
      const batchSize = 150; // Good balance

      while (hasMoreGroups && apiCalls < maxApiCalls) {
        apiCalls++
        totalApiCalls++
        
        console.log(`📡 API call ${apiCalls}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`)
        
        try {
          // Reasonable delay between calls
          if (apiCalls > 1) {
            await delay(2000); // 2 second delay
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
            console.error(`❌ Groups API failed (call ${apiCalls}):`, groupsResponse.status)
            hasApiErrors = true
            
            if (groupsResponse.status === 503) {
              console.log(`🔄 WHAPI Service Unavailable (503) - waiting and retrying...`)
              await delay(5000);
              apiCalls--; // Don't count this attempt
              continue;
            } else if (groupsResponse.status === 429) {
              console.log(`🔄 Rate limit hit - waiting longer...`)
              await delay(10000);
              apiCalls--; // Don't count this attempt
              continue;
            } else {
              console.log(`💥 Non-retryable error, stopping scan`)
              break;
            }
          }

          const groupsData = await groupsResponse.json()
          const batchGroups = groupsData.groups || []
          
          console.log(`📊 API call ${apiCalls}: Received ${batchGroups.length} groups`)
          
          if (batchGroups.length === 0) {
            console.log(`📭 Empty batch, end of groups reached`)
            hasMoreGroups = false;
            break;
          }
          
          allGroups = allGroups.concat(batchGroups)
          totalGroupsScanned += batchGroups.length
          currentOffset += batchSize
          
          if (batchGroups.length < batchSize) {
            console.log(`📭 Partial batch (${batchGroups.length}), likely end of groups`)
            hasMoreGroups = false;
          }

        } catch (batchError) {
          console.error(`❌ API call ${apiCalls} failed:`, batchError)
          hasApiErrors = true
          await delay(3000);
          continue;
        }
      }

      console.log(`📊 Total groups fetched: ${allGroups.length}`)

      // 🔧 HYBRID APPROACH: Process groups intelligently
      if (allGroups.length > 0) {
        console.log(`🔍 Starting hybrid processing: bulk scan + selective detail fetching`);
        
        // PHASE 1: Quick scan of bulk data to find obvious admin groups
        console.log(`📊 Phase 1: Quick scan of ${allGroups.length} groups from bulk data`);
        const quickResults = groupProcessor.processGroupsInChunks(allGroups);
        
        for (const [groupId, groupData] of quickResults) {
          allFoundGroups.set(groupId, groupData);
        }
        
        console.log(`✅ Phase 1 found: ${quickResults.size} admin groups from bulk data`);
        
        // PHASE 2: Individual fetch for groups that had no participants in bulk data
        const groupsWithoutParticipants = allGroups.filter(group => 
          !group.participants || group.participants.length === 0
        );
        
        console.log(`🔍 Phase 2: Fetching details for ${groupsWithoutParticipants.length} groups without participant data`);
        
        if (groupsWithoutParticipants.length > 0) {
          // Limit to reasonable number to avoid excessive API calls
          const groupsToDetailFetch = groupsWithoutParticipants.slice(0, 30); // Max 30 individual calls
          
          if (groupsWithoutParticipants.length > 30) {
            console.log(`⚠️ Limiting detail fetch to first ${groupsToDetailFetch.length} groups (out of ${groupsWithoutParticipants.length})`);
          }
          
          let detailFetchCount = 0;
          
          for (const group of groupsToDetailFetch) {
            try {
              detailFetchCount++;
              console.log(`🔍 Fetching details for group ${detailFetchCount}/${groupsToDetailFetch.length}: ${group.name || group.id}`);
              
              // Individual group detail call
              const detailResponse = await fetch(
                `https://gate.whapi.cloud/groups/${group.id}`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${profile.whapi_token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              
              if (!detailResponse.ok) {
                if (detailResponse.status === 429) {
                  console.log(`⏳ Rate limit hit, waiting 5s...`);
                  await delay(5000);
                  detailFetchCount--; // Retry this one
                  continue;
                }
                console.log(`⚠️ Failed to fetch details for group ${group.id}: ${detailResponse.status}`);
                continue;
              }
              
              const detailedGroup = await detailResponse.json();
              totalApiCalls++;
              
              // Process the detailed group
              const detailResult = groupProcessor.processGroup(detailedGroup);
              
              if (detailResult.isAdminGroup && detailResult.groupData) {
                allFoundGroups.set(group.id, detailResult.groupData);
                const role = detailResult.groupData.is_creator ? 'CREATOR' : 'ADMIN';
                console.log(`✅ PHASE 2 FOUND: ${detailResult.groupData.name} (${detailResult.groupData.participants_count} members) - ${role}`);
              }
              
              // Rate limiting between individual calls
              if (detailFetchCount < groupsToDetailFetch.length) {
                await delay(1500); // 1.5s between individual calls
              }
              
            } catch (error) {
              console.log(`❌ Error fetching details for group ${group.id}:`, error.message);
              continue;
            }
          }
          
          console.log(`✅ Phase 2 completed: Checked ${detailFetchCount} groups individually`);
        }
        
        console.log(`🎯 Hybrid processing complete: Found ${allFoundGroups.size} total admin groups`);
      }

    } catch (error) {
      console.error(`❌ Error in sync process:`, error)
      hasApiErrors = true
    }

    const newFoundGroups = Array.from(allFoundGroups.values());
    const newGroupsCount = newFoundGroups.length;
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = groupProcessor.getStats();

    console.log(`\n🎯 IMPROVED SYNC COMPLETE!`)
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`)
    console.log(`📊 API calls made: ${totalApiCalls}`)
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`)
    console.log(`🆕 Admin groups found: ${newGroupsCount}`)
    console.log(`📁 Existing groups: ${existingCount}`)
    console.log(`🔧 Processing stats:`, processingStats.efficiency)

    // Safety checks (your original logic)
    if (hasApiErrors && newGroupsCount === 0) {
      console.log('🛡️ SAFETY: API errors + 0 groups found - preserving existing')
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API errors occurred during sync',
          existing_groups_preserved: existingCount,
          processing_stats: processingStats,
          message: `Sync failed due to API errors. Your ${existingCount} existing groups are safe.`
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (existingCount > 0 && newGroupsCount < existingCount * 0.5) {
      console.log(`🛡️ SAFETY: Found ${newGroupsCount} but had ${existingCount} - suspicious`)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Sync found significantly fewer groups than expected',
          new_found: newGroupsCount,
          existing_preserved: existingCount,
          processing_stats: processingStats,
          message: `Found only ${newGroupsCount} groups but you had ${existingCount} before. Keeping existing groups safe.`
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Update database (your original logic)
    if (newGroupsCount > 0 || existingCount === 0) {
      console.log(`✅ SAFE TO UPDATE: Found ${newGroupsCount} groups, replacing ${existingCount}`)
      
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
      
      if (newGroupsCount > 0) {
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(newFoundGroups)

        if (insertError) {
          console.error('❌ Database insert error:', insertError)
          return new Response(
            JSON.stringify({ error: 'Failed to save groups to database', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      const adminCount = newFoundGroups.filter(g => !g.is_creator).length;
      const creatorCount = newFoundGroups.filter(g => g.is_creator).length;
      const totalMemberCount = newFoundGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);

      const message = newGroupsCount > 0
        ? `✅ נמצאו ${newGroupsCount} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
        : 'לא נמצאו קבוצות בניהולך'

      return new Response(
        JSON.stringify({
          success: true,
          groups_count: newGroupsCount,
          admin_groups_count: adminCount,
          creator_groups_count: creatorCount,
          total_members_in_managed_groups: totalMemberCount,
          total_api_calls: totalApiCalls,
          total_groups_scanned: totalGroupsScanned,
          sync_time_seconds: totalSyncTime,
          processing_stats: processingStats,
          improved_original: true,
          message: message,
          managed_groups: newFoundGroups.map(g => ({
            name: g.name,
            members: g.participants_count,
            id: g.group_id,
            role: g.is_creator ? 'creator' : 'admin'
          }))
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: existingCount,
        message: `לא נמצאו קבוצות חדשות. שומר על ${existingCount} הקבוצות הקיימות שלך`,
        existing_groups_preserved: true,
        processing_stats: processingStats
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Improved Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})