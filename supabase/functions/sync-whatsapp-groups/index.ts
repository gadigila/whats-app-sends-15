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
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Sync WhatsApp Groups: Starting...')

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
      console.error('No WHAPI token found for user:', userId)
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

    console.log('Fetching groups from WHAPI for instance:', profile.instance_id)

    // STEP 1: Get user's phone number first
    const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    let userPhoneNumber = null
    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      userPhoneNumber = profileData.phone || profileData.id
      console.log('🔍 User phone number:', userPhoneNumber)
    }

    // STEP 2: Fetch groups from WHAPI
    const groupsResponse = await fetch(`https://gate.whapi.cloud/groups`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    if (!groupsResponse.ok) {
      const errorText = await groupsResponse.text()
      console.error('Failed to fetch groups from WHAPI:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch WhatsApp groups', details: errorText }),
        { status: 400, headers: corsHeaders }
      )
    }

    const groupsData = await groupsResponse.json()
    const groups = groupsData.groups || []

    console.log(`Found ${groups.length} groups to sync`)

    // STEP 3: Process groups and determine admin status correctly
    const groupsToInsert = groups.map((group: any) => {
      // 🔍 Check if user is admin by looking in participants array
      let isAdmin = false
      
      if (group.participants && Array.isArray(group.participants) && userPhoneNumber) {
        const userParticipant = group.participants.find((p: any) => 
          p.id === userPhoneNumber || p.id === userPhoneNumber.replace(/^\+/, '')
        )
        
        if (userParticipant) {
          isAdmin = userParticipant.rank === 'admin' || userParticipant.rank === 'creator'
          console.log(`🔍 Group "${group.name}": User rank = ${userParticipant.rank}, isAdmin = ${isAdmin}`)
        } else {
          console.log(`🔍 Group "${group.name}": User not found in participants`)
        }
      } else {
        console.log(`🔍 Group "${group.name}": No participants data or no user phone`)
      }
      
      return {
        user_id: userId,
        group_id: group.id,
        name: group.name || group.subject || 'Unknown Group',
        description: group.description || null,
        participants_count: group.participants_count || group.size || (group.participants ? group.participants.length : 0),
        is_admin: isAdmin, // ✅ Now correctly determined from participants array
        avatar_url: group.avatar_url || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })

    // Count how many admin groups we found
    const adminCount = groupsToInsert.filter(g => g.is_admin).length
    console.log(`🔍 Found ${adminCount} admin groups out of ${groupsToInsert.length} total groups`)

    // Clear existing groups for this user and insert new ones
    const { error: deleteError } = await supabase
      .from('whatsapp_groups')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Failed to clear existing groups:', deleteError)
    }

    if (groupsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('whatsapp_groups')
        .insert(groupsToInsert)

      if (insertError) {
        console.error('Failed to insert groups:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to save groups to database' }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    console.log(`Successfully synced ${groupsToInsert.length} groups (${adminCount} admin groups)`)

    return new Response(
      JSON.stringify({
        success: true,
        groups_count: groupsToInsert.length,
        admin_groups_count: adminCount,
        user_phone: userPhoneNumber,
        groups: groupsToInsert,
        message: `Groups synced successfully - ${adminCount} admin groups found`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Sync WhatsApp Groups Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})