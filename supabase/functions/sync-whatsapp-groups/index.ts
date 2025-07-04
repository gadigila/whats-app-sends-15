import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 SYNC MY MANAGED GROUPS: Admin/Creator groups only...')
    
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

    console.log('👤 Syncing managed groups for user:', userId)

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

    // 🎯 FIXED: Get phone number with proper fallback
    let userPhoneNumber = profile.phone_number

    if (!userPhoneNumber) {
      console.log('📱 No phone number stored, fetching from /health...')
      
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
          console.log('📊 Health data for phone lookup:', JSON.stringify(healthData, null, 2))
          
          // 🎯 FIXED: Extract from correct location
          if (healthData?.user?.id) {
            userPhoneNumber = healthData.user.id;
            console.log('📱 Found phone in user.id:', userPhoneNumber);
          } else if (healthData?.me?.phone) {
            userPhoneNumber = healthData.me.phone;
            console.log('📱 Found phone in me.phone:', userPhoneNumber);
          } else if (healthData?.phone) {
            userPhoneNumber = healthData.phone;
            console.log('📱 Found phone in phone field:', userPhoneNumber);
          }
          
          if (userPhoneNumber) {
            // Clean and store the phone number
            const cleanPhone = userPhoneNumber.replace(/[^\d]/g, '');
            userPhoneNumber = cleanPhone; // Use cleaned version
            
            console.log('📱 Cleaned phone from /health:', cleanPhone)
            
            // Save it to database for future use
            await supabase
              .from('profiles')
              .update({
                phone_number: cleanPhone,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            
            console.log('✅ Phone number saved to database:', cleanPhone)
          }
        } else {
          console.error('❌ Failed to fetch from /health:', healthResponse.status)
        }
      } catch (healthError) {
        console.error('❌ Error calling /health:', healthError)
      }
    } else {
      console.log('📱 Using stored phone number:', userPhoneNumber)
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine your phone number',
          suggestion: 'Please reconnect your WhatsApp account or check connection status'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📱 Using phone for admin matching: ${userPhoneNumber}`)

    // Get all groups
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups?count=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!groupsResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups from WhatsApp' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    const allGroups = groupsData.groups || []
    console.log(`📊 Found ${allGroups.length} total groups`)

    // 🎯 FIXED: More robust phone matching function
    function isPhoneMatch(phone1: string, phone2: string): boolean {
      if (!phone1 || !phone2) return false;
      
      // Clean both numbers (remove all non-digits)
      const clean1 = phone1.replace(/[^\d]/g, '');
      const clean2 = phone2.replace(/[^\d]/g, '');
      
      console.log(`🔍 Comparing: "${clean1}" vs "${clean2}"`);
      
      // Direct exact match
      if (clean1 === clean2) {
        console.log('✅ Exact match found');
        return true;
      }
      
      // Israeli format handling (972 vs 0 prefix)
      if (clean1.startsWith('972') && clean2.startsWith('0')) {
        const match = clean1.substring(3) === clean2.substring(1);
        if (match) console.log('✅ 972 vs 0 prefix match found');
        return match;
      }
      
      if (clean2.startsWith('972') && clean1.startsWith('0')) {
        const match = clean2.substring(3) === clean1.substring(1);
        if (match) console.log('✅ 0 vs 972 prefix match found');
        return match;
      }
      
      // Last 9 digits match (Israeli mobile standard)
      if (clean1.length >= 9 && clean2.length >= 9) {
        const match = clean1.slice(-9) === clean2.slice(-9);
        if (match) console.log('✅ Last 9 digits match found');
        return match;
      }
      
      console.log('❌ No match found');
      return false;
    }

    // 🎯 ONLY PROCESS ADMIN/CREATOR GROUPS
    const managedGroups = []
    let adminCount = 0
    let creatorCount = 0
    let totalMemberCount = 0
    let debugInfo = []

    for (const group of allGroups) {
      const groupName = group.name || group.subject || `Group ${group.id}`
      let isAdmin = false
      let isCreator = false
      let userRole = 'member'
      let foundUser = false
      
      console.log(`\n👥 Checking group: ${groupName} (${group.id})`)
      console.log(`📊 Participants: ${group.participants?.length || 0}`)
      
      // Check if user is admin/creator in this group
      if (group.participants && Array.isArray(group.participants)) {
        for (const participant of group.participants) {
          const participantId = participant.id || participant.phone || participant.number;
          const participantRank = participant.rank || participant.role || 'member';
          
          console.log(`🔍 Checking participant: ${participantId} (${participantRank})`);
          
          if (isPhoneMatch(userPhoneNumber, participantId)) {
            foundUser = true;
            userRole = participantRank;
            
            if (participantRank === 'creator') {
              isCreator = true;
              isAdmin = true;
              creatorCount++;
              console.log(`👑 User is CREATOR of: ${groupName}`);
            } else if (participantRank === 'admin') {
              isAdmin = true;
              adminCount++;
              console.log(`⭐ User is ADMIN of: ${groupName}`);
            } else {
              console.log(`👤 User is MEMBER of: ${groupName}`);
            }
            break;
          }
        }
      }

      // Store debug info for all groups
      debugInfo.push({
        groupName,
        groupId: group.id,
        participantsCount: group.participants?.length || 0,
        foundUser,
        userRole,
        isAdmin,
        userPhone: userPhoneNumber
      });

      // 🎯 ONLY ADD IF USER IS ADMIN OR CREATOR
      if (isAdmin) {
        const participantsCount = group.participants?.length || group.size || 0
        totalMemberCount += participantsCount

        managedGroups.push({
          user_id: userId,
          group_id: group.id,
          name: groupName,
          description: group.description || null,
          participants_count: participantsCount,
          is_admin: true, // Always true since we only sync admin groups
          avatar_url: group.chat_pic || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        const roleIcon = isCreator ? '👑' : '⭐'
        console.log(`${roleIcon} ADDED: ${groupName} (${participantsCount} members)`)
      } else if (foundUser) {
        console.log(`👤 SKIPPED: ${groupName} (user is only a member)`)
      } else {
        console.log(`❌ SKIPPED: ${groupName} (user not found in participants)`)
      }
    }

    console.log(`\n🎯 SYNC SUMMARY:`)
    console.log(`📱 User phone: ${userPhoneNumber}`)
    console.log(`📊 Total groups scanned: ${allGroups.length}`)
    console.log(`👑 Creator groups: ${creatorCount}`)
    console.log(`⭐ Admin groups: ${adminCount}`)
    console.log(`✅ Total managed groups: ${managedGroups.length}`)
    console.log(`👥 Total members in managed groups: ${totalMemberCount}`)

    // Save only managed groups to database
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (managedGroups.length > 0) {
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(managedGroups)

      if (insertError) {
        console.error('❌ Database error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to save groups to database' }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    const totalManagedGroups = adminCount + creatorCount
    const message = managedGroups.length > 0
      ? `נמצאו ${totalManagedGroups} קבוצות בניהולך (${creatorCount} כיוצר, ${adminCount} כמנהל)`
      : 'לא נמצאו קבוצות שאתה מנהל'

    console.log('🎯 SYNC COMPLETE:', {
      phone: userPhoneNumber,
      managed_groups: managedGroups.length,
      creator_groups: creatorCount,
      admin_groups: adminCount,
      total_members: totalMemberCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        user_phone: userPhoneNumber,
        groups_count: managedGroups.length,
        total_groups_scanned: allGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMemberCount,
        message: message,
        managed_groups: managedGroups.map(g => ({
          name: g.name,
          members: g.participants_count,
          id: g.group_id
        })).slice(0, 10), // Show first 10 groups in response
        debug_info: debugInfo.slice(0, 5) // Show debug info for first 5 groups
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})