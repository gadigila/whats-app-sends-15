import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// FIXED: Israeli phone number matching - much more aggressive
function createIsraeliPhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  const variations = new Set<string>();
  
  // Always add original
  variations.add(phone);
  
  // Remove all WhatsApp suffixes first
  let cleanPhone = phone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', ''); // Group suffix
  
  variations.add(cleanPhone);
  
  // Extract only digits
  const digitsOnly = cleanPhone.replace(/[^\d]/g, '');
  if (!digitsOnly || digitsOnly.length < 9) return Array.from(variations);
  
  console.log(`📱 Creating variations for: "${phone}" -> digits: "${digitsOnly}"`);
  
  // Add digits-only version
  variations.add(digitsOnly);
  
  // Israeli specific handling - MUCH MORE AGGRESSIVE
  if (digitsOnly.startsWith('972')) {
    // 972XXXXXXXXX format
    const without972 = digitsOnly.substring(3);
    variations.add(without972);           // XXXXXXXXX
    variations.add(`0${without972}`);     // 0XXXXXXXXX
    variations.add(`+972${without972}`);  // +972XXXXXXXXX
    
    // Add WhatsApp suffixes to all variations
    variations.add(`${digitsOnly}@c.us`);
    variations.add(`${without972}@c.us`);
    variations.add(`0${without972}@c.us`);
    variations.add(`${digitsOnly}@s.whatsapp.net`);
    variations.add(`${without972}@s.whatsapp.net`);
    variations.add(`0${without972}@s.whatsapp.net`);
  }
  
  if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
    // 0XXXXXXXXX format (Israeli local)
    const without0 = digitsOnly.substring(1);
    variations.add(without0);             // XXXXXXXXX
    variations.add(`972${without0}`);     // 972XXXXXXXXX
    variations.add(`+972${without0}`);    // +972XXXXXXXXX
    
    // Add WhatsApp suffixes
    variations.add(`${without0}@c.us`);
    variations.add(`972${without0}@c.us`);
    variations.add(`${digitsOnly}@c.us`);
    variations.add(`${without0}@s.whatsapp.net`);
    variations.add(`972${without0}@s.whatsapp.net`);
    variations.add(`${digitsOnly}@s.whatsapp.net`);
  }
  
  if (digitsOnly.length === 9 && !digitsOnly.startsWith('0') && !digitsOnly.startsWith('972')) {
    // XXXXXXXXX format (9 digits)
    variations.add(`0${digitsOnly}`);     // 0XXXXXXXXX
    variations.add(`972${digitsOnly}`);   // 972XXXXXXXXX
    variations.add(`+972${digitsOnly}`);  // +972XXXXXXXXX
    
    // Add WhatsApp suffixes
    variations.add(`${digitsOnly}@c.us`);
    variations.add(`0${digitsOnly}@c.us`);
    variations.add(`972${digitsOnly}@c.us`);
    variations.add(`${digitsOnly}@s.whatsapp.net`);
    variations.add(`0${digitsOnly}@s.whatsapp.net`);
    variations.add(`972${digitsOnly}@s.whatsapp.net`);
  }
  
  // Add + variations
  if (!cleanPhone.startsWith('+')) {
    variations.add(`+${cleanPhone}`);
    variations.add(`+${digitsOnly}`);
  }
  
  const finalVariations = Array.from(variations).filter(v => v.length >= 9);
  console.log(`📱 Generated ${finalVariations.length} variations:`, finalVariations.slice(0, 15));
  
  return finalVariations;
}

// SUPER AGGRESSIVE phone matching
function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  // Quick exact match
  if (phone1 === phone2) return true;
  
  const variations1 = createIsraeliPhoneVariations(phone1);
  const variations2 = createIsraeliPhoneVariations(phone2);
  
  // Check if any variation matches
  const hasMatch = variations1.some(v1 => variations2.includes(v1));
  
  if (!hasMatch) {
    // Last resort: extract just digits and compare last 9 digits
    const digits1 = phone1.replace(/[^\d]/g, '');
    const digits2 = phone2.replace(/[^\d]/g, '');
    
    if (digits1.length >= 9 && digits2.length >= 9) {
      const last9_1 = digits1.slice(-9);
      const last9_2 = digits2.slice(-9);
      if (last9_1 === last9_2) {
        console.log(`📱 MATCH found by last 9 digits: ${last9_1}`);
        return true;
      }
    }
  }
  
  return hasMatch;
}

