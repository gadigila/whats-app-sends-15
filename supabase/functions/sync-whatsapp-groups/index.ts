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

// 🚀 OPTIMIZED: Enhanced phone matching with caching
class PhoneMatcher {
  private userPhoneClean: string;
  private userPhoneVariants: string[];

  constructor(userPhone: string) {
    this.userPhoneClean = userPhone.replace(/[^\d]/g, '');
    
    // Pre-compute all possible variants for faster matching
    this.userPhoneVariants = [
      this.userPhoneClean,
      this.userPhoneClean.startsWith('972') ? '0' + this.userPhoneClean.substring(3) : null,
      this.userPhoneClean.startsWith('0') ? '972' + this.userPhoneClean.substring(1) : null,
      this.userPhoneClean.slice(-9), // Last 9 digits
    ].filter(Boolean) as string[];
    
    console.log(`📱 Phone matcher initialized for: ${userPhone}`);
    console.log(`🔍 Will match variants: ${this.userPhoneVariants.join(', ')}`);
  }

  isMatch(participantPhone: string): boolean {
    if (!participantPhone) return false;
    
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '');
    
    // Fast exact match first
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

// 🧠 SMART: Group processing cache to avoid duplicate work
class SmartGroupCache {
  private processedGroups = new Set<string>(); // Groups we already checked
  private memberOnlyGroups = new Set<string>(); // Groups where user is just member
  private adminGroups = new Map<string, any>(); // Groups where user is admin
  private noParticipantsGroups = new Set<string>(); // Groups with no participants loaded

  isAlreadyProcessed(groupId: string): boolean {
    return this.processedGroups.has(groupId);
  }

  isMemberOnly(groupId: string): boolean {
    return this.memberOnlyGroups.has(groupId);
  }

  isAdminGroup(groupId: string): boolean {
    return this.adminGroups.has(groupId);
  }

  markAsProcessed(groupId: string, result: { isAdminGroup: boolean; groupData?: any; skipReason?: string }) {
    this.processedGroups.add(groupId);
    
    if (result.isAdminGroup && result.groupData) {
      this.adminGroups.set(groupId, result.groupData);
    } else if (result.skipReason === 'member_only') {
      this.memberOnlyGroups.add(groupId);
    } else if (result.skipReason === 'no_participants_loaded') {
      this.noParticipantsGroups.add(groupId);
    }
  }

  shouldRecheck(groupId: string): boolean {
    // Recheck groups that had no participants loaded (WHAPI might have loaded them now)
    return this.noParticipantsGroups.has(groupId);
  }

  getAllAdminGroups(): any[] {
    return Array.from(this.adminGroups.values());
  }

  getStats() {
    return {
      totalProcessed: this.processedGroups.size,
      adminGroups: this.adminGroups.size,
      memberOnlyGroups: this.memberOnlyGroups.size,
      noParticipantsGroups: this.noParticipantsGroups.size,
      cacheHitRate: this.processedGroups.size > 0 ? 
        ((this.adminGroups.size + this.memberOnlyGroups.size) / this.processedGroups.size * 100).toFixed(1) + '%' : '0%'
    };
  }
}
// 🚀 OPTIMIZED: Smart group processor with caching
class OptimizedGroupProcessor {
  private phoneMatcher: PhoneMatcher;
  private cache: SmartGroupCache;
  private stats = {
    groupsProcessed: 0,
    groupsSkippedNoParticipants: 0,
    groupsSkippedNotMember: 0,
    adminGroupsFound: 0,
    creatorGroupsFound: 0,
    totalParticipantsChecked: 0
  };

  constructor(userPhone: string, private userId: string) {
    this.phoneMatcher = new PhoneMatcher(userPhone);
    this.cache = new SmartGroupCache();
  }

