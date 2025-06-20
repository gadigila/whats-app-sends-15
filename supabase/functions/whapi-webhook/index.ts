
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
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

    // IMPROVED: Better webhook data parsing
    const { event, data, type } = webhookData
    const webhookType = event || type

    console.log('🔍 Webhook details:', {
      event: event,
      type: type,
      webhookType: webhookType,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      fullPayload: webhookData
    })

    if (webhookType === 'channel' && data?.status) {
      console.log('📢 Channel status update:', {
        event: webhookType,
        status: data.status,
        channelId: data.id,
        timestamp: new Date().toISOString()
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
            incomingStatus: data.status
          })

          // IMPROVED: Map WHAPI status to our internal status
          let newStatus = data.status
          
          // FIXED: Better status mapping
          if (data.status === 'unauthorized' || data.status === 'qr' || data.status === 'active') {
            newStatus = 'unauthorized'
            console.log('🎯 Channel is now ready for QR generation!')
          } else if (data.status === 'ready' || data.status === 'launched') {
            newStatus = 'unauthorized'
            console.log('📱 Channel is ready for authentication')
          } else if (data.status === 'authenticated' || data.status === 'connected') {
            newStatus = 'connected'
            console.log('🎉 WhatsApp session is now connected!')
          } else if (data.status === 'initializing') {
            // Don't change status if it's initializing, wait for next update
            console.log('⏳ Channel is still initializing...')
            return new Response(
              JSON.stringify({ success: true, message: 'Channel initializing' }),
              { status: 200, headers: corsHeaders }
            )
          } else {
            console.log('📝 Mapping unknown status to unauthorized:', data.status)
            newStatus = 'unauthorized'
          }

          // Only update if status actually changed
          if (newStatus !== profile.instance_status) {
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
                oldStatus: profile.instance_status,
                newStatus: newStatus,
                webhookStatus: data.status
              })
            }
          } else {
            console.log('ℹ️ Status unchanged, no update needed')
          }
        } else {
          console.log('⚠️ No profile found for channel ID:', data.id)
        }
      }
    } else if (webhookType === 'users' && data?.status) {
      console.log('👥 User status update:', {
        event: webhookType,
        status: data.status,
        phone: data.phone
      })

      // Handle user authentication status updates
      if (data.status === 'authenticated' && data.phone) {
        console.log('🔐 User authenticated:', data.phone)
        
        // Try to find profile by phone or update all instances to connected
        // For now, we'll just log this as we may need additional mapping
      }
    } else {
      console.log('📝 Received webhook event:', webhookType, 'with data:', data)
      console.log('🔍 Full webhook payload for debugging:', webhookData)
    }

    // Always return success to WHAPI
    return new Response(
      JSON.stringify({ success: true, received: true }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    console.error('💥 Request details:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    })
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
