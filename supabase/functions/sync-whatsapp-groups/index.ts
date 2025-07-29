import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FetchGroupsRequest {
  userId: string
  refreshMemberCounts?: boolean // NEW: For refreshing member counts of selected groups
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 🚀 SUPER SIMPLE: Just get ALL groups with basic info (fast!)
async function fetchAllGroupsBasic(token: string) {
  console.log('🚀 Fetching ALL groups (basic info only)...')
  
  const allGroups = new Map()
  let offset = 0
  let hasMore = true
  let apiCalls = 0
  const maxCalls = 8 // Reasonable limit
  
  while (hasMore && apiCalls < maxCalls) {
    apiCalls++
    console.log(`📊 API call ${apiCalls}: offset ${offset}`)
    
    if (apiCalls > 1) {
      await delay(2000) // 2 second delay between calls
    }
    
    try {
      const response = await fetch(
        `https://gate.whapi.cloud/groups?count=500&offset=${offset}`, // Large batches
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error(`❌ API failed: ${response.status}`)
        if (response.status === 429) {
          console.log('🔄 Rate limited, waiting 5 seconds...')
          await delay(5000)
          continue
        }
        break
      }

      const data = await response.json()
      const groups = data.groups || []
      
      console.log(`📊 Found ${groups.length} groups`)
      
      // Store basic group info
      groups.forEach(group => {
        if (group.id) {
          allGroups.set(group.id, {
            group_id: group.id,
            name: group.name || group.subject || `Group ${group.id}`,
            description: group.description || null,
            avatar_url: group.chat_pic || group.picture || null,
            // Use any participant count that might be available
            participants_count: group.participants?.length || group.size || group.participants_count || 0,
            // Store raw data for later processing if needed
            raw_data: group
          })
        }
      })
      
      if (groups.length === 0 || groups.length < 500) {
        hasMore = false
      } else {
        offset += 500
      }
      
    } catch (error) {
      console.error(`❌ API error:`, error.message)
      await delay(3000)
      continue
    }
  }
  
  const finalGroups = Array.from(allGroups.values())
  console.log(`🎯 Fetched ${finalGroups.length} groups in ${apiCalls} API calls`)
  
  return {
    groups: finalGroups,
    totalApiCalls: apiCalls
  }
}

// 🔄 REFRESH: Get detailed info for specific groups (member counts)
async function refreshSelectedGroupsCounts(token: string, selectedGroupIds: string[]) {
  console.log(`🔄 Refreshing member counts for ${selectedGroupIds.length} selected groups...`)
  
  const refreshedGroups = []
  let apiCalls = 0
  
  for (const groupId of selectedGroupIds) {
    apiCalls++
    console.log(`📊 Refreshing ${apiCalls}/${selectedGroupIds.length}: ${groupId}`)
    
    if (apiCalls > 1) {
      await delay(1500) // 1.5 second delay between calls
    }
    
    try {
      const response = await fetch(
        `https://gate.whapi.cloud/groups/${groupId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const groupDetails = await response.json()
        
        refreshedGroups.push({
          group_id: groupId,
          name: groupDetails.name || groupDetails.subject || `Group ${groupId}`,
          description: groupDetails.description || null,
          avatar_url: groupDetails.chat_pic || groupDetails.picture || null,
          participants_count: groupDetails.participants?.length || 0,
          last_refreshed_at: new Date().toISOString()
        })
        
        console.log(`✅ ${groupDetails.name || groupId}: ${groupDetails.participants?.length || 0} members`)
      } else {
        console.log(`⚠️ Failed to refresh ${groupId}: ${response.status}`)
      }
      
    } catch (error) {
      console.error(`❌ Error refreshing ${groupId}:`, error.message)
    }
  }
  
  console.log(`🎯 Refreshed ${refreshedGroups.length}/${selectedGroupIds.length} groups`)
  
  return {
    refreshedGroups,
    totalApiCalls: apiCalls
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 SIMPLE GROUP FETCHER: All groups + user selection')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, refreshMemberCounts }: FetchGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const startTime = Date.now()

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_status')
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

    // If refreshing member counts for selected groups
    if (refreshMemberCounts) {
      console.log('🔄 REFRESH MODE: Getting member counts for selected groups')
      
      // Get user's selected groups
      const { data: selectedGroups, error: selectedError } = await supabase
        .from('user_selected_groups')
        .select('group_id')
        .eq('user_id', userId)

      if (selectedError || !selectedGroups || selectedGroups.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No selected groups found to refresh',
            suggestion: 'Please select some groups first'
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      const groupIds = selectedGroups.map(g => g.group_id)
      const refreshResult = await refreshSelectedGroupsCounts(profile.whapi_token, groupIds)
      
      // Update database with refreshed counts
      for (const refreshedGroup of refreshResult.refreshedGroups) {
        await supabase
          .from('user_selected_groups')
          .update({
            participants_count: refreshedGroup.participants_count,
            last_refreshed_at: refreshedGroup.last_refreshed_at,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('group_id', refreshedGroup.group_id)
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000)

      return new Response(
        JSON.stringify({
          success: true,
          operation: 'refresh_member_counts',
          refreshed_groups: refreshResult.refreshedGroups.length,
          total_selected: groupIds.length,
          api_calls: refreshResult.totalApiCalls,
          time_seconds: totalTime,
          message: `עודכנו ${refreshResult.refreshedGroups.length} קבוצות עם כמות החברים העדכנית`
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Default: Fetch all groups (basic info)
    console.log('📋 FETCH MODE: Getting all groups for user selection')
    
    const fetchResult = await fetchAllGroupsBasic(profile.whapi_token)
    const totalTime = Math.round((Date.now() - startTime) / 1000)

    console.log(`\n🎯 SIMPLE FETCH COMPLETED!`)
    console.log(`📊 Total groups found: ${fetchResult.groups.length}`)
    console.log(`⚡ Total time: ${totalTime} seconds`)

    // Store all groups in a temporary table for user selection
    // Clear existing all_groups data for this user
    await supabase
      .from('all_user_groups')
      .delete()
      .eq('user_id', userId)

    // Insert all found groups
    if (fetchResult.groups.length > 0) {
      const groupsToInsert = fetchResult.groups.map(group => ({
        user_id: userId,
        group_id: group.group_id,
        name: group.name,
        description: group.description,
        avatar_url: group.avatar_url,
        participants_count: group.participants_count,
        last_fetched_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }))

      // Insert in batches
      const batchSize = 100
      for (let i = 0; i < groupsToInsert.length; i += batchSize) {
        const batch = groupsToInsert.slice(i, i + batchSize)
        await supabase.from('all_user_groups').insert(batch)
      }
    }

    // Get count of already selected groups
    const { data: selectedCount } = await supabase
      .from('user_selected_groups')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    return new Response(
      JSON.stringify({
        success: true,
        operation: 'fetch_all_groups',
        total_groups_found: fetchResult.groups.length,
        api_calls: fetchResult.totalApiCalls,
        time_seconds: totalTime,
        already_selected_count: selectedCount || 0,
        message: `נמצאו ${fetchResult.groups.length} קבוצות! כעת תוכל לבחור איזה קבוצות לנהל`,
        next_step: 'show_group_selection_modal',
        groups_sample: fetchResult.groups.slice(0, 5).map(g => ({
          name: g.name,
          members: g.participants_count
        }))
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Simple Group Fetch Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})