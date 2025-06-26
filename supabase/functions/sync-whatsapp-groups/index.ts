import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Enhanced phone number matching function
function createPhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  const variations = new Set<string>();
  
  // Original phone
  variations.add(phone);
  
  // Remove all non-digits and create variations
  const digitsOnly = phone.replace(/[^\d]/g, '');
  if (digitsOnly) {
    variations.add(digitsOnly);
    variations.add(`+${digitsOnly}`);
    
    // If starts with country code, try without it
    if (digitsOnly.startsWith('972')) {
      const withoutCountry = digitsOnly.substring(3);
      variations.add(withoutCountry);
      variations.add(`0${withoutCountry}`);
    }
    
    // If starts with 0, try with country code
    if (digitsOnly.startsWith('0')) {
      const withCountry = `972${digitsOnly.substring(1)}`;
      variations.add(withCountry);
      variations.add(`+${withCountry}`);
    }
  }
  
  // Add/remove + prefix variations
  if (phone.startsWith('+')) {
    variations.add(phone.substring(1));
  } else {
    variations.add(`+${phone}`);
  }
  
  return Array.from(variations).filter(v => v.length >= 8); // Filter out too short numbers
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const variations1 = createPhoneVariations(phone1);
  const variations2 = createPhoneVariations(phone2);
  
  return variations1.some(v1 => variations2.includes(v1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 Sync WhatsApp Groups: Enhanced admin detection starting...')

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

    // STEP 1: Get user's phone number
    console.log('📱 Getting user profile for phone number...')
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
        
        const phoneVariations = createPhoneVariations(userPhoneNumber)
        console.log('📞 Phone variations created:', phoneVariations)
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
      }
    } catch (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
    }

    // STEP 2: Get groups list
    console.log('📋 Fetching groups list...')
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
    let allGroups = []
    
    if (Array.isArray(groupsData)) {
      allGroups = groupsData
    } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
      allGroups = groupsData.groups
    } else if (groupsData.data && Array.isArray(groupsData.data)) {
      allGroups = groupsData.data
    }

    console.log(`📊 Found ${allGroups.length} groups total`)

    // STEP 3: Enhanced admin detection for each group
    const groupsToInsert = []
    let adminCount = 0
    let totalMembersCount = 0

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`🔍 Processing ${i + 1}/${allGroups.length}: ${groupName}`)
      
      let isAdmin = false
      let participantsCount = 0

      try {
        // Get detailed group information
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          
          // Get accurate participant count
          if (detailData.participants && Array.isArray(detailData.participants)) {
            participantsCount = detailData.participants.length
            console.log(`👥 Group "${groupName}" has ${participantsCount} participants`)
            
            // Check each participant for admin role
            if (userPhoneNumber) {
              for (const participant of detailData.participants) {
                const participantPhone = participant.id || participant.phone
                const participantRole = participant.rank || participant.role
                
                if (participantPhone && isPhoneMatch(userPhoneNumber, participantPhone)) {
                  console.log(`👤 Found user in "${groupName}": ${participantPhone}, role: ${participantRole}`)
                  
                  if (participantRole === 'admin' || participantRole === 'creator' || participantRole === 'superadmin') {
                    isAdmin = true
                    console.log(`👑 ✅ User is ${participantRole} in "${groupName}"`)
                    break
                  }
                }
              }
            }
          } else if (detailData.participants_count || detailData.size) {
            participantsCount = detailData.participants_count || detailData.size
            console.log(`👥 Group "${groupName}" has ${participantsCount} participants (from count field)`)
          }

          // Also check admins array if available
          if (!isAdmin && detailData.admins && Array.isArray(detailData.admins) && userPhoneNumber) {
            console.log(`👑 Checking ${detailData.admins.length} admins in "${groupName}"`)
            
            for (const admin of detailData.admins) {
              const adminPhone = admin.id || admin.phone || admin
              
              if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
                isAdmin = true
                console.log(`👑 ✅ Found user as admin in "${groupName}": ${adminPhone}`)
                break
              }
            }
          }
        } else {
          console.log(`⚠️ Could not get details for "${groupName}": ${detailResponse.status}`)
          // Fallback to basic group data
          participantsCount = group.participants_count || group.size || 0
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))

      } catch (error) {
        console.error(`❌ Error processing group ${group.id}:`, error)
        participantsCount = group.participants_count || group.size || 0
      }

      if (isAdmin) {
        adminCount++
      }
      
      totalMembersCount += participantsCount

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

      console.log(`${isAdmin ? '👑' : '👤'} "${groupName}": ${participantsCount} members, admin: ${isAdmin}`)
    }

    console.log(`📊 Final results: ${adminCount} admin groups, ${groupsToInsert.length - adminCount} member groups, ${totalMembersCount} total members`)

    // STEP 4: Save to database
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

    // Return success with detailed stats
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        member_groups_count: groupsToInsert.length - adminCount,
        total_members: totalMembersCount,
        user_phone: userPhoneNumber,
        message: `Successfully synced ${groupsToInsert.length} groups (${adminCount} admin groups found)`
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