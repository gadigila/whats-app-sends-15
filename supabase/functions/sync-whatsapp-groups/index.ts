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
    console.log('🚀 AUTO PHONE DETECTION: Starting with multiple methods...')
    
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
      .select('instance_id, whapi_token, instance_status, user_phone')
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

    // 🎯 AUTOMATIC PHONE DETECTION with multiple methods
    let userPhoneNumber = null

    // Method 1: Check if we already have it stored in database
    if (profile.user_phone) {
      userPhoneNumber = profile.user_phone
      console.log('📱 METHOD 1: Found phone in database:', userPhoneNumber)
    }

    // Method 2: Try /health endpoint 
    if (!userPhoneNumber) {
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
          console.log('📱 Health data structure:', Object.keys(healthData))
          
          // Check various possible fields
          userPhoneNumber = healthData.phone || 
                           healthData.me?.phone || 
                           healthData.user?.phone ||
                           healthData.wid ||
                           healthData.jid

          if (userPhoneNumber) {
            console.log('📱 Found phone in health endpoint:', userPhoneNumber)
          } else {
            console.log('📱 No phone found in health endpoint')
          }
        }
      } catch (error) {
        console.log('⚠️ Health endpoint failed:', error.message)
      }
    }

    // Method 3: Try /users/profile endpoint
    if (!userPhoneNumber) {
      console.log('📱 METHOD 3: Trying /users/profile endpoint...')
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
          userPhoneNumber = profileData.phone || profileData.id || profileData.wid
          
          if (userPhoneNumber) {
            console.log('📱 Found phone in profile endpoint:', userPhoneNumber)
          }
        }
      } catch (error) {
        console.log('⚠️ Profile endpoint failed:', error.message)
      }
    }

    // Method 4: Extract from individual chat that contains only user (me)
    if (!userPhoneNumber) {
      console.log('📱 METHOD 4: Trying to extract from individual chats...')
      try {
        const chatsResponse = await fetch('https://gate.whapi.cloud/chats?count=20', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (chatsResponse.ok) {
          const chatsData = await chatsResponse.json()
          const chats = chatsData.chats || chatsData.data || []
          
          // Look for individual chats where we sent messages
          for (const chat of chats.slice(0, 10)) {
            // Skip groups
            if (chat.type === 'group' || chat.id.includes('@g.us')) continue
            
            // Try to get messages from this chat to find our number
            try {
              const messagesResponse = await fetch(`https://gate.whapi.cloud/messages/list?chat_id=${chat.id}&count=5`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${profile.whapi_token}`,
                  'Content-Type': 'application/json'
                }
              })
              
              if (messagesResponse.ok) {
                const messagesData = await messagesResponse.json()
                const messages = messagesData.messages || messagesData.data || []
                
                // Find messages sent by us (from_me: true)
                for (const message of messages) {
                  if (message.from_me && message.from) {
                    userPhoneNumber = message.from
                    console.log('📱 Found phone from sent message:', userPhoneNumber)
                    break
                  }
                }
                
                if (userPhoneNumber) break
              }
            } catch (msgError) {
              console.log('⚠️ Error checking messages:', msgError.message)
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Chats method failed:', error.message)
      }
    }

    // Method 5: Pattern detection from admin groups
    if (!userPhoneNumber) {
      console.log('📱 METHOD 5: Pattern detection from admin appearances...')
      
      // Get a quick sample of groups to analyze admin patterns
      const groupsResponse = await fetch('https://gate.whapi.cloud/groups?count=20', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json()
        const groups = groupsData.groups || []
        
        // Count admin appearances to find the most likely user phone
        const adminCounts = new Map()
        
        for (const group of groups.slice(0, 10)) {
          if (group.participants && Array.isArray(group.participants)) {
            for (const participant of group.participants) {
              if (participant.rank === 'admin' || participant.rank === 'creator') {
                const phone = participant.id
                adminCounts.set(phone, (adminCounts.get(phone) || 0) + 1)
              }
            }
          }
        }
        
        // Find the phone that appears as admin most frequently
        let maxCount = 0
        let mostFrequentAdmin = null
        
        for (const [phone, count] of adminCounts.entries()) {
          if (count > maxCount && count >= 2) { // Must be admin in at least 2 groups
            maxCount = count
            mostFrequentAdmin = phone
          }
        }
        
        if (mostFrequentAdmin) {
          userPhoneNumber = mostFrequentAdmin
          console.log(`📱 Pattern detected: ${userPhoneNumber} appears as admin in ${maxCount} groups`)
        }
      }
    }

    // If still no phone found, return error with guidance
    if (!userPhoneNumber) {
      console.error('❌ Could not automatically detect user phone number')
      return new Response(
        JSON.stringify({ 
          error: 'Could not automatically detect your phone number',
          suggestion: 'Please contact support to manually configure your phone number',
          methods_tried: ['database', 'health_endpoint', 'profile_endpoint', 'chat_messages', 'admin_pattern']
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🎯 Save the detected phone number for future use
    try {
      await supabase
        .from('profiles')
        .update({ user_phone: userPhoneNumber })
        .eq('id', userId)
      
      console.log('✅ Saved detected phone to database for future use')
    } catch (saveError) {
      console.log('⚠️ Could not save phone to database:', saveError.message)
    }

    // Continue with normal group sync using detected phone
    console.log('📱 Using detected phone number:', userPhoneNumber)

    // Get all groups
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups?count=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text()
      return new Response(
        JSON.stringify({ error: 'Failed to fetch WhatsApp groups', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    const allGroups = groupsData.groups || []
    console.log(`📊 Found ${allGroups.length} groups total`)

    // Enhanced phone matching
    function isPhoneMatch(phone1: string, phone2: string): boolean {
      if (!phone1 || !phone2) return false
      
      const clean1 = phone1.replace(/\D/g, '')
      const clean2 = phone2.replace(/\D/g, '')
      
      // Direct match
      if (clean1 === clean2) return true
      
      // Israeli variations
      const variations1 = [clean1]
      const variations2 = [clean2]
      
      if (!clean1.startsWith('972') && clean1.length === 10 && clean1.startsWith('0')) {
        variations1.push('972' + clean1.substring(1))
      }
      if (!clean2.startsWith('972') && clean2.length === 10 && clean2.startsWith('0')) {
        variations2.push('972' + clean2.substring(1))
      }
      
      for (const v1 of variations1) {
        for (const v2 of variations2) {
          if (v1 === v2) return true
        }
      }
      
      // Last 9 digits
      if (clean1.length >= 9 && clean2.length >= 9) {
        return clean1.slice(-9) === clean2.slice(-9)
      }
      
      return false
    }

    // Process all groups
    const groupsToInsert = []
    let adminCount = 0
    let creatorCount = 0

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      let isAdmin = false
      let isCreator = false
      let participantsCount = group.participants?.length || group.size || 0

      if (group.participants && Array.isArray(group.participants)) {
        for (const participant of group.participants) {
          if (isPhoneMatch(userPhoneNumber, participant.id)) {
            if (participant.rank === 'creator') {
              isCreator = true
              isAdmin = true
              creatorCount++
              console.log(`👑 CREATOR: ${groupName}`)
            } else if (participant.rank === 'admin') {
              isAdmin = true
              adminCount++
              console.log(`⭐ ADMIN: ${groupName}`)
            }
            break
          }
        }
      }

      groupsToInsert.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participantsCount,
        is_admin: isAdmin,
        avatar_url: group.chat_pic || group.picture || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }

    // Save to database
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (groupsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(groupsToInsert)

      if (insertError) {
        console.error('❌ Database error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Database error', details: insertError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    console.log('📊 RESULTS:', {
      phone_detected: userPhoneNumber,
      total_groups: allGroups.length,
      admin_groups: adminCount,
      creator_groups: creatorCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        phone_auto_detected: true,
        user_phone: userPhoneNumber,
        groups_count: allGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        message: `Successfully auto-detected phone ${userPhoneNumber} and synced ${allGroups.length} groups (${adminCount + creatorCount} admin/creator groups)`
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