import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// 🚀 ENHANCED: LID-Compatible Phone Matcher
class AdvancedPhoneMatcher {
  private userPhoneClean: string;
  private userPhoneVariants: string[];

  constructor(userPhone: string) {
    this.userPhoneClean = userPhone.replace(/[^\d]/g, '');
    
    this.userPhoneVariants = [
      this.userPhoneClean,
      // Israeli format variations
      this.userPhoneClean.startsWith('972') ? '0' + this.userPhoneClean.substring(3) : null,
      this.userPhoneClean.startsWith('0') ? '972' + this.userPhoneClean.substring(1) : null,
      // Last 9 digits for Israeli numbers
      this.userPhoneClean.slice(-9),
      // Last 10 digits
      this.userPhoneClean.slice(-10),
    ].filter(Boolean) as string[];
    
    console.log(`📱 Advanced phone matcher for: ${userPhone}`);
    console.log(`🔍 Matching variants: ${this.userPhoneVariants.join(', ')}`);
  }

  isMatch(participantId: string): { isMatch: boolean; method?: string; cleanId?: string } {
    if (!participantId) return { isMatch: false };
    
    // 🚀 HANDLE LID FORMAT: Remove @lid suffix
    const cleanId = participantId.replace(/@lid$/, '').replace(/[^\d]/g, '');
    
    // Skip obviously non-phone LIDs (too long or too short)
    if (cleanId.length < 9 || cleanId.length > 15) {
      return { isMatch: false, method: 'invalid_length', cleanId };
    }
    
    // Method 1: Exact match
    if (this.userPhoneVariants.includes(cleanId)) {
      return { isMatch: true, method: 'exact_match', cleanId };
    }
    
    // Method 2: Last 9 digits (Israeli format)
    if (cleanId.length >= 9) {
      const lastNine = cleanId.slice(-9);
      const userLastNine = this.userPhoneClean.slice(-9);
      if (lastNine === userLastNine) {
        return { isMatch: true, method: 'last_9_digits', cleanId };
      }
    }
    
    // Method 3: Substring matching for international formats
    if (cleanId.length >= 10) {
      const userIn = this.userPhoneClean;
      if (userIn.includes(cleanId) || cleanId.includes(userIn)) {
        return { isMatch: true, method: 'substring', cleanId };
      }
    }
    
    return { isMatch: false, method: 'no_match', cleanId };
  }
}

// 🚀 TWO-STEP: Optimized group processor using both endpoints
class TwoStepGroupProcessor {
  private phoneMatcher: AdvancedPhoneMatcher;
  private stats = {
    groupsListed: 0,
    groupsDetailed: 0,
    adminGroupsFound: 0,
    creatorGroupsFound: 0,
    phoneMatchAttempts: 0,
    phoneMatchSuccesses: 0,
    apiCallsUsed: 0
  };

  constructor(userPhone: string, private userId: string) {
    this.phoneMatcher = new AdvancedPhoneMatcher(userPhone);
  }

  // 🚀 STEP 1: Get groups list (fast)
  async getGroupsList(whapiToken: string, batchSize: number = 100, maxBatches: number = 5): Promise<any[]> {
    console.log(`📋 STEP 1: Getting groups list (${maxBatches} batches max)`);
    
    let allGroups: any[] = [];
    let currentOffset = 0;
    let batchNumber = 0;

    while (batchNumber < maxBatches) {
      batchNumber++;
      this.stats.apiCallsUsed++;
      
      console.log(`📊 Batch ${batchNumber}: Fetching groups ${currentOffset}-${currentOffset + batchSize}`);
      
      try {
        // 🚀 STEP 1: Use basic /groups endpoint (faster, no participants)
        const groupsResponse = await fetch(
          `https://gate.whapi.cloud/groups?count=${batchSize}&offset=${currentOffset}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${whapiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!groupsResponse.ok) {
          console.error(`❌ Groups list API failed: ${groupsResponse.status}`);
          if (groupsResponse.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          break;
        }

        const groupsData = await groupsResponse.json();
        const batchGroups = groupsData.groups || [];
        
        console.log(`📊 Batch ${batchNumber}: Received ${batchGroups.length} groups`);
        
        if (batchGroups.length === 0) {
          console.log('📋 No more groups available');
          break;
        }

        allGroups = allGroups.concat(batchGroups);
        this.stats.groupsListed += batchGroups.length;
        currentOffset += batchSize;

        if (batchGroups.length < batchSize) {
          console.log('📋 Last batch reached');
          break;
        }

        // Rate limiting between batches
        if (batchNumber < maxBatches) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Error in batch ${batchNumber}:`, error.message);
        break;
      }
    }

    console.log(`📋 STEP 1 COMPLETE: Found ${allGroups.length} total groups`);
    return allGroups;
  }

