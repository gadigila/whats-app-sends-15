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

// 🚀 Enhanced phone matching with caching
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

// 🧠 Smart group processor with individual group details fetching
class DetailedGroupProcessor {
  private phoneMatcher: PhoneMatcher;
  private stats = {
    groupsProcessed: 0,
    groupsSkippedNoParticipants: 0,
    groupsSkippedNotMember: 0,
    adminGroupsFound: 0,
    creatorGroupsFound: 0,
    apiCallsMade: 0,
    rateLimitHits: 0
  };

  constructor(userPhone: string, private userId: string, private token: string) {
    this.phoneMatcher = new PhoneMatcher(userPhone);
  }

  // 🚀 Fetch detailed group info with participants
  async fetchGroupDetails(groupId: string): Promise<any> {
    this.stats.apiCallsMade++;
    
    try {
      const response = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          this.stats.rateLimitHits++;
          console.log(`⏳ Rate limit hit for group ${groupId}, waiting...`);
          await delay(5000); // Wait 5 seconds on rate limit
          return null;
        }
        console.log(`⚠️ Failed to fetch details for group ${groupId}: ${response.status}`);
        return null;
      }

      const groupDetails = await response.json();
      return groupDetails;
    } catch (error) {
      console.log(`❌ Error fetching group ${groupId}:`, error.message);
      return null;
    }
  }

  // 🔍 Process a single group to check admin status
  async processGroup(basicGroup: any): Promise<{ isAdminGroup: boolean; groupData?: any; skipReason?: string }> {
    this.stats.groupsProcessed++;
    
    const groupName = basicGroup.name || basicGroup.subject || `Group ${basicGroup.id}`;
    
    // Fetch detailed group info with participants
    const detailedGroup = await this.fetchGroupDetails(basicGroup.id);
    
    if (!detailedGroup) {
      return { 
        isAdminGroup: false, 
        skipReason: 'api_failed'
      };
    }
    
    // Check if group has participants
    if (!detailedGroup.participants || !Array.isArray(detailedGroup.participants) || detailedGroup.participants.length === 0) {
      this.stats.groupsSkippedNoParticipants++;
      return { 
        isAdminGroup: false, 
        skipReason: 'no_participants'
      };
    }

    // Find user in participants
    const userParticipant = detailedGroup.participants.find(participant => {
      const participantId = participant.id || participant.phone || participant.number;
      return this.phoneMatcher.isMatch(participantId);
    });

    if (!userParticipant) {
      this.stats.groupsSkippedNotMember++;
      return { 
        isAdminGroup: false, 
        skipReason: 'not_member'
      };
    }

    // Check admin/creator role
    const participantRank = userParticipant.rank || userParticipant.role || 'member';
    const normalizedRank = participantRank.toLowerCase();
    
    const isCreatorRole = normalizedRank === 'creator' || normalizedRank === 'owner';
    const isAdminRole = normalizedRank === 'admin' || normalizedRank === 'administrator' || isCreatorRole;

    if (!isAdminRole) {
      return { 
        isAdminGroup: false, 
        skipReason: 'member_only'
      };
    }

    // 🎉 Found admin/creator group!
    if (isCreatorRole) {
      this.stats.creatorGroupsFound++;
    } else {
      this.stats.adminGroupsFound++;
    }

    const participantsCount = detailedGroup.participants?.length || 0;

    const groupData = {
      user_id: this.userId,
      group_id: basicGroup.id,
      name: groupName,
      description: detailedGroup.description || null,
      participants_count: participantsCount,
      is_admin: true,
      is_creator: isCreatorRole,
      avatar_url: detailedGroup.chat_pic || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      isAdminGroup: true,
      groupData
    };
  }

  // 🚀 Process groups with proper rate limiting
  async processGroupsBatch(groups: any[]): Promise<Map<string, any>> {
    let foundAdminGroups = new Map<string, any>();
    
    console.log(`🔄 Processing ${groups.length} groups with individual detail fetching...`);
    
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      
      try {
        const result = await this.processGroup(group);
        
        if (result.isAdminGroup && result.groupData) {
          foundAdminGroups.set(group.id, result.groupData);
          const role = result.groupData.is_creator ? 'CREATOR' : 'ADMIN';
          console.log(`✅ FOUND ${result.groupData.name} (${result.groupData.participants_count} members) - ${role}`);
        }
        
        // Rate limiting: Wait between group detail calls
        if (i < groups.length - 1) {
          await delay(1500); // 1.5 second delay between individual group calls
        }
        
      } catch (error) {
        console.log(`❌ Error processing group ${group.id}:`, error.message);
      }
    }
    
    return foundAdminGroups;
  }

  getStats() {
    return {
      ...this.stats,
      efficiency: {
        adminFindRate: ((this.stats.adminGroupsFound + this.stats.creatorGroupsFound) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        skipRate: ((this.stats.groupsSkippedNoParticipants + this.stats.groupsSkippedNotMember) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        apiCallsPerGroup: (this.stats.apiCallsMade / Math.max(this.stats.groupsProcessed, 1)).toFixed(1),
        rateLimitHitRate: (this.stats.rateLimitHits / Math.max(this.stats.apiCallsMade, 1) * 100).toFixed(1) + '%'
      }
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 DETAILED SYNC: Fetching individual group participants for accurate admin detection')
    
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

    console.log('👤 Starting DETAILED sync for user:', userId)

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

    // Get phone number
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

    // Initialize detailed processor
    const groupProcessor = new DetailedGroupProcessor(userPhoneNumber, userId, profile.whapi_token);
    console.log('🚀 Detailed group processor initialized')

    const syncStartTime = Date.now();
    let allFoundGroups = new Map();
    let totalApiCalls = 0;
    let hasApiErrors = false;
    let totalGroupsScanned = 0;

    // 📡 STEP 1: Fetch basic groups list (faster, no rate limits)
    console.log('📡 Fetching basic groups list...')
    
    try {
      const groupsResponse = await fetch(
        `https://gate.whapi.cloud/groups?count=100`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!groupsResponse.ok) {
        console.error(`❌ Groups list API failed:`, groupsResponse.status)
        hasApiErrors = true
        
        if (groupsResponse.status === 503) {
          throw new Error('WHAPI service unavailable (503)')
        }
        
        throw new Error(`Groups API failed with status: ${groupsResponse.status}`)
      }

      const groupsData = await groupsResponse.json()
      const basicGroups = groupsData.groups || []
      totalApiCalls++
      
      console.log(`📊 Received ${basicGroups.length} basic groups`)
      totalGroupsScanned = basicGroups.length

      if (basicGroups.length === 0) {
        console.log('📭 No groups found in account')
        
        return new Response(
          JSON.stringify({
            success: true,
            groups_count: 0,
            message: 'לא נמצאו קבוצות בחשבון הוואטסאפ שלך',
            total_api_calls: totalApiCalls,
            sync_time_seconds: Math.round((Date.now() - syncStartTime) / 1000)
          }),
          { status: 200, headers: corsHeaders }
        )
      }

      // 🔍 STEP 2: Process groups with detailed fetching (limited batch for speed)
      console.log('🔍 Processing groups with detailed participant fetching...')
      
      // Limit to first 50 groups to avoid excessive API calls and long wait times
      const groupsToProcess = basicGroups.slice(0, 50);
      
      if (basicGroups.length > 50) {
        console.log(`⚠️ Limiting to first ${groupsToProcess.length} groups (out of ${basicGroups.length}) to avoid excessive API calls`)
      }
      
      const batchResults = await groupProcessor.processGroupsBatch(groupsToProcess);
      
      // Add results to our collection
      for (const [groupId, groupData] of batchResults) {
        allFoundGroups.set(groupId, groupData);
      }

    } catch (batchError) {
      console.error(`❌ Error in groups processing:`, batchError)
      hasApiErrors = true
    }

    const newFoundGroups = Array.from(allFoundGroups.values());
    const newGroupsCount = newFoundGroups.length;
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = groupProcessor.getStats();

    console.log(`\n🎯 DETAILED SYNC COMPLETE!`)
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`)
    console.log(`📊 API calls made: ${totalApiCalls + processingStats.apiCallsMade}`)
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`)
    console.log(`🆕 Admin groups found: ${newGroupsCount}`)
    console.log(`📁 Existing groups: ${existingCount}`)

    // Safety checks
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

    // Update database
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
          total_api_calls: totalApiCalls + processingStats.apiCallsMade,
          total_groups_scanned: totalGroupsScanned,
          sync_time_seconds: totalSyncTime,
          processing_stats: processingStats,
          detailed_sync_enabled: true,
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

    // Preserve existing groups
    console.log(`🛡️ SAFETY: Preserving ${existingCount} existing groups`)
    
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
    console.error('💥 Detailed Sync Error:', error)
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