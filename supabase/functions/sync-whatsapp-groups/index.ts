import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 Correct WHAPI Sync: Using participants array structure...')

    const body = await req.json()
    const userId = body?.userId

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

    // Get user's phone number
    console.log('📱 Getting user phone number...')
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
        userPhoneNumber = profileData.phone || profileData.id
        console.log('📞 User phone number:', userPhoneNumber)
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to get user phone number' }),
          { status: 400, headers: corsHeaders }
        )
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Error getting user phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get groups with participants
    console.log('📋 Getting groups with participants...')
    let allGroups = []

    try {
      const groupsResponse = await fetch(`https://gate.whapi.cloud/groups`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json()
        console.log('📊 Groups response structure:', Object.keys(groupsData))
        
        if (groupsData.groups && Array.isArray(groupsData.groups)) {
          allGroups = groupsData.groups
        } else if (Array.isArray(groupsData)) {
          allGroups = groupsData
        }
        
        console.log(`📊 Found ${allGroups.length} groups`)
        
        // Log structure of first group for debugging
        if (allGroups.length > 0) {
          console.log('📋 First group structure:', Object.keys(allGroups[0]))
          if (allGroups[0].participants) {
            console.log('👥 Participants structure:', allGroups[0].participants.slice(0, 2))
          }
        }
      } else {
        const errorText = await groupsResponse.text()
        return new Response(
          JSON.stringify({ error: 'Failed to fetch groups', details: errorText }),
          { status: 400, headers: corsHeaders }
        )
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Error fetching groups' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('✅ Got groups, checking admin status using participants array...')

    // Process groups for admin status using participants array
    const processedGroups = []
    let adminCount = 0

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`\n🔍 Group ${i + 1}: "${groupName}"`)
      
      let isAdmin = false
      let participantsCount = 0
      
      // Check participants array for admin status
      if (group.participants && Array.isArray(group.participants)) {
        participantsCount = group.participants.length
        console.log(`👥 Found ${participantsCount} participants`)
        
        // Check each participant
        for (const participant of group.participants) {
          const participantId = participant.id
          const participantRank = participant.rank
          
          console.log(`  👤 Participant: ${participantId}, rank: ${participantRank}`)
          
          // Check if this participant is the user
          if (participantId === userPhoneNumber) {
            console.log(`✅ Found user in group! Rank: ${participantRank}`)
            
            // Check if user is admin or creator
            if (participantRank === 'admin' || participantRank === 'creator' || participantRank === 'superadmin') {
              isAdmin = true
              console.log(`👑 ✅ User is ${participantRank} in "${groupName}"`)
              break
            } else {
              console.log(`👤 User is ${participantRank} in "${groupName}"`)
            }
          }
        }
        
        // If no exact match, try with phone number variations
        if (!isAdmin && userPhoneNumber) {
          // Clean phone number (remove +, spaces, etc.)
          const cleanUserPhone = userPhoneNumber.replace(/[^\d]/g, '')
          
          for (const participant of group.participants) {
            const participantId = participant.id
            const participantRank = participant.rank
            const cleanParticipantId = participantId.replace(/[^\d]/g, '')
            
            if (cleanParticipantId === cleanUserPhone) {
              console.log(`✅ Found user with clean phone match! ${participantId} -> ${userPhoneNumber}`)
              
              if (participantRank === 'admin' || participantRank === 'creator' || participantRank === 'superadmin') {
                isAdmin = true
                console.log(`👑 ✅ User is ${participantRank} in "${groupName}" (clean match)`)
                break
              }
            }
          }
        }
      } else if (group.size) {
        // Fallback to size field if no participants array
        participantsCount = group.size
        console.log(`👥 No participants array, using size: ${participantsCount}`)
      }

      if (isAdmin) {
        adminCount++
        console.log(`👑 ✅ FINAL: User IS admin in "${groupName}"`)
      } else {
        console.log(`👤 FINAL: User is member/not found in "${groupName}"`)
      }

      // Add to processed groups
      processedGroups.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: isAdmin,
        avatar_url: group.chat_pic || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }

    console.log(`\n📊 FINAL RESULTS:`)
    console.log(`📊 Total groups: ${processedGroups.length}`)
    console.log(`📊 Admin groups: ${adminCount}`)
    console.log(`📊 Member groups: ${processedGroups.length - adminCount}`)
    console.log(`📞 User phone: ${userPhoneNumber}`)

    // Save to database
    try {
      // Clear existing groups
      await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)

      // Insert new groups
      if (processedGroups.length > 0) {
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(processedGroups)

        if (insertError) {
          console.log('❌ Insert error:', insertError)
          return new Response(
            JSON.stringify({ error: 'Failed to save groups', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      console.log('✅ Saved to database')
    } catch (dbError) {
      return new Response(
        JSON.stringify({ error: 'Database error', details: dbError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Return success with admin groups details
    const adminGroups = processedGroups.filter(g => g.is_admin)
    
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: processedGroups.length,
        admin_groups_count: adminCount,
        member_groups_count: processedGroups.length - adminCount,
        user_phone: userPhoneNumber,
        admin_groups_found: adminGroups.map(g => ({
          id: g.group_id,
          name: g.name,
          participants: g.participants_count
        })),
        message: `Correct method completed - ${adminCount} admin groups detected out of ${processedGroups.length} total`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})