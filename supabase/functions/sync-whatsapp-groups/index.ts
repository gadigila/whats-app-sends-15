import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

interface GroupParticipant {
  id: string
  phone?: string
  rank?: 'creator' | 'admin' | 'member' | 'superadmin'
  role?: string
}

interface GroupDetails {
  id: string
  name?: string
  subject?: string
  description?: string
  participants?: GroupParticipant[]
  participants_count?: number
  size?: number
  admins?: string[] | { id: string; phone?: string }[]
  owner?: string | { id: string; phone?: string }
  creator?: string | { id: string; phone?: string }
  avatar_url?: string
  picture?: string
}

interface UserProfile {
  phone?: string
  id?: string
  wid?: string
  jid?: string
  me?: { phone?: string }
  user?: { phone?: string }
}

// Enhanced phone number matching with comprehensive Israeli variations
function createPhoneVariations(phone: string): string[] {
  if (!phone) return []
  
  const variations = new Set<string>()
  
  // Original phone
  variations.add(phone)
  
  // Remove WhatsApp suffixes first
  let cleanPhone = phone
  if (phone.includes('@c.us')) {
    cleanPhone = phone.replace('@c.us', '')
    variations.add(cleanPhone)
  }
  if (phone.includes('@s.whatsapp.net')) {
    cleanPhone = phone.replace('@s.whatsapp.net', '')
    variations.add(cleanPhone)
  }
  
  // Remove all non-digits for core matching
  const digitsOnly = cleanPhone.replace(/[^\d]/g, '')
  if (!digitsOnly || digitsOnly.length < 8) return Array.from(variations)
  
  variations.add(digitsOnly)
  variations.add(`+${digitsOnly}`)
  
  // Israeli phone number handling (972 country code)
  if (digitsOnly.startsWith('972')) {
    const withoutCountry = digitsOnly.substring(3)
    variations.add(withoutCountry)
    variations.add(`0${withoutCountry}`)
    variations.add(`+972${withoutCountry}`)
    
    // Add WhatsApp suffixes
    variations.add(`${digitsOnly}@c.us`)
    variations.add(`${withoutCountry}@c.us`)
    variations.add(`0${withoutCountry}@c.us`)
  }
  
  // Handle Israeli local format (0XXXXXXXXX)
  if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
    const without0 = digitsOnly.substring(1)
    variations.add(without0)
    variations.add(`+972${without0}`)
    variations.add(`972${without0}`)
    variations.add(`${without0}@c.us`)
    variations.add(`972${without0}@c.us`)
  }
  
  // Handle Israeli mobile without 0 prefix (XXXXXXXXX)
  if (digitsOnly.length === 9 && !digitsOnly.startsWith('0') && !digitsOnly.startsWith('972')) {
    variations.add(`0${digitsOnly}`)
    variations.add(`+972${digitsOnly}`)
    variations.add(`972${digitsOnly}`)
    variations.add(`${digitsOnly}@c.us`)
    variations.add(`972${digitsOnly}@c.us`)
  }
  
  // Add/remove + prefix for all variations
  Array.from(variations).forEach(variation => {
    if (variation.startsWith('+')) {
      variations.add(variation.substring(1))
    } else if (!variation.startsWith('+') && !variation.includes('@')) {
      variations.add(`+${variation}`)
    }
  })
  
  return Array.from(variations).filter(v => v.length >= 8)
}

function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false
  
  const variations1 = createPhoneVariations(phone1)
  const variations2 = createPhoneVariations(phone2)
  
  return variations1.some(v1 => variations2.includes(v1))
}

// Enhanced user phone detection
async function getUserPhoneNumber(whapiToken: string): Promise<string | null> {
  try {
    console.log('📱 Fetching user profile for phone number...')
    
    const response = await fetch('https://gate.whapi.cloud/users/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whapiToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error('❌ Failed to get user profile:', response.status)
      return null
    }
    
    const profileData: UserProfile = await response.json()
    console.log('📞 Profile data fields:', Object.keys(profileData))
    
    // Try multiple fields for phone number
    const userPhone = profileData.phone || 
                     profileData.id || 
                     profileData.wid ||
                     profileData.jid ||
                     profileData.me?.phone ||
                     profileData.user?.phone
    
    if (userPhone) {
      console.log('📞 User phone number identified:', userPhone)
      return userPhone
    } else {
      console.error('❌ No phone number found in profile data')
      return null
    }
    
  } catch (error) {
    console.error('❌ Error fetching user profile:', error)
    return null
  }
}

