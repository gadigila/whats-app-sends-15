import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Simple phone matching (based on WHAPI examples)
function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove WhatsApp suffixes
  let clean = phone.replace('@c.us', '').replace('@s.whatsapp.net', '');
  
  // Remove all non-digits
  const digits = clean.replace(/[^\d]/g, '');
  
  return digits;
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const clean1 = normalizePhone(phone1);
  const clean2 = normalizePhone(phone2);
  
  // Exact match
  if (clean1 === clean2) return true;
  
  // Israeli format variations (972 vs 0)
  if (clean1.startsWith('972') && clean2.startsWith('0')) {
    return clean1.substring(3) === clean2.substring(1);
  }
  
  if (clean2.startsWith('972') && clean1.startsWith('0')) {
    return clean2.substring(3) === clean1.substring(1);
  }
  
  // Last 9 digits match (for Israeli numbers)
  if (clean1.length >= 9 && clean2.length >= 9) {
    return clean1.slice(-9) === clean2.slice(-9);
  }
  
  return false;
}

// Check if user is admin based on WHAPI documentation
function checkUserAdminStatus(userPhone: string, groupData: any): { isAdmin: boolean, role: string } {
  if (!userPhone || !groupData) {
    return { isAdmin: false, role: 'member' };
  }
  
  console.log(`🔍 Checking admin status for user: ${userPhone}`);
  
  // Method 1: Check participants array for rank (WHAPI's recommendation)
  if (groupData.participants && Array.isArray(groupData.participants)) {
    console.log(`👥 Checking ${groupData.participants.length} participants`);
    
    for (const participant of groupData.participants) {
      const participantId = participant.id || participant.phone;
      const rank = participant.rank;
      
      if (participantId && isPhoneMatch(userPhone, participantId)) {
        console.log(`✅ User found! Phone: ${participantId}, Rank: ${rank}`);
        
        // WHAPI documentation mentions these ranks
        if (rank === 'creator') {
          console.log(`👑 User is CREATOR`);
          return { isAdmin: true, role: 'creator' };
        }
        
        if (rank === 'admin') {
          console.log(`🔑 User is ADMIN`);
          return { isAdmin: true, role: 'admin' };
        }
        
        // User found but not admin
        console.log(`ℹ️ User found as: ${rank || 'member'}`);
        return { isAdmin: false, role: rank || 'member' };
      }
    }
    
    console.log(`❌ User not found in participants`);
  } else {
    console.log(`⚠️ No participants data available`);
  }
  
  // Method 2: Check admins array (fallback)
  if (groupData.admins && Array.isArray(groupData.admins)) {
    console.log(`👑 Checking admins array: ${groupData.admins.length} admins`);
    
    for (const admin of groupData.admins) {
      const adminPhone = typeof admin === 'string' ? admin : admin.id;
      
      if (adminPhone && isPhoneMatch(userPhone, adminPhone)) {
        console.log(`👑 User found in admins array`);
        return { isAdmin: true, role: 'admin' };
      }
    }
  }
  
  console.log(`❌ User is not admin in this group`);
  return { isAdmin: false, role: 'member' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 WHAPI Documentation Compliant Sync Starting...')

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
      console.error('❌ Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      console.error('❌ Instance not connected:', profile.instance_status)
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected', status: profile.instance_status }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ User profile validated')

    // STEP 1: Check instance health (as per WHAPI docs)
    console.log('🏥 Checking instance health...')
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
        console.log('🏥 Health check:', healthData)
      } else {
        console.log('⚠️ Health check failed:', healthResponse.status)
      }
    } catch (healthError) {
      console.log('⚠️ Health check error:', healthError)
    }

    // STEP 2: Get user profile (following WHAPI docs pattern)
    console.log('📱 Getting user profile...')
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
        const userData = await profileResponse.json()
        userPhoneNumber = userData.phone || userData.id || userData.wid
        console.log('📞 User phone detected:', userPhoneNumber)
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
        const errorText = await profileResponse.text()
        console.error('❌ Error details:', errorText)
      }
    } catch (error) {
      console.error('❌ Profile fetch error:', error)
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Could not determine user phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // STEP 3: Get groups list (WHAPI standard endpoint)
    console.log('📋 Fetching groups...')
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text()
      console.error('❌ Groups fetch failed:', groupsResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    
    // Handle different response formats (as per WHAPI docs)
    let allGroups = []
    if (Array.isArray(groupsData)) {
      allGroups = groupsData
    } else if (groupsData.groups) {
      allGroups = groupsData.groups
    } else if (groupsData.data) {
      allGroups = groupsData.data
    }

    console.log(`📊 Found ${allGroups.length} groups`)

    if (allGroups.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          groups_count: 0,
          admin_groups_count: 0,
          message: 'No groups found'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // STEP 4: Process groups (limit to avoid timeout)
    const maxGroups = Math.min(allGroups.length, 20)
    console.log(`📊 Processing ${maxGroups} groups (WHAPI compliant method)`)

    const processedGroups = []
    let adminCount = 0
    let dataAvailableCount = 0

    for (let i = 0; i < maxGroups; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${i + 1}`
      
      console.log(`\n[${i + 1}/${maxGroups}] Processing: "${groupName}"`)

      let userStatus = { isAdmin: false, role: 'member' }
      let participantsCount = group.participants_count || group.size || 0

      try {
        // Get detailed group info (WHAPI endpoint)
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Update participant count from detailed data
          participantsCount = detailData.participants?.length || 
                             detailData.participants_count || 
                             detailData.size || 
                             participantsCount

          // Check if detailed data is available
          if (detailData.participants && detailData.participants.length > 0) {
            dataAvailableCount++
            console.log(`✅ Detailed data available: ${detailData.participants.length} participants`)
            
            // Check admin status
            userStatus = checkUserAdminStatus(userPhoneNumber, detailData)
          } else {
            console.log(`⚠️ No detailed participant data yet (WHAPI gradual loading)`);
            
            // Try basic admin check from group list data
            if (group.admins && Array.isArray(group.admins)) {
              for (const admin of group.admins) {
                const adminPhone = admin.id || admin.phone || admin
                if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
                  userStatus = { isAdmin: true, role: 'admin' }
                  console.log(`👑 Found user in basic admins list`)
                  break
                }
              }
            }
          }
        } else {
          console.log(`⚠️ Could not get group details: ${detailResponse.status}`)
        }

        // Delay between requests (WHAPI rate limiting)
        await new Promise(resolve => setTimeout(resolve, 400))

      } catch (error) {
        console.error(`❌ Error processing group: ${error}`)
      }

      if (userStatus.isAdmin) {
        adminCount++
      }

      processedGroups.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: userStatus.isAdmin,
        user_role: userStatus.role,
        avatar_url: group.avatar_url || group.picture || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      const statusEmoji = userStatus.isAdmin ? '👑' : '👥'
      console.log(`${statusEmoji} "${groupName}": ${userStatus.role} (${participantsCount} members)`)
    }

    // Results summary
    console.log(`\n📊 WHAPI SYNC RESULTS:`)
    console.log(`  - Groups processed: ${processedGroups.length}`)
    console.log(`  - Groups with detailed data: ${dataAvailableCount}`)
    console.log(`  - Admin groups found: ${adminCount}`)
    console.log(`  - Data availability: ${Math.round((dataAvailableCount / processedGroups.length) * 100)}%`)

    // Save to database
    try {
      // Clear existing
      await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)

      // Insert new
      if (processedGroups.length > 0) {
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(processedGroups)

        if (insertError) {
          console.error('❌ Database insert error:', insertError)
          return new Response(
            JSON.stringify({ error: 'Failed to save to database' }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      console.log('✅ Data saved to database')
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Success response
    const adminGroups = processedGroups.filter(g => g.is_admin)
    
    return new Response(
      JSON.stringify({
        success: true,
        whapi_compliant: true,
        groups_count: processedGroups.length,
        total_groups_available: allGroups.length,
        admin_groups_count: adminCount,
        member_groups_count: processedGroups.length - adminCount,
        data_availability_percentage: Math.round((dataAvailableCount / processedGroups.length) * 100),
        groups_with_detailed_data: dataAvailableCount,
        user_phone: userPhoneNumber,
        channel_id: profile.instance_id,
        admin_groups: adminGroups.map(g => ({ 
          name: g.name, 
          role: g.user_role,
          participants: g.participants_count
        })),
        message: adminCount > 0 
          ? `🎉 Found ${adminCount} admin groups! WHAPI data loading working correctly.`
          : dataAvailableCount < processedGroups.length / 2
            ? `No admin groups found. ${Math.round(((processedGroups.length - dataAvailableCount) / processedGroups.length) * 100)}% of groups still loading data (WHAPI gradual sync).`
            : `No admin groups found in ${processedGroups.length} fully loaded groups.`,
        whapi_note: dataAvailableCount < processedGroups.length / 2 
          ? "Group data is still loading. Wait 5-10 minutes and sync again for complete results."
          : "Group data is fully loaded.",
        recommendation: dataAvailableCount < processedGroups.length / 2
          ? "Wait 5-10 minutes for WHAPI to finish loading group data, then sync again."
          : adminCount === 0 
            ? "You appear to be a member (not admin/creator) in all processed groups."
            : "Admin detection is working correctly!"
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 WHAPI compliant sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Sync failed', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})