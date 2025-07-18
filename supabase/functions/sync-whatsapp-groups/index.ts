import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// 🚀 FIXED: LID-Compatible Phone Matcher
class ModernPhoneMatcher {
  private userPhoneClean: string;
  private userPhoneVariants: string[];

  constructor(userPhone: string) {
    this.userPhoneClean = userPhone.replace(/[^\d]/g, '');
    
    // Pre-compute all possible variants
    this.userPhoneVariants = [
      this.userPhoneClean,
      // Israeli format variations
      this.userPhoneClean.startsWith('972') ? '0' + this.userPhoneClean.substring(3) : null,
      this.userPhoneClean.startsWith('0') ? '972' + this.userPhoneClean.substring(1) : null,
      // Last 9 digits for Israeli numbers
      this.userPhoneClean.slice(-9),
      // Last 10 digits for international
      this.userPhoneClean.slice(-10),
    ].filter(Boolean) as string[];
    
    console.log(`📱 Modern phone matcher initialized for: ${userPhone}`);
    console.log(`🔍 Will match variants: ${this.userPhoneVariants.join(', ')}`);
  }

  isMatch(participantId: string): boolean {
    if (!participantId) return false;
    
    // 🚀 HANDLE LID FORMAT: Remove @lid suffix
    const cleanId = participantId.replace(/@lid$/, '').replace(/[^\d]/g, '');
    
    // Skip obviously non-phone LIDs (too long or too short)
    if (cleanId.length < 9 || cleanId.length > 15) {
      return false;
    }
    
    // Fast exact match
    if (this.userPhoneVariants.includes(cleanId)) {
      console.log(`✅ PHONE MATCH: ${participantId} → ${cleanId}`);
      return true;
    }
    
    // Check last 9 digits for Israeli numbers
    if (cleanId.length >= 9) {
      const lastNine = cleanId.slice(-9);
      const isMatch = this.userPhoneVariants.some(variant => 
        variant.length >= 9 && variant.slice(-9) === lastNine
      );
      
      if (isMatch) {
        console.log(`✅ PARTIAL MATCH (last 9): ${participantId} → ${lastNine}`);
      }
      
      return isMatch;
    }
    
    return false;
  }
}

// 🚀 MODERN: Use WHAPI's Built-in Admin Detection
class ModernGroupProcessor {
  private phoneMatcher: ModernPhoneMatcher;
  private stats = {
    groupsProcessed: 0,
    adminGroupsFound: 0,
    creatorGroupsFound: 0,
    lidParticipants: 0,
    phoneParticipants: 0
  };

  constructor(userPhone: string, private userId: string) {
    this.phoneMatcher = new ModernPhoneMatcher(userPhone);
  }

