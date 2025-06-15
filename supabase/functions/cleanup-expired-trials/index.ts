
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Cleanup job started at:', new Date().toISOString())

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find expired trial users with active channels
    const { data: expiredUsers, error: fetchError } = await supabase
      .from('profiles')
      .select('id, whapi_channel_id, trial_expires_at')
      .eq('billing_status', 'trial')
      .not('whapi_channel_id', 'is', null)
      .lt('trial_expires_at', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching expired users:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch expired users' }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('No expired trial users found')
      return new Response(
        JSON.stringify({ message: 'No expired users to cleanup', processed: 0 }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log(`Found ${expiredUsers.length} expired trial users to cleanup`)

    let processed = 0
    let errors = 0

    // Process each expired user
    for (const user of expiredUsers) {
      try {
        console.log(`Processing user ${user.id} with channel ${user.whapi_channel_id}`)

        // Delete channel from WHAPI
        const deleteResponse = await fetch(`https://gate.whapi.cloud/partner/channels/${user.whapi_channel_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text()
          console.error(`Failed to delete WHAPI channel ${user.whapi_channel_id}:`, errorText)
          errors++
          continue
        }

        // Update user profile - mark as expired and remove channel
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            billing_status: 'expired',
            whapi_channel_id: null,
            whapi_token: null,
            instance_status: 'inactive',
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (updateError) {
          console.error(`Failed to update user profile ${user.id}:`, updateError)
          errors++
          continue
        }

        console.log(`Successfully processed user ${user.id}`)
        processed++

      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error)
        errors++
      }
    }

    const result = {
      message: 'Cleanup completed',
      totalFound: expiredUsers.length,
      processed: processed,
      errors: errors,
      timestamp: new Date().toISOString()
    }

    console.log('Cleanup job completed:', result)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Cleanup job error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
