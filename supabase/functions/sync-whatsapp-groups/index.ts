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
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 ADMIN PRIVILEGE SYNC: Requesting real phone numbers as admin...')
    
    const { userId }: SyncGroupsRequest = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user with WhatsApp data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('phone, whatsapp_token, whatsapp_instance_id')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`)
    }

    if (!user.whatsapp_token || !user.whatsapp_instance_id) {
      throw new Error('WhatsApp credentials not found')
    }

    console.log(`📱 User phone: "${user.phone}"`)

    // Generate user phone variants for matching
    function generatePhoneVariants(phone: string): string[] {
      if (!phone) return []
      
      const cleaned = phone.replace(/[^\d]/g, '')
      const variants = new Set<string>()
      
      variants.add(cleaned)
      variants.add(phone)
      
      if (cleaned.startsWith('972')) {
        const withoutCountry = cleaned.substring(3)
        variants.add(withoutCountry)
        variants.add('0' + withoutCountry)
        variants.add('+972' + withoutCountry)
      }
      
      if (cleaned.startsWith('0')) {
        const withoutLeading = cleaned.substring(1)
        variants.add(withoutLeading)
        variants.add('972' + withoutLeading)
        variants.add('+972' + withoutLeading)
      }
      
      return Array.from(variants)
    }

    const userPhoneVariants = generatePhoneVariants(user.phone)
    console.log(`🔢 User phone variants: [${userPhoneVariants.join(', ')}]`)

    // Fetch groups from WHAPI
    const groupsResponse = await fetch(
      `https://gate.whapi.cloud/groups?count=50`,
      {
        headers: {
          'Authorization': `Bearer ${user.whatsapp_token}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!groupsResponse.ok) {
      throw new Error(`WHAPI groups API failed: ${groupsResponse.status} ${groupsResponse.statusText}`)
    }

    const groupsData = await groupsResponse.json()
    const groups = groupsData.groups || []
    
    console.log(`📊 Received ${groups.length} groups from WHAPI`)

    if (groups.length === 0) {
      console.log('❌ No groups returned from WHAPI')
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No groups found in WhatsApp',
        groupsProcessed: 0,
        adminGroupsFound: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let adminGroupsFound = 0
    const processedGroups = []

    // Process each group with enhanced admin privilege requests
    for (const group of groups) {
      console.log(`\n🔍 PROCESSING: ${group.name}`)
      console.log(`📊 Initial participants: ${group.participants?.length || 0}`)
      
      // STEP 1: Get detailed group info with admin privileges
      try {
        const detailResponse = await fetch(
          `https://gate.whapi.cloud/groups/${group.id}`,
          {
            headers: {
              'Authorization': `Bearer ${user.whatsapp_token}`,
              'Accept': 'application/json'
            }
          }
        )

        if (!detailResponse.ok) {
          console.log(`❌ Cannot get details for: ${group.name} (${detailResponse.status})`)
          continue
        }

        const detailData = await detailResponse.json()
        console.log(`✅ Got detailed info for: ${group.name}`)
        console.log(`👥 Detailed participants: ${detailData.participants?.length || 0}`)

        // Use detailed participant data if available
        const participants = detailData.participants || group.participants || []
        
        if (participants.length === 0) {
          console.log(`⚠️ No participants in: ${group.name}`)
          continue
        }

        console.log(`\n🔍 ANALYZING PARTICIPANTS in ${group.name}:`)
        console.log(`📋 Total participants to check: ${participants.length}`)

        let isAdmin = false
        let userRole = null
        let realPhoneNumbersCount = 0
        let lidCount = 0

        // Analyze each participant
        for (let i = 0; i < Math.min(participants.length, 10); i++) { // Check first 10 for debugging
          const participant = participants[i]
          
          const phone = participant.phone || participant.wa_id || participant.id
          const isRealPhone = phone && !phone.includes('@lid') && /^\+?[\d\-\s\(\)]+$/.test(phone)
          const isLid = phone && phone.includes('@lid')
          
          if (isRealPhone) realPhoneNumbersCount++
          if (isLid) lidCount++

          console.log(`👤 Participant ${i + 1}:`)
          console.log(`   Name: "${participant.name || 'Unknown'}"`)
          console.log(`   Phone: "${phone}" (${isRealPhone ? 'REAL PHONE' : isLid ? 'LID' : 'OTHER'})`)
          console.log(`   Role: "${participant.rank || 'member'}"`)

          // Check if this participant matches our user
          if (isRealPhone && userPhoneVariants.includes(phone)) {
            console.log(`   🎯 MATCH FOUND! This is our user`)
            console.log(`   👑 User role: ${participant.rank}`)
            
            if (participant.rank === 'admin' || participant.rank === 'creator') {
              isAdmin = true
              userRole = participant.rank
              console.log(`   ✅ USER IS ${userRole.toUpperCase()}!`)
              break
            } else {
              console.log(`   👤 User is just a member`)
              break
            }
          }
        }

        console.log(`\n📊 PARTICIPANT ANALYSIS for ${group.name}:`)
        console.log(`   Real phone numbers: ${realPhoneNumbersCount}`)
        console.log(`   @lid identifiers: ${lidCount}`)
        console.log(`   Total checked: ${Math.min(participants.length, 10)}`)

        if (realPhoneNumbersCount === 0 && lidCount > 0) {
          console.log(`⚠️ ALL PARTICIPANTS HAVE @LID - Privacy mode active`)
          console.log(`📝 This suggests strict privacy settings or you're not admin`)
        } else if (realPhoneNumbersCount > 0) {
          console.log(`✅ REAL PHONE NUMBERS VISIBLE - Admin privileges confirmed`)
        }

        if (isAdmin) {
          console.log(`🎉 ADMIN GROUP CONFIRMED: ${group.name}`)
          adminGroupsFound++
          
          const groupData = {
            whatsapp_group_id: group.id,
            name: group.name,
            user_id: userId,
            participants_count: participants.length,
            user_role: userRole,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          processedGroups.push(groupData)
          console.log(`✅ ADDED: ${group.name} (${participants.length} members) - ${userRole?.toUpperCase()}`)
        } else {
          console.log(`❌ Not admin in: ${group.name}`)
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        console.log(`❌ Error processing ${group.name}: ${error.message}`)
      }
    }

    // Save to database
    if (processedGroups.length > 0) {
      console.log(`\n💾 Saving ${processedGroups.length} admin groups to database...`)
      
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .upsert(processedGroups, { 
          onConflict: 'whatsapp_group_id,user_id',
          ignoreDuplicates: false 
        })

      if (insertError) {
        console.error('❌ Database insert error:', insertError)
        throw insertError
      }

      console.log(`✅ Successfully saved ${processedGroups.length} groups`)
    } else {
      console.log('💾 No admin groups found to save')
    }

    console.log(`\n🎯 ADMIN PRIVILEGE SYNC COMPLETE!`)
    console.log(`📊 Groups processed: ${groups.length}`)
    console.log(`👑 Admin groups found: ${adminGroupsFound}`)
    console.log(`🔧 Method: Enhanced admin privilege detection`)

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Admin privilege sync completed`,
      groupsProcessed: groups.length,
      adminGroupsFound: adminGroupsFound,
      method: 'admin_privilege_detection',
      groups: processedGroups.map(g => ({ name: g.name, role: g.user_role, participants: g.participants_count }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Sync error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})