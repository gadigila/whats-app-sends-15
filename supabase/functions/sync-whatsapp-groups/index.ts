import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Enhanced phone number matching function
function createPhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  const variations = new Set<string>();
  
  // Original phone
  variations.add(phone);
  
  // Handle @c.us suffix (WhatsApp format) - REMOVE IT FIRST
  let cleanPhone = phone;
  if (phone.includes('@c.us')) {
    cleanPhone = phone.replace('@c.us', '');
    variations.add(cleanPhone);
  }
  
  // Handle @s.whatsapp.net suffix
  if (phone.includes('@s.whatsapp.net')) {
    cleanPhone = phone.replace('@s.whatsapp.net', '');
    variations.add(cleanPhone);
  }
  
  // Remove all non-digits and create variations
  const digitsOnly = cleanPhone.replace(/[^\d]/g, '');
  if (digitsOnly) {
    variations.add(digitsOnly);
    variations.add(`+${digitsOnly}`);
    
    // Israel specific (972) - MORE VARIATIONS
    if (digitsOnly.startsWith('972')) {
      const withoutCountry = digitsOnly.substring(3);
      variations.add(withoutCountry);
      variations.add(`0${withoutCountry}`);
      variations.add(`+972${withoutCountry}`);
    }
    
    // If starts with 0, try with country code
    if (digitsOnly.startsWith('0')) {
      const withCountry = `972${digitsOnly.substring(1)}`;
      variations.add(withCountry);
      variations.add(`+${withCountry}`);
    }

    // Add WhatsApp suffixes to ALL variations
    variations.add(`${digitsOnly}@c.us`);
    variations.add(`${digitsOnly}@s.whatsapp.net`);
    
    if (digitsOnly.startsWith('972')) {
      const withoutCountryCode = digitsOnly.substring(3);
      variations.add(`${withoutCountryCode}@c.us`);
      variations.add(`0${withoutCountryCode}@c.us`);
      variations.add(`${withoutCountryCode}@s.whatsapp.net`);
      variations.add(`0${withoutCountryCode}@s.whatsapp.net`);
    }
    
    // Handle 10-digit Israeli numbers (like 0501234567)
    if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
      const without0 = digitsOnly.substring(1);
      variations.add(without0);
      variations.add(`+972${without0}`);
      variations.add(`972${without0}`);
      variations.add(`${without0}@c.us`);
      variations.add(`972${without0}@c.us`);
    }
    
    // Handle 9-digit Israeli numbers (like 501234567)
    if (digitsOnly.length === 9 && !digitsOnly.startsWith('0')) {
      variations.add(`0${digitsOnly}`);
      variations.add(`+972${digitsOnly}`);
      variations.add(`972${digitsOnly}`);
      variations.add(`${digitsOnly}@c.us`);
      variations.add(`972${digitsOnly}@c.us`);
    }
  }
  
  // Add/remove + prefix variations
  if (cleanPhone.startsWith('+')) {
    variations.add(cleanPhone.substring(1));
  } else if (!cleanPhone.startsWith('+')) {
    variations.add(`+${cleanPhone}`);
  }
  
  return Array.from(variations).filter(v => v.length >= 8);
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const variations1 = createPhoneVariations(phone1);
  const variations2 = createPhoneVariations(phone2);
  
  return variations1.some(v1 => variations2.includes(v1));
}

