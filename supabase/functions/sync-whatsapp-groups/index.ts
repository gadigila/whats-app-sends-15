import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Phone matching utility
class PhoneMatcher {
  private userPhoneVariants: string[]

  constructor(userPhone: string) {
    const cleanPhone = userPhone.replace(/[^\d]/g, '')
    
    this.userPhoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('972') ? '0' + cleanPhone.substring(3) : null,
      cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : null,
      cleanPhone.slice(-9) // Last 9 digits for Israeli mobile
    ].filter(Boolean) as string[]
    
    console.log(`📱 Phone variants for matching: ${this.userPhoneVariants.join(', ')}`)
  }

  isUserPhone(participantPhone: string): boolean {
    if (!participantPhone) return false
    
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '')
    
    // Fast exact match
    if (this.userPhoneVariants.includes(cleanParticipant)) return true
    
    // Israeli mobile number matching (last 9 digits)
    if (cleanParticipant.length >= 9) {
      const lastNine = cleanParticipant.slice(-9)
      return this.userPhoneVariants.some(variant => 
        variant.length >= 9 && variant.slice(-9) === lastNine
      )
    }
    
    return false
  }
}

// 🚀 STAGE 1: Fast Group Discovery (Basic Info Only)
async function discoverAllGroups(token: string): Promise<any[]> {
  console.log('🔍 STAGE 1: Fast group discovery (names & IDs only)...')
  
  const allGroups = new Map()
  let offset = 0
  let hasMore = true
  let apiCalls = 0
  
  while (hasMore && apiCalls < 10) { // Max 10 calls for discovery
    apiCalls++
    console.log(`📊 Discovery call ${apiCalls}: offset ${offset}`)
    
    if (apiCalls > 1) {
      await delay(2000) // 2 second delay between calls
    }
    
    try {
      const response = await fetch(
        `https://gate.whapi.cloud/groups?count=200&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error(`❌ Discovery API failed: ${response.status}`)
        if (response.status === 429) {
          console.log('🔄 Rate limited during discovery, waiting 5 seconds...')
          await delay(5000)
          continue
        }
        break
      }

      const data = await response.json()
      const groups = data.groups || []
      
      console.log(`📊 Discovery: Found ${groups.length} groups`)
      
      // Store basic group info
      groups.forEach(group => {
        if (group.id) {
          allGroups.set(group.id, {
            id: group.id,
            name: group.name || group.subject || `Group ${group.id}`,
            description: group.description || null,
            avatar_url: group.chat_pic || null
          })
        }
      })
      
      // Check if we should continue
      if (groups.length === 0) {
        console.log('📊 No more groups found in discovery')
        hasMore = false
      } else if (groups.length < 200) {
        console.log('📊 Last batch of groups discovered')
        hasMore = false
      } else {
        offset += 200
      }
      
    } catch (error) {
      console.error(`❌ Discovery error:`, error.message)
      await delay(3000)
      continue
    }
  }
  
  const discoveredGroups = Array.from(allGroups.values())
  console.log(`🎯 STAGE 1 COMPLETE: Discovered ${discoveredGroups.length} groups in ${apiCalls} API calls`)
  
  return discoveredGroups
}

// 🔍 STAGE 2: Individual Admin Verification
async function verifyAdminStatus(
  groups: any[], 
  token: string, 
  userPhone: string, 
  userId: string
): Promise<any[]> {
  console.log(`🔍 STAGE 2: Verifying admin status for ${groups.length} groups...`)
  
  const phoneMatcher = new PhoneMatcher(userPhone)
  const adminGroups = []
  let processed = 0
  let adminFound = 0
  let creatorFound = 0
  let errors = 0
  
  for (const basicGroup of groups) {
    processed++
    console.log(`🔍 Checking ${processed}/${groups.length}: ${basicGroup.name}`)
    
    // Conservative 2-second delay between each check
    if (processed > 1) {
      await delay(2000)
    }
    
    try {
      // Get detailed group info with participants
      const response = await fetch(
        `https://gate.whapi.cloud/groups/${basicGroup.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.log(`⚠️ Failed to check ${basicGroup.name}: ${response.status}`)
        errors++
        
        if (response.status === 429) {
          console.log('🔄 Rate limited, waiting 5 seconds...')
          await delay(5000)
          processed-- // Retry this group
          continue
        }
        
        continue // Skip this group
      }

      const groupDetails = await response.json()
      
      // Check if we have participants data
      if (!groupDetails.participants || !Array.isArray(groupDetails.participants)) {
        console.log(`⚠️ ${basicGroup.name}: No participants data`)
        continue
      }

      // Find user in participants
      const userParticipant = groupDetails.participants.find(participant => {
        const participantId = participant.id || participant.phone || participant.number
        return phoneMatcher.isUserPhone(participantId)
      })

      if (!userParticipant) {
        console.log(`👤 ${basicGroup.name}: User not found (not a member)`)
        continue
      }

      // Check user role
      const participantRank = (userParticipant.rank || userParticipant.role || 'member').toLowerCase()
      const isCreator = participantRank === 'creator' || participantRank === 'owner'
      const isAdmin = participantRank === 'admin' || participantRank === 'administrator' || isCreator

      if (!isAdmin) {
        console.log(`👤 ${basicGroup.name}: User is only member (${participantRank})`)
        continue
      }

      // Found admin/creator group!
      if (isCreator) {
        creatorFound++
        console.log(`👑 ${basicGroup.name}: CREATOR ✅ (${groupDetails.participants.length} members)`)
      } else {
        adminFound++
        console.log(`⭐ ${basicGroup.name}: ADMIN ✅ (${groupDetails.participants.length} members)`)
      }

      // Add to admin groups
      adminGroups.push({
        user_id: userId,
        group_id: basicGroup.id,
        name: basicGroup.name,
        description: basicGroup.description,
        participants_count: groupDetails.participants.length,
        is_admin: true,
        is_creator: isCreator,
        avatar_url: basicGroup.avatar_url,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    } catch (error) {
      console.error(`❌ Error checking ${basicGroup.name}:`, error.message)
      errors++
      
      // Add delay after errors
      await delay(3000)
      continue
    }
  }
  
  console.log(`🎯 STAGE 2 COMPLETE:`)
  console.log(`📊 Groups processed: ${processed}`)
  console.log(`👑 Creator groups: ${creatorFound}`)
  console.log(`⭐ Admin groups: ${adminFound}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`🔑 Total admin groups: ${adminGroups.length}`)
  
  return adminGroups
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 TWO-STAGE GROUP SYNC: Conservative & Reliable')
    
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

    const syncStartTime = Date.now()

    // Get user profile and validate
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_status, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get phone number if not stored
    let userPhone = profile.phone_number
    if (!userPhone) {
      console.log('📱 Fetching phone from /health...')
      
      const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        userPhone = healthData?.user?.id?.replace(/[^\d]/g, '')
        
        if (userPhone) {
          await supabase
            .from('profiles')
            .update({ phone_number: userPhone })
            .eq('id', userId)
        }
      }
    }

    if (!userPhone) {
      return new Response(
        JSON.stringify({ error: 'Could not determine phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`👤 Starting sync for user: ${userPhone}`)

    // 🚀 STAGE 1: Discover all groups (fast)
    const allGroups = await discoverAllGroups(profile.whapi_token)
    
    if (allGroups.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          groups_count: 0,
          message: 'לא נמצאו קבוצות',
          total_groups_scanned: 0,
          sync_time_seconds: Math.round((Date.now() - syncStartTime) / 1000)
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // 🔍 STAGE 2: Verify admin status (thorough)
    const adminGroups = await verifyAdminStatus(
      allGroups, 
      profile.whapi_token, 
      userPhone, 
      userId
    )

    const totalSyncTime = Math.round((Date.now() - syncStartTime) / 1000)

    console.log(`\n🎯 TWO-STAGE SYNC COMPLETED!`)
    console.log(`📊 Total groups discovered: ${allGroups.length}`)
    console.log(`🔑 Admin groups verified: ${adminGroups.length}`)
    console.log(`⚡ Total sync time: ${totalSyncTime} seconds`)

    // 🛡️ SAFETY: Only clear existing groups if we found some admin groups
    // OR if this is the first sync (no existing groups)
    const { data: existingGroups } = await supabase
      .from('whatsapp_groups')
      .select('id')
      .eq('user_id', userId)

    if (adminGroups.length === 0 && existingGroups && existingGroups.length > 0) {
      console.log('⚠️ Found 0 admin groups but user has existing groups - preserving data')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No admin groups found in comprehensive scan',
          existing_groups_count: existingGroups.length,
          total_groups_scanned: allGroups.length,
          recommendation: 'This might indicate a temporary API issue. Your existing groups are preserved.',
          sync_time_seconds: totalSyncTime
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 🔄 UPDATE DATABASE
    console.log('💾 Updating database...')
    
    // Clear existing groups
    await supabase
      .from('whatsapp_groups')
      .delete()
      .eq('user_id', userId)
    
    // Insert new groups
    if (adminGroups.length > 0) {
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(adminGroups)

      if (insertError) {
        console.error('❌ Database insert error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to save groups', details: insertError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    // Calculate summary stats
    const adminCount = adminGroups.filter(g => !g.is_creator).length
    const creatorCount = adminGroups.filter(g => g.is_creator).length
    const totalMembers = adminGroups.reduce((sum, g) => sum + (g.participants_count || 0), 0)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: adminGroups.length,
        admin_groups_count: adminCount,
        creator_groups_count: creatorCount,
        total_members_in_managed_groups: totalMembers,
        total_groups_scanned: allGroups.length,
        sync_time_seconds: totalSyncTime,
        message: adminGroups.length > 0 
          ? `נמצאו ${adminGroups.length} קבוצות בניהולך! (${creatorCount} כיוצר, ${adminCount} כמנהל)`
          : 'לא נמצאו קבוצות בניהולך',
        sync_method: 'Two-Stage Conservative',
        stage_1_groups_discovered: allGroups.length,
        stage_2_admin_groups_verified: adminGroups.length
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Two-Stage Sync Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})