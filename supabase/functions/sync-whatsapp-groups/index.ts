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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 WHAPI Exact Solution: Following their guidance exactly...')

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

    // STEP 1: Get user's phone number from profile
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

    // STEP 2: Get groups - exactly as WHAPI said
    console.log('📋 Getting groups with admins array...')
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
    console.log('📊 Full groups response structure:', Object.keys(groupsData))
    console.log('📊 First group structure:', groupsData.groups?.[0] ? Object.keys(groupsData.groups[0]) : 'No groups')
    
    let allGroups = []
    
    if (Array.isArray(groupsData)) {
      allGroups = groupsData
    } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
      allGroups = groupsData.groups
    } else if (groupsData.data && Array.isArray(groupsData.data)) {
      allGroups = groupsData.data
    }

    console.log(`📊 Found ${allGroups.length} groups total`)

    // STEP 3: Filter by admin as WHAPI suggested - check "admins" array
    console.log('👑 Checking admins arrays as WHAPI suggested...')
    
    const processedGroups = []
    let adminCount = 0
    let debugInfo = []

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`\n📋 Group ${i + 1}: "${groupName}"`)
      console.log(`📋 Group structure:`, Object.keys(group))
      
      let isAdmin = false
      let adminsList = []
      
      // WHAPI said: "With get groups, it is possible to see "admins" and a list of administrator phone numbers"
      if (group.admins && Array.isArray(group.admins)) {
        adminsList = group.admins
        console.log(`👑 Found ${adminsList.length} admins:`, adminsList)
        
        // Check if user's phone is in admins array
        for (const admin of adminsList) {
          const adminPhone = admin.id || admin.phone || admin
          console.log(`  📞 Admin: ${adminPhone}`)
          
          // WHAPI said: filter groups by admin "your phone number"
          if (adminPhone === userPhoneNumber) {
            isAdmin = true
            console.log(`✅ EXACT MATCH: User ${userPhoneNumber} is admin in "${groupName}"`)
            break
          }
        }
        
        // If no exact match, try some variations (but minimal)
        if (!isAdmin) {
          for (const admin of adminsList) {
            const adminPhone = admin.id || admin.phone || admin
            
            // Remove + and spaces for comparison
            const cleanUserPhone = userPhoneNumber.replace(/[^\d]/g, '')
            const cleanAdminPhone = adminPhone.replace(/[^\d]/g, '')
            
            if (cleanAdminPhone === cleanUserPhone) {
              isAdmin = true
              console.log(`✅ CLEAN MATCH: ${adminPhone} matches ${userPhoneNumber} in "${groupName}"`)
              break
            }
          }
        }
      } else {
        console.log(`⚠️ No admins array found for "${groupName}"`)
        // Log what fields ARE available
        console.log(`📋 Available fields:`, Object.keys(group))
      }

      if (isAdmin) {
        adminCount++
        console.log(`👑 ✅ USER IS ADMIN in "${groupName}"`)
      } else {
        console.log(`👤 User is member/not found in "${groupName}"`)
      }

      debugInfo.push({
        groupName,
        admins: adminsList,
        isAdmin,
        userPhone: userPhoneNumber,
        groupFields: Object.keys(group)
      })

      // Add to processed groups
      processedGroups.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: group.participants_count || group.size || 0,
        is_admin: isAdmin,
        avatar_url: group.avatar_url || group.picture || null,
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
      const { error: deleteError } = await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('❌ Failed to clear existing groups:', deleteError)
      }

      // Insert new groups
      if (processedGroups.length > 0) {
        const { error: insertError } = await supabase
          .from('whatsapp_groups')
          .insert(processedGroups)

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

    // Return detailed response with debug info
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
        debug_sample: debugInfo.slice(0, 3), // First 3 groups for debugging
        message: `WHAPI method completed - ${adminCount} admin groups detected out of ${processedGroups.length} total`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 WHAPI Exact Solution Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})