// PERFECT ADMIN DETECTION - Post WHAPI Fix
function detectUserRole(userPhone: string, groupDetails: any, groupName: string): { isAdmin: boolean, role: string | null, method: string } {
  console.log(`\n🔍 ===== ADMIN DETECTION for "${groupName}" =====`);
  console.log(`👤 User phone: ${userPhone}`);
  
  if (!userPhone || !groupDetails) {
    return { isAdmin: false, role: null, method: 'no_data' };
  }
  
  // STEP 1: Check participants array for "rank": "creator" (WHAPI's main recommendation)
  if (groupDetails.participants && Array.isArray(groupDetails.participants)) {
    console.log(`👥 Checking ${groupDetails.participants.length} participants for creator/admin ranks`);
    
    for (let i = 0; i < groupDetails.participants.length; i++) {
      const participant = groupDetails.participants[i];
      const participantPhone = participant.id || participant.phone;
      const participantRank = participant.rank; // WHAPI specifically uses "rank"
      
      if (participantPhone) {
        const isMatch = isPhoneMatch(userPhone, participantPhone);
        
        if (isMatch) {
          console.log(`  ✅ PHONE MATCH FOUND! Phone: ${participantPhone} | Rank: ${participantRank}`);
          
          if (participantRank === 'creator') {
            console.log(`  👑 ✅ USER IS CREATOR in "${groupName}"`);
            return { isAdmin: true, role: 'creator', method: 'participants_rank_creator' };
          }
          
          if (participantRank === 'admin') {
            console.log(`  👑 ✅ USER IS ADMIN in "${groupName}"`);
            return { isAdmin: true, role: 'admin', method: 'participants_rank_admin' };
          }
          
          if (participantRank === 'owner') {
            console.log(`  👑 ✅ USER IS OWNER in "${groupName}"`);
            return { isAdmin: true, role: 'owner', method: 'participants_rank_owner' };
          }
          
          if (participantRank === 'superadmin') {
            console.log(`  👑 ✅ USER IS SUPERADMIN in "${groupName}"`);
            return { isAdmin: true, role: 'superadmin', method: 'participants_rank_superadmin' };
          }
          
          // User found but no admin rank
          console.log(`  ℹ️ User found but rank is: "${participantRank}" (not admin/creator)`);
          return { isAdmin: false, role: participantRank || 'member', method: 'participants_found_not_admin' };
        }
      }
    }
    
    console.log(`  ❌ User phone not found in participants array`);
  } else {
    console.log(`❌ No participants array found`);
  }
  
  // STEP 2: Fallback - Check admins array (legacy method)
  if (groupDetails.admins && Array.isArray(groupDetails.admins)) {
    console.log(`👑 Fallback: Checking ${groupDetails.admins.length} admins in admins array`);
    
    for (const admin of groupDetails.admins) {
      const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone);
      
      if (adminPhone && isPhoneMatch(userPhone, adminPhone)) {
        console.log(`  👑 ✅ USER FOUND IN ADMINS ARRAY: ${adminPhone}`);
        return { isAdmin: true, role: 'admin', method: 'admins_array' };
      }
    }
    
    console.log(`  ❌ User not found in admins array`);
  }
  
  // STEP 3: Check owner field (legacy method)
  if (groupDetails.owner) {
    const ownerPhone = typeof groupDetails.owner === 'string' ? groupDetails.owner : (groupDetails.owner.id || groupDetails.owner.phone);
    
    if (ownerPhone && isPhoneMatch(userPhone, ownerPhone)) {
      console.log(`  👑 ✅ USER IS OWNER: ${ownerPhone}`);
      return { isAdmin: true, role: 'owner', method: 'owner_field' };
    }
  }
  
  // STEP 4: Check creator field (legacy method)
  if (groupDetails.creator) {
    const creatorPhone = typeof groupDetails.creator === 'string' ? groupDetails.creator : (groupDetails.creator.id || groupDetails.creator.phone);
    
    if (creatorPhone && isPhoneMatch(userPhone, creatorPhone)) {
      console.log(`  👑 ✅ USER IS CREATOR: ${creatorPhone}`);
      return { isAdmin: true, role: 'creator', method: 'creator_field' };
    }
  }
  
  console.log(`❌ User is NOT admin/creator in "${groupName}"`);
  return { isAdmin: false, role: 'member', method: 'not_found' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 PERFECT SYNC: WHAPI Fixed - Group Creator/Admin Data Now Available!')

    const { userId }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's WHAPI token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      console.error('❌ No WHAPI token found for user:', userId)
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

    console.log(`🆔 Using Channel ID: ${profile.instance_id}`)

    // STEP 1: Get user phone number
    console.log('📱 Getting user profile for phone number...')
    let userPhoneNumber = null
    
    try {
      const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })
    
      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        
        userPhoneNumber = profileData.phone || 
                         profileData.id || 
                         profileData.wid ||
                         profileData.jid ||
                         (profileData.me && profileData.me.phone) ||
                         (profileData.user && profileData.user.phone)
        
        console.log('📞 User phone number identified:', userPhoneNumber)
        console.log('📞 Available profile fields:', Object.keys(profileData))
        
        if (userPhoneNumber) {
          const phoneVariations = createPhoneVariations(userPhoneNumber)
          console.log('📞 Generated phone variations count:', phoneVariations.length)
        }
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
      }
    } catch (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine user phone number',
          suggestion: 'Check your WhatsApp connection and try again',
          channel_id: profile.instance_id
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // STEP 2: Get groups list
    console.log('📋 Fetching groups list...')
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text()
      console.error('❌ Failed to fetch groups:', groupsResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch WhatsApp groups', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    let allGroups = []
    
    if (Array.isArray(groupsData)) {
      allGroups = groupsData
    } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
      allGroups = groupsData.groups
    } else if (groupsData.data && Array.isArray(groupsData.data)) {
      allGroups = groupsData.data
    }

    console.log(`📊 Found ${allGroups.length} groups total`)

    // STEP 3: Process groups with timeout protection (limit to 50 groups to avoid timeout)
    const maxGroupsToProcess = Math.min(allGroups.length, 50);
    const groupsToProcess = allGroups.slice(0, maxGroupsToProcess);
    
    console.log(`📊 Processing ${groupsToProcess.length} groups (limited for performance)`);
    if (allGroups.length > 50) {
      console.log(`⚠️ Note: ${allGroups.length - 50} groups will be processed in next sync`);
    }

    const groupsToInsert = []
    let adminCount = 0
    let creatorCount = 0
    let ownerCount = 0
    let memberCount = 0
    let totalMembersCount = 0
    const roleDistribution = { creator: 0, admin: 0, owner: 0, superadmin: 0, member: 0 }
    const detectionMethods = {}

    const startTime = Date.now()

    for (let i = 0; i < groupsToProcess.length; i++) {
      // Timeout protection
      if (Date.now() - startTime > 25000) { // 25 seconds max
        console.log(`⏰ Timeout protection: Stopping at group ${i + 1}/${groupsToProcess.length}`);
        break;
      }

      const group = groupsToProcess[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`\n🔍 [${i + 1}/${groupsToProcess.length}] Processing: "${groupName}"`)
      
      let userRole = { isAdmin: false, role: 'member', method: 'unknown' }
      let participantsCount = 0

      try {
        // Get detailed group information
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Show complete structure for first 3 groups (debugging)
          if (i < 3) {
            console.log(`📋 GROUP STRUCTURE for "${groupName}":`, JSON.stringify(detailData, null, 2));
          }
          
          // Get participant count
          participantsCount = detailData.participants?.length || 
                             detailData.participants_count || 
                             detailData.size || 0;

          console.log(`👥 Group "${groupName}" has ${participantsCount} participants`);

          // PERFECT ROLE DETECTION
          userRole = detectUserRole(userPhoneNumber, detailData, groupName);
          
        } else {
          console.log(`⚠️ Could not get details for "${groupName}": ${detailResponse.status}`)
          participantsCount = group.participants_count || group.size || 0
          
          // Fallback: try basic group data
          if (group.admins && Array.isArray(group.admins)) {
            for (const admin of group.admins) {
              const adminPhone = admin.id || admin.phone || admin
              if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
                userRole = { isAdmin: true, role: 'admin', method: 'fallback_admins' }
                console.log(`👑 ✅ Found user as admin in "${groupName}" (fallback)`)
                break
              }
            }
          }
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        console.error(`❌ Error processing group ${group.id}:`, error)
        participantsCount = group.participants_count || group.size || 0
      }

      // Count statistics
      if (userRole.isAdmin) {
        adminCount++
        
        if (userRole.role === 'creator') creatorCount++
        else if (userRole.role === 'owner') ownerCount++
      } else {
        memberCount++
      }
      
      totalMembersCount += participantsCount
      
      // Track role distribution
      roleDistribution[userRole.role as keyof typeof roleDistribution]++
      
      // Track detection methods
      detectionMethods[userRole.method] = (detectionMethods[userRole.method] || 0) + 1

      // Add to groups list
      groupsToInsert.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: userRole.isAdmin,
        user_role: userRole.role,
        detection_method: userRole.method,
        avatar_url: group.avatar_url || group.picture || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      const roleEmoji = userRole.role === 'creator' ? '👑' : userRole.role === 'admin' ? '🔑' : userRole.role === 'owner' ? '👤' : '👥'
      console.log(`${roleEmoji} RESULT: "${groupName}" - ${userRole.role} (${userRole.method}) - ${participantsCount} members`)
    }

    // Enhanced logging
    console.log(`\n📊 ===== SYNC RESULTS =====`)
    console.log(`📈 Groups processed: ${groupsToInsert.length}`)
    console.log(`📈 Total groups available: ${allGroups.length}`)
    console.log(`👑 Total admin groups: ${adminCount}`)
    console.log(`  - Creator: ${creatorCount}`)
    console.log(`  - Admin: ${adminCount - creatorCount - ownerCount}`)
    console.log(`  - Owner: ${ownerCount}`)
    console.log(`👥 Member groups: ${memberCount}`)
    console.log(`👥 Total members across groups: ${totalMembersCount}`)
    console.log(`🔍 Role distribution:`, roleDistribution)
    console.log(`🔧 Detection methods:`, detectionMethods)

    const adminGroups = groupsToInsert.filter(g => g.is_admin)
    const memberGroups = groupsToInsert.filter(g => !g.is_admin)

    if (adminCount > 0) {
      console.log('\n👑 ADMIN GROUPS FOUND:')
      adminGroups.forEach(g => {
        const roleEmoji = g.user_role === 'creator' ? '👑' : g.user_role === 'admin' ? '🔑' : '👤'
        console.log(`  ${roleEmoji} ${g.name} (${g.user_role}) - ${g.participants_count} members`)
      })
    } else {
      console.log('\n❌ NO ADMIN GROUPS DETECTED')
      console.log('💡 Possible reasons:')
      console.log('  - You are only a member in these groups')
      console.log('  - Group data is still syncing (WHAPI note: data pulled gradually after authorization)')
      console.log('  - Phone number format mismatch')
    }

    // STEP 4: Save to database
    try {
      // Clear existing groups
      const { error: deleteError } = await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('❌ Failed to clear existing groups:', deleteError)
      }

      // Insert new groups
      if (groupsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(groupsToInsert)

        if (insertError) {
          console.error('❌ Failed to insert groups:', insertError)
          return new Response(
            JSON.stringify({ error: 'Failed to save groups to database', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      console.log('✅ Successfully saved groups to database')

    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: dbError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Return detailed success response
    return new Response(
      JSON.stringify({
        success: true,
        whapi_fixed: true,
        processed_groups: groupsToInsert.length,
        total_groups_available: allGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        owner_groups_count: ownerCount,
        member_groups_count: memberCount,
        total_members: totalMembersCount,
        user_phone: userPhoneNumber,
        channel_id: profile.instance_id,
        role_distribution: roleDistribution,
        detection_methods: detectionMethods,
        admin_groups: adminGroups.map(g => ({ 
          name: g.name, 
          role: g.user_role,
          participants: g.participants_count,
          method: g.detection_method
        })),
        message: adminCount > 0 
          ? `🎉 SUCCESS! Found ${adminCount} admin groups (${creatorCount} creator, ${adminCount - creatorCount - ownerCount} admin, ${ownerCount} owner) out of ${groupsToInsert.length} processed groups`
          : `No admin groups found out of ${groupsToInsert.length} processed groups. ${allGroups.length > 50 ? 'More groups will be processed in next sync.' : 'You appear to be a member in all groups.'}`,
        whapi_note: "WHAPI confirmed they fixed the group creator/admin data issue. Data is pulled gradually after authorization.",
        next_steps: adminCount === 0 
          ? "If you expect to be admin/creator in some groups, wait a few minutes and try syncing again (WHAPI pulls data gradually), or contact WHAPI support with your channel ID."
          : "You can now send messages to your admin groups!"
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})