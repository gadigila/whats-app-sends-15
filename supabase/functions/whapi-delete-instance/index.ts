
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteInstanceRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    console.log('🗑️ WHAPI Instance Deletion: Starting...')
    
    if (!whapiPartnerToken) {
      console.error('❌ Missing WHAPI partner token')
      return new Response(
        JSON.stringify({ error: 'WHAPI partner token not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: DeleteInstanceRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's current instance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const instanceId = profile?.instance_id

    // Delete from WHAPI if instance exists
    if (instanceId) {
      console.log('🗑️ Deleting channel from WHAPI:', instanceId)
      
      try {
        const deleteResponse = await fetch(`https://manager.whapi.cloud/channels/${instanceId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })

        if (deleteResponse.ok) {
          console.log('✅ Channel deleted from WHAPI successfully')
        } else {
          const errorText = await deleteResponse.text()
          console.log('⚠️ WHAPI deletion failed (continuing with DB cleanup):', {
            status: deleteResponse.status,
            error: errorText
          })
        }
      } catch (deleteError) {
        console.error('❌ Error deleting from WHAPI (continuing with DB cleanup):', deleteError)
      }

      // Also clean up any other channels for this user
      try {
        console.log('🧹 Cleaning up all user channels from WHAPI...')
        const channelsResponse = await fetch('https://manager.whapi.cloud/channels', {
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })

        if (channelsResponse.ok) {
          const channels = await channelsResponse.json()
          const userChannels = channels.filter((channel: any) => 
            channel.name && channel.name.includes(`reecher_user_${userId}`)
          )
          
          console.log(`🔍 Found ${userChannels.length} channels to clean up`)
          
          for (const channel of userChannels) {
            try {
              console.log(`🗑️ Deleting channel: ${channel.id}`)
              await fetch(`https://manager.whapi.cloud/channels/${channel.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${whapiPartnerToken}`
                }
              })
            } catch (cleanupError) {
              console.error(`❌ Failed to delete channel ${channel.id}:`, cleanupError)
            }
          }
        }
      } catch (cleanupError) {
        console.error('❌ Error during WHAPI cleanup:', cleanupError)
      }
    }

    // Clear database
    console.log('💾 Clearing database records...')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: null,
        whapi_token: null,
        instance_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to clear database', details: updateError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ Instance deletion completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Instance deleted successfully'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Instance Deletion Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