  // 🚀 NEW: Process group using WHAPI's admin detection
  async processGroupWithAdminAPI(group: any, whapiToken: string): Promise<{ isAdminGroup: boolean; groupData?: any; skipReason?: string }> {
    this.stats.groupsProcessed++;
    
    const groupName = group.name || group.subject || `Group ${group.id}`;
    console.log(`🔍 Processing: ${groupName}`);

    // Method 1: Check if WHAPI already provides admin info
    if (group.admin !== undefined || group.is_admin !== undefined) {
      const isAdmin = group.admin === true || group.is_admin === true;
      console.log(`📊 WHAPI Admin Info: ${isAdmin} for ${groupName}`);
      
      if (isAdmin) {
        return this.createGroupData(group, true, false);
      }
    }

    // Method 2: Use participants array if available
    if (group.participants && Array.isArray(group.participants)) {
      console.log(`👥 Group has ${group.participants.length} participants`);
      
      let lidCount = 0;
      let phoneCount = 0;
      
      for (const participant of group.participants) {
        const participantId = participant.id || participant.phone || participant.number;
        
        if (participantId?.includes('@lid')) {
          lidCount++;
        } else {
          phoneCount++;
        }
        
        // Check if this participant is the user
        if (this.phoneMatcher.isMatch(participantId)) {
          const role = participant.rank || participant.role || 'member';
          const isAdmin = ['admin', 'administrator', 'creator', 'owner'].includes(role.toLowerCase());
          const isCreator = ['creator', 'owner'].includes(role.toLowerCase());
          
          console.log(`✅ Found user in ${groupName} with role: ${role}`);
          
          if (isAdmin) {
            return this.createGroupData(group, isAdmin, isCreator);
          } else {
            return { isAdminGroup: false, skipReason: 'member_only' };
          }
        }
      }
      
      this.stats.lidParticipants += lidCount;
      this.stats.phoneParticipants += phoneCount;
      
      console.log(`📊 ${groupName}: ${lidCount} LIDs, ${phoneCount} phones`);
      
      // If no user found in participants, skip
      return { isAdminGroup: false, skipReason: 'user_not_found' };
    }

    // Method 3: Fallback - get detailed group info
    try {
      console.log(`🔍 Getting detailed info for ${groupName}...`);
      
      const groupResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (groupResponse.ok) {
        const detailedGroup = await groupResponse.json();
        console.log(`📊 Detailed group data received for ${groupName}`);
        
        // Recursively process with detailed data
        return this.processGroupWithAdminAPI(detailedGroup, whapiToken);
      } else {
        console.log(`⚠️ Failed to get detailed group info: ${groupResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️ Error getting group details: ${error.message}`);
    }

    return { isAdminGroup: false, skipReason: 'no_detailed_info' };
  }

  private createGroupData(group: any, isAdmin: boolean, isCreator: boolean) {
    if (isCreator) {
      this.stats.creatorGroupsFound++;
    } else {
      this.stats.adminGroupsFound++;
    }

    const participantsCount = group.participants?.length || group.size || 0;
    const groupName = group.name || group.subject || `Group ${group.id}`;

    return {
      isAdminGroup: true,
      groupData: {
        user_id: this.userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: true,
        is_creator: isCreator,
        avatar_url: group.chat_pic || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  }

  getStats() {
    return {
      ...this.stats,
      efficiency: {
        adminFindRate: ((this.stats.adminGroupsFound + this.stats.creatorGroupsFound) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        lidRatio: `${this.stats.lidParticipants}/${this.stats.phoneParticipants + this.stats.lidParticipants} participants use LIDs`
      }
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 MODERN GROUP SYNC: LID-Compatible System Starting...')
    
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

    console.log('👤 Starting modern sync for user:', userId)

    // Get user's WHAPI credentials and phone
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

    // Ensure we have user's phone number
    let userPhoneNumber = profile.phone_number;

    if (!userPhoneNumber) {
      console.log('📱 Getting user phone from health endpoint...');
      
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
          userPhoneNumber = healthData?.user?.id?.replace(/[^\d]/g, '');
          
          if (userPhoneNumber) {
            await supabase
              .from('profiles')
              .update({
                phone_number: userPhoneNumber,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId);
            
            console.log('📱 Phone retrieved and saved:', userPhoneNumber);
          }
        }
      } catch (healthError) {
        console.error('❌ Error calling health endpoint:', healthError);
      }
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine user phone number',
          suggestion: 'Please check connection status first'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Initialize modern group processor
    const groupProcessor = new ModernGroupProcessor(userPhoneNumber, userId);
    console.log('🚀 Modern group processor initialized');

    // 🚀 OPTIMIZED: Single-pass strategy with better endpoints
    let allFoundGroups: any[] = [];
    let totalApiCalls = 0;
    let totalGroupsScanned = 0;
    const syncStartTime = Date.now();

    console.log('🔄 Starting optimized group fetch...');

    // Strategy: Fetch groups in larger batches with detailed participant info
    let currentOffset = 0;
    let hasMoreGroups = true;
    const batchSize = 100; // Reasonable batch size
    const maxApiCalls = 10; // Reasonable limit

    while (hasMoreGroups && totalApiCalls < maxApiCalls) {
      totalApiCalls++;
      
      console.log(`📊 API call ${totalApiCalls}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`);
      
      try {
        // 🚀 USE MODERN ENDPOINT: Get groups with participant details
        const groupsResponse = await fetch(
          `https://gate.whapi.cloud/groups?count=${batchSize}&offset=${currentOffset}&participants=true`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${profile.whapi_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!groupsResponse.ok) {
          console.error(`❌ Groups API failed:`, groupsResponse.status);
          if (groupsResponse.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          } else {
            break;
          }
        }

        const groupsData = await groupsResponse.json();
        const batchGroups = groupsData.groups || [];
        
        console.log(`📊 Received ${batchGroups.length} groups in batch ${totalApiCalls}`);
        
        if (batchGroups.length === 0) {
          hasMoreGroups = false;
          break;
        }

        totalGroupsScanned += batchGroups.length;

        // Process each group with modern LID-compatible logic
        for (const group of batchGroups) {
          try {
            const result = await groupProcessor.processGroupWithAdminAPI(group, profile.whapi_token);
            
            if (result.isAdminGroup && result.groupData) {
              allFoundGroups.push(result.groupData);
              const role = result.groupData.is_creator ? 'CREATOR' : 'ADMIN';
              console.log(`✅ FOUND: ${result.groupData.name} (${result.groupData.participants_count} members) - ${role}`);
            }
          } catch (processError) {
            console.log(`⚠️ Error processing group ${group.id}:`, processError.message);
          }
        }

        currentOffset += batchSize;
        
        if (batchGroups.length < batchSize) {
          hasMoreGroups = false;
        }

        // Rate limiting
        if (totalApiCalls < maxApiCalls && hasMoreGroups) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (apiError) {
        console.error(`❌ API Error:`, apiError.message);
        break;
      }
    }

    const newGroupsCount = allFoundGroups.length;
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = groupProcessor.getStats();

    console.log(`\n🎯 MODERN SYNC COMPLETE!`);
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`);
    console.log(`📊 API calls made: ${totalApiCalls}`);
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`);
    console.log(`🆕 Admin groups found: ${newGroupsCount}`);
    console.log(`🚀 Processing stats:`, processingStats);

    // Save results to database
    if (newGroupsCount > 0) {
      console.log(`✅ Saving ${newGroupsCount} admin groups to database`);
      
      // Clear existing groups and insert new ones
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId);
      
      const dbBatchSize = 50;
      for (let i = 0; i < allFoundGroups.length; i += dbBatchSize) {
        const batch = allFoundGroups.slice(i, i + dbBatchSize);
        
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(batch);

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save groups to database' }),
            { status: 500, headers: corsHeaders }
          );
        }
        
        if (i + dbBatchSize < allFoundGroups.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    const adminCount = allFoundGroups.filter(g => !g.is_creator).length;
    const creatorCount = allFoundGroups.filter(g => g.is_creator).length;
    const totalMemberCount = allFoundGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);

    const message = newGroupsCount > 0
      ? `נמצאו ${newGroupsCount} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות בניהולך';

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
        lid_compatible: true,
        modern_sync_enabled: true,
        message: message,
        managed_groups: allFoundGroups.map(g => ({
          name: g.name,
          members: g.participants_count,
          id: g.group_id,
          role: g.is_creator ? 'creator' : 'admin'
        })).slice(0, 20)
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Modern Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})