// ENHANCED admin detection with detailed logging
function detectAdminRole(userPhone: string, groupData: any, groupName: string): { isAdmin: boolean, role: string, method: string } {
  console.log(`\n🔍 ========== ADMIN DETECTION: "${groupName}" ==========`);
  console.log(`👤 User phone: ${userPhone}`);
  
  if (!userPhone || !groupData) {
    return { isAdmin: false, role: 'member', method: 'no_data' };
  }
  
  // Method 1: Check participants array (MAIN METHOD)
  if (groupData.participants && Array.isArray(groupData.participants)) {
    console.log(`👥 Checking ${groupData.participants.length} participants...`);
    
    // Check first 10 participants in detail, then scan all
    for (let i = 0; i < groupData.participants.length; i++) {
      const participant = groupData.participants[i];
      const participantPhone = participant.id || participant.phone || participant.number;
      const participantRank = participant.rank || participant.role || participant.type;
      
      // Log first 10 for debugging
      if (i < 10) {
        console.log(`  [${i + 1}] Phone: "${participantPhone}" | Rank: "${participantRank}"`);
      }
      
      if (participantPhone) {
        const isMatch = isPhoneMatch(userPhone, participantPhone);
        
        if (i < 10) {
          console.log(`    📱 Match result: ${isMatch}`);
        }
        
        if (isMatch) {
          console.log(`  ✅ ===== USER FOUND! =====`);
          console.log(`  📱 Matched phone: ${participantPhone}`);
          console.log(`  👑 User rank: "${participantRank}"`);
          
          // Check for admin roles
          if (participantRank) {
            const roleCheck = participantRank.toLowerCase();
            
            if (roleCheck === 'creator') {
              console.log(`  👑 ✅ USER IS CREATOR!`);
              return { isAdmin: true, role: 'creator', method: 'participants_creator' };
            }
            
            if (roleCheck === 'admin') {
              console.log(`  🔑 ✅ USER IS ADMIN!`);
              return { isAdmin: true, role: 'admin', method: 'participants_admin' };
            }
            
            if (roleCheck === 'owner') {
              console.log(`  👤 ✅ USER IS OWNER!`);
              return { isAdmin: true, role: 'owner', method: 'participants_owner' };
            }
            
            if (roleCheck === 'superadmin') {
              console.log(`  ⭐ ✅ USER IS SUPERADMIN!`);
              return { isAdmin: true, role: 'superadmin', method: 'participants_superadmin' };
            }
          }
          
          // User found but not admin
          console.log(`  ℹ️ User found but rank is: "${participantRank}" (not admin)`);
          return { isAdmin: false, role: participantRank || 'member', method: 'participants_member' };
        }
      }
    }
    
    console.log(`  ❌ User phone not found in ${groupData.participants.length} participants`);
  } else {
    console.log(`❌ No participants array (or empty)`);
  }
  
  // Method 2: Check admins array
  if (groupData.admins && Array.isArray(groupData.admins)) {
    console.log(`👑 Checking ${groupData.admins.length} admins...`);
    
    for (const admin of groupData.admins) {
      const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone);
      console.log(`  👑 Admin: "${adminPhone}"`);
      
      if (adminPhone && isPhoneMatch(userPhone, adminPhone)) {
        console.log(`  👑 ✅ USER FOUND IN ADMINS ARRAY!`);
        return { isAdmin: true, role: 'admin', method: 'admins_array' };
      }
    }
  }
  
  // Method 3: Check owner/creator fields
  const ownerPhone = typeof groupData.owner === 'string' ? groupData.owner : (groupData.owner?.id || groupData.owner?.phone);
  if (ownerPhone) {
    console.log(`👤 Owner: "${ownerPhone}"`);
    if (isPhoneMatch(userPhone, ownerPhone)) {
      console.log(`👤 ✅ USER IS OWNER!`);
      return { isAdmin: true, role: 'owner', method: 'owner_field' };
    }
  }
  
  const creatorPhone = typeof groupData.creator === 'string' ? groupData.creator : (groupData.creator?.id || groupData.creator?.phone);
  if (creatorPhone) {
    console.log(`👑 Creator: "${creatorPhone}"`);
    if (isPhoneMatch(userPhone, creatorPhone)) {
      console.log(`👑 ✅ USER IS CREATOR!`);
      return { isAdmin: true, role: 'creator', method: 'creator_field' };
    }
  }
  
  console.log(`❌ User is NOT admin in "${groupName}"`);
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

    console.log('🚀 Phone Matching Fix: Israeli Numbers Focus')

    const { userId }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
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

    // Get user phone
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
        
        if (userPhoneNumber) {
          const phoneVariations = createIsraeliPhoneVariations(userPhoneNumber)
          console.log('📞 Phone variations sample:', phoneVariations.slice(0, 10))
        }
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
      }
    } catch (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Could not determine user phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get groups
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

    // Process groups with enhanced admin detection
    const groupsToInsert = []
    let adminCount = 0
    let totalMembersCount = 0
    const roleStats = { creator: 0, admin: 0, owner: 0, superadmin: 0, member: 0 }

    // Process first 15 groups to avoid timeout
    const maxGroups = Math.min(allGroups.length, 15)
    console.log(`📊 Processing first ${maxGroups} groups`)

    for (let i = 0; i < maxGroups; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`\n🔍 [${i + 1}/${maxGroups}] Processing: "${groupName}"`)
      
      let userRole = { isAdmin: false, role: 'member', method: 'unknown' }
      let participantsCount = 0

      try {
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          participantsCount = detailData.participants?.length || 
                             detailData.participants_count || 
                             detailData.size || 0

          console.log(`👥 Group "${groupName}" has ${participantsCount} participants`)

          // ENHANCED admin detection
          userRole = detectAdminRole(userPhoneNumber, detailData, groupName)
          
        } else {
          console.log(`⚠️ Could not get details for "${groupName}": ${detailResponse.status}`)
          participantsCount = group.participants_count || group.size || 0
        }

        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        console.error(`❌ Error processing group ${group.id}:`, error)
        participantsCount = group.participants_count || group.size || 0
      }

      if (userRole.isAdmin) {
        adminCount++
      }
      
      totalMembersCount += participantsCount
      roleStats[userRole.role as keyof typeof roleStats]++

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

    console.log(`\n📊 ENHANCED RESULTS:`)
    console.log(`  - Groups processed: ${groupsToInsert.length}`)
    console.log(`  - Admin groups found: ${adminCount}`)
    console.log(`  - Role distribution:`, roleStats)

    const adminGroups = groupsToInsert.filter(g => g.is_admin)

    if (adminCount > 0) {
      console.log('👑 ADMIN GROUPS FOUND:')
      adminGroups.forEach(g => {
        const roleEmoji = g.user_role === 'creator' ? '👑' : g.user_role === 'admin' ? '🔑' : '👤'
        console.log(`  ${roleEmoji} ${g.name} (${g.user_role} via ${g.detection_method}) - ${g.participants_count} members`)
      })
    } else {
      console.log('❌ NO ADMIN GROUPS DETECTED with enhanced phone matching')
    }

    // Save to database
    try {
      const { error: deleteError } = await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('❌ Failed to clear existing groups:', deleteError)
      }

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

    return new Response(
      JSON.stringify({
        success: true,
        enhanced_matching: true,
        groups_count: groupsToInsert.length,
        total_groups_available: allGroups.length,
        admin_groups_count: adminCount,
        member_groups_count: groupsToInsert.length - adminCount,
        total_members: totalMembersCount,
        user_phone: userPhoneNumber,
        role_distribution: roleStats,
        admin_groups: adminGroups.map(g => ({ 
          name: g.name, 
          role: g.user_role,
          participants: g.participants_count,
          method: g.detection_method
        })),
        message: adminCount > 0 
          ? `🎉 ENHANCED SUCCESS! Found ${adminCount} admin groups with improved phone matching!`
          : `Enhanced phone matching applied but no admin groups found. Check logs for detailed analysis.`
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