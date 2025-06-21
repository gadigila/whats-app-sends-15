
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
    console.log('📨 WHAPI Webhook - Processing Event')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const webhookData = await req.json()
    console.log('📊 Webhook received:', {
      type: webhookData.type,
      hasData: !!webhookData.data,
      timestamp: new Date().toISOString()
    })

    const eventType = webhookData.type
    const eventData = webhookData.data || {}

    // Handle different event types as per WHAPI documentation
    switch (eventType) {
      case 'ready':
        console.log('🎉 WhatsApp connected successfully!')
        console.log('📱 Phone number:', eventData.phone)
        console.log('📊 Device info:', eventData.device)
        
        // Find user by channel token or instance_id
        const phoneNumber = eventData.phone
        const deviceInfo = eventData.device
        
        // Update user profile to connected status
        const { data: profiles, error: findError } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('instance_status', 'unauthorized')
          .or('instance_status.eq.initializing')

        if (findError) {
          console.error('❌ Error finding profiles:', findError)
        } else if (profiles && profiles.length > 0) {
          // Update the most recent profile (or all matching ones)
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              instance_status: 'connected',
              updated_at: new Date().toISOString()
            })
            .in('id', profiles.map(p => p.id))

          if (updateError) {
            console.error('❌ Error updating profile status:', updateError)
          } else {
            console.log('✅ Updated profile(s) to connected status')
          }
        }
        
        break

      case 'auth_failure':
        console.log('❌ WhatsApp authentication failed')
        console.log('🔍 Reason:', eventData.reason || eventData.error || 'Unknown')
        
        // Update status to reflect auth failure
        const { error: authFailError } = await supabase
          .from('profiles')
          .update({
            instance_status: 'unauthorized',
            updated_at: new Date().toISOString()
          })
          .or('instance_status.eq.initializing,instance_status.eq.connecting')

        if (authFailError) {
          console.error('❌ Error updating auth failure status:', authFailError)
        } else {
          console.log('✅ Updated profiles after auth failure')
        }
        
        break

      case 'messages':
        console.log('💬 Message received:', {
          from: eventData.from,
          type: eventData.type || 'text',
          fromMe: eventData.from_me || false
        })
        // Message handling can be expanded here
        break

      case 'statuses':
        console.log('📊 Message status update:', {
          messageId: eventData.id,
          status: eventData.status
        })
        // Status handling can be expanded here
        break

      case 'groups':
        console.log('👥 Group event:', {
          groupId: eventData.id,
          action: eventData.action
        })
        // Group handling can be expanded here
        break

      case 'chats':
        console.log('💬 Chat event:', {
          chatId: eventData.id,
          action: eventData.action
        })
        // Chat handling can be expanded here
        break

      case 'contacts':
        console.log('📞 Contact event:', {
          contactId: eventData.id,
          action: eventData.action
        })
        // Contact handling can be expanded here
        break

      default:
        console.log(`⚠️ Unknown webhook event: ${eventType}`)
        console.log('📊 Event data:', JSON.stringify(eventData, null, 2))
        break
    }

    // Always return 200 OK to WHAPI within 30 seconds (as per documentation)
    return new Response(
      JSON.stringify({ 
        received: true, 
        processed: eventType,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    
    // Still return 200 to avoid WHAPI retries for malformed data
    return new Response(
      JSON.stringify({ 
        received: true, 
        error: 'Processing failed',
        details: error.message 
      }),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    )
  }
})
