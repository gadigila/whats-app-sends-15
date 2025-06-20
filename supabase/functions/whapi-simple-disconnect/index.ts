
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface DisconnectRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const partnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: DisconnectRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔌 Simple Disconnect for user:', userId)

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile?.instance_id) {
      // Delete channel from WhAPI
      try {
        const deleteResponse = await fetch(`https://manager.whapi.cloud/channels/${profile.instance_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${partnerToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (deleteResponse.ok) {
          console.log('✅ Channel deleted from WhAPI')
        } else {
          console.log('⚠️ Failed to delete channel from WhAPI, continuing anyway')
        }
      } catch (error) {
        console.log('⚠️ Error deleting channel from WhAPI:', error)
      }
    }

    // Clear user profile
    await supabase
      .from('profiles')
      .update({
        instance_id: null,
        whapi_token: null,
        instance_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    console.log('✅ Simple disconnect complete')
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Disconnected successfully'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Simple Disconnect Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Disconnect failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
