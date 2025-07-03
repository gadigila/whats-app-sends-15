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
    console.log('🚀 PHONE DEBUG: Sync starting...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId } = await req.json()
    console.log('👤 Processing for user:', userId)

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'No WhatsApp token found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user phone with detailed logging
    console.log('📱 Getting user phone number...')
    const profileResponse = await fetch('https://gate.whapi.cloud/users/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text()
      console.error('❌ WHAPI profile failed:', errorText)
      return new Response(
        JSON.stringify({ error: 'WHAPI connection failed' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const profileData = await profileResponse.json()
    console.log('📱 FULL PROFILE DATA:', JSON.stringify(profileData, null, 2))
    
    const userPhone = profileData.phone || profileData.id || profileData.wid
    console.log('📱 EXTRACTED USER PHONE:', userPhone)
    
    // Normalize phone number
    function normalizePhone(phone) {
      if (!phone) return ''
      const clean = phone.replace(/\D/g, '')
      console.log(`📱 Normalizing: ${phone} → ${clean}`)
      return clean
    }
    
    const normalizedUserPhone = normalizePhone(userPhone)
    console.log('📱 NORMALIZED USER PHONE:', normalizedUserPhone)

    // Get groups
    const groupsResponse = await fetch('https://gate.whapi.cloud/groups?count=10', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    const groupsData = await groupsResponse.json()
    const groups = groupsData.groups || []
    console.log('📋 Groups received:', groups.length)

    // Enhanced phone matching with detailed logging
    function isPhoneMatch(phone1, phone2) {
      if (!phone1 || !phone2) {
        console.log(`❌ Phone match failed - missing phone: "${phone1}" vs "${phone2}"`)
        return false
      }
      
      const clean1 = phone1.replace(/\D/g, '')
      const clean2 = phone2.replace(/\D/g, '')
      
      console.log(`🔍 Comparing: "${phone1}" (${clean1}) vs "${phone2}" (${clean2})`)
      
      // Direct match
      if (clean1 === clean2) {
        console.log(`✅ DIRECT MATCH: ${clean1} === ${clean2}`)
        return true
      }
      
      // Last 9 digits match (Israeli mobile)
      if (clean1.length >= 9 && clean2.length >= 9) {
        const last9_1 = clean1.slice(-9)
        const last9_2 = clean2.slice(-9)
        if (last9_1 === last9_2) {
          console.log(`✅ LAST 9 DIGITS MATCH: ${last9_1} === ${last9_2}`)
          return true
        }
      }
      
      console.log(`❌ NO MATCH: ${clean1} vs ${clean2}`)
      return false
    }

    // Process groups with enhanced logging
    let adminCount = 0
    const processedGroups = []

    for (let i = 0; i < Math.min(groups.length, 3); i++) { // Process first 3 groups
      const group = groups[i]
      const groupName = group.name || `Group ${group.id}`
      
      console.log(`\n🔍 ===== PROCESSING GROUP ${i + 1}: "${groupName}" =====`)
      console.log(`👥 Group has ${group.participants?.length || 0} participants`)
      
      let isAdmin = false
      let foundUser = false
      
      if (group.participants && Array.isArray(group.participants)) {
        console.log(`🔍 Checking participants for user phone: ${normalizedUserPhone}`)
        
        // Show all admins/creators in this group first
        const adminsInGroup = group.participants.filter(p => p.rank === 'admin' || p.rank === 'creator')
        console.log(`👑 Group has ${adminsInGroup.length} admins/creators:`)
        adminsInGroup.forEach(admin => {
          console.log(`   👑 ${admin.id} (${admin.rank})`)
        })
        
        // Now check if user is in the group
        for (const participant of group.participants) {
          const participantPhone = participant.id
          const rank = participant.rank
          
          // Only log the first few and any potential matches
          if (group.participants.indexOf(participant) < 5 || isPhoneMatch(normalizedUserPhone, participantPhone)) {
            console.log(`👤 Participant: ${participantPhone}, rank: ${rank}`)
          }
          
          if (isPhoneMatch(normalizedUserPhone, participantPhone)) {
            foundUser = true
            console.log(`🎯 ===== FOUND USER IN GROUP! =====`)
            console.log(`🎯 User phone: ${normalizedUserPhone}`)
            console.log(`🎯 Participant phone: ${participantPhone}`)
            console.log(`🎯 Rank: ${rank}`)
            
            if (rank === 'admin' || rank === 'creator') {
              isAdmin = true
              adminCount++
              console.log(`✅ USER IS ${rank.toUpperCase()} OF "${groupName}"`)
            } else {
              console.log(`👤 User is only a member of "${groupName}"`)
            }
            break
          }
        }
        
        if (!foundUser) {
          console.log(`❌ User phone ${normalizedUserPhone} NOT FOUND in group "${groupName}"`)
        }
      } else {
        console.log(`⚠️ No participants array for group "${groupName}"`)
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

      console.log(`${isAdmin ? '⭐' : '👤'} "${groupName}": ${group.size || 0} members, admin: ${isAdmin}`)
    }

    console.log(`\n📊 ===== FINAL RESULTS =====`)
    console.log(`📊 User phone: ${userPhone}`)
    console.log(`📊 Normalized: ${normalizedUserPhone}`)
    console.log(`📊 Admin groups: ${adminCount}`)
    console.log(`📊 Total processed: ${processedGroups.length}`)

    // Save to database
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (processedGroups.length > 0) {
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(processedGroups)

      if (insertError) {
        console.error('❌ Database insert error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Database error', details: insertError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        debug_phone_matching: true,
        user_phone_raw: userPhone,
        user_phone_normalized: normalizedUserPhone,
        total_groups: groups.length,
        processed_groups: processedGroups.length,
        admin_groups: adminCount,
        message: `DEBUG: User phone ${normalizedUserPhone}, found ${adminCount} admin groups`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 ERROR:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})