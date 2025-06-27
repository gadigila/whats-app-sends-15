import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface HardDisconnectRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔌 WHAPI Hard Disconnect - Complete WhatsApp Logout')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: HardDisconnectRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Hard disconnecting user:', userId)

    // Get user's current channel info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (!profile.whapi_token) {
      console.log('⚠️ No token found, just updating database')
      
      await supabase
        .from('profiles')
        .update({
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User disconnected (no active session found)'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log('📱 Logging out from WhatsApp via WHAPI...')

    // Step 1: Logout from WhatsApp using WHAPI
    try {
      const logoutResponse = await fetch(`https://gate.whapi.cloud/users/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('📤 Logout response status:', logoutResponse.status)

      if (logoutResponse.ok) {
        console.log('✅ Successfully logged out from WhatsApp')
      } else {
        const errorText = await logoutResponse.text()
        console.log('⚠️ Logout failed (continuing with database update):', errorText)
      }
    } catch (logoutError) {
      console.error('❌ Error calling logout endpoint:', logoutError)
    }

    // Step 2: Update database to unauthorized status
    console.log('💾 Updating database status...')
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_status: 'unauthorized', // Will need QR scan to reconnect
        updated_at: new Date().toISOString()
        // Keep instance_id and whapi_token for potential reconnection
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Database update failed:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update database', 
          details: updateError.message 
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Step 3: Clear WhatsApp groups cache
    console.log('🧹 Clearing WhatsApp groups cache...')
    
    try {
      await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId)
      
      console.log('✅ Groups cache cleared')
    } catch (groupsError) {
      console.log('⚠️ Failed to clear groups cache:', groupsError)
    }

    console.log('🎯 Hard disconnect completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully logged out from WhatsApp',
        next_steps: 'User will need to scan QR code to reconnect',
        status: 'unauthorized'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Hard Disconnect Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
