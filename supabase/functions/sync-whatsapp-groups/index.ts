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
    console.log('🚀 FIXED PHONE DETECTION: Starting...')
    
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

    // METHOD 1: Try /users/profile endpoint
    console.log('📱 METHOD 1: Trying /users/profile...')
    let userPhone = null
    
    try {
      const profileResponse = await fetch('https://gate.whapi.cloud/users/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        console.log('📱 Profile response keys:', Object.keys(profileData))
        userPhone = profileData.phone || profileData.id || profileData.wid || profileData.jid
        console.log('📱 From profile:', userPhone)
      }
    } catch (error) {
      console.log('⚠️ Profile method failed:', error.message)
    }

    // METHOD 2: Try /health endpoint if profile didn't work
    if (!userPhone) {
      console.log('📱 METHOD 2: Trying /health endpoint...')
      try {
        const healthResponse = await fetch('https://gate.whapi.cloud/health', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          console.log('📱 Health response:', JSON.stringify(healthData, null, 2))
          userPhone = healthData.phone || healthData.me?.phone || healthData.user?.phone
          console.log('📱 From health:', userPhone)
        }
      } catch (error) {
        console.log('⚠️ Health method failed:', error.message)
      }
    }

    // METHOD 3: Try /chats endpoint and look for own messages
    if (!userPhone) {
      console.log('📱 METHOD 3: Trying to find phone from chats...')
      try {
        const chatsResponse = await fetch('https://gate.whapi.cloud/chats?count=5', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (chatsResponse.ok) {
          const chatsData = await chatsResponse.json()
          console.log('📱 Chats response structure:', Object.keys(chatsData))
          
          // Look for individual chats (not groups) that might reveal our number
          const chats = chatsData.chats || chatsData.data || []
          for (const chat of chats.slice(0, 3)) {
            if (chat.type === 'individual' || !chat.type) {
              console.log('📱 Found individual chat:', chat.id, chat.name)
              // Sometimes our own number appears in individual chats
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Chats method failed:', error.message)
      }
    }

    // METHOD 4: Use instance status from database or try different WHAPI endpoints
    if (!userPhone) {
      console.log('📱 METHOD 4: Trying alternative detection...')
      
      // Check if we stored the phone number anywhere in our database
      const { data: profileWithPhone } = await supabase
        .from('profiles')
        .select('phone_number, whapi_phone') // These columns might not exist, but let's try
        .eq('id', userId)
        .single()
      
      if (profileWithPhone?.phone_number) {
        userPhone = profileWithPhone.phone_number
        console.log('📱 From database:', userPhone)
      }
    }

    // If still no phone, we'll try to detect it from admin patterns
    if (!userPhone) {
      console.log('⚠️ Could not determine user phone number!')
      console.log('📱 Will try to detect from admin patterns in groups...')
    } else {
      console.log('✅ USER PHONE FOUND:', userPhone)
    }

    // Get groups
    console.log('📋 Fetching groups...')
    const groupsResponse = await fetch('https://gate.whapi.cloud/groups?count=10', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!groupsResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    const groups = groupsData.groups || []
    console.log('📋 Groups received:', groups.length)

    // Enhanced phone normalization
    function normalizePhone(phone) {
      if (!phone) return ''
      let clean = phone.replace(/\D/g, '')
      
      // Convert Israeli format: 0501234567 → 972501234567
      if (clean.startsWith('0') && clean.length === 10) {
        clean = '972' + clean.substring(1)
      }
      
      return clean
    }

    // Enhanced phone matching
    function isPhoneMatch(phone1, phone2) {
      if (!phone1 || !phone2) return false
      
      const clean1 = normalizePhone(phone1)
      const clean2 = normalizePhone(phone2)
      
      if (clean1 === clean2) return true
      
      // Israeli number variations
      if (clean1.length >= 9 && clean2.length >= 9) {
        return clean1.slice(-9) === clean2.slice(-9)
      }
      
      return false
    }

    const normalizedUserPhone = normalizePhone(userPhone)
    console.log('📱 Normalized user phone:', normalizedUserPhone)

    // Process groups with phone detection fallback
    let adminCount = 0
    const processedGroups = []
    const potentialUserPhones = new Set() // Collect phones that appear as admin in multiple groups

    for (let i = 0; i < Math.min(groups.length, 5); i++) {
      const group = groups[i]
      const groupName = group.name || `Group ${group.id}`
      
      console.log(`\n🔍 ===== GROUP ${i + 1}: "${groupName}" =====`)
      
      let isAdmin = false
      let foundUser = false
      
      if (group.participants && Array.isArray(group.participants)) {
        const adminsInGroup = group.participants.filter(p => p.rank === 'admin' || p.rank === 'creator')
        console.log(`👑 Admins/creators (${adminsInGroup.length}):`)
        
        adminsInGroup.forEach(admin => {
          console.log(`   👑 ${admin.id} (${admin.rank})`)
          // If we don't have user phone, collect admin phones for pattern analysis
          if (!normalizedUserPhone) {
            potentialUserPhones.add(admin.id)
          }
        })

        // If we have user phone, try to match
        if (normalizedUserPhone) {
          for (const participant of group.participants) {
            if (isPhoneMatch(normalizedUserPhone, participant.id)) {
              foundUser = true
              console.log(`🎯 FOUND USER: ${participant.id} (${participant.rank})`)
              
              if (participant.rank === 'admin' || participant.rank === 'creator') {
                isAdmin = true
                adminCount++
                console.log(`✅ USER IS ${participant.rank.toUpperCase()}`)
              }
              break
            }
          }
          
          if (!foundUser) {
            console.log(`❌ User phone ${normalizedUserPhone} not found in group`)
          }
        } else {
          console.log(`⚠️ Skipping user detection - no phone number available`)
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

      console.log(`${isAdmin ? '⭐' : '👤'} Result: admin=${isAdmin}`)
    }

    // If we couldn't find user phone, show potential phones
    if (!normalizedUserPhone && potentialUserPhones.size > 0) {
      console.log('\n📱 POTENTIAL USER PHONES (appear as admin):')
      Array.from(potentialUserPhones).forEach(phone => {
        console.log(`   📱 ${phone}`)
      })
    }

    // Save to database
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (processedGroups.length > 0) {
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(processedGroups)

      if (insertError) {
        console.error('❌ Database error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Database error' }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    console.log('\n📊 ===== FINAL RESULTS =====')
    console.log(`📊 User phone detected: ${userPhone || 'NOT FOUND'}`)
    console.log(`📊 Admin groups found: ${adminCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        phone_detection_debug: true,
        user_phone_raw: userPhone,
        user_phone_normalized: normalizedUserPhone,
        phone_detection_successful: !!userPhone,
        potential_admin_phones: Array.from(potentialUserPhones),
        total_groups: groups.length,
        processed_groups: processedGroups.length,
        admin_groups_found: adminCount,
        message: userPhone 
          ? `Found ${adminCount} admin groups for phone ${normalizedUserPhone}`
          : `Could not detect user phone. Found ${potentialUserPhones.size} potential admin phones.`
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