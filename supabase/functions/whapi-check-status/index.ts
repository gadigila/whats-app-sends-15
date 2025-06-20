
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckStatusRequest {
  userId: string
}

async function checkChannelManagerStatus(channelId: string, partnerToken: string) {
  try {
    console.log(`🔍 Checking Manager API status for channel: ${channelId}`)
    
    const response = await fetch(`https://manager.whapi.cloud/channels/${channelId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${partnerToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`📊 Manager API response: ${response.status}`)
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Manager API data:`, {
        id: data.id,
        status: data.status,
        name: data.name
      })
      
      return {
        success: true,
        status: data.status,
        data: data
      }
    } else {
      const errorText = await response.text()
      console.error(`❌ Manager API error: ${response.status} - ${errorText}`)
      
      return {
        success: false,
        status: response.status,
        error: errorText
      }
    }
  } catch (error) {
    console.error(`💥 Manager API network error:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
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

    // IMPROVED: First check Manager API to see if channel exists and is ready
    if (whapiPartnerToken) {
      const managerStatus = await checkChannelManagerStatus(profile.instance_id, whapiPartnerToken)
      
      if (!managerStatus.success) {
        console.log('❌ Channel not found in Manager API, cleaning up database...')
        
        await supabase
          .from('profiles')
          .update({
            instance_status: 'not_found',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        return new Response(
          JSON.stringify({ 
            connected: false, 
            status: 'not_found',
            error: 'Channel not found in WHAPI',
            requiresQr: true
          }),
          { status: 200, headers: corsHeaders }
        )
      }
      
      // Check if channel is not ready yet
      if (managerStatus.status !== 'LAUNCHED' && managerStatus.status !== 'READY' && managerStatus.status !== 'AUTHORIZED') {
        console.log(`⏳ Channel not ready yet, status: ${managerStatus.status}`)
        
        await supabase
          .from('profiles')
          .update({
            instance_status: 'initializing',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        return new Response(
          JSON.stringify({ 
            connected: false, 
            status: 'initializing',
            channel_status: managerStatus.status,
            message: 'Channel is still initializing',
            retry_after: 10
          }),
          { status: 200, headers: corsHeaders }
        )
      }
      
      console.log(`✅ Channel is ready in Manager API: ${managerStatus.status}`)
    }

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