  processGroup(group: any): { isAdminGroup: boolean; groupData?: any; skipReason?: string; fromCache?: boolean } {
    this.stats.groupsProcessed++;
    
    const groupName = group.name || group.subject || `Group ${group.id}`;
    
    // 🧠 SMART: Check cache first - avoid duplicate work!
    if (this.cache.isAlreadyProcessed(group.id)) {
      if (this.cache.isAdminGroup(group.id)) {
        console.log(`💾 Cache HIT: ${groupName} - already known admin group`);
        return { 
          isAdminGroup: true, 
          groupData: this.cache.adminGroups.get(group.id),
          fromCache: true 
        };
      } else if (this.cache.isMemberOnly(group.id)) {
        console.log(`💾 Cache HIT: ${groupName} - already known member-only group (skipping)`);
        return { 
          isAdminGroup: false, 
          skipReason: 'member_only_cached',
          fromCache: true 
        };
      } else if (!this.cache.shouldRecheck(group.id)) {
        console.log(`💾 Cache HIT: ${groupName} - already processed (skipping)`);
        return { 
          isAdminGroup: false, 
          skipReason: 'already_processed',
          fromCache: true 
        };
      } else {
        console.log(`🔄 Cache RECHECK: ${groupName} - participants might be loaded now`);
      }
    }
    
    // 🚀 OPTIMIZATION 1: Early skip if no participants loaded
    if (!group.participants || !Array.isArray(group.participants) || group.participants.length === 0) {
      this.stats.groupsSkippedNoParticipants++;
      const result = { 
        isAdminGroup: false, 
        skipReason: 'no_participants_loaded' as const
      };
      
      // 🧠 SMART: Cache this result but mark for recheck later
      this.cache.markAsProcessed(group.id, result);
      
      return result;
    }

    this.stats.totalParticipantsChecked += group.participants.length;

    // 🚀 OPTIMIZATION 2: Fast user lookup using .find()
    const userParticipant = group.participants.find(participant => {
      const participantId = participant.id || participant.phone || participant.number;
      return this.phoneMatcher.isMatch(participantId);
    });

    // 🚀 OPTIMIZATION 3: Early exit if user not in group
    if (!userParticipant) {
      this.stats.groupsSkippedNotMember++;
      const result = { 
        isAdminGroup: false, 
        skipReason: 'not_member' as const
      };
      
      // 🧠 SMART: Cache this - user will never be in this group
      this.cache.markAsProcessed(group.id, result);
      
      return result;
    }

    // 🚀 OPTIMIZATION 4: Quick role check
    const participantRank = userParticipant.rank || userParticipant.role || 'member';
    const normalizedRank = participantRank.toLowerCase();
    
    const isCreatorRole = normalizedRank === 'creator' || normalizedRank === 'owner';
    const isAdminRole = normalizedRank === 'admin' || normalizedRank === 'administrator' || isCreatorRole;

    if (!isAdminRole) {
      console.log(`👤 Found MEMBER role in ${groupName} (skipping)`);
      const result = { 
        isAdminGroup: false, 
        skipReason: 'member_only' as const
      };
      
      // 🧠 SMART: Cache this - user is member-only in this group
      this.cache.markAsProcessed(group.id, result);
      
      return result;
    }

    // 🎉 Found admin/creator group!
    if (isCreatorRole) {
      this.stats.creatorGroupsFound++;
      console.log(`👑 Found CREATOR role in ${groupName}`);
    } else {
      this.stats.adminGroupsFound++;
      console.log(`⭐ Found ADMIN role in ${groupName}`);
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

    const result = {
      isAdminGroup: true,
      groupData
    };

    // 🧠 SMART: Cache this admin group
    this.cache.markAsProcessed(group.id, result);

    return result;
  }

  getStats() {
    const cacheStats = this.cache.getStats();
    return {
      ...this.stats,
      cache: cacheStats,
      efficiency: {
        participantsPerGroup: Math.round(this.stats.totalParticipantsChecked / Math.max(this.stats.groupsProcessed, 1)),
        adminFindRate: ((this.stats.adminGroupsFound + this.stats.creatorGroupsFound) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        skipRate: ((this.stats.groupsSkippedNoParticipants + this.stats.groupsSkippedNotMember) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        cacheHitRate: cacheStats.cacheHitRate
      }
    };
  }

  getAllCachedAdminGroups(): any[] {
    return this.cache.getAllAdminGroups();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 OPTIMIZED SAFE SYNC: Maximum speed + data protection...')
    
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

    console.log('👤 Starting OPTIMIZED sync for user:', userId)

    // 🛡️ STEP 1: Get existing groups for safety
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

    // 🚀 STEP 2: Initialize optimized processor
    const groupProcessor = new OptimizedGroupProcessor(userPhoneNumber, userId);
    console.log('🚀 Optimized group processor initialized')

    // 🚀 AGGRESSIVE 4-PASS STRATEGY - Push WHAPI harder!
    const passConfig = [
      { pass: 1, delay: 0,     batchSize: 100, description: "Fast discovery", maxCalls: 4 },
      { pass: 2, delay: 15000, batchSize: 150, description: "Deep scan", maxCalls: 6 },
      { pass: 3, delay: 30000, batchSize: 200, description: "Aggressive scan", maxCalls: 8 },
      { pass: 4, delay: 45000, batchSize: 250, description: "Final deep dive", maxCalls: 6 }
    ];

    let allFoundGroups = new Map();
    let totalApiCalls = 0;
    let hasApiErrors = false;
    let totalGroupsScanned = 0;
    const syncStartTime = Date.now();

    for (const config of passConfig) {
      if (config.delay > 0) {
        console.log(`⏳ Waiting ${config.delay/1000}s before pass ${config.pass}...`)
        await delay(config.delay);
      }

      console.log(`\n🔄 === OPTIMIZED PASS ${config.pass}/3 === (${config.description})`)
      
      let passFoundGroups = 0;
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let passApiCalls = 0
      const maxPassApiCalls = 6

      // 🚀 AGGRESSIVE: Push beyond apparent limits
      while (hasMoreGroups && passApiCalls < config.maxCalls) {
        passApiCalls++
        totalApiCalls++
        
        console.log(`📊 Pass ${config.pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + config.batchSize}`)
        
        try {
          const apiDelay = 2200 + (config.pass * 600); // 2.2s to 4.6s - longer for deeper passes
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
          
          // 🚀 AGGRESSIVE: Don't stop at empty batches, WHAPI might have more
          if (batchGroups.length === 0) {
            console.log(`📊 Empty batch in pass ${config.pass} - checking if WHAPI has more...`)
            
            // Try a few more offsets in case WHAPI has gaps
            if (passApiCalls < config.maxCalls - 1) {
              console.log(`🔄 Continuing past empty batch - might be WHAPI timing issue`)
              currentOffset += config.batchSize // Skip the empty range
              continue
            } else {
              hasMoreGroups = false
            }
          } else {
            allGroups = allGroups.concat(batchGroups)
            totalGroupsScanned += batchGroups.length
            currentOffset += config.batchSize
            
            if (batchGroups.length < config.batchSize) {
              hasMoreGroups = false
            }
          }

        } catch (batchError) {
          console.error(`❌ CRITICAL API Error in pass ${config.pass}:`, batchError)
          hasApiErrors = true
          
          if (batchError.message.includes('TypeError') || batchError.message.includes('decode')) {
            console.log('🛡️ Critical API error detected - preserving existing groups')
            break
          }
          
          await delay(3000)
          continue
        }
      }

      // 🧠 SMART: Process groups with intelligent caching
      console.log(`🔍 Processing ${allGroups.length} groups with smart caching...`)
      
      for (const group of allGroups) {
        const result = groupProcessor.processGroup(group);
        
        if (result.isAdminGroup && result.groupData && !result.fromCache) {
          allFoundGroups.set(group.id, result.groupData);
          passFoundGroups++;
          
          const role = result.groupData.is_creator ? 'CREATOR' : 'ADMIN';
          console.log(`✅ Pass ${config.pass}: ADDED ${result.groupData.name} (${result.groupData.participants_count} members) - ${role}`);
        } else if (result.isAdminGroup && result.fromCache) {
          // Already in cache, don't count as new
          allFoundGroups.set(group.id, result.groupData);
        }
      }

      // 🧠 SMART: Also get any cached admin groups we haven't added yet
      const cachedAdminGroups = groupProcessor.getAllCachedAdminGroups();
      for (const cachedGroup of cachedAdminGroups) {
        if (!allFoundGroups.has(cachedGroup.group_id)) {
          allFoundGroups.set(cachedGroup.group_id, cachedGroup);
        }
      }

      const totalElapsedTime = Math.round((Date.now() - syncStartTime) / 1000);
      console.log(`🎯 Pass ${config.pass} completed: Found ${passFoundGroups} new admin groups (${totalElapsedTime}s elapsed)`)

      // 🚀 AGGRESSIVE: Continue even if no new groups in this pass
      if (passFoundGroups === 0 && config.pass < 3) {
        console.log(`🔄 Pass ${config.pass} found 0 new groups, but continuing deeper scan...`)
        // Don't stop early - WHAPI might have more groups in later ranges
      } else if (passFoundGroups === 0 && allFoundGroups.size > 0) {
        console.log(`🏁 Smart stopping after pass ${config.pass}: no new groups and we have ${allFoundGroups.size} groups`)
        break;
      }
    }

    const newFoundGroups = Array.from(allFoundGroups.values());
    const newGroupsCount = newFoundGroups.length;
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = groupProcessor.getStats();

    console.log(`\n🎯 OPTIMIZED SYNC COMPLETE!`)
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`)
    console.log(`📊 API calls made: ${totalApiCalls}`)
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`)
    console.log(`🆕 Admin groups found: ${newGroupsCount}`)
    console.log(`📁 Existing groups: ${existingCount}`)
    console.log(`🚀 Processing efficiency:`, processingStats.efficiency)

    // 🛡️ SAFETY DECISION LOGIC (same as before)
    if (hasApiErrors && newGroupsCount === 0) {
      console.log('🛡️ SAFETY: API errors + 0 groups found - preserving existing')
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API errors occurred during sync',
          existing_groups_preserved: existingCount,
          processing_stats: processingStats,
          message: `Sync failed due to API errors. Your ${existingCount} existing groups are safe.`,
          recommendation: 'Try again in a few minutes when WHAPI is more stable'
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
          message: `Found only ${newGroupsCount} groups but you had ${existingCount} before. Keeping existing groups safe.`,
          recommendation: 'This might be a temporary WHAPI issue. Try again later.'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🛡️ SAFE UPDATE
    if (newGroupsCount > 0 || existingCount === 0) {
      console.log(`✅ SAFE TO UPDATE: Found ${newGroupsCount} groups, replacing ${existingCount}`)
      
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
      
      if (newGroupsCount > 0) {
        const dbBatchSize = 100
        for (let i = 0; i < newFoundGroups.length; i += dbBatchSize) {
          const batch = newFoundGroups.slice(i, i + dbBatchSize)
          
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
          
          if (i + dbBatchSize < newFoundGroups.length) {
            await delay(100)
          }
        }
      }

      const adminCount = newFoundGroups.filter(g => !g.is_creator).length;
      const creatorCount = newFoundGroups.filter(g => g.is_creator).length;
      const totalMemberCount = newFoundGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);

      const message = newGroupsCount > 0
        ? `נמצאו ${newGroupsCount} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
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
          optimization_enabled: true,
          message: message,
          managed_groups: newFoundGroups.map(g => ({
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
        processing_stats: processingStats,
        recommendation: 'יתכן שזה בעיה זמנית של WHAPI. נסה שוב מאוחר יותר'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Optimized Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        safety_note: 'Your existing groups should be preserved'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})