
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    console.log('🧹 Starting cleanup of orphaned channels...')
    
    if (!whapiPartnerToken) {
      console.error('❌ Missing WHAPI partner token')
      return new Response(
        JSON.stringify({ error: 'WHAPI partner token not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find channels that are older than 24 hours and still unauthorized
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: orphanedProfiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, instance_id, whapi_token, instance_status, updated_at')
      .not('instance_id', 'is', null)
      .not('whapi_token', 'is', null)
      .in('instance_status', ['unauthorized', 'created'])
      .lt('updated_at', twentyFourHoursAgo)

    if (fetchError) {
      console.error('❌ Error fetching orphaned profiles:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orphaned profiles' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(`🔍 Found ${orphanedProfiles?.length || 0} orphaned channels to cleanup`)

    let cleanedUp = 0
    let errors = 0

    if (orphanedProfiles && orphanedProfiles.length > 0) {
      for (const profile of orphanedProfiles) {
        try {
          console.log(`🗑️ Cleaning up channel ${profile.instance_id} for user ${profile.id}`)
          
          // Delete from WHAPI
          const deleteResponse = await fetch(`https://manager.whapi.cloud/channels/${profile.instance_id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${whapiPartnerToken}`
            }
          })
          
          if (deleteResponse.ok || deleteResponse.status === 404) {
            console.log(`✅ Successfully deleted channel ${profile.instance_id} from WHAPI`)
            
            // Clear from database
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                instance_id: null,
                whapi_token: null,
                instance_status: 'disconnected',
                updated_at: new Date().toISOString()
              })
              .eq('id', profile.id)
            
            if (updateError) {
              console.error(`❌ Error updating profile ${profile.id}:`, updateError)
              errors++
            } else {
              console.log(`✅ Successfully cleared profile ${profile.id}`)
              cleanedUp++
            }
          } else {
            console.error(`❌ Failed to delete channel ${profile.instance_id} from WHAPI:`, deleteResponse.status)
            errors++
          }
        } catch (error) {
          console.error(`❌ Error cleaning up profile ${profile.id}:`, error)
          errors++
        }
      }
    }

    console.log(`🧹 Cleanup completed: ${cleanedUp} cleaned up, ${errors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        cleaned_up: cleanedUp,
        errors: errors,
        total_found: orphanedProfiles?.length || 0
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Cleanup Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
