
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const webhookData = await req.json()
    console.log('📬 Received WHAPI webhook:', JSON.stringify(webhookData, null, 2))

    // Extract relevant information from webhook
    const { event, data } = webhookData

    if (event === 'channel' && data?.status) {
      console.log('📢 Channel status update:', {
        event,
        status: data.status,
        channelId: data.id
      })

      // Find user by instance_id and update status
      if (data.id) {
        const { data: profiles, error: findError } = await supabase
          .from('profiles')
          .select('id, instance_id, instance_status')
          .eq('instance_id', data.id)

        if (findError) {
          console.error('❌ Error finding profile:', findError)
          return new Response(
            JSON.stringify({ error: 'Failed to find profile' }),
            { status: 500, headers: corsHeaders }
          )
        }

        if (profiles && profiles.length > 0) {
          const profile = profiles[0]
          console.log('👤 Found profile for channel update:', {
            userId: profile.id,
            currentStatus: profile.instance_status,
            newStatus: data.status
          })

          // Map WHAPI status to our internal status
          let newStatus = data.status
          if (data.status === 'ready') {
            newStatus = 'authorized'
          } else if (data.status === 'authenticated') {
            newStatus = 'connected'
          }

          // Update the profile status
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              instance_status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', profile.id)

          if (updateError) {
            console.error('❌ Error updating profile status:', updateError)
          } else {
            console.log('✅ Profile status updated successfully:', {
              userId: profile.id,
              newStatus
            })
          }
        } else {
          console.log('⚠️ No profile found for channel ID:', data.id)
        }
      }
    } else if (event === 'users' && data?.status) {
      console.log('👥 User status update:', {
        event,
        status: data.status,
        phone: data.phone
      })

      // Handle user authentication status updates
      // This indicates when a user has scanned QR and is connected
      if (data.status === 'authenticated' && data.phone) {
        // Find profile by phone or other identifier and update to connected
        // For now, we'll just log this as we may need additional mapping
        console.log('🔐 User authenticated:', data.phone)
      }
    }

    // Always return success to WHAPI
    return new Response(
      JSON.stringify({ success: true, received: true }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
