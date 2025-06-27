import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// FIXED: Precise phone number normalization based on WHAPI formats
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove @c.us and @s.whatsapp.net suffixes first
  let clean = phone.replace(/@c\.us$|@s\.whatsapp\.net$/g, '');
  
  // Remove all non-digits
  clean = clean.replace(/[^\d]/g, '');
  
  // Normalize Israeli numbers to international format (972XXXXXXXXX)
  if (clean.startsWith('0') && clean.length === 10) {
    // Convert 0501234567 -> 972501234567
    clean = '972' + clean.substring(1);
  }
  
  return clean;
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const norm1 = normalizePhoneNumber(phone1);
  const norm2 = normalizePhoneNumber(phone2);
  
  if (!norm1 || !norm2) return false;
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Match last 9 digits (mobile number without country code)
  if (norm1.length >= 9 && norm2.length >= 9) {
    return norm1.slice(-9) === norm2.slice(-9);
  }
  
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 Enhanced WHAPI Admin Detection Starting...')

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
        userPhoneNumber = profileData.phone || profileData.id || profileData.wid
        
        if (userPhoneNumber) {
          const normalizedUserPhone = normalizePhoneNumber(userPhoneNumber)
          console.log('📞 User phone found:', userPhoneNumber, '-> normalized:', normalizedUserPhone)
        }
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
        throw new Error('Could not get user phone number')
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

    // STEP 2: Get all groups
    console.log('📋 Fetching all groups...')
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

    console.log(`📊 Found ${allGroups.length} total groups`)

    // STEP 3: Process groups with better rate limiting
    const groupsToInsert = []
    let adminCount = 0
    let processedCount = 0

    console.log(`🔍 Starting admin detection for ${allGroups.length} groups...`)

    for (const group of allGroups) {
      const groupName = group.name || group.subject || `Group ${group.id}`
      console.log(`🔍 [${processedCount + 1}/${allGroups.length}] Checking: ${groupName}`)
      
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
          participantsCount = detailData.participants?.length || 0

          // Check admin status using WHAPI's recommended approach
          // 1. Check participants array with rank field
          if (detailData.participants && Array.isArray(detailData.participants)) {
            for (const participant of detailData.participants) {
              const participantPhone = participant.id || participant.phone
              const participantRank = participant.rank || participant.role

              if (participantPhone && isPhoneMatch(userPhoneNumber, participantPhone)) {
                if (participantRank === 'admin' || participantRank === 'creator' || participantRank === 'owner') {
                  isAdmin = true
                  console.log(`👑 ✅ User is ${participantRank} in "${groupName}"`)
                  break
                }
              }
            }
          }

          // 2. Check admins array (fallback)
          if (!isAdmin && detailData.admins && Array.isArray(detailData.admins)) {
            for (const admin of detailData.admins) {
              const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone)
              
              if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
                isAdmin = true
                console.log(`👑 ✅ User found in admins array for "${groupName}"`)
                break
              }
            }
          }

          // 3. Check owner field (fallback)
          if (!isAdmin && detailData.owner) {
            const ownerPhone = typeof detailData.owner === 'string' ? detailData.owner : (detailData.owner.id || detailData.owner.phone)
            
            if (ownerPhone && isPhoneMatch(userPhoneNumber, ownerPhone)) {
              isAdmin = true
              console.log(`👑 ✅ User is owner of "${groupName}"`)
            }
          }

        } else if (detailResponse.status === 429) {
          console.log(`⏳ Rate limited for "${groupName}", waiting...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        } else {
          console.log(`⚠️ Could not get details for "${groupName}": ${detailResponse.status}`)
          participantsCount = group.participants_count || group.size || 0
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        console.error(`❌ Error processing group ${group.id}:`, error.message)
        participantsCount = group.participants_count || group.size || 0
      }

      if (isAdmin) {
        adminCount++
      }

      // Add to results
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
      processedCount++
    }

    // STEP 4: Save to database
    console.log(`💾 Saving ${groupsToInsert.length} groups to database...`)
    
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

      console.log('✅ Successfully saved all groups to database')

    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: dbError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Final results
    const adminGroups = groupsToInsert.filter(g => g.is_admin)
    const totalMembers = groupsToInsert.reduce((sum, g) => sum + g.participants_count, 0)

    console.log(`📊 FINAL RESULTS:`)
    console.log(`📊 Total groups: ${groupsToInsert.length}`)
    console.log(`👑 Admin groups: ${adminCount}`)
    console.log(`👤 Member groups: ${groupsToInsert.length - adminCount}`)
    console.log(`👥 Total members: ${totalMembers}`)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        member_groups_count: groupsToInsert.length - adminCount,
        total_members: totalMembers,
        user_phone: userPhoneNumber,
        normalized_user_phone: normalizePhoneNumber(userPhoneNumber),
        admin_groups: adminGroups.map(g => ({
          name: g.name,
          participants_count: g.participants_count,
          group_id: g.group_id
        })),
        message: `Successfully synced ${groupsToInsert.length} groups with enhanced admin detection`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Enhanced sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})