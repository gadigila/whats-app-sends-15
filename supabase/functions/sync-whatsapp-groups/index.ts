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
    console.log('🚀 REALISTIC AUTO DETECTION: Using proven methods...')
    
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

    // 🎯 SMART AUTO DETECTION using the most reliable method
    let userPhoneNumber = null

    // Method 1: Check if we already detected it before
    if (profile.user_phone) {
      userPhoneNumber = profile.user_phone
      console.log('📱 Found cached phone number:', userPhoneNumber)
    }

    // Method 2: Admin Pattern Analysis (Most Reliable!)
    // This analyzes which phone number appears as admin/creator most frequently
    if (!userPhoneNumber) {
      console.log('📱 METHOD: Smart admin pattern analysis...')
      
      try {
        // Get groups to analyze admin patterns
        const groupsResponse = await fetch('https://gate.whapi.cloud/groups?count=50', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json()
          const groups = groupsData.groups || []
          console.log(`📊 Analyzing ${groups.length} groups for admin patterns...`)
          
          // Count admin/creator appearances
          const adminFrequency = new Map()
          let totalAdminGroups = 0
          
          for (const group of groups) {
            if (group.participants && Array.isArray(group.participants)) {
              const adminsInGroup = group.participants.filter(p => 
                p.rank === 'admin' || p.rank === 'creator'
              )
              
              if (adminsInGroup.length > 0) {
                totalAdminGroups++
                
                for (const admin of adminsInGroup) {
                  const phone = admin.id
                  if (phone && phone.match(/^972\d{9}$/)) { // Valid Israeli format
                    const count = adminFrequency.get(phone) || 0
                    adminFrequency.set(phone, count + 1)
                  }
                }
              }
            }
          }
          
          console.log(`📊 Found ${totalAdminGroups} groups with admin data`)
          console.log(`📊 Admin frequency analysis:`)
          
          // Sort by frequency and find the most likely user phone
          const sortedAdmins = Array.from(adminFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) // Top 10
          
          for (const [phone, count] of sortedAdmins) {
            console.log(`   📱 ${phone}: admin in ${count} groups`)
          }
          
          // Auto-select if one phone is clearly dominant
          if (sortedAdmins.length > 0) {
            const [topPhone, topCount] = sortedAdmins[0]
            const [secondPhone, secondCount] = sortedAdmins[1] || [null, 0]
            
            // IMPROVED: More confident auto-selection
            // Auto-select the top candidate if they're admin in at least 3 groups
            // OR if they're clearly the most frequent admin
            if (topCount >= 3) {
              userPhoneNumber = topPhone
              console.log(`🎯 AUTO-DETECTED: ${userPhoneNumber} (admin in ${topCount} groups - high confidence)`)
            } else if (topCount >= 2 && topCount > secondCount) {
              // Select if admin in 2+ groups AND more than second place
              userPhoneNumber = topPhone
              console.log(`🎯 AUTO-DETECTED: ${userPhoneNumber} (admin in ${topCount} groups - medium confidence)`)
            } else if (sortedAdmins.length === 1 && topCount >= 1) {
              // Only one admin candidate
              userPhoneNumber = topPhone
              console.log(`🎯 AUTO-DETECTED: ${userPhoneNumber} (only admin candidate)`)
            } else {
              console.log(`⚠️ Multiple admin candidates found. Top candidates:`)
              for (const [phone, count] of sortedAdmins.slice(0, 3)) {
                console.log(`   📱 ${phone}: ${count} groups`)
              }
              
              // FALLBACK: Just pick the top one if they have at least 2 groups
              if (topCount >= 2) {
                userPhoneNumber = topPhone
                console.log(`🎯 FALLBACK AUTO-SELECT: ${userPhoneNumber} (top candidate with ${topCount} groups)`)
              }
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Admin pattern analysis failed:', error.message)
      }
    }

    // Method 3: Fallback - Extract from sent messages 
    if (!userPhoneNumber) {
      console.log('📱 FALLBACK: Trying to extract from sent messages...')
      
      try {
        const chatsResponse = await fetch('https://gate.whapi.cloud/chats?count=10', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (chatsResponse.ok) {
          const chatsData = await chatsResponse.json()
          const chats = chatsData.chats || chatsData.data || []
          
          for (const chat of chats) {
            // Skip groups, look for individual chats
            if (chat.type === 'group' || chat.id.includes('@g.us')) continue
            
            try {
              const messagesResponse = await fetch(`https://gate.whapi.cloud/messages/list?chat_id=${chat.id}&count=3`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${profile.whapi_token}`,
                  'Content-Type': 'application/json'
                }
              })
              
              if (messagesResponse.ok) {
                const messagesData = await messagesResponse.json()
                const messages = messagesData.messages || []
                
                for (const message of messages) {
                  if (message.from_me && message.from && message.from.match(/^972\d{9}$/)) {
                    userPhoneNumber = message.from
                    console.log('📱 Found phone from sent message:', userPhoneNumber)
                    break
                  }
                }
                
                if (userPhoneNumber) break
              }
            } catch (msgError) {
              console.log('⚠️ Error checking messages in chat:', chat.id)
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Message extraction failed:', error.message)
      }
    }

    // If still no phone, provide helpful guidance
    if (!userPhoneNumber) {
      console.log('❌ Could not auto-detect phone number')
      
      // Try to get admin patterns anyway for manual selection
      const groupsResponse = await fetch('https://gate.whapi.cloud/groups?count=20', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      let adminPhones = []
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json()
        const groups = groupsData.groups || []
        const phoneSet = new Set()
        
        for (const group of groups) {
          if (group.participants) {
            for (const participant of group.participants) {
              if ((participant.rank === 'admin' || participant.rank === 'creator') && 
                  participant.id.match(/^972\d{9}$/)) {
                phoneSet.add(participant.id)
              }
            }
          }
        }
        
        adminPhones = Array.from(phoneSet)
      }

      return new Response(
        JSON.stringify({ 
          error: 'Could not automatically detect your phone number',
          help: 'Please contact support with one of these phone numbers that appear as admin in your groups:',
          possible_phones: adminPhones,
          instructions: 'Tell support which of these numbers is yours, and we will configure it for you.'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🎯 Save detected phone for future use
    if (userPhoneNumber && !profile.user_phone) {
      try {
        await supabase
          .from('profiles')
          .update({ user_phone: userPhoneNumber })
          .eq('id', userId)
        
        console.log('✅ Saved detected phone to database')
      } catch (saveError) {
        console.log('⚠️ Could not save phone:', saveError.message)
      }
    }

    console.log('📱 Using phone number:', userPhoneNumber)

    // Continue with group sync
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups?count=100`, {
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
    const allGroups = groupsData.groups || []

    // Enhanced phone matching
    function isPhoneMatch(phone1: string, phone2: string): boolean {
      if (!phone1 || !phone2) return false
      
      const clean1 = phone1.replace(/\D/g, '')
      const clean2 = phone2.replace(/\D/g, '')
      
      if (clean1 === clean2) return true
      
      // Israeli format handling
      if (clean1.length >= 9 && clean2.length >= 9) {
        return clean1.slice(-9) === clean2.slice(-9)
      }
      
      return false
    }

    // Process groups
    const groupsToInsert = []
    let adminCount = 0
    let creatorCount = 0

    for (const group of allGroups) {
      const groupName = group.name || group.subject || `Group ${group.id}`
      let isAdmin = false
      let isCreator = false
      
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
        participants_count: group.participants?.length || group.size || 0,
        is_admin: isAdmin,
        avatar_url: group.chat_pic || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }

    // Save to database
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId)
    
    if (groupsToInsert.length > 0) {
      await supabase.from('whatsapp_groups').insert(groupsToInsert)
    }

    console.log('🎯 SYNC COMPLETE:', {
      phone: userPhoneNumber,
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
        message: `Auto-detected ${userPhoneNumber} and found ${adminCount + creatorCount} admin/creator groups out of ${allGroups.length} total groups`
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