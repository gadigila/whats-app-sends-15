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

    // 🎯 NEW: Check if we have phone number stored
    let userPhoneNumber = profile.phone_number

    if (!userPhoneNumber) {
      console.log('📱 No phone number stored, fetching from WHAPI...')
      
      // Get phone number from WHAPI profile
      const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        userPhoneNumber = profileData.phone || profileData.id
        
        if (userPhoneNumber) {
          console.log('📱 Got phone number from WHAPI:', userPhoneNumber)
          
          // Save it to database for future use
          await supabase
            .from('profiles')
            .update({
              phone_number: userPhoneNumber,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          
          console.log('✅ Phone number saved to database')
        }
      }
    } else {
      console.log('📱 Using stored phone number:', userPhoneNumber)
    }

    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine your phone number',
          suggestion: 'Please reconnect your WhatsApp account'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📱 Using phone: ${userPhoneNumber}`)

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

    // Phone matching function
    function isPhoneMatch(phone1: string, phone2: string): boolean {
      if (!phone1 || !phone2) return false
      const clean1 = phone1.replace(/\D/g, '')
      const clean2 = phone2.replace(/\D/g, '')
      if (clean1 === clean2) return true
      if (clean1.length >= 9 && clean2.length >= 9) {
        return clean1.slice(-9) === clean2.slice(-9)
      }
      return false
    }

    // 🎯 ONLY PROCESS ADMIN/CREATOR GROUPS
    const managedGroups = []
    let adminCount = 0
    let creatorCount = 0
    let totalMemberCount = 0

    for (const group of allGroups) {
      const groupName = group.name || group.subject || `Group ${group.id}`
      let isAdmin = false
      let isCreator = false
      let userRole = 'member'
      
      // Check if user is admin/creator in this group
      if (group.participants && Array.isArray(group.participants)) {
        for (const participant of group.participants) {
          if (isPhoneMatch(userPhoneNumber, participant.id)) {
            userRole = participant.rank || 'member'
            if (participant.rank === 'creator') {
              isCreator = true
              isAdmin = true
              creatorCount++
            } else if (participant.rank === 'admin') {
              isAdmin = true
              adminCount++
            }
            break
          }
        }
      }

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
        console.log(`${roleIcon} ${groupName}: ${participantsCount} members (${userRole})`)
      }
    }

    console.log(`🎯 Found ${managedGroups.length} managed groups out of ${allGroups.length} total`)

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
          members: g.participants_count
        })).slice(0, 10) // Show first 10 groups in response
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