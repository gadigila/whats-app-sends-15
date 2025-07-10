import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeepSyncRequest {
  userId: string
  progressCallback?: boolean // Whether to send real-time updates
}

// Helper function to add delays between requests
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 📱 Enhanced phone matching for Israeli numbers
class PhoneMatcher {
  private userPhoneClean: string;
  private userPhoneVariants: string[];

  constructor(userPhone: string) {
    this.userPhoneClean = userPhone.replace(/[^\d]/g, '');
    
    this.userPhoneVariants = [
      this.userPhoneClean,
      this.userPhoneClean.startsWith('972') ? '0' + this.userPhoneClean.substring(3) : null,
      this.userPhoneClean.startsWith('0') ? '972' + this.userPhoneClean.substring(1) : null,
      this.userPhoneClean.slice(-9), // Last 9 digits
    ].filter(Boolean) as string[];
    
    console.log(`📱 Phone matcher initialized for: ${userPhone}`);
  }

  isMatch(participantPhone: string): boolean {
    if (!participantPhone) return false;
    
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '');
    
    if (this.userPhoneVariants.includes(cleanParticipant)) {
      return true;
    }
    
    if (cleanParticipant.length >= 9) {
      const lastNine = cleanParticipant.slice(-9);
      return this.userPhoneVariants.some(variant => 
        variant.length >= 9 && variant.slice(-9) === lastNine
      );
    }
    
    return false;
  }
}

// 🧠 SMART: Advanced caching with persistence
class SmartGroupCache {
  private processedGroups = new Map<string, any>(); // Groups we already processed
  private memberOnlyGroups = new Set<string>(); // Groups where user is just member
  private adminGroups = new Map<string, any>(); // Groups where user is admin
  private lastSyncTime: number = 0;

  constructor(private supabase: any, private userId: string) {}

  async loadCache() {
    try {
      // Load from database cache
      const { data: cacheData } = await this.supabase
        .from('group_sync_cache')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (cacheData && cacheData.cache_data) {
        const cache = JSON.parse(cacheData.cache_data);
        this.lastSyncTime = cache.lastSyncTime || 0;
        
        // Only use cache if less than 24 hours old
        if (Date.now() - this.lastSyncTime < 24 * 60 * 60 * 1000) {
          cache.memberOnlyGroups?.forEach(id => this.memberOnlyGroups.add(id));
          cache.adminGroups?.forEach(group => this.adminGroups.set(group.group_id, group));
          console.log(`📊 Loaded cache: ${this.memberOnlyGroups.size} member groups, ${this.adminGroups.size} admin groups`);
        }
      }
    } catch (error) {
      console.log('⚠️ No cache found or cache invalid, starting fresh');
    }
  }

  async saveCache() {
    try {
      const cacheData = {
        lastSyncTime: Date.now(),
        memberOnlyGroups: Array.from(this.memberOnlyGroups),
        adminGroups: Array.from(this.adminGroups.values())
      };

      await this.supabase
        .from('group_sync_cache')
        .upsert({
          user_id: this.userId,
          cache_data: JSON.stringify(cacheData),
          updated_at: new Date().toISOString()
        });

      console.log('💾 Cache saved successfully');
    } catch (error) {
      console.error('❌ Failed to save cache:', error);
    }
  }

  isKnownMemberOnly(groupId: string): boolean {
    return this.memberOnlyGroups.has(groupId);
  }

  isKnownAdmin(groupId: string): boolean {
    return this.adminGroups.has(groupId);
  }

  markAsMemberOnly(groupId: string) {
    this.memberOnlyGroups.add(groupId);
  }

  addAdminGroup(groupData: any) {
    this.adminGroups.set(groupData.group_id, groupData);
  }

  getAllAdminGroups(): any[] {
    return Array.from(this.adminGroups.values());
  }

  getStats() {
    return {
      totalProcessed: this.processedGroups.size,
      adminGroups: this.adminGroups.size,
      memberOnlyGroups: this.memberOnlyGroups.size,
      cacheAge: Math.round((Date.now() - this.lastSyncTime) / (1000 * 60 * 60)) // hours
    };
  }
}

