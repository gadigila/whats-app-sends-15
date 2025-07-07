import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

interface SyncProgress {
  userId: string
  status: 'starting' | 'syncing' | 'completed' | 'failed'
  groupsFound: number
  totalScanned: number
  currentPass: number
  totalPasses: number
  message: string
  error?: string
  startedAt: string
  completedAt?: string
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

// Update progress in database
async function updateProgress(supabase: any, progress: SyncProgress): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sync_progress')
      .upsert(progress, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('❌ Failed to update progress:', error);
      return false;
    } else {
      console.log(`📊 Progress updated: ${progress.status} - ${progress.groupsFound} groups found`);
      return true;
    }
  } catch (err) {
    console.error('❌ Exception updating progress:', err);
    return false;
  }
}

// Check for SYNC_ERROR and handle recovery
async function checkAndHandleSyncError(token: string, supabase: any, userId: string): Promise<boolean> {
  try {
    console.log('🔍 Checking for SYNC_ERROR status...');
    
    const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!healthResponse.ok) {
      console.log('⚠️ Health check failed:', healthResponse.status);
      return healthResponse.status !== 401;
    }

    const healthData = await healthResponse.json();
    console.log('📊 Health status:', healthData.status);
    
    if (healthData.status === 'SYNC_ERROR') {
      console.log('⚠️ SYNC_ERROR detected - implementing recovery strategy');
      
      await updateProgress(supabase, {
        userId,
        status: 'syncing',
        groupsFound: 0,
        totalScanned: 0,
        currentPass: 0,
        totalPasses: 3,
        message: 'מזהה שגיאת סנכרון, מתאושש...',
        startedAt: new Date().toISOString()
      });

      // Recovery strategy: wait and check again
      console.log('🔄 Waiting 30 seconds for SYNC_ERROR recovery...');
      await delay(30000);
      
      // Check again
      const retryHealthResponse = await fetch(`https://gate.whapi.cloud/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (retryHealthResponse.ok) {
        const retryHealthData = await retryHealthResponse.json();
        console.log('📊 Post-recovery health status:', retryHealthData.status);
        
        if (retryHealthData.status === 'SYNC_ERROR') {
          console.log('❌ SYNC_ERROR persists after recovery attempt');
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking sync status:', error);
    return true; // Continue anyway
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let userId = 'unknown';

  try {
    console.log('🚀 ENHANCED GROUP SYNC: Starting intelligent sync with progress tracking...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestBody: SyncGroupsRequest = await req.json()
    userId = requestBody.userId;

    if (!userId || userId === 'unknown') {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Starting enhanced sync for user:', userId)

    // Initialize progress tracking
    const startTime = new Date().toISOString();
    await updateProgress(supabase, {
      userId,
      status: 'starting',
      groupsFound: 0,
      totalScanned: 0,
      currentPass: 0,
      totalPasses: 3,
      message: 'מתחיל סנכרון קבוצות...',
      startedAt: startTime
    });

    // Get user's WHAPI token AND phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      await updateProgress(supabase, {
        userId,
        status: 'failed',
        groupsFound: 0,
        totalScanned: 0,
        currentPass: 0,
        totalPasses: 3,
        message: 'לא נמצא חיבור וואטסאפ',
        error: 'No WHAPI token found',
        startedAt: startTime,
        completedAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      await updateProgress(supabase, {
        userId,
        status: 'failed',
        groupsFound: 0,
        totalScanned: 0,
        currentPass: 0,
        totalPasses: 3,
        message: 'וואטסאפ לא מחובר',
        error: `Instance status: ${profile.instance_status}`,
        startedAt: startTime,
        completedAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get phone number with fallback
    let userPhoneNumber = profile.phone_number

    if (!userPhoneNumber) {
      console.log('📱 No phone stored, fetching from /health...')
      
      await updateProgress(supabase, {
        userId,
        status: 'syncing',
        groupsFound: 0,
        totalScanned: 0,
        currentPass: 0,
        totalPasses: 3,
        message: 'מקבל את מספר הטלפון שלך...',
        startedAt: startTime
      });

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
      await updateProgress(supabase, {
        userId,
        status: 'failed',
        groupsFound: 0,
        totalScanned: 0,
        currentPass: 0,
        totalPasses: 3,
        message: 'לא ניתן לקבוע את מספר הטלפון',
        error: 'Phone number not found',
        startedAt: startTime,
        completedAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ 
          error: 'Could not determine your phone number',
          suggestion: 'Please check connection status first'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📱 User phone for matching: ${userPhoneNumber}`)

    // Check for SYNC_ERROR before starting
    const canProceed = await checkAndHandleSyncError(profile.whapi_token, supabase, userId);
    if (!canProceed) {
      await updateProgress(supabase, {
        userId,
        status: 'failed',
        groupsFound: 0,
        totalScanned: 0,
        currentPass: 0,
        totalPasses: 3,
        message: 'זוהתה שגיאת סנכרון, נסה שוב מאוחר יותר',
        error: 'SYNC_ERROR persists',
        startedAt: startTime,
        completedAt: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ 
          error: 'WhatsApp backend sync error detected',
          suggestion: 'Please wait a few minutes and try again'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🚀 INTELLIGENT 3-PASS STRATEGY with progress updates
    const passConfig = [
      { pass: 1, delay: 5000,  batchSize: 50,  description: "סריקה ראשונית מהירה" },
      { pass: 2, delay: 15000, batchSize: 100, description: "גילוי מפורט" },
      { pass: 3, delay: 20000, batchSize: 150, description: "סריקה מקיפה אחרונה" }
    ];

    let allFoundGroups = new Map();
    let totalApiCalls = 0;
    let totalGroupsScanned = 0;
    const syncStartTime = Date.now();

    await updateProgress(supabase, {
      userId,
      status: 'syncing',
      groupsFound: 0,
      totalScanned: 0,
      currentPass: 1,
      totalPasses: 3,
      message: 'מתחיל לגלות קבוצות...',
      startedAt: startTime
    });

    for (const config of passConfig) {
      // Add delay before pass (except first pass)
      if (config.delay > 0 && config.pass > 1) {
        console.log(`⏳ Waiting ${config.delay/1000}s before pass ${config.pass}...`)
        
        await updateProgress(supabase, {
          userId,
          status: 'syncing',
          groupsFound: allFoundGroups.size,
          totalScanned: totalGroupsScanned,
          currentPass: config.pass,
          totalPasses: 3,
          message: `ממתין ${config.delay/1000} שניות לפני ${config.description}...`,
          startedAt: startTime
        });

        await delay(config.delay);
      }

      console.log(`\n🔄 === PASS ${config.pass}/3 === (${config.description})`)
      
      await updateProgress(supabase, {
        userId,
        status: 'syncing',
        groupsFound: allFoundGroups.size,
        totalScanned: totalGroupsScanned,
        currentPass: config.pass,
        totalPasses: 3,
        message: `${config.description} מתבצעת...`,
        startedAt: startTime
      });

      const passStartTime = Date.now();
      let passFoundGroups = 0;

      // Get all groups with pagination for this pass
      let allGroups: any[] = []
      let currentOffset = 0
      let hasMoreGroups = true
      let passApiCalls = 0
      const maxPassApiCalls = 8

      while (hasMoreGroups && passApiCalls < maxPassApiCalls) {
        passApiCalls++
        totalApiCalls++
        
        console.log(`📊 Pass ${config.pass}, API call ${passApiCalls}: Fetching groups ${currentOffset}-${currentOffset + config.batchSize}`)
        
        try {
          // Check for SYNC_ERROR during sync
          if (passApiCalls > 2) {
            const canContinue = await checkAndHandleSyncError(profile.whapi_token, supabase, userId);
            if (!canContinue) {
              console.log('❌ SYNC_ERROR detected during sync, stopping');
              break;
            }
          }

          const apiDelay = Math.min(2000 + (config.pass * 500), 4000);
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
              const retryDelay = apiDelay * 2;
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
          totalGroupsScanned += batchGroups.length;
          
          // Update progress with current scan count
          await updateProgress(supabase, {
            userId,
            status: 'syncing',
            groupsFound: allFoundGroups.size,
            totalScanned: totalGroupsScanned,
            currentPass: config.pass,
            totalPasses: 3,
            message: `${config.description} - סורק קבוצות ${currentOffset}-${currentOffset + batchGroups.length}`,
            startedAt: startTime
          });
          
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
            await delay(apiDelay * 2)
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
        let userRole = 'member'
        
        // Process group participants for admin detection
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
              userRole = participantRank;
              
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
          
          // Update progress immediately when group found
          await updateProgress(supabase, {
            userId,
            status: 'syncing',
            groupsFound: allFoundGroups.size,
            totalScanned: totalGroupsScanned,
            currentPass: config.pass,
            totalPasses: 3,
            message: `נמצאו ${allFoundGroups.size} קבוצות בניהולך עד כה...`,
            startedAt: startTime
          });
        }
      }

      const passTime = Math.round((Date.now() - passStartTime) / 1000);
      console.log(`🎯 Pass ${config.pass} completed in ${passTime}s: Found ${passFoundGroups} new admin groups`)
      
      // Early stopping if we found good results and no new groups in last pass
      if (passFoundGroups === 0 && allFoundGroups.size >= 5 && config.pass >= 2) {
        console.log(`🏁 Early stopping: Good results (${allFoundGroups.size} groups) with no new finds`);
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
    console.log(`📊 Total API calls: ${totalApiCalls}`)
    console.log(`✅ Final admin groups found: ${managedGroups.length}`)

    // Save groups to database
    console.log('💾 Saving all found groups...')
    
    await updateProgress(supabase, {
      userId,
      status: 'syncing',
      groupsFound: managedGroups.length,
      totalScanned: totalGroupsScanned,
      currentPass: 3,
      totalPasses: 3,
      message: 'שומר קבוצות במסד הנתונים...',
      startedAt: startTime
    });
    
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (managedGroups.length > 0) {
      const dbBatchSize = 100
      for (let i = 0; i < managedGroups.length; i += dbBatchSize) {
        const batch = managedGroups.slice(i, i + dbBatchSize)
        console.log(`💾 Saving batch: ${batch.length} groups`)
        
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(batch)

        if (insertError) {
          console.error('❌ Database batch error:', insertError)
          
          await updateProgress(supabase, {
            userId,
            status: 'failed',
            groupsFound: managedGroups.length,
            totalScanned: totalGroupsScanned,
            currentPass: 3,
            totalPasses: 3,
            message: 'שגיאה בשמירת קבוצות',
            error: insertError.message,
            startedAt: startTime,
            completedAt: new Date().toISOString()
          });

          return new Response(
            JSON.stringify({ error: 'Failed to save groups to database', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          )
        }
        
        if (i + dbBatchSize < managedGroups.length) {
          await delay(100)
        }
      }
    }

    // Mark as completed
    const completedMessage = managedGroups.length > 0
      ? `נמצאו ${managedGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות בניהולך';

    await updateProgress(supabase, {
      userId,
      status: 'completed',
      groupsFound: managedGroups.length,
      totalScanned: totalGroupsScanned,
      currentPass: 3,
      totalPasses: 3,
      message: completedMessage,
      startedAt: startTime,
      completedAt: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_phone: userPhoneNumber,
        groups_count: managedGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        total_api_calls: totalApiCalls,
        sync_time_seconds: totalSyncTime,
        message: completedMessage,
        enhanced_sync: true
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Enhanced Sync Error:', error)
    
    // Update progress as failed
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!, 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await updateProgress(supabase, {
        userId,
        status: 'failed',
        groupsFound: 0,
        totalScanned: 0,
        currentPass: 0,
        totalPasses: 3,
        message: 'הסנכרון נכשל עם שגיאה',
        error: error.message,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });
    } catch (progressError) {
      console.error('❌ Failed to update progress on error:', progressError)
    }

    return new Response(
      JSON.stringify({ 
        error: 'Enhanced sync failed', 
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})