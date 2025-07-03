import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Simple phone number normalization for Israeli numbers
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove WhatsApp suffixes and non-digits
  let clean = phone.replace(/@c\.us|@s\.whatsapp\.net/g, '').replace(/[^\d]/g, '');
  
  // Convert Israeli numbers to international format (972XXXXXXXXX)
  if (clean.startsWith('0') && clean.length === 10) {
    return `972${clean.substring(1)}`;
  }
  
  if (clean.length === 9 && !clean.startsWith('0') && !clean.startsWith('972')) {
    return `972${clean}`;
  }
  
  return clean;
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  return normalized1 === normalized2;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 Sync WhatsApp Groups: Final Version with WHAPI Documentation')
    
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

    console.log('👤 Syncing groups for user:', userId)

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

    // STEP 1: Get user's phone number from profile
    console.log('📱 Getting user phone number...')
    const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text()
      console.error('❌ Failed to get user profile:', profileResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to get user phone number', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const profileData = await profileResponse.json()
    const userPhoneNumber = profileData.phone || profileData.id || profileData.wid

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Could not determine user phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const normalizedUserPhone = normalizePhoneNumber(userPhoneNumber)
    console.log('📞 User phone:', userPhoneNumber, '→ normalized:', normalizedUserPhone)

    // STEP 2: Get groups with participants (using the documented endpoint)
    console.log('📋 Fetching groups with participants...')
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups?count=100`, {
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
    
    // Extract groups array based on WHAPI documentation
    const allGroups = groupsData.groups || []
    console.log(`📊 Found ${allGroups.length} groups from WHAPI`)

    // STEP 3: Process each group and check admin status
    const groupsToInsert = []
    let adminCount = 0
    let creatorCount = 0

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || `Group ${group.id}`
      
      console.log(`🔍 Processing ${i + 1}/${allGroups.length}: "${groupName}"`)
      
      let isAdmin = false
      let isCreator = false
      let adminRole = 'member'
      
      // Check participants array for user's rank (this is the main method according to WHAPI docs)
      if (group.participants && Array.isArray(group.participants)) {
        console.log(`👥 Checking ${group.participants.length} participants for "${groupName}"`)
        
        for (const participant of group.participants) {
          const participantPhone = participant.id
          const participantRank = participant.rank // "admin", "member", "creator"
          
          if (participantPhone && isPhoneMatch(userPhoneNumber, participantPhone)) {
            console.log(`✅ FOUND USER in "${groupName}":`, {
              phone: participantPhone,
              rank: participantRank,
              userPhone: userPhoneNumber
            })
            
            if (participantRank === 'creator') {
              isCreator = true
              isAdmin = true // creators are also admins
              adminRole = 'creator'
              console.log(`👑 User is CREATOR of "${groupName}"`)
            } else if (participantRank === 'admin') {
              isAdmin = true
              adminRole = 'admin'
              console.log(`⭐ User is ADMIN of "${groupName}"`)
            } else {
              adminRole = 'member'
              console.log(`👤 User is MEMBER of "${groupName}"`)
            }
            break
          }
        }
      } else {
        console.log(`⚠️ No participants array found for "${groupName}"`)
      }

      // Count statistics
      if (isCreator) {
        creatorCount++
      } else if (isAdmin) {
        adminCount++
      }

      // Prepare group data for database
      groupsToInsert.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: group.size || group.participants?.length || 0,
        is_admin: isAdmin,
        avatar_url: group.chat_pic || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      const roleIcon = isCreator ? '👑' : (isAdmin ? '⭐' : '👤')
      console.log(`${roleIcon} "${groupName}": ${group.size || 0} members, role: ${adminRole}`)

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // STEP 4: Log results
    console.log(`📊 SYNC RESULTS:`)
    console.log(`   👑 Creator of: ${creatorCount} groups`)
    console.log(`   ⭐ Admin of: ${adminCount} groups`)
    console.log(`   👤 Member of: ${allGroups.length - adminCount - creatorCount} groups`)
    console.log(`   📱 Total groups: ${allGroups.length}`)

    const creatorGroups = groupsToInsert.filter(g => g.is_admin && groupsToInsert.some(gg => gg.group_id === g.group_id))
    const adminGroups = groupsToInsert.filter(g => g.is_admin)

    console.log('👑 Creator/Admin groups:', adminGroups.map(g => g.name))

    // STEP 5: Save to database
    try {
      // Clear existing groups for this user
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

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: allGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        member_groups_count: allGroups.length - adminCount - creatorCount,
        user_phone: userPhoneNumber,
        normalized_user_phone: normalizedUserPhone,
        message: `Successfully synced ${allGroups.length} groups (${creatorCount} creator, ${adminCount} admin groups found)`,
        admin_groups: adminGroups.map(g => ({ name: g.name, members: g.participants_count }))
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