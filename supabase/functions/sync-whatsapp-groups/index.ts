import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Enhanced phone number matching function
// Replace your createPhoneVariations function with this MORE AGGRESSIVE version:

function createPhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  const variations = new Set<string>();
  
  // Original phone
  variations.add(phone);
  
  // Handle @c.us suffix (WhatsApp format) - REMOVE IT FIRST
  let cleanPhone = phone;
  if (phone.includes('@c.us')) {
    cleanPhone = phone.replace('@c.us', '');
    variations.add(cleanPhone);
  }
  
  // Handle @s.whatsapp.net suffix
  if (phone.includes('@s.whatsapp.net')) {
    cleanPhone = phone.replace('@s.whatsapp.net', '');
    variations.add(cleanPhone);
  }
  
  // Remove all non-digits and create variations
  const digitsOnly = cleanPhone.replace(/[^\d]/g, '');
  if (digitsOnly) {
    variations.add(digitsOnly);
    variations.add(`+${digitsOnly}`);
    
    // Israel specific (972) - MORE VARIATIONS
    if (digitsOnly.startsWith('972')) {
      const withoutCountry = digitsOnly.substring(3);
      variations.add(withoutCountry);
      variations.add(`0${withoutCountry}`);
      variations.add(`+972${withoutCountry}`);
    }
    
    // If starts with 0, try with country code
    if (digitsOnly.startsWith('0')) {
      const withCountry = `972${digitsOnly.substring(1)}`;
      variations.add(withCountry);
      variations.add(`+${withCountry}`);
    }

    // Add WhatsApp suffixes to ALL variations
    variations.add(`${digitsOnly}@c.us`);
    variations.add(`${digitsOnly}@s.whatsapp.net`);
    
    if (digitsOnly.startsWith('972')) {
      const withoutCountryCode = digitsOnly.substring(3);
      variations.add(`${withoutCountryCode}@c.us`);
      variations.add(`0${withoutCountryCode}@c.us`);
      variations.add(`${withoutCountryCode}@s.whatsapp.net`);
      variations.add(`0${withoutCountryCode}@s.whatsapp.net`);
    }
    
    // Handle 10-digit Israeli numbers (like 0501234567)
    if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
      const without0 = digitsOnly.substring(1);
      variations.add(without0);
      variations.add(`+972${without0}`);
      variations.add(`972${without0}`);
      variations.add(`${without0}@c.us`);
      variations.add(`972${without0}@c.us`);
    }
    
    // Handle 9-digit Israeli numbers (like 501234567)
    if (digitsOnly.length === 9 && !digitsOnly.startsWith('0')) {
      variations.add(`0${digitsOnly}`);
      variations.add(`+972${digitsOnly}`);
      variations.add(`972${digitsOnly}`);
      variations.add(`${digitsOnly}@c.us`);
      variations.add(`972${digitsOnly}@c.us`);
    }
  }
  
  // Add/remove + prefix variations
  if (cleanPhone.startsWith('+')) {
    variations.add(cleanPhone.substring(1));
  } else if (!cleanPhone.startsWith('+')) {
    variations.add(`+${cleanPhone}`);
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

            // STEP 1: Enhanced user phone number detection
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
            // Try multiple fields for phone number
            userPhoneNumber = profileData.phone || 
                             profileData.id || 
                             profileData.wid ||
                             profileData.jid ||
                             (profileData.me && profileData.me.phone) ||
                             (profileData.user && profileData.user.phone)
            
            console.log('📞 User phone number identified:', userPhoneNumber)
            console.log('📞 Profile data fields:', Object.keys(profileData))
            
            if (userPhoneNumber) {
              const phoneVariations = createPhoneVariations(userPhoneNumber)
              console.log('📞 Phone variations created:', phoneVariations)
            }
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
    // Get detailed group information with retry logic
    let detailData = null
    let retryCount = 0
    const maxRetries = 2

    while (!detailData && retryCount <= maxRetries) {
      try {
        const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${group.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (detailResponse.ok) {
          detailData = await detailResponse.json()
          break
        } else if (detailResponse.status === 429) {
          // Rate limited, wait longer
          console.log(`⏳ Rate limited for "${groupName}", waiting...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          retryCount++
        } else {
          console.log(`⚠️ Could not get details for "${groupName}": ${detailResponse.status}`)
          break
        }
      } catch (fetchError) {
        console.log(`⚠️ Fetch error for "${groupName}": ${fetchError.message}`)
        retryCount++
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    if (detailData) {
 
      // METHOD 1: Check participants array for admin roles
      if (detailData.participants && Array.isArray(detailData.participants)) {
        participantsCount = detailData.participants.length
        console.log(`👥 Group "${groupName}" has ${participantsCount} participants`)
        
        if (userPhoneNumber) {
          for (const participant of detailData.participants) {
            const participantPhone = participant.id || participant.phone || participant.wid
            const participantRole = participant.rank || participant.role || participant.type
            
            if (participantPhone && isPhoneMatch(userPhoneNumber, participantPhone)) {
              console.log(`👤 Found user in "${groupName}": ${participantPhone}, role: ${participantRole}`)
              
              if (participantRole === 'admin' || 
                  participantRole === 'creator' || 
                  participantRole === 'superadmin' ||
                  participantRole === 'owner') {
                isAdmin = true
                console.log(`👑 ✅ User is ${participantRole} in "${groupName}"`)
                break
              }
            }
          }
        }
      }

      // METHOD 2: Check admins array (as WHAPI support suggested)
      if (!isAdmin && detailData.admins && Array.isArray(detailData.admins) && userPhoneNumber) {
        console.log(`👑 Checking ${detailData.admins.length} admins in "${groupName}"`)
        
        for (const admin of detailData.admins) {
          const adminPhone = admin.id || admin.phone || admin.wid || admin
          
          if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
            isAdmin = true
            console.log(`👑 ✅ Found user as admin in "${groupName}": ${adminPhone}`)
            break
          }
        }
      }

      // METHOD 3: Check if user is group creator/owner
      if (!isAdmin && detailData.owner && userPhoneNumber) {
        const ownerPhone = detailData.owner.id || detailData.owner.phone || detailData.owner
        if (ownerPhone && isPhoneMatch(userPhoneNumber, ownerPhone)) {
          isAdmin = true
          console.log(`👑 ✅ User is owner of "${groupName}"`)
        }
      }

      // Get participant count from various possible fields
      if (!participantsCount) {
        participantsCount = detailData.participants_count || 
                          detailData.size || 
                          detailData.participant_count ||
                          (detailData.participants ? detailData.participants.length : 0)
      }

    } else {
      // Fallback to basic group data
      console.log(`⚠️ Using fallback data for "${groupName}"`)
      participantsCount = group.participants_count || group.size || 0
      
      // Check if basic group data has admin info
      if (group.admins && Array.isArray(group.admins) && userPhoneNumber) {
        for (const admin of group.admins) {
          const adminPhone = admin.id || admin.phone || admin
          if (adminPhone && isPhoneMatch(userPhoneNumber, adminPhone)) {
            isAdmin = true
            console.log(`👑 ✅ Found user as admin in "${groupName}" (fallback)`)
            break
          }
        }
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))

  } catch (error) {
    console.error(`❌ Error processing group ${group.id}:`, error)
    participantsCount = group.participants_count || group.size || 0
  }

  if (isAdmin) {
    adminCount++
  }
  
  totalMembersCount += participantsCount

  // Add to groups list - THIS SHOULD ONLY APPEAR ONCE HERE
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
} // <- CLOSING BRACE FOR THE FOR LOOP

// Enhanced logging - MOVE THIS HERE, AFTER THE LOOP
console.log(`📊 Final results: ${adminCount} admin groups, ${groupsToInsert.length - adminCount} member groups, ${totalMembersCount} total members`)

const adminGroups = groupsToInsert.filter(g => g.is_admin)
const memberGroups = groupsToInsert.filter(g => !g.is_admin)

console.log('👑 Admin groups:', adminGroups.map(g => `${g.name} (${g.participants_count} members)`))
console.log('👤 Member groups:', memberGroups.map(g => `${g.name} (${g.participants_count} members)`))

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