// Enhanced group details fetching with retry logic
async function getGroupDetails(groupId: string, whapiToken: string, retries = 2): Promise<GroupDetails | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        return await response.json()
      } else if (response.status === 429) {
        console.log(`⏳ Rate limited for group ${groupId}, waiting...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
        continue
      } else {
        console.log(`⚠️ Could not get details for group ${groupId}: ${response.status}`)
        return null
      }
    } catch (error) {
      console.log(`⚠️ Fetch error for group ${groupId} (attempt ${attempt + 1}): ${error.message}`)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  return null
}

// Enhanced admin detection logic
function checkIfUserIsAdmin(userPhone: string, groupDetails: GroupDetails, groupName: string, debugMode = false): boolean {
  if (!userPhone || !groupDetails) return false
  
  let isAdmin = false
  const userPhoneClean = userPhone.replace(/[^\d]/g, '')
  
  if (debugMode) {
    console.log(`🔍 ADMIN CHECK for "${groupName}":`)
    console.log(`  - User phone: ${userPhone} (clean: ${userPhoneClean})`)
    console.log(`  - Participants: ${groupDetails.participants?.length || 0}`)
    console.log(`  - Admins array: ${groupDetails.admins?.length || 0}`)
    console.log(`  - Owner: ${groupDetails.owner}`)
    console.log(`  - Creator: ${groupDetails.creator}`)
  }
  
  // Method 1: Check participants array for creator/admin rank
  if (groupDetails.participants && Array.isArray(groupDetails.participants)) {
    for (const participant of groupDetails.participants) {
      const participantPhone = participant.id || participant.phone
      const participantRole = participant.rank || participant.role
      
      if (participantPhone && isPhoneMatch(userPhone, participantPhone)) {
        if (debugMode) {
          console.log(`  📱 Found user in participants: ${participantPhone} with role: ${participantRole}`)
        }
        
        if (participantRole) {
          const roleCheck = participantRole.toLowerCase()
          // Check for creator, admin, owner, or superadmin
          if (['creator', 'admin', 'owner', 'superadmin'].includes(roleCheck)) {
            isAdmin = true
            console.log(`👑 ✅ User is ${participantRole} in "${groupName}" (matched: ${participantPhone})`)
            break
          }
        }
      }
    }
  }
  
  // Method 2: Check admins array
  if (!isAdmin && groupDetails.admins && Array.isArray(groupDetails.admins)) {
    for (const admin of groupDetails.admins) {
      const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone)
      
      if (adminPhone && isPhoneMatch(userPhone, adminPhone)) {
        isAdmin = true
        console.log(`👑 ✅ Found user in admins array: ${adminPhone}`)
        break
      }
    }
  }
  
  // Method 3: Check owner field
  if (!isAdmin && groupDetails.owner) {
    const ownerPhone = typeof groupDetails.owner === 'string' ? groupDetails.owner : (groupDetails.owner.id || groupDetails.owner.phone)
    
    if (ownerPhone && isPhoneMatch(userPhone, ownerPhone)) {
      isAdmin = true
      console.log(`👑 ✅ User is owner: ${ownerPhone}`)
    }
  }
  
  // Method 4: Check creator field
  if (!isAdmin && groupDetails.creator) {
    const creatorPhone = typeof groupDetails.creator === 'string' ? groupDetails.creator : (groupDetails.creator.id || groupDetails.creator.phone)
    
    if (creatorPhone && isPhoneMatch(userPhone, creatorPhone)) {
      isAdmin = true
      console.log(`👑 ✅ User is creator: ${creatorPhone}`)
    }
  }
  
  if (debugMode) {
    console.log(`  ➡️ Final admin status: ${isAdmin}`)
  }
  
  return isAdmin
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🚀 Enhanced WhatsApp Groups Sync Starting...')

    const { userId }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's WHAPI configuration
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

    // STEP 1: Get user phone number
    const userPhoneNumber = await getUserPhoneNumber(profile.whapi_token)
    
    if (!userPhoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine user phone number. Please try reconnecting WhatsApp.',
          suggestion: 'Disconnect and reconnect your WhatsApp instance'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📞 User phone identified: ${userPhoneNumber}`)
    const phoneVariations = createPhoneVariations(userPhoneNumber)
    console.log(`📞 Generated ${phoneVariations.length} phone variations for matching`)

    // STEP 2: Fetch groups list
    console.log('📋 Fetching groups list...')
    const groupsResponse = await fetch('https://gate.whapi.cloud/groups', {
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
    let allGroups: GroupDetails[] = []
    
    // Handle different response formats
    if (Array.isArray(groupsData)) {
      allGroups = groupsData
    } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
      allGroups = groupsData.groups
    } else if (groupsData.data && Array.isArray(groupsData.data)) {
      allGroups = groupsData.data
    }

    console.log(`📊 Found ${allGroups.length} groups total`)

    if (allGroups.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          groups_count: 0,
          admin_groups_count: 0,
          member_groups_count: 0,
          total_members: 0,
          message: 'No groups found'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // STEP 3: Process each group with enhanced admin detection
    const groupsToInsert = []
    let adminCount = 0
    let totalMembersCount = 0
    const debugMode = true // Set to false in production

    for (let i = 0; i < allGroups.length; i++) {
      const group = allGroups[i]
      const groupName = group.name || group.subject || `Group ${group.id}`
      
      console.log(`🔍 Processing ${i + 1}/${allGroups.length}: ${groupName}`)
      
      let isAdmin = false
      let participantsCount = 0

      // Get detailed group information
      const detailData = await getGroupDetails(group.id, profile.whapi_token)

      if (detailData) {
        // Log complete structure for first 3 groups in debug mode
        if (debugMode && i < 3) {
          console.log(`🔍 COMPLETE GROUP DATA for "${groupName}":`, JSON.stringify(detailData, null, 2))
        }

        // Get participant count
        participantsCount = detailData.participants?.length || 
                          detailData.participants_count || 
                          detailData.size || 0

        // Check if user is admin
        isAdmin = checkIfUserIsAdmin(userPhoneNumber, detailData, groupName, debugMode && i < 5)

      } else {
        // Fallback to basic group data
        console.log(`⚠️ Using fallback data for "${groupName}"`)
        participantsCount = group.participants_count || group.size || 0
        
        // Basic admin check from group list data
        if (group.admins && Array.isArray(group.admins)) {
          for (const admin of group.admins) {
            const adminPhone = typeof admin === 'string' ? admin : (admin.id || admin.phone)
            if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
              isAdmin = true
              console.log(`👑 ✅ Found user as admin in "${groupName}" (fallback)`)
              break
            }
          }
        }
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

      // Rate limiting - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Enhanced logging
    console.log(`📊 FINAL RESULTS:`)
    console.log(`  - Total groups: ${groupsToInsert.length}`)
    console.log(`  - Admin groups: ${adminCount}`)
    console.log(`  - Member groups: ${groupsToInsert.length - adminCount}`)
    console.log(`  - Total members: ${totalMembersCount}`)

    const adminGroups = groupsToInsert.filter(g => g.is_admin)
    const memberGroups = groupsToInsert.filter(g => !g.is_admin)

    if (adminCount > 0) {
      console.log('👑 Admin groups:', adminGroups.map(g => `${g.name} (${g.participants_count} members)`))
    } else {
      console.log('⚠️ NO ADMIN GROUPS DETECTED - This might indicate an issue with phone matching')
    }

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

    // Return detailed success response
    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        member_groups_count: groupsToInsert.length - adminCount,
        total_members: totalMembersCount,
        user_phone: userPhoneNumber,
        phone_variations_count: phoneVariations.length,
        admin_groups: adminGroups.map(g => ({ name: g.name, participants: g.participants_count })),
        message: `Successfully synced ${groupsToInsert.length} groups (${adminCount} admin groups found)`,
        debug_info: {
          user_phone_clean: userPhoneNumber.replace(/[^\d]/g, ''),
          first_phone_variation: phoneVariations[0],
          total_variations: phoneVariations.length
        }
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: corsHeaders }
    )
  }
}