import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Enhanced phone number matching with extensive debugging
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
    
    // Israeli phone number specific handling
    if (digitsOnly.startsWith('972')) {
      const withoutCountry = digitsOnly.substring(3);
      variations.add(withoutCountry);
      variations.add(`0${withoutCountry}`);
    }
    
    if (digitsOnly.startsWith('0')) {
      const withCountry = `972${digitsOnly.substring(1)}`;
      variations.add(withCountry);
      variations.add(`+${withCountry}`);
    }
    
    // Add common Israeli mobile prefixes
    if (digitsOnly.length === 9 && !digitsOnly.startsWith('0')) {
      variations.add(`0${digitsOnly}`);
    }
  }
  
  // Add/remove + prefix variations
  if (phone.startsWith('+')) {
    variations.add(phone.substring(1));
  } else {
    variations.add(`+${phone}`);
  }
  
  return Array.from(variations).filter(v => v.length >= 8);
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

    console.log('🚀 Enhanced Sync: Starting with detailed admin detection...')

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

    // STEP 1: Get user's phone number with detailed logging
    console.log('📱 Getting user profile for phone number...')
    let userPhoneNumber = null
    let userPhoneVariations: string[] = []

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
        userPhoneVariations = createPhoneVariations(userPhoneNumber)
        
        console.log('📞 ===== USER PHONE DEBUG =====')
        console.log('📞 Raw phone from WHAPI:', userPhoneNumber)
        console.log('📞 All phone variations:', userPhoneVariations)
        console.log('📞 =============================')
      } else {
        console.error('❌ Failed to get user profile:', profileResponse.status)
      }
    } catch (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
    }

    // STEP 2: Fetch ALL groups (don't save yet - we'll implement selective sync)
    console.log('📋 Fetching all available groups...')
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

    console.log(`📊 Found ${allGroups.length} groups total. Analyzing admin status...`)

    // STEP 3: Enhanced admin detection with detailed logging
    const processedGroups = []
    let adminCount = 0
    let debugInfo = []

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`\n🔍 ===== GROUP ${i + 1}/${allGroups.length}: ${groupName} =====`)
      
      let isAdmin = false
      let participantsCount = 0
      let debugData = {
        groupName,
        groupId: group.id,
        isAdmin: false,
        adminCheckMethods: [],
        participantData: null,
        adminData: null,
        userFound: false,
        userRole: null
      }

      try {
        // Method 1: Check basic group data first
        if (group.admins && Array.isArray(group.admins)) {
          console.log(`👑 Method 1: Checking ${group.admins.length} admins in basic group data`)
          debugData.adminCheckMethods.push('basic_group_admins')
          debugData.adminData = group.admins
          
          for (const admin of group.admins) {
            const adminPhone = admin.id || admin.phone || admin
            console.log(`  📞 Admin phone: ${adminPhone}`)
            
            if (adminPhone && userPhoneNumber && isPhoneMatch(userPhoneNumber, adminPhone)) {
              isAdmin = true
              debugData.isAdmin = true
              debugData.userFound = true
              debugData.userRole = 'admin'
              console.log(`👑 ✅ MATCH! User found as admin: ${adminPhone}`)
              break
            }
          }
        }

        // Method 2: Get detailed group information
        if (!isAdmin) {
          console.log(`🔍 Method 2: Getting detailed group info...`)
          const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${profile.whapi_token}`,
              'Content-Type': 'application/json'
            }
          })

          if (detailResponse.ok) {
            const detailData = await detailResponse.json()
            debugData.adminCheckMethods.push('detailed_group_call')
            
            // Check participants for count and roles
            if (detailData.participants && Array.isArray(detailData.participants)) {
              participantsCount = detailData.participants.length
              debugData.participantData = {
                count: participantsCount,
                sampleParticipants: detailData.participants.slice(0, 3).map(p => ({
                  id: p.id || p.phone,
                  rank: p.rank || p.role
                }))
              }
              
              console.log(`👥 Found ${participantsCount} participants`)
              console.log(`👥 Sample participants:`, debugData.participantData.sampleParticipants)
              
              // Check each participant
              for (const participant of detailData.participants) {
                const participantPhone = participant.id || participant.phone
                const participantRole = participant.rank || participant.role
                
                if (participantPhone && userPhoneNumber) {
                  const phoneMatch = isPhoneMatch(userPhoneNumber, participantPhone)
                  console.log(`  👤 Participant: ${participantPhone}, role: ${participantRole}, match: ${phoneMatch}`)
                  
                  if (phoneMatch) {
                    debugData.userFound = true
                    debugData.userRole = participantRole
                    
                    if (participantRole === 'admin' || participantRole === 'creator' || participantRole === 'superadmin') {
                      isAdmin = true
                      debugData.isAdmin = true
                      console.log(`👑 ✅ MATCH! User found as ${participantRole}: ${participantPhone}`)
                      break
                    } else {
                      console.log(`👤 User found as member: ${participantPhone}`)
                    }
                  }
                }
              }
            }

            // Also check detailed admins array
            if (!isAdmin && detailData.admins && Array.isArray(detailData.admins)) {
              console.log(`👑 Method 3: Checking ${detailData.admins.length} admins in detailed data`)
              debugData.adminCheckMethods.push('detailed_group_admins')
              
              for (const admin of detailData.admins) {
                const adminPhone = admin.id || admin.phone || admin
                console.log(`  📞 Detailed admin phone: ${adminPhone}`)
                
                if (adminPhone && userPhoneNumber && isPhoneMatch(userPhoneNumber, adminPhone)) {
                  isAdmin = true
                  debugData.isAdmin = true
                  debugData.userFound = true
                  debugData.userRole = 'admin'
                  console.log(`👑 ✅ MATCH! User found in detailed admins: ${adminPhone}`)
                  break
                }
              }
            }
          } else {
            console.log(`⚠️ Could not get detailed info: ${detailResponse.status}`)
          }
        }

        // Fallback participant count
        if (participantsCount === 0) {
          participantsCount = group.participants_count || group.size || 0
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))

      } catch (error) {
        console.error(`❌ Error processing group ${group.id}:`, error)
        debugData.adminCheckMethods.push('error')
      }

      if (isAdmin) {
        adminCount++
        console.log(`👑 ✅ FINAL: User IS admin in "${groupName}"`)
      } else {
        console.log(`👤 FINAL: User is ${debugData.userFound ? 'member' : 'not found'} in "${groupName}"`)
      }

      debugInfo.push(debugData)

      // Add to processed groups list
      processedGroups.push({
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

      console.log(`====================================\n`)
    }

    console.log(`\n📊 ===== FINAL ANALYSIS =====`)
    console.log(`📊 Total groups processed: ${processedGroups.length}`)
    console.log(`📊 Admin groups found: ${adminCount}`)
    console.log(`📊 Member groups: ${processedGroups.length - adminCount}`)
    console.log(`📞 User phone: ${userPhoneNumber}`)
    console.log(`📞 Phone variations tested: ${userPhoneVariations.length}`)

    // FOR NOW: Save all groups (we'll implement selective sync in the UI)
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
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: processedGroups.length,
        admin_groups_count: adminCount,
        member_groups_count: processedGroups.length - adminCount,
        user_phone: userPhoneNumber,
        user_phone_variations: userPhoneVariations,
        debug_info: debugInfo.slice(0, 5), // First 5 groups for debugging
        admin_groups_sample: processedGroups.filter(g => g.is_admin).slice(0, 3).map(g => ({
          id: g.group_id,
          name: g.name,
          participants: g.participants_count
        })),
        message: `Enhanced sync completed - ${adminCount} admin groups detected out of ${processedGroups.length} total`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Enhanced Sync Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})