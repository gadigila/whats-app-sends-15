import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Simple phone matching function
function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  // Remove all non-digits for comparison
  const clean1 = phone1.replace(/[^\d]/g, '');
  const clean2 = phone2.replace(/[^\d]/g, '');
  
  if (clean1 === clean2) return true;
  
  // Check last 9 digits (Israeli mobile numbers)
  if (clean1.length >= 9 && clean2.length >= 9) {
    if (clean1.slice(-9) === clean2.slice(-9)) return true;
  }
  
  // Handle 972 country code variations
  if (clean1.startsWith('972') && clean2.startsWith('0')) {
    if (clean1.substring(3) === clean2.substring(1)) return true;
  }
  
  if (clean2.startsWith('972') && clean1.startsWith('0')) {
    if (clean2.substring(3) === clean1.substring(1)) return true;
  }
  
  return false;
}

// WHAPI compliant admin detection
function checkIfUserIsAdmin(userPhone: string, groupData: any): boolean {
  if (!userPhone || !groupData) return false;
  
  // Method 1: Check participants array for rank = "creator" (WHAPI recommendation)
  if (groupData.participants && Array.isArray(groupData.participants)) {
    for (const participant of groupData.participants) {
      const participantPhone = participant.id || participant.phone;
      const rank = participant.rank;
      
      if (participantPhone && isPhoneMatch(userPhone, participantPhone)) {
        if (rank === 'creator' || rank === 'admin' || rank === 'owner') {
          return true;
        }
      }
    }
  }
  
  // Method 2: Check admins array
  if (groupData.admins && Array.isArray(groupData.admins)) {
    for (const admin of groupData.admins) {
      const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone);
      if (adminPhone && isPhoneMatch(userPhone, adminPhone)) {
        return true;
      }
    }
  }
  
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Starting WHAPI compliant sync...');

  try {
    // Parse request
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      console.error('❌ Missing userId');
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('👤 User ID:', userId);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.whapi_token) {
      console.error('❌ Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (profile.instance_status !== 'connected') {
      console.error('❌ Not connected. Status:', profile.instance_status);
      return new Response(
        JSON.stringify({ error: 'WhatsApp not connected', status: profile.instance_status }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('✅ Profile validated');

    // Get user phone from WHAPI
    console.log('📱 Getting user phone...');
    let userPhone = null;
    
    try {
      const profileResponse = await fetch('https://gate.whapi.cloud/users/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        userPhone = profileData.phone || profileData.id || profileData.wid;
        console.log('📞 User phone:', userPhone);
      } else {
        console.error('❌ Failed to get user phone:', profileResponse.status);
      }
    } catch (error) {
      console.error('❌ Error getting user phone:', error);
    }

    if (!userPhone) {
      return new Response(
        JSON.stringify({ error: 'Could not get user phone number' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get groups from WHAPI
    console.log('📋 Fetching groups...');
    const groupsResponse = await fetch('https://gate.whapi.cloud/groups', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text();
      console.error('❌ Groups fetch failed:', groupsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const groupsData = await groupsResponse.json();
    const allGroups = Array.isArray(groupsData) ? groupsData : (groupsData.groups || []);
    
    console.log(`📊 Found ${allGroups.length} groups`);

    if (allGroups.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          groups_count: 0,
          admin_groups_count: 0,
          message: 'No groups found'
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Process first 10 groups only (to avoid timeout)
    const groupsToProcess = allGroups.slice(0, 10);
    console.log(`📊 Processing ${groupsToProcess.length} groups`);

    const results = [];
    let adminCount = 0;

    for (let i = 0; i < groupsToProcess.length; i++) {
      const group = groupsToProcess[i];
      const groupName = group.name || group.subject || `Group ${i + 1}`;
      
      console.log(`[${i + 1}] Processing: ${groupName}`);

      let isAdmin = false;
      let participantsCount = group.participants_count || group.size || 0;

      try {
        // Get group details
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          participantsCount = detailData.participants?.length || participantsCount;
          
          // Check if user is admin
          isAdmin = checkIfUserIsAdmin(userPhone, detailData);
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`❌ Error processing ${groupName}:`, error);
      }

      if (isAdmin) adminCount++;

      results.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: isAdmin,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`${isAdmin ? '👑' : '👥'} ${groupName}: ${isAdmin ? 'ADMIN' : 'MEMBER'}`);
    }

    console.log(`📊 Results: ${adminCount} admin groups out of ${results.length}`);

    // Save to database (basic schema)
    try {
      // Clear existing
      await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId);

      // Insert new
      if (results.length > 0) {
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(results);

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Database error', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      console.log('✅ Saved to database');
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: results.length,
        admin_groups_count: adminCount,
        total_groups_available: allGroups.length,
        user_phone: userPhone,
        message: `Processed ${results.length} groups, found ${adminCount} admin groups`,
        admin_groups: results.filter(g => g.is_admin).map(g => ({ name: g.name, participants: g.participants_count }))
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});