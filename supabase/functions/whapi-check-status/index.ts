
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckStatusRequest {
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
    const { userId }: CheckStatusRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Checking status for user:', userId)

    // Get user channel
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.instance_id || !profile?.whapi_token) {
      console.log('❌ No channel found for user:', userId)
      return new Response(
        JSON.stringify({ connected: false, error: 'No channel found' }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('🔍 Found channel:', profile.instance_id, 'current status:', profile.instance_status)

    // FIXED: Check channel status using /me endpoint instead of /channels/{id}
    const statusResponse = await fetch(`https://gate.whapi.cloud/me`, {
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`
      }
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error('❌ Status check failed:', {
        status: statusResponse.status,
        error: errorText,
        channelId: profile.instance_id
      })

      // If it's a 404 or 401, clean up the database
      if (statusResponse.status === 404 || statusResponse.status === 401) {
        console.log('🗑️ Channel not found or unauthorized, updating database...')
        await supabase
          .from('profiles')
          .update({
            instance_status: 'unauthorized',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        return new Response(
          JSON.stringify({ 
            connected: false, 
            status: 'unauthorized',
            error: 'Channel needs QR scan',
            requiresQr: true
          }),
          { status: 200, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ connected: false, error: 'Status check failed' }),
        { status: 200, headers: corsHeaders }
      )
    }

    const statusData = await statusResponse.json()
    console.log('📊 Channel status response:', statusData)
    
    // FIXED: Check if channel is connected - /me returns user data when authenticated
    const isConnected = !!statusData.id || !!statusData.phone || !!statusData.name

    // Update status in database if connected
    if (isConnected && profile.instance_status !== 'connected') {
      console.log('✅ Updating database status to connected')
      await supabase
        .from('profiles')
        .update({
          instance_status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    } else if (!isConnected && profile.instance_status === 'connected') {
      console.log('📱 Updating database status to unauthorized (needs QR)')
      await supabase
        .from('profiles')
        .update({
          instance_status: 'unauthorized',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    console.log('✅ Status check completed. Connected:', isConnected)

    return new Response(
      JSON.stringify({
        connected: isConnected,
        status: isConnected ? 'connected' : 'unauthorized',
        phone: statusData.phone,
        name: statusData.name,
        channel_id: profile.instance_id,
        user_data: statusData
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Check Status Error:', error)
    return new Response(
      JSON.stringify({ connected: false, error: error.message }),
      { status: 200, headers: corsHeaders }
    )
  }
})
