
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncStatusRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: SyncStatusRequest = await req.json()
    console.log('🔄 Manual status sync for user:', userId)

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's instance info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (!profile.instance_id || !profile.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'No instance found for user' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📡 Checking WHAPI channel status directly...')

    // Check actual status from WHAPI
    const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error('❌ WHAPI status check failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check WHAPI status',
          details: errorText 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const whapiStatus = await statusResponse.json()
    console.log('📥 WHAPI status response:', whapiStatus)

    // Map WHAPI status to our internal status
    let newStatus = profile.instance_status
    if (whapiStatus.status === 'qr' || whapiStatus.status === 'unauthorized') {
      newStatus = 'unauthorized'
    } else if (whapiStatus.status === 'authenticated' || whapiStatus.status === 'ready') {
      newStatus = 'connected'
    } else if (whapiStatus.status === 'initializing' || whapiStatus.status === 'loading') {
      newStatus = 'initializing'
    }

    console.log('🔄 Status mapping:', {
      whapiStatus: whapiStatus.status,
      currentStatus: profile.instance_status,
      newStatus: newStatus
    })

    // Update database if status changed
    if (newStatus !== profile.instance_status) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          instance_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('❌ Failed to update status:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update status' }),
          { status: 500, headers: corsHeaders }
        )
      }

      console.log('✅ Status updated successfully:', {
        oldStatus: profile.instance_status,
        newStatus: newStatus
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        oldStatus: profile.instance_status,
        newStatus: newStatus,
        whapiStatus: whapiStatus.status,
        updated: newStatus !== profile.instance_status
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Manual status sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
