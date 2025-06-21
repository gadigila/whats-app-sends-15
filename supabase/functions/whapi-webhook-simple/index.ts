
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

    // Handle different event types
    switch (eventType) {
      case 'ready':
        console.log('🎉 WhatsApp connected successfully!')
        console.log('📱 Phone number:', eventData.phone)
        console.log('📊 Device info:', eventData.device)
        
        // Find users with matching tokens and update to connected
        const phoneNumber = eventData.phone
        const deviceInfo = eventData.device
        
        // Update users who are waiting for connection
        const { data: waitingProfiles, error: findError } = await supabase
          .from('profiles')
          .select('id, instance_id, whapi_token')
          .in('instance_status', ['unauthorized', 'initializing', 'qr', 'active'])

        if (findError) {
          console.error('❌ Error finding waiting profiles:', findError)
        } else if (waitingProfiles && waitingProfiles.length > 0) {
          console.log(`📊 Found ${waitingProfiles.length} profiles waiting for connection`)
          
          // Check which token this event belongs to by trying health check
          // (Since webhook doesn't include token info)
          for (const profile of waitingProfiles) {
            try {
              const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${profile.whapi_token}`,
                  'Content-Type': 'application/json'
                }
              })
              
              if (healthResponse.ok) {
                const healthData = await healthResponse.json()
                if (healthData.status === 'connected' && healthData.me?.phone === phoneNumber) {
                  console.log(`✅ Updating profile ${profile.id} to connected`)
                  
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                      instance_status: 'connected',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', profile.id)

                  if (updateError) {
                    console.error('❌ Error updating profile:', updateError)
                  } else {
                    console.log('✅ Profile updated to connected status')
                    break // Found the right profile, stop checking others
                  }
                }
              }
            } catch (error) {
              console.log(`⚠️ Error checking profile ${profile.id}:`, error.message)
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
        
        break

      case 'auth_failure':
        console.log('❌ WhatsApp authentication failed')
        console.log('🔍 Reason:', eventData.reason || eventData.error || 'Unknown')
        
        // Update status to reflect auth failure - but don't auto-cleanup tokens
        // Let users manually retry or create new channel
        const { data: authFailProfiles, error: authFailError } = await supabase
          .from('profiles')
          .select('id')
          .in('instance_status', ['initializing', 'qr', 'active'])

        if (authFailError) {
          console.error('❌ Error finding auth fail profiles:', authFailError)
        } else if (authFailProfiles && authFailProfiles.length > 0) {
          const { error: failUpdateError } = await supabase
            .from('profiles')
            .update({
              instance_status: 'unauthorized',
              updated_at: new Date().toISOString()
            })
            .in('id', authFailProfiles.map(p => p.id))

          if (failUpdateError) {
            console.error('❌ Error updating auth failure status:', failUpdateError)
          } else {
            console.log('✅ Updated profiles after auth failure')
          }
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

    // Always return 200 OK to WHAPI within 30 seconds
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