  // 🚀 STEP 2: Get detailed group info (for admin detection)
  async checkGroupAdmin(group: any, whapiToken: string): Promise<{ isAdmin: boolean; groupData?: any; error?: string }> {
    const groupName = group.name || group.subject || `Group ${group.id}`;
    
    try {
      this.stats.groupsDetailed++;
      this.stats.apiCallsUsed++;
      
      console.log(`🔍 STEP 2: Getting detailed info for "${groupName}"`);
      
      // 🚀 STEP 2: Use /groups/{GroupID} for complete metadata
      const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!detailResponse.ok) {
        const error = `Detail API failed: ${detailResponse.status}`;
        console.log(`⚠️ ${error} for ${groupName}`);
        return { isAdmin: false, error };
      }

      const detailData = await detailResponse.json();
      console.log(`📊 Detailed data received for ${groupName}:`);
      console.log(`   - Participants: ${detailData.participants?.length || 0}`);
      console.log(`   - Has admin info: ${!!(detailData.admins || detailData.admin)}`);

      // Method A: Check if WHAPI provides admin list directly
      if (detailData.admins && Array.isArray(detailData.admins)) {
        console.log(`👑 Checking admin list (${detailData.admins.length} admins)`);
        
        for (const admin of detailData.admins) {
          this.stats.phoneMatchAttempts++;
          const matchResult = this.phoneMatcher.isMatch(admin.id || admin.phone || admin.number);
          
          if (matchResult.isMatch) {
            this.stats.phoneMatchSuccesses++;
            console.log(`✅ ADMIN MATCH: ${admin.id} → ${matchResult.cleanId} (${matchResult.method})`);
            
            return {
              isAdmin: true,
              groupData: this.createGroupData(detailData, true, admin.role === 'creator')
            };
          }
        }
      }

      // Method B: Check participants list with roles
      if (detailData.participants && Array.isArray(detailData.participants)) {
        console.log(`👥 Checking participants (${detailData.participants.length} total)`);
        
        let lidCount = 0;
        let phoneCount = 0;
        
        for (const participant of detailData.participants) {
          const participantId = participant.id || participant.phone || participant.number;
          
          if (participantId?.includes('@lid')) {
            lidCount++;
          } else {
            phoneCount++;
          }
          
          this.stats.phoneMatchAttempts++;
          const matchResult = this.phoneMatcher.isMatch(participantId);
          
          if (matchResult.isMatch) {
            this.stats.phoneMatchSuccesses++;
            const role = participant.rank || participant.role || 'member';
            const isAdmin = ['admin', 'administrator', 'creator', 'owner'].includes(role.toLowerCase());
            const isCreator = ['creator', 'owner'].includes(role.toLowerCase());
            
            console.log(`✅ USER FOUND: ${participantId} → ${matchResult.cleanId} (${matchResult.method})`);
            console.log(`   Role: ${role}, Admin: ${isAdmin}, Creator: ${isCreator}`);
            
            if (isAdmin) {
              if (isCreator) {
                this.stats.creatorGroupsFound++;
              } else {
                this.stats.adminGroupsFound++;
              }
              
              return {
                isAdmin: true,
                groupData: this.createGroupData(detailData, isAdmin, isCreator)
              };
            } else {
              console.log(`👤 Found as member only in ${groupName}`);
              return { isAdmin: false };
            }
          }
        }
        
        console.log(`📊 ${groupName}: ${lidCount} LIDs, ${phoneCount} phones - User not found`);
      }

      console.log(`👤 User not found in ${groupName}`);
      return { isAdmin: false };

    } catch (error) {
      console.error(`❌ Error checking ${groupName}:`, error.message);
      return { isAdmin: false, error: error.message };
    }
  }

  private createGroupData(groupData: any, isAdmin: boolean, isCreator: boolean) {
    const participantsCount = groupData.participants?.length || groupData.size || 0;
    const groupName = groupData.name || groupData.subject || `Group ${groupData.id}`;

    return {
      user_id: this.userId,
      group_id: groupData.id,
      name: groupName,
      description: groupData.description || null,
      participants_count: participantsCount,
      is_admin: isAdmin,
      is_creator: isCreator,
      avatar_url: groupData.chat_pic || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  getStats() {
    return {
      ...this.stats,
      efficiency: {
        adminFindRate: ((this.stats.adminGroupsFound + this.stats.creatorGroupsFound) / Math.max(this.stats.groupsDetailed, 1) * 100).toFixed(1) + '%',
        phoneMatchRate: (this.stats.phoneMatchSuccesses / Math.max(this.stats.phoneMatchAttempts, 1) * 100).toFixed(1) + '%',
        apiEfficiency: `${this.stats.apiCallsUsed} calls for ${this.stats.groupsListed} groups listed, ${this.stats.groupsDetailed} detailed`
      }
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 TWO-STEP OPTIMIZED SYNC: List + Detailed Group Checking...')
    
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

    console.log('👤 Starting two-step sync for user:', userId)

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

    // Initialize two-step processor
    const processor = new TwoStepGroupProcessor(userPhoneNumber, userId);
    const syncStartTime = Date.now();

    // 🚀 STEP 1: Get all groups list (fast)
    const allGroups = await processor.getGroupsList(profile.whapi_token, 100, 5);
    
    if (allGroups.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No groups found',
          message: 'לא נמצאו קבוצות כלל'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // 🚀 STEP 2: Check each group for admin status (detailed)
    const adminGroups: any[] = [];
    const maxDetailedChecks = Math.min(allGroups.length, 30); // Limit for performance
    
    console.log(`🔍 STEP 2: Checking admin status for ${maxDetailedChecks} groups...`);

    for (let i = 0; i < maxDetailedChecks; i++) {
      const group = allGroups[i];
      
      try {
        const result = await processor.checkGroupAdmin(group, profile.whapi_token);
        
        if (result.isAdmin && result.groupData) {
          adminGroups.push(result.groupData);
          const role = result.groupData.is_creator ? 'CREATOR' : 'ADMIN';
          console.log(`🎉 ADMIN GROUP: ${result.groupData.name} (${result.groupData.participants_count} members) - ${role}`);
        }
        
        // Rate limiting between detailed checks
        if (i < maxDetailedChecks - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        console.log(`⚠️ Error checking group ${i + 1}:`, error.message);
      }
    }

    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000);
    const processingStats = processor.getStats();

    console.log(`\n🎯 TWO-STEP SYNC COMPLETE!`);
    console.log(`📊 Total groups found: ${allGroups.length}`);
    console.log(`📊 Groups checked in detail: ${processingStats.groupsDetailed}`);
    console.log(`📊 Admin groups found: ${adminGroups.length}`);
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`);
    console.log(`🚀 Processing stats:`, processingStats);

    // Save results to database
    if (adminGroups.length > 0) {
      console.log(`✅ Saving ${adminGroups.length} admin groups to database`);
      
      // Clear existing groups and insert new ones
      await supabase.from('whatsapp_groups').delete().eq('user_id', userId);
      
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(adminGroups);

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save groups to database' }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    const adminCount = adminGroups.filter(g => !g.is_creator).length;
    const creatorCount = adminGroups.filter(g => g.is_creator).length;
    const totalMemberCount = adminGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0);

    const message = adminGroups.length > 0
      ? `נמצאו ${adminGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות בניהולך';

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: adminGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        total_groups_scanned: allGroups.length,
        groups_checked_detailed: processingStats.groupsDetailed,
        sync_time_seconds: totalSyncTime,
        processing_stats: processingStats,
        two_step_optimization: true,
        detailed_api_used: true,
        message: message,
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
    console.error('💥 Two-Step Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})