// 🚀 AGGRESSIVE: Background processor for deep sync
class AggressiveGroupProcessor {
  private phoneMatcher: PhoneMatcher;
  private cache: SmartGroupCache;
  private stats = {
    groupsProcessed: 0,
    groupsSkippedCache: 0,
    groupsSkippedNoParticipants: 0,
    groupsSkippedNotMember: 0,
    adminGroupsFound: 0,
    creatorGroupsFound: 0,
    totalParticipantsChecked: 0,
    apiCallsMade: 0
  };

  constructor(userPhone: string, private userId: string, cache: SmartGroupCache) {
    this.phoneMatcher = new PhoneMatcher(userPhone);
    this.cache = cache;
  }

  processGroup(group: any): { isAdminGroup: boolean; groupData?: any; skipReason?: string; fromCache?: boolean } {
    this.stats.groupsProcessed++;
    
    const groupName = group.name || group.subject || `Group ${group.id}`;
    
    // 🧠 SMART: Check cache first
    if (this.cache.isKnownMemberOnly(group.id)) {
      this.stats.groupsSkippedCache++;
      return { 
        isAdminGroup: false, 
        skipReason: 'known_member_only',
        fromCache: true 
      };
    }

    if (this.cache.isKnownAdmin(group.id)) {
      this.stats.groupsSkippedCache++;
      return { 
        isAdminGroup: true, 
        groupData: this.cache.getAllAdminGroups().find(g => g.group_id === group.id),
        fromCache: true 
      };
    }

    // 🚀 SKIP: If no participants loaded
    if (!group.participants || !Array.isArray(group.participants) || group.participants.length === 0) {
      this.stats.groupsSkippedNoParticipants++;
      console.log(`⚠️ ${groupName} - No participants data (will try individual fetch later)`);
      return { 
        isAdminGroup: false, 
        skipReason: 'no_participants_loaded'
      };
    }

    this.stats.totalParticipantsChecked += group.participants.length;

    // 🚀 FAST: User lookup
    const userParticipant = group.participants.find(participant => {
      const participantId = participant.id || participant.phone || participant.number;
      return this.phoneMatcher.isMatch(participantId);
    });

    // 🚀 NOT MEMBER: Cache this info
    if (!userParticipant) {
      this.stats.groupsSkippedNotMember++;
      this.cache.markAsMemberOnly(group.id);
      return { 
        isAdminGroup: false, 
        skipReason: 'not_member'
      };
    }

    // 🚀 ROLE CHECK
    const participantRank = userParticipant.rank || userParticipant.role || 'member';
    const normalizedRank = participantRank.toLowerCase();
    
    const isCreatorRole = normalizedRank === 'creator' || normalizedRank === 'owner';
    const isAdminRole = normalizedRank === 'admin' || normalizedRank === 'administrator' || isCreatorRole;

    if (!isAdminRole) {
      console.log(`👤 ${groupName} - User is MEMBER only`);
      this.cache.markAsMemberOnly(group.id);
      return { 
        isAdminGroup: false, 
        skipReason: 'member_only'
      };
    }

    // 🎉 Found admin/creator group!
    if (isCreatorRole) {
      this.stats.creatorGroupsFound++;
      console.log(`👑 ${groupName} - User is CREATOR (${group.participants.length} members)`);
    } else {
      this.stats.adminGroupsFound++;
      console.log(`⭐ ${groupName} - User is ADMIN (${group.participants.length} members)`);
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

    // 🧠 CACHE: Store this admin group
    this.cache.addAdminGroup(groupData);

    return {
      isAdminGroup: true,
      groupData
    };
  }

  getStats() {
    return {
      ...this.stats,
      efficiency: {
        cacheHitRate: this.stats.groupsSkippedCache > 0 ? 
          ((this.stats.groupsSkippedCache / this.stats.groupsProcessed) * 100).toFixed(1) + '%' : '0%',
        adminFindRate: ((this.stats.adminGroupsFound + this.stats.creatorGroupsFound) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        participantsPerGroup: Math.round(this.stats.totalParticipantsChecked / Math.max(this.stats.groupsProcessed, 1))
      }
    };
  }
}

// 🚀 MAIN: Background deep sync function
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 BACKGROUND DEEP SYNC: Comprehensive groups discovery...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: DeepSyncRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Starting BACKGROUND DEEP SYNC for user:', userId)

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

    // Get/ensure phone number
    let userPhoneNumber = profile.phone_number
    if (!userPhoneNumber) {
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

    // 🧠 SMART: Initialize cache
    const cache = new SmartGroupCache(supabase, userId);
    await cache.loadCache();

    const groupProcessor = new AggressiveGroupProcessor(userPhoneNumber, userId, cache);
    console.log('🧠 Smart cached processor initialized')

    // 🚀 AGGRESSIVE DEEP SYNC STRATEGY
    console.log('\n🔄 === BACKGROUND DEEP SYNC (Comprehensive Discovery) ===')
    
    const syncStartTime = Date.now();
    let totalApiCalls = 0;
    let totalGroupsScanned = 0;
    let hasApiErrors = false;
    const adminGroups: any[] = [];
    const groupsNeedingIndividualFetch: any[] = [];

    // 🎯 AGGRESSIVE SETTINGS - Following WHAPI's "30-60s delay is acceptable"
    const BATCH_SIZE = 50;        // Back to 50 - we can handle it now
    const MAX_CALLS = 20;         // Much more aggressive - up to 1000 groups!
    const BASE_DELAY = 4000;      // 4 second base delay
    const ADAPTIVE_DELAY = 2000;  // Additional delay based on load
    
    let currentOffset = 0;
    let hasMoreGroups = true;
    let consecutiveEmptyResponses = 0;
    let adaptiveDelayMultiplier = 1;

    while (hasMoreGroups && totalApiCalls < MAX_CALLS && consecutiveEmptyResponses < 3) {
      totalApiCalls++;
      
      // 🎯 ADAPTIVE DELAY: Increase delay if we're finding lots of groups
      const currentDelay = BASE_DELAY + (ADAPTIVE_DELAY * adaptiveDelayMultiplier);
      
      console.log(`📊 DEEP API call ${totalApiCalls}/${MAX_CALLS}: Fetching groups ${currentOffset}-${currentOffset + BATCH_SIZE}`);
      
      try {
        // Progressive delay - longer waits as we go deeper
        if (totalApiCalls > 1) {
          console.log(`⏳ Adaptive wait: ${currentDelay/1000}s (multiplier: ${adaptiveDelayMultiplier})`);
          await delay(currentDelay);
        }

        const groupsResponse = await fetch(
          `https://gate.whapi.cloud/groups?count=${BATCH_SIZE}&offset=${currentOffset}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${profile.whapi_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!groupsResponse.ok) {
          console.error(`❌ Groups API failed (call ${totalApiCalls}):`, groupsResponse.status);
          hasApiErrors = true;
          
          if (groupsResponse.status === 429) {
            console.log('🚫 Rate limited - increasing adaptive delay');
            adaptiveDelayMultiplier += 0.5; // Increase delay
            await delay(currentDelay * 2);
            continue;
          } else if (groupsResponse.status >= 500) {
            console.log('🔄 Server error - waiting and retrying...');
            await delay(currentDelay * 1.5);
            continue;
          } else {
            console.log('💥 Non-retryable error - stopping sync');
            break;
          }
        }

        const groupsData = await groupsResponse.json();
        const batchGroups = groupsData.groups || [];
        
        console.log(`📊 DEEP call ${totalApiCalls}: Received ${batchGroups.length} groups`);
        
        if (batchGroups.length === 0) {
          consecutiveEmptyResponses++;
          console.log(`📊 Empty response ${consecutiveEmptyResponses}/3 - approaching end`);
        } else {
          consecutiveEmptyResponses = 0;
          totalGroupsScanned += batchGroups.length;
          
          let newAdminGroupsInBatch = 0;
          
          // Process each group 
          for (const group of batchGroups) {
            const result = groupProcessor.processGroup(group);
            
            if (result.isAdminGroup && result.groupData && !result.fromCache) {
              adminGroups.push(result.groupData);
              newAdminGroupsInBatch++;
            } else if (result.isAdminGroup && result.fromCache) {
              adminGroups.push(result.groupData);
            } else if (result.skipReason === 'no_participants_loaded') {
              groupsNeedingIndividualFetch.push({
                id: group.id,
                name: group.name || group.subject || `Group ${group.id}`
              });
            }
          }
          
          // 🎯 ADAPTIVE: If finding lots of admin groups, slow down to be more thorough
          if (newAdminGroupsInBatch >= 3) {
            adaptiveDelayMultiplier += 0.3;
            console.log(`🎯 Found ${newAdminGroupsInBatch} admin groups in batch - slowing down for thoroughness`);
          }
          
          currentOffset += batchGroups.length;
          
          if (batchGroups.length < BATCH_SIZE) {
            hasMoreGroups = false;
          }
        }

        // 🎯 PROGRESS UPDATE
        const currentAdminCount = adminGroups.length;
        const elapsedTime = Math.round((Date.now() - syncStartTime) / 1000);
        console.log(`🎯 Progress: ${currentAdminCount} admin groups found, ${totalGroupsScanned} groups scanned, ${elapsedTime}s elapsed`);

      } catch (batchError) {
        console.error(`❌ Critical API Error in call ${totalApiCalls}:`, batchError);
        hasApiErrors = true;
        
        // Increase delay and continue
        adaptiveDelayMultiplier += 0.5;
        await delay(currentDelay * 2);
        continue;
      }
    }

    // 🔍 STEP 2: Individual fetch for groups without participant data (limited)
    console.log(`\n🔍 Processing ${groupsNeedingIndividualFetch.length} groups needing individual fetch`);
    
    if (groupsNeedingIndividualFetch.length > 0) {
      const maxIndividualFetches = Math.min(groupsNeedingIndividualFetch.length, 15);
      
      for (let i = 0; i < maxIndividualFetches; i++) {
        const group = groupsNeedingIndividualFetch[i];
        totalApiCalls++;
        
        try {
          await delay(3000); // 3 second delay for individual calls
          
          console.log(`🔍 Individual fetch ${i+1}/${maxIndividualFetches}: ${group.name}`);
          
          const groupDetailResponse = await fetch(
            `https://gate.whapi.cloud/groups/${group.id}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${profile.whapi_token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (groupDetailResponse.ok) {
            const groupDetail = await groupDetailResponse.json();
            const result = groupProcessor.processGroup(groupDetail);
            
            if (result.isAdminGroup && result.groupData) {
              adminGroups.push(result.groupData);
              console.log(`✅ Individual fetch found admin role in: ${group.name}`);
            }
          }
          
        } catch (fetchError) {
          console.error(`❌ Individual fetch error for ${group.name}:`, fetchError);
        }
      }
    }

    // 🧠 SAVE CACHE
    await cache.saveCache();

    const newGroupsCount = adminGroups.length;
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = groupProcessor.getStats();
    const cacheStats = cache.getStats();

    console.log(`\n🎯 BACKGROUND DEEP SYNC COMPLETE!`);
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`);
    console.log(`📊 Individual fetches: ${groupsNeedingIndividualFetch.length > 15 ? '15' : groupsNeedingIndividualFetch.length}`);
    console.log(`📊 API calls made: ${totalApiCalls}`);
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`);
    console.log(`🆕 Admin groups found: ${newGroupsCount}`);
    console.log(`🧠 Cache efficiency: ${processingStats.efficiency.cacheHitRate}`);

