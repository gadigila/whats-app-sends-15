import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

// Enhanced phone number normalization
function normalizePhoneNumber(phone: string): string[] {
  if (!phone) return []
  
  const basePhone = phone.replace(/[^\d+]/g, '') // Remove all non-digit chars except +
  const digitsOnly = basePhone.replace(/^\+/, '') // Remove + if present
  
  const variations = [
    phone,                           // Original format
    basePhone,                       // Cleaned format
    '+' + digitsOnly,               // With + prefix
    digitsOnly,                     // Digits only
    digitsOnly.slice(-10),          // Last 10 digits (US format)
    digitsOnly.slice(-11),          // Last 11 digits (with country code)
    digitsOnly.slice(-12),          // Last 12 digits (some international)
  ]
  
  // Add country code variations if missing
  if (!digitsOnly.startsWith('1') && !digitsOnly.startsWith('972')) {
    variations.push('1' + digitsOnly)    // US prefix
    variations.push('972' + digitsOnly)  // Israel prefix
  }
  
  // Remove duplicates and empty strings
  return [...new Set(variations.filter(v => v.length > 0))]
}

// Enhanced admin detection with multiple strategies
async function detectAdminStatus(groupId: string, userPhoneVariations: string[], whapiToken: string): Promise<{
  isAdmin: boolean
  participants: number
  adminReason?: string
}> {
  try {
    console.log(`🔍 Checking admin status for group ${groupId}`)
    
    // Strategy 1: Direct group info with participants
    const detailResponse = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, {
      headers: {
        'Authorization': `Bearer ${whapiToken}`
      }
    })

    if (detailResponse.ok) {
      const detailData = await detailResponse.json()
      
      if (detailData.participants && Array.isArray(detailData.participants)) {
        console.log(`👥 Found ${detailData.participants.length} participants in group ${groupId}`)
        
        // Check each participant against all phone variations
        for (const participant of detailData.participants) {
          for (const phoneVariation of userPhoneVariations) {
            if (participant.id === phoneVariation || 
                participant.id?.includes(phoneVariation) || 
                phoneVariation.includes(participant.id)) {
              
              const rank = participant.rank?.toLowerCase()
              const isAdmin = rank === 'admin' || rank === 'creator' || rank === 'superadmin'
              
              console.log(`👤 User found in group: id=${participant.id}, rank=${rank}, isAdmin=${isAdmin}`)
              
              return {
                isAdmin,
                participants: detailData.participants.length,
                adminReason: `Direct match: ${participant.id} has rank ${rank}`
              }
            }
          }
        }
        
        return {
          isAdmin: false,
          participants: detailData.participants.length,
          adminReason: 'User found but not admin'
        }
      }
    }

    // Strategy 2: Try participants endpoint separately
    console.log(`🔄 Trying separate participants endpoint for group ${groupId}`)
    
    const participantsResponse = await fetch(`https://gate.whapi.cloud/groups/${groupId}/participants`, {
      headers: {
        'Authorization': `Bearer ${whapiToken}`
      }
    })

    if (participantsResponse.ok) {
      const participantsData = await participantsResponse.json()
      const participants = participantsData.participants || participantsData
      
      if (Array.isArray(participants)) {
        console.log(`👥 Found ${participants.length} participants via separate endpoint`)
        
        for (const participant of participants) {
          for (const phoneVariation of userPhoneVariations) {
            if (participant.id === phoneVariation || 
                participant.id?.includes(phoneVariation) || 
                phoneVariation.includes(participant.id)) {
              
              const rank = participant.rank?.toLowerCase()
              const isAdmin = rank === 'admin' || rank === 'creator' || rank === 'superadmin'
              
              console.log(`👤 User found via participants endpoint: id=${participant.id}, rank=${rank}`)
              
              return {
                isAdmin,
                participants: participants.length,
                adminReason: `Participants endpoint: ${participant.id} has rank ${rank}`
              }
            }
          }
        }
        
        return {
          isAdmin: false,
          participants: participants.length,
          adminReason: 'User found via participants endpoint but not admin'
        }
      }
    }

    // Strategy 3: Check if user can perform admin actions (test permission)
    console.log(`🧪 Testing admin permissions for group ${groupId}`)
    
    // Try to get group settings (admin-only action)
    const settingsResponse = await fetch(`https://gate.whapi.cloud/groups/${groupId}/settings`, {
      headers: {
        'Authorization': `Bearer ${whapiToken}`
      }
    })

    if (settingsResponse.ok) {
      console.log(`✅ User can access group settings - likely admin`)
      return {
        isAdmin: true,
        participants: 0, // Unknown
        adminReason: 'Can access group settings (admin permission test)'
      }
    }

    // If all strategies fail
    console.log(`⚠️ Could not determine admin status for group ${groupId}`)
    return {
      isAdmin: false,
      participants: 0,
      adminReason: 'Could not determine admin status'
    }

  } catch (error) {
    console.error(`❌ Error checking admin status for group ${groupId}:`, error)
    return {
      isAdmin: false,
      participants: 0,
      adminReason: `Error: ${error.message}`
    }
  }
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

    console.log('🚀 Enhanced WhatsApp Groups Sync: Starting comprehensive admin detection...')

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

    console.log('📱 Fetching enhanced user profile information...')

    // STEP 1: Get user's phone number with enhanced detection
    const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    let userPhoneVariations: string[] = []
    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      const userPhone = profileData.phone || profileData.id || profileData.wid
      
      if (userPhone) {
        userPhoneVariations = normalizePhoneNumber(userPhone)
        console.log('📞 Enhanced user phone variations:', userPhoneVariations)
      } else {
        console.error('❌ Could not extract phone number from profile:', profileData)
      }
    } else {
      console.error('❌ Failed to get user profile:', profileResponse.status)
      const errorText = await profileResponse.text()
      console.error('❌ Profile error details:', errorText)
    }

    // STEP 2: Get basic groups list
    console.log('📋 Fetching groups list...')
    
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

    console.log(`📊 Found ${basicGroups.length} groups. Starting enhanced admin detection...`)

    // STEP 3: Enhanced admin detection for each group
    const groupsToInsert = []
    let adminCount = 0
    let processedCount = 0
    const adminDetectionResults: any[] = []

    for (const basicGroup of basicGroups) {
      try {
        processedCount++
        console.log(`🔍 Processing group ${processedCount}/${basicGroups.length}: ${basicGroup.name || basicGroup.subject}`)
        
        // Enhanced admin detection
        const adminResult = await detectAdminStatus(
          basicGroup.id, 
          userPhoneVariations, 
          profile.whapi_token
        )

        const isAdmin = adminResult.isAdmin
        if (isAdmin) {
          adminCount++
          console.log(`👑 User is admin in: "${basicGroup.name || basicGroup.subject}" - ${adminResult.adminReason}`)
        }

        // Store detection result for debugging
        adminDetectionResults.push({
          groupId: basicGroup.id,
          groupName: basicGroup.name || basicGroup.subject,
          isAdmin,
          reason: adminResult.adminReason,
          participants: adminResult.participants
        })

        // Add to groups list
        groupsToInsert.push({
          user_id: userId,
          group_id: basicGroup.id,
          name: basicGroup.name || basicGroup.subject || 'Unknown Group',
          description: basicGroup.description || null,
          participants_count: adminResult.participants || basicGroup.participants_count || basicGroup.size || 0,
          is_admin: isAdmin,
          avatar_url: basicGroup.avatar_url || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        // Rate limiting protection
        await new Promise(resolve => setTimeout(resolve, 150))

      } catch (error) {
        console.error(`❌ Error processing group ${basicGroup.id}:`, error)
        
        // Add group with basic info even if admin detection failed
        groupsToInsert.push({
          user_id: userId,
          group_id: basicGroup.id,
          name: basicGroup.name || basicGroup.subject || 'Unknown Group',
          description: basicGroup.description || null,
          participants_count: basicGroup.participants_count || basicGroup.size || 0,
          is_admin: false, // Default to false if detection fails
          avatar_url: basicGroup.avatar_url || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }

    console.log(`📊 Enhanced processing complete: ${adminCount} admin groups found out of ${groupsToInsert.length} total`)

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

    console.log(`✅ Enhanced sync complete: ${groupsToInsert.length} groups synced (${adminCount} admin groups)`)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        user_phone_variations: userPhoneVariations,
        processed_groups: processedCount,
        admin_detection_results: adminDetectionResults,
        admin_groups: groupsToInsert.filter(g => g.is_admin).map(g => ({
          name: g.name,
          group_id: g.group_id,
          participants_count: g.participants_count
        })),
        message: `Enhanced sync successful - ${adminCount} admin groups detected out of ${groupsToInsert.length} total groups`,
        enhanced_features: [
          'Multiple phone number format detection',
          'Fallback participant endpoint queries', 
          'Admin permission testing',
          'Comprehensive error handling'
        ]
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