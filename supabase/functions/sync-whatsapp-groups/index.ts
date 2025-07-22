import { createClient } from 'jsr:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Helper function to add delays between requests
function delay(ms) {
  return new Promise((resolve)=>setTimeout(resolve, ms));
}
// 🚀 OPTIMIZED: Enhanced phone matching with caching, Israel-specific
class PhoneMatcher {
  userPhoneClean;
  userPhoneVariants;
  constructor(userPhone){
    this.userPhoneClean = userPhone.replace(/[^\d]/g, '');
    // Israel-specific variants: '972'/'0' swaps, international +, last 9-10 digits
    this.userPhoneVariants = [
      this.userPhoneClean,
      this.userPhoneClean.startsWith('972') ? '0' + this.userPhoneClean.substring(3) : null,
      this.userPhoneClean.startsWith('0') ? '972' + this.userPhoneClean.substring(1) : null,
      '+' + this.userPhoneClean,
      this.userPhoneClean.slice(-10), // IL numbers often 10 digits
      this.userPhoneClean.slice(-9)
    ].filter(Boolean);
    console.log(`📱 Phone matcher initialized for IL: ${userPhone}`);
    console.log(`🔍 Variants: ${this.userPhoneVariants.join(', ')}`);
  }
  isMatch(participantId) {
    if (!participantId) return false;
    const cleanParticipant = String(participantId).replace(/[^\d]/g, '');
    // Exact match
    if (this.userPhoneVariants.includes(cleanParticipant)) {
      return true;
    }
    // Fuzzy: includes or substring for partial matches
    if (this.userPhoneVariants.some(v => cleanParticipant.includes(v) || v.includes(cleanParticipant))) {
      return true;
    }
    // Last 9-10 digits match
    if (cleanParticipant.length >= 9) {
      const lastTen = cleanParticipant.slice(-10);
      const lastNine = cleanParticipant.slice(-9);
      return this.userPhoneVariants.some(v => v.endsWith(lastTen) || v.endsWith(lastNine));
    }
    return false;
  }
}
// 🔧 FIXED: Smart Group Cache with Time-Based Expiration
class SmartGroupCache {
  processedGroups = new Map(); // groupId -> { status, timestamp, retryCount, groupData }
  CACHE_TTL = 5 * 60 * 1000; // 5 minutes expiration
  RETRY_INTERVAL = 2 * 60 * 1000; // 2 minutes for no-participants retry

  isAlreadyProcessed(groupId) {
    const cached = this.processedGroups.get(groupId);
    if (!cached) return false;
    
    const now = Date.now();
    const isExpired = (now - cached.timestamp) > this.CACHE_TTL;
    
    // 🔧 FIXED: Clear expired cache
    if (isExpired) {
      console.log(`🔄 Cache expired for group ${groupId}, will reprocess`);
      this.processedGroups.delete(groupId);
      return false;
    }
    
    return true;
  }

  isMemberOnly(groupId) {
    const cached = this.processedGroups.get(groupId);
    return cached?.status === 'member_only';
  }

  isAdminGroup(groupId) {
    const cached = this.processedGroups.get(groupId);
    return cached?.status === 'admin' && cached.groupData;
  }

  markAsProcessed(groupId, result) {
    const now = Date.now();
    let status = 'processed';
    let retryCount = 0;
    
    if (result.isAdminGroup && result.groupData) {
      status = 'admin';
    } else if (result.skipReason === 'member_only') {
      status = 'member_only';
    } else if (result.skipReason === 'no_participants_loaded') {
      status = 'no_participants';
      const existing = this.processedGroups.get(groupId);
      retryCount = (existing?.retryCount || 0) + 1;
    } else {
      status = 'not_member';
    }
    
    this.processedGroups.set(groupId, {
      status,
      timestamp: now,
      retryCount,
      groupData: result.groupData || null
    });
    
    console.log(`💾 Cached group ${groupId} as ${status} (expires in ${this.CACHE_TTL/1000/60}min)`);
  }

  shouldRecheck(groupId) {
    const cached = this.processedGroups.get(groupId);
    if (!cached) return false;
    
    const now = Date.now();
    
    // 🔧 FIXED: Recheck no-participants groups after shorter interval
    if (cached.status === 'no_participants') {
      const shouldRecheck = (now - cached.timestamp) > this.RETRY_INTERVAL && cached.retryCount < 3;
      if (shouldRecheck) {
        console.log(`🔄 Rechecking no-participants group ${groupId} (attempt ${cached.retryCount + 1}/3)`);
      }
      return shouldRecheck;
    }
    
    return false;
  }

