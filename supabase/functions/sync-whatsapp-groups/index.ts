import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 Sync WhatsApp Groups: Starting FIXED admin detection...')

    const { userId }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's WHAPI token and instance details
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

    console.log('📱 Getting user profile to identify phone number...')

    // STEP 1: Get user's phone number from profile endpoint
    const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    let userPhoneNumber = null
    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      userPhoneNumber = profileData.phone || profileData.id
      console.log('📞 User phone number identified:', userPhoneNumber)
    } else {
      console.error('❌ Failed to get user profile:', profileResponse.status)
      return new Response(
        JSON.stringify({ error: 'Failed to get user profile' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!userPhoneNumber) {
      console.error('❌ Could not determine user phone number')
      return new Response(
        JSON.stringify({ error: 'Could not determine user phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📋 Fetching groups list...')

    // STEP 2: Get basic groups list using the correct endpoint
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text()
      console.error('❌ Failed to fetch groups from WHAPI:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch WhatsApp groups', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    const basicGroups = groupsData.groups || []

    console.log(`📊 Found ${basicGroups.length} groups. Checking admin status for each...`)

    // STEP 3: For each group, get detailed info to check admin status
    const groupsToInsert = []
    let adminCount = 0
    let processedCount = 0

    for (const basicGroup of basicGroups) {
      try {
        processedCount++
        console.log(`🔍 Processing group ${processedCount}/${basicGroups.length}: ${basicGroup.name || basicGroup.subject}`)
        
        // Get detailed group info using the groups/{id} endpoint
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${basicGroup.id}`, {
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`
          }
        })

        let isAdmin = false
        let participantsCount = 0
        
        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          console.log(`📊 Group "${basicGroup.name}" detail keys:`, Object.keys(detailData))
          
          // Check participants for admin status
          if (detailData.participants && Array.isArray(detailData.participants)) {
            participantsCount = detailData.participants.length
            console.log(`👥 Group has ${participantsCount} participants`)
            
            // Look for user in participants and check if admin/creator
            for (const participant of detailData.participants) {
              // Try multiple phone number formats
              const participantId = participant.id || participant.phone
              
              // Check if this participant is the user (multiple format matching)
              const isUserParticipant = participantId === userPhoneNumber ||
                                      participantId === `+${userPhoneNumber}` ||
                                      participantId === userPhoneNumber.replace(/^\+/, '') ||
                                      `+${participantId}` === userPhoneNumber ||
                                      participantId.replace(/^\+/, '') === userPhoneNumber.replace(/^\+/, '')
              
              if (isUserParticipant) {
                const rank = participant.rank || participant.role
                isAdmin = rank === 'admin' || rank === 'creator' || rank === 'superadmin'
                console.log(`👤 Found user in group "${basicGroup.name}": phone=${participantId}, rank=${rank}, isAdmin=${isAdmin}`)
                break
              }
            }
          } else if (detailData.admins && Array.isArray(detailData.admins)) {
            // Alternative: Check admins array directly if participants not available
            console.log(`👑 Checking admins array with ${detailData.admins.length} admins`)
            participantsCount = detailData.participants_count || detailData.size || 0
            
            for (const admin of detailData.admins) {
              const adminId = admin.id || admin.phone || admin
              const isUserAdmin = adminId === userPhoneNumber ||
                                adminId === `+${userPhoneNumber}` ||
                                adminId === userPhoneNumber.replace(/^\+/, '') ||
                                `+${adminId}` === userPhoneNumber ||
                                adminId.replace(/^\+/, '') === userPhoneNumber.replace(/^\+/, '')
              
              if (isUserAdmin) {
                isAdmin = true
                console.log(`👑 Found user as admin in group "${basicGroup.name}": ${adminId}`)
                break
              }
            }
          } else {
            console.log(`⚠️ No participants or admins data for group "${basicGroup.name}"`)
            // Use basic group data as fallback
            participantsCount = basicGroup.participants_count || basicGroup.size || 0
            
            // If the group has an 'admins' field in basic data, check it
            if (basicGroup.admins && Array.isArray(basicGroup.admins)) {
              for (const admin of basicGroup.admins) {
                const adminId = admin.id || admin.phone || admin
                const isUserAdmin = adminId === userPhoneNumber ||
                                  adminId === `+${userPhoneNumber}` ||
                                  adminId === userPhoneNumber.replace(/^\+/, '') ||
                                  `+${adminId}` === userPhoneNumber ||
                                  adminId.replace(/^\+/, '') === userPhoneNumber.replace(/^\+/, '')
                
                if (isUserAdmin) {
                  isAdmin = true
                  console.log(`👑 Found user as admin in basic group data "${basicGroup.name}": ${adminId}`)
                  break
                }
              }
            }
          }
        } else {
          console.log(`⚠️ Could not get detailed info for group "${basicGroup.name}": ${detailResponse.status}`)
          // Use basic group data as fallback
          participantsCount = basicGroup.participants_count || basicGroup.size || 0
        }

        if (isAdmin) {
          adminCount++
          console.log(`👑 ✅ User is admin in: "${basicGroup.name || basicGroup.subject}"`)
        } else {
          console.log(`👤 User is member in: "${basicGroup.name || basicGroup.subject}"`)
        }

        // Add to groups list
        groupsToInsert.push({
          user_id: userId,
          group_id: basicGroup.id,
          name: basicGroup.name || basicGroup.subject || 'Unknown Group',
          description: basicGroup.description || null,
          participants_count: participantsCount,
          is_admin: isAdmin,
          avatar_url: basicGroup.avatar_url || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`❌ Error processing group ${basicGroup.id}:`, error)
        // Add group with basic info even if detailed fetch failed
        groupsToInsert.push({
          user_id: userId,
          group_id: basicGroup.id,
          name: basicGroup.name || basicGroup.subject || 'Unknown Group',
          description: basicGroup.description || null,
          participants_count: basicGroup.participants_count || basicGroup.size || 0,
          is_admin: false, // Default to false if we can't determine
          avatar_url: basicGroup.avatar_url || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }

    console.log(`📊 Processing complete: ${adminCount} admin groups found out of ${groupsToInsert.length} total`)

    // STEP 4: Save to database
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
          JSON.stringify({ error: 'Failed to save groups to database' }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    console.log(`✅ Successfully synced ${groupsToInsert.length} groups (${adminCount} admin groups)`)

    // Return detailed breakdown for debugging
    const adminGroups = groupsToInsert.filter(g => g.is_admin)
    const memberGroups = groupsToInsert.filter(g => !g.is_admin)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        member_groups_count: memberGroups.length,
        user_phone: userPhoneNumber,
        admin_groups: adminGroups.map(g => ({ id: g.group_id, name: g.name })),
        member_groups: memberGroups.slice(0, 5).map(g => ({ id: g.group_id, name: g.name })), // First 5 for debugging
        message: `Groups synced successfully - ${adminCount} admin groups found out of ${groupsToInsert.length} total`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Sync WhatsApp Groups Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})