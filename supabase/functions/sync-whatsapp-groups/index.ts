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

// 📱 Enhanced phone matching for Israeli numbers
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

// 🚀 SIMPLE: Conservative group processor
class SimpleGroupProcessor {
  private phoneMatcher: PhoneMatcher;
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
  }

  processGroup(group: any): { isAdminGroup: boolean; groupData?: any; skipReason?: string } {
    this.stats.groupsProcessed++;
    
    const groupName = group.name || group.subject || `Group ${group.id}`;
    
    // 🚀 OPTIMIZATION 1: Early skip if no participants loaded  
    if (!group.participants || !Array.isArray(group.participants) || group.participants.length === 0) {
      this.stats.groupsSkippedNoParticipants++;
      console.log(`⚠️ ${groupName} - No participants data (skipping)`);
      return { 
        isAdminGroup: false, 
        skipReason: 'no_participants_loaded'
      };
    }

    this.stats.totalParticipantsChecked += group.participants.length;

    // 🚀 OPTIMIZATION 2: Fast user lookup
    const userParticipant = group.participants.find(participant => {
      const participantId = participant.id || participant.phone || participant.number;
      return this.phoneMatcher.isMatch(participantId);
    });

    // 🚀 OPTIMIZATION 3: Early exit if user not in group
    if (!userParticipant) {
      this.stats.groupsSkippedNotMember++;
      console.log(`👤 ${groupName} - User not a member (skipping)`);
      return { 
        isAdminGroup: false, 
        skipReason: 'not_member'
      };
    }

    // 🚀 OPTIMIZATION 4: Quick role check
    const participantRank = userParticipant.rank || userParticipant.role || 'member';
    const normalizedRank = participantRank.toLowerCase();
    
    const isCreatorRole = normalizedRank === 'creator' || normalizedRank === 'owner';
    const isAdminRole = normalizedRank === 'admin' || normalizedRank === 'administrator' || isCreatorRole;

    if (!isAdminRole) {
      console.log(`👤 ${groupName} - User is MEMBER only (skipping)`);
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

    return {
      isAdminGroup: true,
      groupData
    };
  }

  getStats() {
    return {
      ...this.stats,
      efficiency: {
        participantsPerGroup: Math.round(this.stats.totalParticipantsChecked / Math.max(this.stats.groupsProcessed, 1)),
        adminFindRate: ((this.stats.adminGroupsFound + this.stats.creatorGroupsFound) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%',
        skipRate: ((this.stats.groupsSkippedNoParticipants + this.stats.groupsSkippedNotMember) / Math.max(this.stats.groupsProcessed, 1) * 100).toFixed(1) + '%'
      }
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 SIMPLE CONSERVATIVE SYNC: Following WHAPI best practices...')
    
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

    console.log('👤 Starting CONSERVATIVE sync for user:', userId)

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

    // 🚀 STEP 2: Initialize simple processor
    const groupProcessor = new SimpleGroupProcessor(userPhoneNumber, userId);
    console.log('🚀 Simple group processor initialized')

    // 🎯 SIMPLE CONSERVATIVE STRATEGY - Following WHAPI recommendations
    console.log('\n🔄 === CONSERVATIVE SINGLE-PASS SYNC ===')
    
    const syncStartTime = Date.now();
    let totalApiCalls = 0;
    let totalGroupsScanned = 0;
    let hasApiErrors = false;
    const adminGroups: any[] = [];

    // 🎯 SMALLER BATCHES for complete data - Following your suggestion
    const BATCH_SIZE = 20; // Smaller batches = more complete participant data
    const MAX_CALLS = 10;  // More calls to compensate, still scan 200 groups
    
    let currentOffset = 0;
    let hasMoreGroups = true;
    let consecutiveEmptyResponses = 0;

    while (hasMoreGroups && totalApiCalls < MAX_CALLS && consecutiveEmptyResponses < 2) {
      totalApiCalls++;
      
      console.log(`📊 API call ${totalApiCalls}/${MAX_CALLS}: Fetching groups ${currentOffset}-${currentOffset + BATCH_SIZE}`);
      
      try {
        // Add 3-second delay between calls (except first) - reduced from 4s
        if (totalApiCalls > 1) {
          console.log('⏳ Waiting 3 seconds between API calls...');
          await delay(3000);
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
            console.log('🚫 Rate limited - stopping sync to respect WHAPI limits');
            break;
          } else if (groupsResponse.status >= 500) {
            console.log('🔄 Server error - waiting 5 seconds and trying once more...');
            await delay(5000);
            continue;
          } else {
            console.log('💥 Non-retryable error - stopping sync');
            break;
          }
        }

        const groupsData = await groupsResponse.json();
        const batchGroups = groupsData.groups || [];
        
        console.log(`📊 API call ${totalApiCalls}: Received ${batchGroups.length} groups`);
        
        if (batchGroups.length === 0) {
          consecutiveEmptyResponses++;
          console.log(`📊 Empty response ${consecutiveEmptyResponses}/2 - might be end of groups`);
          
          if (consecutiveEmptyResponses >= 2) {
            hasMoreGroups = false;
          }
        } else {
          consecutiveEmptyResponses = 0;
          totalGroupsScanned += batchGroups.length;
          
          // Process each group to find admin roles
          for (const group of batchGroups) {
            const result = groupProcessor.processGroup(group);
            
            if (result.isAdminGroup && result.groupData) {
              adminGroups.push(result.groupData);
            }
          }
          
          currentOffset += batchGroups.length;
          
          // If we got less than batch size, probably no more groups
          if (batchGroups.length < BATCH_SIZE) {
            hasMoreGroups = false;
          }
        }

      } catch (batchError) {
        console.error(`❌ Critical API Error in call ${totalApiCalls}:`, batchError);
        hasApiErrors = true;
        break;
      }
    }

    const newGroupsCount = adminGroups.length;
    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = groupProcessor.getStats();

    console.log(`\n🎯 CONSERVATIVE SYNC COMPLETE!`);
    console.log(`📊 Groups scanned: ${totalGroupsScanned}`);
    console.log(`📊 API calls made: ${totalApiCalls}`);
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`);
    console.log(`🆕 Admin groups found: ${newGroupsCount}`);
    console.log(`📁 Existing groups: ${existingCount}`);
    console.log(`🚀 Processing efficiency:`, processingStats.efficiency);

    // 🛡️ SAFETY DECISION LOGIC
    if (hasApiErrors && newGroupsCount === 0) {
      console.log('🛡️ SAFETY: API errors + 0 groups found - preserving existing');
      
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

    // 🛡️ CONSERVATIVE: Only warn if dramatic drop, but still allow small decreases
    if (existingCount > 10 && newGroupsCount < existingCount * 0.3) {
      console.log(`🛡️ SAFETY: Found ${newGroupsCount} but had ${existingCount} - suspicious drop`);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Sync found significantly fewer groups than expected',
          new_found: newGroupsCount,
          existing_preserved: existingCount,
          processing_stats: processingStats,
          message: `Found only ${newGroupsCount} groups but you had ${existingCount} before. This seems like a temporary WHAPI issue.`,
          recommendation: 'Try again in a few minutes. Your existing groups are preserved.'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🛡️ SAFE UPDATE
    if (newGroupsCount > 0 || existingCount === 0) {
      console.log(`✅ SAFE TO UPDATE: Found ${newGroupsCount} groups, replacing ${existingCount}`);
      
      // Delete existing groups
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId);
      
      // Insert new groups if any found
      if (newGroupsCount > 0) {
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

      const message = newGroupsCount > 0
        ? `נמצאו ${newGroupsCount} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
        : 'לא נמצאו קבוצות בניהולך בטווח הנסרק'

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
          conservative_mode: true,
          message: message,
          note: totalApiCalls >= MAX_CALLS ? 'Scanned 200 groups max. Run again to scan more if needed.' : 'Sync completed successfully.',
          managed_groups: adminGroups.map(g => ({
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
    console.log(`🛡️ SAFETY: Preserving ${existingCount} existing groups`);
    
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: existingCount,
        message: `לא נמצאו קבוצות חדשות בטווח הנסרק. שומר על ${existingCount} הקבוצות הקיימות שלך`,
        existing_groups_preserved: true,
        processing_stats: processingStats,
        recommendation: 'נסה שוב מאוחר יותר או פעל עוד פעם לסריקת טווחים נוספים'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Conservative Sync Error:', error)
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