    // Update database
    if (newGroupsCount > 0) {
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId);
      
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(adminGroups);

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save groups to database', details: insertError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    const adminCount = adminGroups.filter(g => !g.is_creator).length;
    const creatorCount = adminGroups.filter(g => g.is_creator).length;
    const totalMemberCount = adminGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        deep_sync: true,
        groups_count: newGroupsCount,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        total_api_calls: totalApiCalls,
        total_groups_scanned: totalGroupsScanned,
        individual_fetches: Math.min(groupsNeedingIndividualFetch.length, 15),
        sync_time_seconds: totalSyncTime,
        sync_time_minutes: Math.round(totalSyncTime / 60 * 10) / 10,
        processing_stats: processingStats,
        cache_stats: cacheStats,
        adaptive_delay_used: adaptiveDelayMultiplier > 1,
        message: `🎉 Deep sync found ${newGroupsCount} admin groups! (${creatorCount} as creator, ${adminCount} as admin)`,
        coverage_note: totalApiCalls >= MAX_CALLS ? `Scanned ${totalGroupsScanned} groups. Run again to scan more.` : 'Complete scan finished.',
        managed_groups: adminGroups.map(g => ({
          name: g.name,
          members: g.participants_count,
          id: g.group_id,
          role: g.is_creator ? 'creator' : 'admin'
        }))
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Background Deep Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Deep sync failed', 
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})