
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhapiGroup {
  id: string
  name: string
  description?: string
  participants_count?: number
  avatar?: string
  is_admin?: boolean
}

interface UserProfile {
  instance_id: string
  instance_status: string
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
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Syncing groups for user:', userId)

    // Get user's instance info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.instance_id) {
      console.error('No instance found for user:', userId)
      return new Response(
        JSON.stringify({ error: 'No WhatsApp instance configured' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const userProfile = profile as UserProfile

    if (userProfile.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Fetch groups from WHAPI
    console.log('Fetching groups from WHAPI for instance:', userProfile.instance_id)
    
    const whapiResponse = await fetch(`https://gate.whapi.cloud/instances/${userProfile.instance_id}/groups`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whapiPartnerToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!whapiResponse.ok) {
      const errorText = await whapiResponse.text()
      console.error('Failed to fetch groups from WHAPI:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups from WhatsApp' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const whapiData = await whapiResponse.json()
    const groups = whapiData.groups || []

    console.log(`Found ${groups.length} groups from WHAPI`)

    // Process and upsert groups
    const syncedGroups = []
    
    for (const group of groups as WhapiGroup[]) {
      try {
        const groupData = {
          user_id: userId,
          group_id: group.id,
          name: group.name,
          description: group.description || null,
          participants_count: group.participants_count || 0,
          is_admin: group.is_admin || false,
          avatar_url: group.avatar || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        // Upsert group (insert or update if exists)
        const { data: upsertedGroup, error: upsertError } = await supabase
          .from('whatsapp_groups')
          .upsert(groupData, {
            onConflict: 'user_id,group_id',
            ignoreDuplicates: false
          })
          .select()
          .single()

        if (upsertError) {
          console.error('Error upserting group:', group.id, upsertError)
        } else {
          syncedGroups.push(upsertedGroup)
        }
      } catch (error) {
        console.error('Error processing group:', group.id, error)
      }
    }

    // Update user's last sync time
    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', userId)

    console.log(`Successfully synced ${syncedGroups.length} groups`)

    return new Response(
      JSON.stringify({ 
        success: true,
        synced_count: syncedGroups.length,
        total_found: groups.length,
        groups: syncedGroups
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Sync groups error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
