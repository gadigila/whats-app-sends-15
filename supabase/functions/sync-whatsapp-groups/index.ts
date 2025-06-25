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

    console.log('🚀 Sync WhatsApp Groups: Starting comprehensive sync...')

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

    console.log('📱 Fetching user profile for phone number...')

    // STEP 1: Get user's phone number
    const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    let userPhoneNumbers: string[] = []
    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      const basePhone = profileData.phone || profileData.id
      
      if (basePhone) {
        // Create multiple phone number formats to handle different cases
        userPhoneNumbers = [
          basePhone,                           // Original format
          basePhone.replace(/^\+/, ''),        // Without +
          '+' + basePhone.replace(/^\+/, ''),  // With +
          basePhone.replace(/[^\d]/g, '')      // Only digits
        ]
        // Remove duplicates
        userPhoneNumbers = [...new Set(userPhoneNumbers)]
        console.log('📞 User phone number variations:', userPhoneNumbers)
      } else {
        console.error('❌ Could not get user phone number from profile')
      }
    } else {
      console.error('❌ Failed to get user profile:', profileResponse.status)
    }

    console.log('📋 Fetching groups list...')

    // STEP 2: Get basic groups list
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

    console.log(`📊 Found ${basicGroups.length} groups. Getting detailed info for each...`)

    // STEP 3: Get detailed info for each group (including participants)
    const groupsToInsert = []
    let adminCount = 0
    let processedCount = 0

    for (const basicGroup of basicGroups) {
      try {
        processedCount++
        console.log(`🔍 Processing group ${processedCount}/${basicGroups.length}: ${basicGroup.name || basicGroup.subject}`)
        
        // Get detailed group info with participants
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${basicGroup.id}`, {
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`
          }
        })

        let isAdmin = false
        let participantsCount = 0
        
        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Check participants for admin status
          if (detailData.participants && Array.isArray(detailData.participants)) {
            participantsCount = detailData.participants.length
            
            // Check if any of our phone number variations match an admin/creator
            for (const participant of detailData.participants) {
              if (userPhoneNumbers.includes(participant.id)) {
                const rank = participant.rank
                isAdmin = rank === 'admin' || rank === 'creator'
                console.log(`👤 Found user in group "${basicGroup.name}": rank=${rank}, isAdmin=${isAdmin}`)
                break
              }
            }
          } else {
            console.log(`⚠️ No participants data for group "${basicGroup.name}"`)
          }
        } else {
          console.log(`⚠️ Could not get detailed info for group "${basicGroup.name}": ${detailResponse.status}`)
          // Use basic group data as fallback
          participantsCount = basicGroup.participants_count || basicGroup.size || 0
        }

        if (isAdmin) {
          adminCount++
          console.log(`👑 User is admin in: "${basicGroup.name || basicGroup.subject}"`)
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
        await new Promise(resolve => setTimeout(resolve, 100))

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

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        user_phone_variations: userPhoneNumbers,
        processed_groups: processedCount,
        groups: groupsToInsert.slice(0, 5), // Return first 5 for debugging
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