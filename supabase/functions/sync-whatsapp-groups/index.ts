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

    console.log('🚀 Sync WhatsApp Groups: Starting with WHAPI documentation approach...')

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

    console.log('📱 Getting user profile for phone number...')

    // STEP 1: Get user's phone number from users/profile endpoint
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
        console.log('📞 User phone number identified:', userPhoneNumber)
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
        const errorText = await profileResponse.text()
        console.error('Profile error details:', errorText)
      }
    } catch (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
    }

    console.log('📋 Fetching groups list using WHAPI documentation method...')

    // STEP 2: Get groups list using exact WHAPI documentation endpoint
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text()
      console.error('❌ Failed to fetch groups from WHAPI:', groupsResponse.status, errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch WhatsApp groups', 
          status: groupsResponse.status,
          details: errorText 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    console.log('📊 Groups response structure:', Object.keys(groupsData))
    
    // Handle different response structures
    let allGroups = []
    if (Array.isArray(groupsData)) {
      allGroups = groupsData
    } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
      allGroups = groupsData.groups
    } else if (groupsData.data && Array.isArray(groupsData.data)) {
      allGroups = groupsData.data
    } else {
      console.error('❌ Unexpected groups response structure:', groupsData)
      return new Response(
        JSON.stringify({ error: 'Unexpected response format from WHAPI' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📊 Found ${allGroups.length} groups total`)

    // STEP 3: Process each group and check admin status using WHAPI's suggested approach
    const groupsToInsert = []
    let adminCount = 0
    let processedCount = 0

    for (const group of allGroups) {
      try {
        processedCount++
        const groupName = group.name || group.subject || `Group ${group.id}`
        console.log(`🔍 Processing ${processedCount}/${allGroups.length}: ${groupName}`)
        
        let isAdmin = false
        let participantsCount = group.participants_count || group.size || 0

        // Check if group already has admins array (from basic groups response)
        if (group.admins && Array.isArray(group.admins) && userPhoneNumber) {
          console.log(`👑 Checking admins in basic group data for "${groupName}"`)
          
          for (const admin of group.admins) {
            const adminPhone = admin.id || admin.phone || admin
            
            // Multiple phone format matching as suggested by WHAPI support
            if (adminPhone && userPhoneNumber && (
              adminPhone === userPhoneNumber ||
              adminPhone === `+${userPhoneNumber.replace(/^\+/, '')}` ||
              adminPhone.replace(/^\+/, '') === userPhoneNumber.replace(/^\+/, '') ||
              `+${adminPhone.replace(/^\+/, '')}` === userPhoneNumber
            )) {
              isAdmin = true
              console.log(`👑 ✅ Found user as admin in "${groupName}": ${adminPhone}`)
              break
            }
          }
        }

        // If not found in basic data and we have phone number, get detailed group info
        if (!isAdmin && userPhoneNumber && group.id) {
          try {
            console.log(`🔍 Getting detailed info for "${groupName}"...`)
            
            const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${profile.whapi_token}`,
                'Content-Type': 'application/json'
              }
            })

            if (detailResponse.ok) {
              const detailData = await detailResponse.json()
              
              // Update participants count from detailed data
              if (detailData.participants && Array.isArray(detailData.participants)) {
                participantsCount = detailData.participants.length
              }

              // Check admins array in detailed response
              if (detailData.admins && Array.isArray(detailData.admins)) {
                console.log(`👑 Checking ${detailData.admins.length} admins in detailed data`)
                
                for (const admin of detailData.admins) {
                  const adminPhone = admin.id || admin.phone || admin
                  
                  if (adminPhone && userPhoneNumber && (
                    adminPhone === userPhoneNumber ||
                    adminPhone === `+${userPhoneNumber.replace(/^\+/, '')}` ||
                    adminPhone.replace(/^\+/, '') === userPhoneNumber.replace(/^\+/, '') ||
                    `+${adminPhone.replace(/^\+/, '')}` === userPhoneNumber
                  )) {
                    isAdmin = true
                    console.log(`👑 ✅ Found user as admin in detailed "${groupName}": ${adminPhone}`)
                    break
                  }
                }
              }

              // Also check participants array for admin/creator roles
              if (!isAdmin && detailData.participants && Array.isArray(detailData.participants)) {
                for (const participant of detailData.participants) {
                  const participantPhone = participant.id || participant.phone
                  const participantRole = participant.rank || participant.role
                  
                  if (participantPhone && userPhoneNumber && (
                    participantPhone === userPhoneNumber ||
                    participantPhone === `+${userPhoneNumber.replace(/^\+/, '')}` ||
                    participantPhone.replace(/^\+/, '') === userPhoneNumber.replace(/^\+/, '') ||
                    `+${participantPhone.replace(/^\+/, '')}` === userPhoneNumber
                  )) {
                    if (participantRole === 'admin' || participantRole === 'creator' || participantRole === 'superadmin') {
                      isAdmin = true
                      console.log(`👑 ✅ Found user as ${participantRole} in "${groupName}": ${participantPhone}`)
                      break
                    }
                  }
                }
              }
            } else {
              console.log(`⚠️ Could not get detailed info for "${groupName}": ${detailResponse.status}`)
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
            
          } catch (detailError) {
            console.log(`⚠️ Error getting details for "${groupName}":`, detailError.message)
          }
        }

        if (isAdmin) {
          adminCount++
          console.log(`👑 ✅ User is ADMIN in: "${groupName}"`)
        } else {
          console.log(`👤 User is member in: "${groupName}"`)
        }

        // Add to groups list
        groupsToInsert.push({
          user_id: userId,
          group_id: group.id,
          name: groupName,
          description: group.description || null,
          participants_count: participantsCount,
          is_admin: isAdmin,
          avatar_url: group.avatar_url || group.picture || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      } catch (error) {
        console.error(`❌ Error processing group ${group.id}:`, error)
        // Add group with basic info even if processing failed
        groupsToInsert.push({
          user_id: userId,
          group_id: group.id,
          name: group.name || group.subject || 'Unknown Group',
          description: group.description || null,
          participants_count: group.participants_count || group.size || 0,
          is_admin: false, // Default to false if we can't determine
          avatar_url: group.avatar_url || group.picture || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }

    console.log(`📊 Processing complete: ${adminCount} admin groups found out of ${groupsToInsert.length} total`)

    // STEP 4: Save to database (clear old data first)
    try {
      const { error: deleteError } = await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('❌ Failed to clear existing groups:', deleteError)
      } else {
        console.log('✅ Cleared existing groups')
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
        } else {
          console.log('✅ Successfully saved groups to database')
        }
      }
    } catch (dbError) {
      console.error('❌ Database operation error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: dbError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(`✅ Successfully synced ${groupsToInsert.length} groups (${adminCount} admin groups)`)

    // Return success response with detailed breakdown
    const adminGroups = groupsToInsert.filter(g => g.is_admin)
    const memberGroups = groupsToInsert.filter(g => !g.is_admin)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        member_groups_count: memberGroups.length,
        user_phone: userPhoneNumber,
        admin_groups_sample: adminGroups.slice(0, 3).map(g => ({ id: g.group_id, name: g.name })),
        member_groups_sample: memberGroups.slice(0, 3).map(g => ({ id: g.group_id, name: g.name })),
        message: `Groups synced successfully - ${adminCount} admin groups found out of ${groupsToInsert.length} total`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Sync WhatsApp Groups Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})