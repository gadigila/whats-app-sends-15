import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// SIMPLIFIED phone number matching - following WHAPI support advice
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove WhatsApp suffixes and non-digits
  let clean = phone.replace(/@c\.us|@s\.whatsapp\.net/g, '').replace(/[^\d]/g, '');
  
  // Handle Israeli numbers specifically (972 country code)
  if (clean.startsWith('972')) {
    return clean; // Keep as international format
  }
  
  if (clean.startsWith('0') && clean.length === 10) {
    return `972${clean.substring(1)}`; // Convert 0501234567 to 972501234567
  }
  
  if (clean.length === 9 && !clean.startsWith('0')) {
    return `972${clean}`; // Convert 501234567 to 972501234567
  }
  
  return clean;
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  console.log(`🔍 Comparing phones: ${phone1} (${normalized1}) vs ${phone2} (${normalized2})`);
  
  return normalized1 === normalized2;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 Sync WhatsApp Groups: FIXED Admin Detection Starting...')

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

    // STEP 1: Get user's phone number
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
        userPhoneNumber = profileData.phone || profileData.id || profileData.wid
        
        console.log('📞 User phone number identified:', userPhoneNumber)
        console.log('📞 Normalized user phone:', normalizePhoneNumber(userPhoneNumber))
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
        return new Response(
          JSON.stringify({ error: 'Failed to get user phone number' }),
          { status: 400, headers: corsHeaders }
        )
      }
    } catch (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to get user phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Could not determine user phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const normalizedUserPhone = normalizePhoneNumber(userPhoneNumber);

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

    // STEP 3: FIXED Admin detection for each group
    const groupsToInsert = []
    let adminCount = 0
    let creatorCount = 0
    let totalMembersCount = 0

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`🔍 Processing ${i + 1}/${allGroups.length}: ${groupName}`)
      
      let isAdmin = false
      let isCreator = false
      let adminRole = 'member' // member, admin, creator
      let participantsCount = 0

      try {
        // Get detailed group information
        console.log(`📡 Fetching details for group: ${group.id}`)
        
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!detailResponse.ok) {
          console.log(`⚠️ Could not get details for "${groupName}": ${detailResponse.status}`)
          
          // Use basic group data as fallback
          participantsCount = group.participants_count || group.size || 0
          
          // Check basic group data for admin info
          if (group.admins && Array.isArray(group.admins)) {
            for (const admin of group.admins) {
              const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone || admin);
              if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
                isAdmin = true;
                adminRole = 'admin';
                console.log(`👑 Found user as admin in "${groupName}" (basic data)`);
                break;
              }
            }
          }
        } else {
          const detailData = await detailResponse.json()
          
          // Log the structure for debugging (first 3 groups only)
          if (i < 3) {
            console.log(`🔍 Group "${groupName}" structure:`, {
              hasParticipants: !!detailData.participants,
              participantsCount: detailData.participants?.length || 0,
              hasAdmins: !!detailData.admins,
              adminsCount: detailData.admins?.length || 0,
              hasOwner: !!detailData.owner,
              hasCreator: !!detailData.creator
            });
          }
          
          participantsCount = detailData.participants?.length || 
                             detailData.participants_count || 
                             detailData.size || 0;

          console.log(`👥 Group "${groupName}" has ${participantsCount} participants`);

          // METHOD 1: Check participants array for rank (WHAPI support recommended)
          if (detailData.participants && Array.isArray(detailData.participants)) {
            console.log(`👥 Checking ${detailData.participants.length} participants for roles`);
            
            for (const participant of detailData.participants) {
              const participantPhone = participant.id || participant.phone;
              const participantRank = participant.rank; // creator, admin, member
              
              if (participantPhone && isPhoneMatch(userPhoneNumber, participantPhone)) {
                console.log(`✅ FOUND USER in participants: ${participantPhone} with rank: ${participantRank}`);
                
                if (participantRank === 'creator') {
                  isCreator = true;
                  isAdmin = true; // creators are also admins
                  adminRole = 'creator';
                  console.log(`👑 User is CREATOR of "${groupName}"`);
                } else if (participantRank === 'admin') {
                  isAdmin = true;
                  adminRole = 'admin';
                  console.log(`👑 User is ADMIN of "${groupName}"`);
                } else {
                  adminRole = 'member';
                  console.log(`👤 User is MEMBER of "${groupName}"`);
                }
                break;
              }
            }
          }

          // METHOD 2: Check admins array (if not found in participants)
          if (!isAdmin && detailData.admins && Array.isArray(detailData.admins)) {
            console.log(`👑 Checking ${detailData.admins.length} admins in admins array`);
            
            for (const admin of detailData.admins) {
              const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone);
              
              if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
                isAdmin = true;
                adminRole = 'admin';
                console.log(`👑 ✅ FOUND USER in admins array: ${adminPhone}`);
                break;
              }
            }
          }

          // METHOD 3: Check owner/creator field (if not found yet)
          if (!isCreator && detailData.owner) {
            const ownerPhone = typeof detailData.owner === 'string' ? detailData.owner : (detailData.owner.id || detailData.owner.phone);
            
            if (ownerPhone && isPhoneMatch(userPhoneNumber, ownerPhone)) {
              isCreator = true;
              isAdmin = true; // creators are also admins
              adminRole = 'creator';
              console.log(`👑 ✅ FOUND USER as owner: ${ownerPhone}`);
            }
          }

          // METHOD 4: Check creator field (sometimes separate)
          if (!isCreator && detailData.creator) {
            const creatorPhone = typeof detailData.creator === 'string' ? detailData.creator : (detailData.creator.id || detailData.creator.phone);
            
            if (creatorPhone && isPhoneMatch(userPhoneNumber, creatorPhone)) {
              isCreator = true;
              isAdmin = true;
              adminRole = 'creator';
              console.log(`👑 ✅ FOUND USER as creator: ${creatorPhone}`);
            }
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        console.error(`❌ Error processing group ${group.id}:`, error)
        participantsCount = group.participants_count || group.size || 0
      }

      // Count statistics
      if (isCreator) {
        creatorCount++
      } else if (isAdmin) {
        adminCount++
      }
      
      totalMembersCount += participantsCount

      // Add to groups list with role information
      groupsToInsert.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: isAdmin,
        admin_role: adminRole, // 'member', 'admin', 'creator'
        avatar_url: group.avatar_url || group.picture || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      const roleIcon = isCreator ? '👑' : (isAdmin ? '⭐' : '👤');
      console.log(`${roleIcon} "${groupName}": ${participantsCount} members, role: ${adminRole}`)
    }

    // Enhanced logging
    console.log(`📊 FINAL RESULTS:`)
    console.log(`   👑 Creator of: ${creatorCount} groups`)
    console.log(`   ⭐ Admin of: ${adminCount} groups`) 
    console.log(`   👤 Member of: ${groupsToInsert.length - adminCount - creatorCount} groups`)
    console.log(`   📱 Total members across all groups: ${totalMembersCount}`)

    const creatorGroups = groupsToInsert.filter(g => g.admin_role === 'creator')
    const adminGroups = groupsToInsert.filter(g => g.admin_role === 'admin')
    const memberGroups = groupsToInsert.filter(g => g.admin_role === 'member')

    console.log('👑 Creator groups:', creatorGroups.map(g => `${g.name} (${g.participants_count} members)`))
    console.log('⭐ Admin groups:', adminGroups.map(g => `${g.name} (${g.participants_count} members)`))
    console.log('👤 Member groups:', memberGroups.map(g => `${g.name} (${g.participants_count} members)`))

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

    // Return success with detailed stats
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        creator_groups_count: creatorCount,
        admin_groups_count: adminCount,
        member_groups_count: groupsToInsert.length - adminCount - creatorCount,
        total_members: totalMembersCount,
        user_phone: userPhoneNumber,
        normalized_user_phone: normalizedUserPhone,
        message: `Successfully synced ${groupsToInsert.length} groups (${creatorCount} creator, ${adminCount} admin groups found)`,
        breakdown: {
          creator_groups: creatorGroups.map(g => ({ name: g.name, members: g.participants_count })),
          admin_groups: adminGroups.map(g => ({ name: g.name, members: g.participants_count })),
          member_groups: memberGroups.map(g => ({ name: g.name, members: g.participants_count }))
        }
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