
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LifecycleRequest {
  userId?: string
  action: 'delete' | 'check_status' | 'cleanup_expired'
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

    console.log('Manage Instance Lifecycle: Starting...')

    const { userId, action }: LifecycleRequest = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    switch (action) {
      case 'delete':
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required for delete action' }),
            { status: 400, headers: corsHeaders }
          )
        }

        // Get user's instance details
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('instance_id, whapi_token')
          .eq('id', userId)
          .single()

        if (profileError || !profile?.instance_id) {
          return new Response(
            JSON.stringify({ error: 'No instance found for user' }),
            { status: 404, headers: corsHeaders }
          )
        }

        // Delete instance via WHAPI Partner API
        const deleteResponse = await fetch(`https://partner-api.whapi.cloud/api/v1/channels/${profile.instance_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })

        if (!deleteResponse.ok) {
          console.error('Failed to delete WHAPI instance:', await deleteResponse.text())
        }

        // Clear instance data from user profile
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            payment_plan: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        return new Response(
          JSON.stringify({ success: true, message: 'Instance deleted successfully' }),
          { status: 200, headers: corsHeaders }
        )

      case 'check_status':
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required for status check' }),
            { status: 400, headers: corsHeaders }
          )
        }

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('instance_id, whapi_token, instance_status, payment_plan, trial_expires_at')
          .eq('id', userId)
          .single()

        if (!userProfile?.instance_id) {
          return new Response(
            JSON.stringify({ 
              status: 'disconnected',
              message: 'No instance found'
            }),
            { status: 200, headers: corsHeaders }
          )
        }

        // Check if trial has expired
        const now = new Date()
        const trialExpired = userProfile.trial_expires_at && new Date(userProfile.trial_expires_at) < now

        if (trialExpired && userProfile.payment_plan === 'trial') {
          return new Response(
            JSON.stringify({ 
              status: 'expired',
              message: 'Trial has expired'
            }),
            { status: 200, headers: corsHeaders }
          )
        }

        return new Response(
          JSON.stringify({ 
            status: userProfile.instance_status,
            payment_plan: userProfile.payment_plan,
            trial_expires_at: userProfile.trial_expires_at,
            instance_id: userProfile.instance_id
          }),
          { status: 200, headers: corsHeaders }
        )

      case 'cleanup_expired':
        console.log('Starting cleanup of expired trials...')

        // Find all expired trial users
        const { data: expiredUsers, error: expiredError } = await supabase
          .from('profiles')
          .select('id, instance_id, whapi_token')
          .eq('payment_plan', 'trial')
          .lt('trial_expires_at', new Date().toISOString())
          .not('instance_id', 'is', null)

        if (expiredError) {
          console.error('Failed to fetch expired users:', expiredError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch expired users' }),
            { status: 500, headers: corsHeaders }
          )
        }

        console.log(`Found ${expiredUsers?.length || 0} expired trial users`)

        let cleanedCount = 0
        for (const user of expiredUsers || []) {
          try {
            // Delete instance via WHAPI Partner API
            const deleteResponse = await fetch(`https://partner-api.whapi.cloud/api/v1/channels/${user.instance_id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${whapiPartnerToken}`
              }
            })

            if (!deleteResponse.ok) {
              console.error(`Failed to delete WHAPI instance for user ${user.id}:`, await deleteResponse.text())
            }

            // Update user profile
            await supabase
              .from('profiles')
              .update({
                instance_id: null,
                whapi_token: null,
                instance_status: 'disconnected',
                payment_plan: 'expired',
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id)

            cleanedCount++
            console.log(`Cleaned up expired trial for user ${user.id}`)

          } catch (error) {
            console.error(`Error cleaning up user ${user.id}:`, error)
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            cleaned_count: cleanedCount,
            message: `Cleaned up ${cleanedCount} expired trials`
          }),
          { status: 200, headers: corsHeaders }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: corsHeaders }
        )
    }

  } catch (error) {
    console.error('Manage Instance Lifecycle Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
