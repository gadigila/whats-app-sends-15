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

    // Fetch groups from WHAPI
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

    // 🔍 DEBUG: Log the first few groups to see the structure
    console.log('🔍 First 3 groups structure:', JSON.stringify(groups.slice(0, 3), null, 2))

    // Store/update groups in database
    const groupsToInsert = groups.map((group: any) => {
      // 🔍 DEBUG: Check different possible admin field names
      const possibleAdminFields = {
        is_admin: group.is_admin,
        admin: group.admin,
        isAdmin: group.isAdmin,
        role: group.role,
        participant_role: group.participant_role,
        my_role: group.my_role,
        user_role: group.user_role
      }
      
      console.log(`🔍 Group "${group.name || group.subject}" admin fields:`, possibleAdminFields)
      
      // Try to determine admin status from various possible fields
      let isAdmin = false
      
      if (group.is_admin === true || group.is_admin === 'true') {
        isAdmin = true
      } else if (group.admin === true || group.admin === 'true') {
        isAdmin = true
      } else if (group.isAdmin === true || group.isAdmin === 'true') {
        isAdmin = true
      } else if (group.role === 'admin' || group.role === 'creator') {
        isAdmin = true
      } else if (group.participant_role === 'admin' || group.participant_role === 'creator') {
        isAdmin = true
      } else if (group.my_role === 'admin' || group.my_role === 'creator') {
        isAdmin = true
      } else if (group.user_role === 'admin' || group.user_role === 'creator') {
        isAdmin = true
      }
      
      console.log(`🔍 Final admin status for "${group.name || group.subject}": ${isAdmin}`)
      
      return {
        user_id: userId,
        group_id: group.id,
        name: group.name || group.subject || 'Unknown Group',
        description: group.description || null,
        participants_count: group.participants_count || group.size || 0,
        is_admin: isAdmin, // Use our calculated admin status
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