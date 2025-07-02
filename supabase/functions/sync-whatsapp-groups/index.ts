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
  
  // Handle @c.us suffix (WhatsApp format)
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
  if (digitsOnly && digitsOnly.length >= 8) {
    variations.add(digitsOnly);
    variations.add(`+${digitsOnly}`);
    
    // Israel specific (972)
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

    // Add WhatsApp suffixes
    variations.add(`${digitsOnly}@c.us`);
    variations.add(`${digitsOnly}@s.whatsapp.net`);
    
    if (digitsOnly.startsWith('972')) {
      const withoutCountryCode = digitsOnly.substring(3);
      variations.add(`${withoutCountryCode}@c.us`);
      variations.add(`0${withoutCountryCode}@c.us`);
    }
    
    // Handle 10-digit Israeli numbers (like 0501234567)
    if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
      const without0 = digitsOnly.substring(1);
      variations.add(without0);
      variations.add(`+972${without0}`);
      variations.add(`972${without0}`);
      variations.add(`${without0}@c.us`);
    }
    
    // Handle 9-digit Israeli numbers (like 501234567)
    if (digitsOnly.length === 9 && !digitsOnly.startsWith('0') && !digitsOnly.startsWith('972')) {
      variations.add(`0${digitsOnly}`);
      variations.add(`+972${digitsOnly}`);
      variations.add(`972${digitsOnly}`);
      variations.add(`${digitsOnly}@c.us`);
    }
  }
  
  return Array.from(variations).filter(v => v.length >= 8);
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const variations1 = createPhoneVariations(phone1);
  const variations2 = createPhoneVariations(phone2);
  
  return variations1.some(v1 => variations2.includes(v1));
}