  getAllAdminGroups() {
    const adminGroups = [];
    for (const [groupId, cached] of this.processedGroups.entries()) {
      if (cached.status === 'admin' && cached.groupData) {
        adminGroups.push(cached.groupData);
      }
    }
    return adminGroups;
  }

  // 🆕 NEW: Method to clear specific group cache (useful for debugging)
  clearGroupCache(groupId) {
    this.processedGroups.delete(groupId);
    console.log(`🧹 Manually cleared cache for group ${groupId}`);
  }

  // 🆕 NEW: Method to force refresh all cache
  clearAllCache() {
    this.processedGroups.clear();
    console.log(`🧹 Cleared all group cache`);
  }

  getStats() {
    const stats = { 
      totalCached: this.processedGroups.size,
      adminGroups: 0,
      memberOnlyGroups: 0,
      noParticipantsGroups: 0,
      notMemberGroups: 0,
      expiredEntries: 0
    };
    
    const now = Date.now();
    
    for (const cached of this.processedGroups.values()) {
      // Check if expired
      if ((now - cached.timestamp) > this.CACHE_TTL) {
        stats.expiredEntries++;
      }
      
      switch (cached.status) {
        case 'admin': stats.adminGroups++; break;
        case 'member_only': stats.memberOnlyGroups++; break;
        case 'no_participants': stats.noParticipantsGroups++; break;
        case 'not_member': stats.notMemberGroups++; break;
      }
    }
    
    return {
      ...stats,
      cacheHitRate: stats.totalCached > 0 ? 
        (((stats.adminGroups + stats.memberOnlyGroups) / stats.totalCached) * 100).toFixed(1) + '%' : '0%',
      activeEntries: stats.totalCached - stats.expiredEntries,
      expirationInfo: `${stats.expiredEntries} entries will be rechecked next sync`
    };
  }
}
// 🚀 OPTIMIZED: Smart group processor with caching and WHAPI enhancements
class OptimizedGroupProcessor {
  userId;
  phoneMatcher;
  cache;
  stats;
  whapiToken;
  constructor(userPhone, userId, whapiToken){
    this.userId = userId;
    this.whapiToken = whapiToken;
    this.stats = {
      groupsProcessed: 0,
      groupsSkippedNoParticipants: 0,
      groupsSkippedNotMember: 0,
      adminGroupsFound: 0,
      creatorGroupsFound: 0,
      totalParticipantsChecked: 0,
      singleGroupFetches: 0
    };
    this.phoneMatcher = new PhoneMatcher(userPhone);
    this.cache = new SmartGroupCache();
  }
  async processGroup(group) {
    this.stats.groupsProcessed++;
    const groupName = group.name || group.subject || `Group ${group.id}`;
    // 🧠 SMART: Check cache first
    if (this.cache.isAlreadyProcessed(group.id)) {
      if (this.cache.isAdminGroup(group.id)) {
        console.log(`💾 Cache HIT: ${groupName} - known admin`);
        return {
          isAdminGroup: true,
          groupData: this.cache.adminGroups.get(group.id),
          fromCache: true
        };
      } else if (this.cache.isMemberOnly(group.id)) {
        console.log(`💾 Cache HIT: ${groupName} - member-only (skip)`);
        return {
          isAdminGroup: false,
          skipReason: 'member_only_cached',
          fromCache: true
        };
      } else if (!this.cache.shouldRecheck(group.id)) {
        console.log(`💾 Cache HIT: ${groupName} - processed (skip)`);
        return {
          isAdminGroup: false,
          skipReason: 'already_processed',
          fromCache: true
        };
      } else {
        console.log(`🔄 Cache RECHECK: ${groupName} - retry ${this.cache.noParticipantsGroups.get(group.id) || 1}/3`);
      }
    }
    // 🚀 Early skip or fetch details if no participants
    let participants = group.participants || [];
    if (!Array.isArray(participants) || participants.length === 0) {
      this.stats.groupsSkippedNoParticipants++;
      // Fetch single group details for better participant loading
      participants = await this.fetchSingleGroupParticipants(group.id);
      if (participants.length === 0) {
        const result = { isAdminGroup: false, skipReason: 'no_participants_loaded' };
        this.cache.markAsProcessed(group.id, result);
        return result;
      }
    }
    this.stats.totalParticipantsChecked += participants.length;
    // Fast user lookup
    const userParticipant = participants.find((p) => {
      // Handle WHAPI 2025 'lid' and other IDs
      const ids = [p.id, p.lid, p.phone, p.number, p.wid?.user, p.wid?._serialized?.split('@')[0], p.contact?.id, p.contact?.phone].filter(Boolean);
      return ids.some(id => this.phoneMatcher.isMatch(id));
    });
    // Early exit if not member
    if (!userParticipant) {
      this.stats.groupsSkippedNotMember++;
      const result = { isAdminGroup: false, skipReason: 'not_member' };
      this.cache.markAsProcessed(group.id, result);
      return result;
    }
    // Quick role check - broadened for WHAPI variations
    const possibleRoles = [userParticipant.rank, userParticipant.role, userParticipant.type, userParticipant.admin, userParticipant.isAdmin, userParticipant.permissions, userParticipant.status].filter(Boolean);
    let normalizedRank = 'member';
    let isCreatorRole = false;
    let isAdminRole = false;
    for (const role of possibleRoles) {
      if (typeof role === 'boolean' && role) {
        isAdminRole = true;
        break;
      }
      normalizedRank = String(role).toLowerCase();
      isCreatorRole = /creator|owner/i.test(normalizedRank);
      isAdminRole = /admin|administrator|mod|superadmin/i.test(normalizedRank) || isCreatorRole;
      if (isAdminRole) break;
    }
    if (!isAdminRole) {
      console.log(`👤 MEMBER role in ${groupName} (skip)`);
      const result = { isAdminGroup: false, skipReason: 'member_only' };
      this.cache.markAsProcessed(group.id, result);
      return result;
    }
    // Found admin/creator!
    if (isCreatorRole) {
      this.stats.creatorGroupsFound++;
      console.log(`👑 CREATOR in ${groupName}`);
    } else {
      this.stats.adminGroupsFound++;
      console.log(`⭐ ADMIN in ${groupName}`);
    }
    const participantsCount = participants.length || group.size || 0;
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
    const result = { isAdminGroup: true, groupData };
    this.cache.markAsProcessed(group.id, result);
    return result;
  }
  async fetchSingleGroupParticipants(groupId) {
    this.stats.singleGroupFetches++;
    console.log(`🔍 Fetching details for group ${groupId}`);
    try {
      await delay(2000); // Delay to give WHAPI time
      const response = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.whapiToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        console.error(`❌ Single group fetch failed: ${response.status}`);
        return [];
      }
      const data = await response.json();
      return data.participants || [];
    } catch (error) {
      console.error(`❌ Single fetch error: ${error}`);
      return [];
    }
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
  getAllCachedAdminGroups() {
    return this.cache.getAllAdminGroups();
  }
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log('🚀 OPTIMIZED SAFE SYNC: Maximum speed + data protection...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'User ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    console.log('👤 Starting OPTIMIZED sync for user:', userId);
    // 🛡️ STEP 1: Get existing groups for safety
    const { data: existingGroups, error: existingError } = await supabase.from('whatsapp_groups').select('*').eq('user_id', userId);
    const existingCount = existingGroups?.length || 0;
    console.log(`🔍 Existing groups in database: ${existingCount}`);
    // Get user's WHAPI credentials
    const { data: profile, error: profileError } = await supabase.from('profiles').select('instance_id, whapi_token, instance_status, phone_number').eq('id', userId).single();
    if (profileError || !profile?.whapi_token) {
      return new Response(JSON.stringify({
        error: 'WhatsApp instance not found or not connected'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    if (profile.instance_status !== 'connected') {
      return new Response(JSON.stringify({
        error: 'WhatsApp instance is not connected'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Get/update phone number
    let userPhoneNumber = profile.phone_number;
    if (!userPhoneNumber) {
      console.log('📱 Fetching phone from /health...');
      try {
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        });
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (healthData?.user?.id) {
            userPhoneNumber = healthData.user.id.replace(/[^\d]/g, '');
            await supabase.from('profiles').update({
              phone_number: userPhoneNumber,
              updated_at: new Date().toISOString()
            }).eq('id', userId);
            console.log('📱 Phone retrieved and saved:', userPhoneNumber);
          }
        }
      } catch (healthError) {
        console.error('❌ Error calling /health:', healthError);
      }
    }
    if (!userPhoneNumber) {
      return new Response(JSON.stringify({
        error: 'Could not determine your phone number',
        suggestion: 'Please check connection status first'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // 🚀 STEP 2: Initialize optimized processor
    const groupProcessor = new OptimizedGroupProcessor(userPhoneNumber, userId, profile.whapi_token);
    console.log('🚀 Optimized group processor initialized');
    // 🚀 AGGRESSIVE 4-PASS STRATEGY - Push WHAPI harder!
    const passConfig = [
      {
        pass: 1,
        delay: 0,
        batchSize: 100,
        description: "Fast discovery",
        maxCalls: 10 // Increased for more coverage
      },
      {
        pass: 2,
        delay: 15000,
        batchSize: 150,
        description: "Deep scan",
        maxCalls: 10
      },
      {
        pass: 3,
        delay: 30000,
        batchSize: 200,
        description: "Aggressive scan",
        maxCalls: 10
      },
      {
        pass: 4,
        delay: 45000,
        batchSize: 250,
        description: "Final deep dive",
        maxCalls: 10
      }
    ];
    let allFoundGroups = new Map();
    let totalApiCalls = 0;
    let hasApiErrors = false;
    let totalGroupsScanned = 0;
    const syncStartTime = Date.now();
    for (const config of passConfig){
      if (config.delay > 0) {
        console.log(`⏳ Waiting ${config.delay / 1000}s before pass ${config.pass}...`);
        await delay(config.delay);
      }
      console.log(`\n🔄 === OPTIMIZED PASS ${config.pass}/4 === (${config.description})`);
      let passFoundGroups = 0;
      let allGroups = [];
      let currentOffset = 0;
      let hasMoreGroups = true;
      let passApiCalls = 0;
      while(hasMoreGroups && passApiCalls < config.maxCalls){
        passApiCalls++;
        totalApiCalls++;
        console.log(`📊 Pass ${config.pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + config.batchSize}`);
        try {
          const apiDelay = 2200 + config.pass * 600; // 2.2s to 4.6s
          if (passApiCalls > 1) {
            await delay(apiDelay);
          }
          const groupsResponse = await fetch(`https://gate.whapi.cloud/groups?count=${config.batchSize}&offset=${currentOffset}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${profile.whapi_token}`,
              'Content-Type': 'application/json'
            }
          });
          if (!groupsResponse.ok) {
            console.error(`❌ Groups API failed (pass ${config.pass}, call ${passApiCalls}):`, groupsResponse.status);
            hasApiErrors = true;
            if (groupsResponse.status === 429 || groupsResponse.status >= 500) {
              console.log(`🔄 Retryable error, waiting...`);
              await delay(apiDelay * 2);
              continue;
            } else {
              console.log(`💥 Non-retryable, stopping pass ${config.pass}`);
              break;
            }
          }
          const groupsData = await groupsResponse.json();
          const batchGroups = groupsData.groups || [];
          console.log(`📊 Pass ${config.pass}, batch ${passApiCalls}: Received ${batchGroups.length} groups`);
          if (batchGroups.length === 0) {
            console.log(`📊 Empty batch - checking further...`);
            if (passApiCalls < config.maxCalls - 1) {
              currentOffset += config.batchSize;
              continue;
            } else {
              hasMoreGroups = false;
            }
          } else {
            allGroups = allGroups.concat(batchGroups);
            totalGroupsScanned += batchGroups.length;
            currentOffset += config.batchSize;
            if (batchGroups.length < config.batchSize) {
              hasMoreGroups = false;
            }
          }
        } catch (batchError) {
          console.error(`❌ CRITICAL API Error in pass ${config.pass}:`, batchError);
          hasApiErrors = true;
          await delay(3000);
          continue;
        }
      }
      // 🧠 Process groups
      console.log(`🔍 Processing ${allGroups.length} groups...`);
      for (const group of allGroups){
        const result = await groupProcessor.processGroup(group);
        if (result.isAdminGroup && result.groupData && !result.fromCache) {
          allFoundGroups.set(group.id, result.groupData);
          passFoundGroups++;
          const role = result.groupData.is_creator ? 'CREATOR' : 'ADMIN';
          console.log(`✅ Pass ${config.pass}: ADDED ${result.groupData.name} (${result.groupData.participants_count} members) - ${role}`);
        } else if (result.isAdminGroup && result.fromCache) {
          allFoundGroups.set(group.id, result.groupData);
        }
      }
      // Add cached admins
      const cachedAdminGroups = groupProcessor.getAllCachedAdminGroups();
      for (const cachedGroup of cachedAdminGroups){
        if (!allFoundGroups.has(cachedGroup.group_id)) {
          allFoundGroups.set(cachedGroup.group_id, cachedGroup);
        }
      }
      const totalElapsedTime = Math.round((Date.now() - syncStartTime) / 1000);
      console.log(`🎯 Pass ${config.pass} completed: Found ${passFoundGroups} new admins (${totalElapsedTime}s)`);
      if (passFoundGroups === 0 && allFoundGroups.size > 0) {
        console.log(`🏁 Stopping after pass ${config.pass}: No new, have ${allFoundGroups.size}`);
        break;
      }
    }
    const newFoundGroups = Array.from(allFoundGroups.values());
    const newGroupsCount = newFoundGroups.length;
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = groupProcessor.getStats();
    console.log(`\n🎯 OPTIMIZED SYNC COMPLETE!`);
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`);
    console.log(`📊 API calls: ${totalApiCalls}`);
    console.log(`⚡ Sync time: ${totalSyncTime}s`);
    console.log(`🆕 Admin groups: ${newGroupsCount}`);
    console.log(`📁 Existing: ${existingCount}`);
    console.log(`🚀 Efficiency:`, processingStats.efficiency);
    // 🛡️ SAFETY LOGIC
    if (hasApiErrors && newGroupsCount === 0) {
      console.log('🛡️ SAFETY: API errors + 0 found - preserve existing');
      return new Response(JSON.stringify({
        success: false,
        error: 'API errors during sync',
        existing_groups_preserved: existingCount,
        processing_stats: processingStats,
        message: `Sync failed due to API errors. Keeping ${existingCount} existing groups safe.`,
        recommendation: 'Retry later when WHAPI stable'
      }), { status: 400, headers: corsHeaders });
    }
    if (existingCount > 0 && newGroupsCount < existingCount * 0.5) {
      console.log(`🛡️ SAFETY: Found ${newGroupsCount} < 50% of ${existingCount} - suspicious`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Fewer groups than expected',
        new_found: newGroupsCount,
        existing_preserved: existingCount,
        processing_stats: processingStats,
        message: `Found ${newGroupsCount} but had ${existingCount}. Keeping existing safe.`,
        recommendation: 'Temporary WHAPI issue? Retry later.'
      }), { status: 400, headers: corsHeaders });
    }
    // 🛡️ SAFE UPDATE
    if (newGroupsCount > 0 || existingCount === 0) {
      console.log(`✅ UPDATE: Found ${newGroupsCount}, replacing ${existingCount}`);
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId);
      if (newGroupsCount > 0) {
        const dbBatchSize = 100;
        for(let i = 0; i < newFoundGroups.length; i += dbBatchSize){
          const batch = newFoundGroups.slice(i, i + dbBatchSize);
          const { error: insertError } = await supabase.from('whatsapp_groups').insert(batch);
          if (insertError) {
            console.error('❌ Insert error:', insertError);
            return new Response(JSON.stringify({
              error: 'Failed to save groups',
              details: insertError.message
            }), { status: 500, headers: corsHeaders });
          }
          if (i + dbBatchSize < newFoundGroups.length) await delay(100);
        }
      }
      const adminCount = newFoundGroups.filter((g)=>!g.is_creator).length;
      const creatorCount = newFoundGroups.filter((g)=>g.is_creator).length;
      const totalMemberCount = newFoundGroups.reduce((sum, g)=>sum + (g.participants_count || 0), 0);
      const message = newGroupsCount > 0 ? `נמצאו ${newGroupsCount} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)` : 'לא נמצאו קבוצות בניהולך';
      return new Response(JSON.stringify({
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
        managed_groups: newFoundGroups.map((g)=>({
            name: g.name,
            members: g.participants_count,
            id: g.group_id,
            role: g.is_creator ? 'creator' : 'admin'
          })).slice(0, 20)
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
    // Preserve existing
    console.log(`🛡️ Preserving ${existingCount} existing groups`);
    return new Response(JSON.stringify({
      success: true,
      groups_count: existingCount,
      message: `לא נמצאו קבוצות חדשות. שומר על ${existingCount} הקבוצות הקיימות`,
      existing_groups_preserved: true,
      processing_stats: processingStats,
      recommendation: 'יתכן שזה בעיה זמנית של WHAPI. נסה שוב מאוחר יותר'
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('💥 Sync Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      safety_note: 'Existing groups preserved'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});