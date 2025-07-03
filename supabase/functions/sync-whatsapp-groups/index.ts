import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 MINIMAL DEBUG: Sync starting...')
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('🔧 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      urlStart: supabaseUrl?.substring(0, 20) || 'missing'
    })
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration missing' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Parse request
    let requestBody
    try {
      requestBody = await req.json()
      console.log('📥 Request received:', requestBody)
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const userId = requestBody?.userId
    if (!userId) {
      console.error('❌ Missing userId')
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Processing for user:', userId)

    // Create Supabase client
    let supabase
    try {
      supabase = createClient(supabaseUrl, supabaseServiceKey)
      console.log('✅ Supabase client created')
    } catch (supabaseError) {
      console.error('❌ Supabase client error:', supabaseError)
      return new Response(
        JSON.stringify({ error: 'Database connection failed' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Get user profile
    let profile
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('whapi_token, instance_status')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Profile query error:', error)
        return new Response(
          JSON.stringify({ error: 'User not found', details: error.message }),
          { status: 404, headers: corsHeaders }
        )
      }

      profile = data
      console.log('👤 Profile found:', {
        hasToken: !!profile?.whapi_token,
        status: profile?.instance_status
      })

    } catch (profileError) {
      console.error('❌ Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!profile?.whapi_token) {
      console.error('❌ No WHAPI token')
      return new Response(
        JSON.stringify({ error: 'No WhatsApp token found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      console.error('❌ Not connected:', profile.instance_status)
      return new Response(
        JSON.stringify({ error: 'WhatsApp not connected', status: profile.instance_status }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Test WHAPI connection with user profile
    let userPhone
    try {
      console.log('📱 Testing WHAPI connection...')
      const response = await fetch('https://gate.whapi.cloud/users/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('📱 WHAPI profile response:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ WHAPI profile failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'WHAPI connection failed', details: errorText }),
          { status: 400, headers: corsHeaders }
        )
      }

      const profileData = await response.json()
      userPhone = profileData.phone || profileData.id
      console.log('📱 User phone:', userPhone)

    } catch (whapiError) {
      console.error('❌ WHAPI error:', whapiError)
      return new Response(
        JSON.stringify({ error: 'WHAPI request failed', details: whapiError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Get groups from WHAPI
    let groups = []
    try {
      console.log('📋 Fetching groups from WHAPI...')
      const response = await fetch('https://gate.whapi.cloud/groups?count=50', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('📋 WHAPI groups response:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ WHAPI groups failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch groups', details: errorText }),
          { status: 400, headers: corsHeaders }
        )
      }

      const groupsData = await response.json()
      groups = groupsData.groups || []
      console.log('📋 Groups received:', groups.length)

      // Log structure of first group for debugging
      if (groups.length > 0) {
        console.log('📋 First group structure:', {
          id: groups[0].id,
          name: groups[0].name,
          hasParticipants: !!groups[0].participants,
          participantsCount: groups[0].participants?.length || 0,
          size: groups[0].size
        })
      }

    } catch (groupsError) {
      console.error('❌ Groups fetch error:', groupsError)
      return new Response(
        JSON.stringify({ error: 'Groups request failed', details: groupsError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Simple phone matching function
    function isPhoneMatch(phone1, phone2) {
      if (!phone1 || !phone2) return false
      
      // Remove all non-digits and compare
      const clean1 = phone1.replace(/\D/g, '')
      const clean2 = phone2.replace(/\D/g, '')
      
      // Direct match
      if (clean1 === clean2) return true
      
      // Check last 9 digits (Israeli mobile)
      if (clean1.length >= 9 && clean2.length >= 9) {
        return clean1.slice(-9) === clean2.slice(-9)
      }
      
      return false
    }

    // Process groups for admin detection
    let adminCount = 0
    const processedGroups = []

    for (let i = 0; i < Math.min(groups.length, 5); i++) { // Process first 5 groups only for debugging
      const group = groups[i]
      const groupName = group.name || `Group ${group.id}`
      
      console.log(`🔍 Processing group ${i + 1}: "${groupName}"`)
      
      let isAdmin = false
      
      // Check participants for admin status
      if (group.participants && Array.isArray(group.participants)) {
        console.log(`👥 Checking ${group.participants.length} participants`)
        
        for (const participant of group.participants) {
          const participantPhone = participant.id
          const rank = participant.rank
          
          console.log(`👤 Participant: ${participantPhone}, rank: ${rank}`)
          
          if (participantPhone && userPhone && isPhoneMatch(userPhone, participantPhone)) {
            console.log(`✅ FOUND USER with rank: ${rank}`)
            
            if (rank === 'admin' || rank === 'creator') {
              isAdmin = true
              adminCount++
              console.log(`🎯 User is ${rank} of "${groupName}"`)
            }
            break
          }
        }
      }

      processedGroups.push({
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

      console.log(`${isAdmin ? '⭐' : '👤'} "${groupName}": ${group.size || 0} members`)
    }

    console.log(`📊 RESULTS: Found ${adminCount} admin groups out of ${processedGroups.length} processed`)

    // Save to database
    try {
      console.log('💾 Saving to database...')
      
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
          console.error('❌ Database insert error:', insertError)
          return new Response(
            JSON.stringify({ error: 'Database insert failed', details: insertError.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      console.log('✅ Database updated successfully')

    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Database error', details: dbError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        debug: true,
        total_groups: groups.length,
        processed_groups: processedGroups.length,
        admin_groups: adminCount,
        user_phone: userPhone,
        message: `DEBUG: Processed ${processedGroups.length} groups, found ${adminCount} admin groups`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (mainError) {
    console.error('💥 MAIN ERROR:', mainError)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: mainError.message,
        stack: mainError.stack 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})