// Simple but effective admin detection
function checkUserRole(userPhone: string, groupDetails: any, groupName: string): { isAdmin: boolean, role: string } {
  if (!userPhone || !groupDetails) {
    return { isAdmin: false, role: 'member' };
  }
  
  console.log(`🔍 Checking role in "${groupName}" for user: ${userPhone}`);
  
  // Method 1: Check participants array for rank
  if (groupDetails.participants && Array.isArray(groupDetails.participants)) {
    console.log(`👥 Checking ${groupDetails.participants.length} participants`);
    
    for (const participant of groupDetails.participants) {
      const participantPhone = participant.id || participant.phone;
      const participantRank = participant.rank;
      
      if (participantPhone && isPhoneMatch(userPhone, participantPhone)) {
        console.log(`✅ Phone match! Participant: ${participantPhone}, Rank: ${participantRank}`);
        
        if (participantRank === 'creator') {
          console.log(`👑 USER IS CREATOR in "${groupName}"`);
          return { isAdmin: true, role: 'creator' };
        }
        
        if (participantRank === 'admin') {
          console.log(`🔑 USER IS ADMIN in "${groupName}"`);
          return { isAdmin: true, role: 'admin' };
        }
        
        if (participantRank === 'owner') {
          console.log(`👤 USER IS OWNER in "${groupName}"`);
          return { isAdmin: true, role: 'owner' };
        }
        
        // User found but not admin
        console.log(`ℹ️ User found but role is: ${participantRank}`);
        return { isAdmin: false, role: participantRank || 'member' };
      }
    }
  }
  
  // Method 2: Check admins array (fallback)
  if (groupDetails.admins && Array.isArray(groupDetails.admins)) {
    console.log(`👑 Checking ${groupDetails.admins.length} admins in array`);
    
    for (const admin of groupDetails.admins) {
      const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone);
      
      if (adminPhone && isPhoneMatch(userPhone, adminPhone)) {
        console.log(`👑 USER FOUND IN ADMINS ARRAY: ${adminPhone}`);
        return { isAdmin: true, role: 'admin' };
      }
    }
  }
  
  console.log(`❌ User is not admin in "${groupName}"`);
  return { isAdmin: false, role: 'member' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting robust WhatsApp groups sync...')

    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const { userId } = requestBody as SyncGroupsRequest;

    if (!userId || typeof userId !== 'string') {
      console.error('❌ Invalid or missing userId:', userId);
      return new Response(
        JSON.stringify({ error: 'Valid User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Processing for user:', userId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's WHAPI token
    console.log('🔍 Fetching user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found', details: profileError.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!profile?.whapi_token) {
      console.error('❌ No WHAPI token found for user:', userId);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      console.error('❌ WhatsApp not connected. Status:', profile.instance_status);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected', status: profile.instance_status }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ User profile validated. Instance ID:', profile.instance_id);

    // STEP 1: Get user phone number
    console.log('📱 Getting user phone number...');
    let userPhoneNumber = null;
    
    try {
      const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      });
    
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        
        userPhoneNumber = profileData.phone || 
                         profileData.id || 
                         profileData.wid ||
                         profileData.jid ||
                         (profileData.me && profileData.me.phone) ||
                         (profileData.user && profileData.user.phone);
        
        console.log('📞 User phone identified:', userPhoneNumber);
        console.log('📞 Profile fields available:', Object.keys(profileData));
      } else {
        console.error('❌ Failed to get user profile from WHAPI:', profileResponse.status);
        const errorText = await profileResponse.text();
        console.error('❌ WHAPI profile error:', errorText);
      }
    } catch (profileFetchError) {
      console.error('❌ Error fetching user profile from WHAPI:', profileFetchError);
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine user phone number',
          suggestion: 'Check your WhatsApp connection and try reconnecting',
          channel_id: profile.instance_id
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // STEP 2: Get groups list
    console.log('📋 Fetching groups list...');
    let allGroups = [];
    
    try {
      const groupsResponse = await fetch(`https://gate.whapi.cloud/groups`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!groupsResponse.ok) {
        const errorText = await groupsResponse.text();
        console.error('❌ Failed to fetch groups:', groupsResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch WhatsApp groups', details: errorText }),
          { status: 400, headers: corsHeaders }
        )
      }

      const groupsData = await groupsResponse.json();
      
      if (Array.isArray(groupsData)) {
        allGroups = groupsData;
      } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
        allGroups = groupsData.groups;
      } else if (groupsData.data && Array.isArray(groupsData.data)) {
        allGroups = groupsData.data;
      }

      console.log(`📊 Found ${allGroups.length} groups total`);
      
    } catch (groupsFetchError) {
      console.error('❌ Error fetching groups:', groupsFetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups', details: groupsFetchError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (allGroups.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          groups_count: 0,
          admin_groups_count: 0,
          message: 'No groups found for this WhatsApp account'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // STEP 3: Process groups (limit to 15 for safety)
    const maxGroups = Math.min(allGroups.length, 15);
    const groupsToProcess = allGroups.slice(0, maxGroups);
    
    console.log(`📊 Processing ${groupsToProcess.length} groups (limited for safety)`);

    const groupsToInsert = [];
    let adminCount = 0;
    let creatorCount = 0;
    let totalMembersCount = 0;

    for (let i = 0; i < groupsToProcess.length; i++) {
      const group = groupsToProcess[i];
      const groupName = group.name || group.subject || `Group ${group.id}`;
      
      console.log(`\n[${i + 1}/${groupsToProcess.length}] Processing: "${groupName}"`);
      
      let userRole = { isAdmin: false, role: 'member' };
      let participantsCount = 0;

      try {
        // Get detailed group information
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          
          // Show structure for first group (debugging)
          if (i === 0) {
            console.log(`📋 First group structure sample:`, JSON.stringify(detailData, null, 2));
          }
          
          participantsCount = detailData.participants?.length || 
                             detailData.participants_count || 
                             detailData.size || 0;

          console.log(`👥 Group has ${participantsCount} participants`);

          // Check user role
          userRole = checkUserRole(userPhoneNumber, detailData, groupName);
          
        } else {
          console.log(`⚠️ Could not get details for "${groupName}": ${detailResponse.status}`);
          participantsCount = group.participants_count || group.size || 0;
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 400));

      } catch (error) {
        console.error(`❌ Error processing group "${groupName}":`, error);
        participantsCount = group.participants_count || group.size || 0;
      }

      // Update counters
      if (userRole.isAdmin) {
        adminCount++;
        if (userRole.role === 'creator') creatorCount++;
      }
      
      totalMembersCount += participantsCount;

      // Add to results
      groupsToInsert.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: userRole.isAdmin,
        user_role: userRole.role,
        avatar_url: group.avatar_url || group.picture || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const roleEmoji = userRole.role === 'creator' ? '👑' : userRole.role === 'admin' ? '🔑' : '👥';
      console.log(`${roleEmoji} "${groupName}": ${userRole.role} - ${participantsCount} members`);
    }

    // Results summary
    console.log(`\n📊 SYNC RESULTS:`);
    console.log(`  - Groups processed: ${groupsToInsert.length}`);
    console.log(`  - Admin groups: ${adminCount} (${creatorCount} creators)`);
    console.log(`  - Member groups: ${groupsToInsert.length - adminCount}`);
    console.log(`  - Total members: ${totalMembersCount}`);

    // STEP 4: Save to database
    try {
      console.log('💾 Saving to database...');
      
      // Clear existing groups
      const { error: deleteError } = await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ Failed to clear existing groups:', deleteError);
      }

      // Insert new groups
      if (groupsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(groupsToInsert);

        if (insertError) {
          console.error('❌ Failed to insert groups:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save groups to database', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      console.log('✅ Successfully saved to database');

    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: dbError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Success response
    const adminGroups = groupsToInsert.filter(g => g.is_admin);
    
    return new Response(
      JSON.stringify({
        success: true,
        processed_groups: groupsToInsert.length,
        total_groups_available: allGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        member_groups_count: groupsToInsert.length - adminCount,
        total_members: totalMembersCount,
        user_phone: userPhoneNumber,
        channel_id: profile.instance_id,
        admin_groups: adminGroups.map(g => ({ 
          name: g.name, 
          role: g.user_role,
          participants: g.participants_count
        })),
        message: adminCount > 0 
          ? `🎉 Found ${adminCount} admin groups (${creatorCount} creator) out of ${groupsToInsert.length} processed!`
          : `No admin groups found in ${groupsToInsert.length} processed groups. ${allGroups.length > 15 ? 'More groups available for next sync.' : ''}`,
        limited: allGroups.length > 15,
        whapi_note: "WHAPI fixed group data - creators/admins should now be visible"
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        type: error.name
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})